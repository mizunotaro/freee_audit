import { z } from 'zod'
import { createAppError, failure, success, type AppError, type Result } from '@/types/result'

/**
 * Outbound HTTP rate limiting + User-Agent policy (CrystalBall "rate control").
 *
 * The inbound `rateLimiters` (src/lib/api/rate-limiters.ts) operate on
 * NextRequest and cannot govern outbound fetch() calls. This module applies the
 * same sliding-window policy shape ({ windowMs, maxRequests, keyPrefix }) to
 * outbound calls, keyed by host, so external API callers remain polite clients.
 * freee integration is Class-A and is covered separately (rate-02); this module
 * is intentionally consumed only by non-Class-A outbound callers.
 */

const OutboundRateLimitConfigSchema = z.object({
  windowMs: z.number().int().positive().finite(),
  maxRequests: z.number().int().positive().finite(),
  keyPrefix: z.string().min(1).max(64),
})

export interface OutboundRateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix: string
}

export interface OutboundRateLimitDecision {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterMs: number
}

interface Bucket {
  timestamps: number[]
}

/**
 * Thrown when an outbound call is rate-limited. Callers that already map thrown
 * errors to Result-style failures (market-data providers, calculation client,
 * info sources) surface it through their existing error paths.
 */
export class OutboundRateLimitError extends Error {
  readonly name = 'OutboundRateLimitError'
  readonly key: string
  readonly retryAfterMs: number

  constructor(key: string, retryAfterMs: number) {
    super(
      `Outbound rate limit exceeded for "${key}"; retry after ${Math.ceil(retryAfterMs / 1000)}s`
    )
    this.key = key
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Descriptive User-Agent for all outbound calls (CrystalBall policy). Overridable
 * via APP_USER_AGENT so deployments can set a contact address.
 */
export const OUTBOUND_USER_AGENT: string =
  process.env.APP_USER_AGENT && process.env.APP_USER_AGENT.trim().length > 0
    ? process.env.APP_USER_AGENT.trim()
    : 'freee_audit/1.0.0 (+https://github.com/mizunotaro/freee_audit)'

const UA_HEADER_NAMES = new Set(['user-agent', 'useragent', 'user agent'])

function toHeaderEntries(headers: HeadersInit): Array<[string, string]> {
  if (headers instanceof Headers) {
    const out: Array<[string, string]> = []
    headers.forEach((value, name) => out.push([name, value]))
    return out
  }
  if (Array.isArray(headers)) {
    return headers.map(([name, value]) => [String(name), String(value)] as [string, string])
  }
  return Object.entries(headers).map(([name, value]) => [name, String(value)] as [string, string])
}

/**
 * Merge the descriptive User-Agent into outbound request headers without
 * clobbering a caller-supplied value. Original header key casing is preserved
 * (HeadersInit variants are copied entry-by-entry rather than re-normalised) so
 * callers that later inspect their own header object keep seeing their keys.
 */
export function withOutboundUserAgent(
  headers?: HeadersInit,
  userAgent: string = OUTBOUND_USER_AGENT
): Record<string, string> {
  const merged: Record<string, string> = {}
  if (headers) {
    for (const [name, value] of toHeaderEntries(headers)) {
      merged[name] = value
    }
  }
  const hasUserAgent = Object.keys(merged).some((name) => UA_HEADER_NAMES.has(name.toLowerCase()))
  if (!hasUserAgent) {
    merged['User-Agent'] = userAgent
  }
  return merged
}

/**
 * Sliding-window outbound rate limiter (in-memory, per-process). Mirrors the
 * algorithm used by lib/security MemoryRateLimitStore but is keyed by host so it
 * can govern outbound fetch() calls rather than inbound NextRequest traffic.
 */
export class OutboundRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  readonly config: OutboundRateLimitConfig

  constructor(config: OutboundRateLimitConfig) {
    this.config = config
  }

  /**
   * Attempt to consume one outbound-call token for `key`. Consumes a token only
   * when allowed (denied attempts do not count). Returns a Result; use
   * assertOutboundAllowed for the throw-based integration.
   */
  tryAcquire(key: string): Result<OutboundRateLimitDecision, AppError> {
    if (!key || key.trim().length === 0) {
      return failure(createAppError('VALIDATION_ERROR', 'Outbound rate-limit key is required'))
    }

    const now = Date.now()
    const windowMs = this.config.windowMs
    const windowStart = now - windowMs
    const fullKey = `${this.config.keyPrefix}:${key}`

    const bucket = this.buckets.get(fullKey) ?? { timestamps: [] }
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart)

    const allowed = bucket.timestamps.length < this.config.maxRequests
    if (allowed) {
      bucket.timestamps.push(now)
    }
    this.buckets.set(fullKey, bucket)

    const oldest = bucket.timestamps[0] ?? now
    const resetAt = oldest + windowMs
    const remaining = Math.max(0, this.config.maxRequests - bucket.timestamps.length)
    const retryAfterMs = allowed ? 0 : Math.max(0, resetAt - now)

    return success({ allowed, remaining, resetAt, retryAfterMs })
  }

  /** Remove a specific key's bucket, or all buckets when omitted. */
  reset(key?: string): void {
    if (key === undefined) {
      this.buckets.clear()
      return
    }
    this.buckets.delete(`${this.config.keyPrefix}:${key}`)
  }
}

/** Validate and construct an OutboundRateLimiter from untrusted config. */
export function createOutboundRateLimiter(config: unknown): Result<OutboundRateLimiter, AppError> {
  const parsed = OutboundRateLimitConfigSchema.safeParse(config)
  if (!parsed.success) {
    return failure(
      createAppError('VALIDATION_ERROR', 'Invalid outbound rate-limit configuration', {
        details: {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        },
      })
    )
  }
  return success(new OutboundRateLimiter(parsed.data))
}

const registry = new Map<string, OutboundRateLimiter>()

function cacheKey(config: OutboundRateLimitConfig): string {
  return `${config.keyPrefix}:${config.windowMs}:${config.maxRequests}`
}

/** Return a cached limiter for the given (validated) config, creating one on first use. */
export function getOutboundRateLimiter(config: OutboundRateLimitConfig): OutboundRateLimiter {
  const key = cacheKey(config)
  let limiter = registry.get(key)
  if (!limiter) {
    limiter = new OutboundRateLimiter(config)
    registry.set(key, limiter)
  }
  return limiter
}

/**
 * Named outbound limiters, mirroring the inbound `rateLimiters` registry.
 * marketData: third-party public APIs (EDINET, J-Quants) — ~1 req/s, polite yet
 *   leaves headroom for legitimate EDINET date-range document scans.
 * externalInfo: external info sources — medium.
 * internalService: own python/R microservices — generous.
 */
export const outboundRateLimiters = {
  marketData: () =>
    getOutboundRateLimiter({
      windowMs: 60_000,
      maxRequests: 60,
      keyPrefix: 'outbound:market-data',
    }),
  externalInfo: () =>
    getOutboundRateLimiter({
      windowMs: 60_000,
      maxRequests: 20,
      keyPrefix: 'outbound:external-info',
    }),
  internalService: () =>
    getOutboundRateLimiter({
      windowMs: 60_000,
      maxRequests: 300,
      keyPrefix: 'outbound:internal-service',
    }),
}

/**
 * Acquire an outbound-call token, throwing OutboundRateLimitError when the
 * limit is exceeded. Bridges the Result-based limiter to the throw-based error
 * contracts used by existing outbound callers.
 */
export function assertOutboundAllowed(limiter: OutboundRateLimiter, key: string): void {
  const result = limiter.tryAcquire(key)
  if (!result.success) {
    throw new OutboundRateLimitError(key, 0)
  }
  if (!result.data.allowed) {
    throw new OutboundRateLimitError(key, result.data.retryAfterMs)
  }
}

/** Resolve a host key from a URL for rate-limiting (falls back to "unknown-host"). */
export function resolveOutboundHost(url: string): string {
  try {
    return new URL(url).hostname || 'unknown-host'
  } catch {
    return 'unknown-host'
  }
}

/** Reset every cached named limiter's token state. Intended for tests. */
export function resetOutboundRateLimiters(): void {
  for (const limiter of registry.values()) {
    limiter.reset()
  }
}

/**
 * Hybrid Rate Limiter - Redis/メモリ切替可能なレート制限
 *
 * 機能:
 * - Redis優先、未設定時はメモリフォールバック
 * - スライディングウィンドウアルゴリズム
 * - 分散環境対応
 *
 * @module lib/security/rate-limit-hybrid
 */

import { NextRequest, NextResponse } from 'next/server'

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (req: NextRequest) => string
  skip?: (req: NextRequest) => boolean
  handler?: () => NextResponse
  keyPrefix?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

interface MemoryStoreEntry {
  timestamps: number[]
  resetAt: number
}

class MemoryRateLimitStore {
  private store: Map<string, MemoryStoreEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key)
      }
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now()
    const windowStart = now - windowMs
    const resetAt = now + windowMs

    const entry = this.store.get(key)

    if (!entry || entry.resetAt < now) {
      this.store.set(key, { timestamps: [now], resetAt })
      return { count: 1, resetAt }
    }

    const validTimestamps = entry.timestamps.filter((ts) => ts > windowStart)
    validTimestamps.push(now)
    entry.timestamps = validTimestamps

    return { count: validTimestamps.length, resetAt: entry.resetAt }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

interface RedisLike {
  multi(): {
    zremrangebyscore(key: string, min: number, max: number): unknown
    zcard(key: string): unknown
    zadd(key: string, score: number, member: string): unknown
    expire(key: string, seconds: number): unknown
    exec(): Promise<Array<[Error | null, unknown]>>
  }
  zremrangebyscore(key: string, min: number, max: number): Promise<number>
  zcard(key: string): Promise<number>
  zadd(key: string, score: number, member: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  disconnect?(): Promise<void>
}

class RedisRateLimitStore {
  private redis: RedisLike | null = null
  private connectionPromise: Promise<RedisLike | null> | null = null
  private redisUrl: string | null = null

  constructor() {
    this.redisUrl = process.env.REDIS_URL || null
  }

  private async connect(): Promise<RedisLike | null> {
    if (this.redis) return this.redis
    if (this.connectionPromise) return this.connectionPromise

    if (!this.redisUrl) {
      return null
    }

    this.connectionPromise = this.createConnection()
    this.redis = await this.connectionPromise
    return this.redis
  }

  private async createConnection(): Promise<RedisLike | null> {
    try {
      const Redis = require('ioredis')
      if (!this.redisUrl) return null

      const redis = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
      })

      await redis.ping().catch(() => null)
      return redis as unknown as RedisLike
    } catch {
      return null
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const redis = await this.connect()

    if (!redis) {
      throw new Error('Redis not available')
    }

    const now = Date.now()
    const windowStart = now - windowMs
    const resetAt = now + windowMs
    const member = `${now}:${Math.random().toString(36).slice(2)}`

    const multi = redis.multi()
    multi.zremrangebyscore(key, 0, windowStart)
    multi.zcard(key)
    multi.zadd(key, now, member)
    multi.expire(key, Math.ceil(windowMs / 1000))

    const results = await multi.exec()
    const count = (results?.[1]?.[1] as number) ?? 0

    return { count: count + 1, resetAt }
  }

  async disconnect(): Promise<void> {
    if (this.redis && this.redis.disconnect) {
      await this.redis.disconnect()
      this.redis = null
    }
  }
}

class HybridRateLimiter {
  private memoryStore: MemoryRateLimitStore
  private redisStore: RedisRateLimitStore
  private useRedis: boolean
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
    this.memoryStore = new MemoryRateLimitStore()
    this.redisStore = new RedisRateLimitStore()
    this.useRedis = !!process.env.REDIS_URL
  }

  async check(key: string): Promise<RateLimitResult> {
    const fullKey = `${this.config.keyPrefix ?? 'ratelimit'}:${key}`
    const windowMs = this.config.windowMs
    const maxRequests = this.config.maxRequests

    let count: number
    let resetAt: number

    if (this.useRedis) {
      try {
        const result = await this.redisStore.increment(fullKey, windowMs)
        count = result.count
        resetAt = result.resetAt
      } catch {
        const result = await this.memoryStore.increment(fullKey, windowMs)
        count = result.count
        resetAt = result.resetAt
      }
    } else {
      const result = await this.memoryStore.increment(fullKey, windowMs)
      count = result.count
      resetAt = result.resetAt
    }

    const allowed = count <= maxRequests
    const remaining = Math.max(0, maxRequests - count)
    const retryAfter = allowed ? 0 : Math.ceil((resetAt - Date.now()) / 1000)

    return {
      allowed,
      remaining: allowed ? remaining : 0,
      resetAt,
      retryAfter: allowed ? undefined : retryAfter,
    }
  }

  middleware() {
    return async (req: NextRequest): Promise<NextResponse | null> => {
      if (this.config.skip?.(req)) {
        return null
      }

      const key = this.config.keyGenerator?.(req) ?? this.getDefaultKey(req)
      const result = await this.check(key)

      if (!result.allowed) {
        const response = this.config.handler?.() ?? this.defaultHandler()
        response.headers.set('X-RateLimit-Limit', this.config.maxRequests.toString())
        response.headers.set('X-RateLimit-Remaining', '0')
        response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
        response.headers.set('Retry-After', result.retryAfter?.toString() ?? '60')
        return response
      }

      return null
    }
  }

  private getDefaultKey(req: NextRequest): string {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'
    return `ip:${ip}`
  }

  private defaultHandler(): NextResponse {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  destroy(): void {
    this.memoryStore.destroy()
    this.redisStore.disconnect().catch(() => {})
  }
}

const limiters = new Map<string, HybridRateLimiter>()

export function createHybridRateLimiter(config: RateLimitConfig): HybridRateLimiter {
  const key = `${config.keyPrefix ?? 'default'}:${config.windowMs}:${config.maxRequests}`

  if (!limiters.has(key)) {
    limiters.set(key, new HybridRateLimiter(config))
  }

  return limiters.get(key)!
}

export function withHybridRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
): (req: NextRequest) => Promise<NextResponse> {
  const limiter = createHybridRateLimiter(config)
  const middleware = limiter.middleware()

  return async (req: NextRequest) => {
    const limited = await middleware(req)
    if (limited) return limited
    return handler(req)
  }
}

export const hybridRateLimiters = {
  api: () => createHybridRateLimiter({ windowMs: 60000, maxRequests: 100, keyPrefix: 'api' }),
  auth: () => createHybridRateLimiter({ windowMs: 900000, maxRequests: 5, keyPrefix: 'auth' }),
  upload: () =>
    createHybridRateLimiter({ windowMs: 3600000, maxRequests: 20, keyPrefix: 'upload' }),
  strict: () => createHybridRateLimiter({ windowMs: 60000, maxRequests: 10, keyPrefix: 'strict' }),
}

export function destroyAllLimiters(): void {
  for (const limiter of limiters.values()) {
    limiter.destroy()
  }
  limiters.clear()
}

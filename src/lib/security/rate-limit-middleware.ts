import { NextRequest, NextResponse } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (req: NextRequest) => string
  skip?: (req: NextRequest) => boolean
  handler?: () => NextResponse
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  keyGenerator: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    return `rate-limit:${typeof ip === 'string' ? ip : ip[0]}`
  },
  skip: () => false,
  handler: () =>
    NextResponse.json(
      { success: false, error: 'Too many requests, please try again later' },
      { status: 429, headers: { 'Retry-After': '60' } }
    ),
}

function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const key of Object.keys(store)) {
    if (store[key]?.resetAt < now) {
      delete store[key]
    }
  }
}

function getKey(req: NextRequest, config: RateLimitConfig): string {
  return config.keyGenerator ? config.keyGenerator(req) : `rate-limit:${req.ip || 'unknown'}`
}

function isRateLimited(key: string, config: RateLimitConfig): boolean {
  const now = Date.now()
  const record = store[key]

  if (!record || record.resetAt < now) {
    store[key] = {
      count: 1,
      resetAt: now + config.windowMs,
    }
    return false
  }

  if (record.count >= config.maxRequests) {
    return true
  }

  record.count++
  return false
}

function getResetTime(key: string): number {
  const record = store[key]
  if (!record) return 0
  return Math.ceil((record.resetAt - Date.now()) / 1000)
}

export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const finalConfig: RateLimitConfig = { ...DEFAULT_CONFIG, ...config }

  return async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
    if (finalConfig.skip && finalConfig.skip(req)) {
      return null
    }

    cleanupExpiredEntries()

    const key = getKey(req, finalConfig)

    if (isRateLimited(key, finalConfig)) {
      const response = finalConfig.handler ? finalConfig.handler() : DEFAULT_CONFIG.handler!()
      response.headers.set('X-RateLimit-Limit', finalConfig.maxRequests.toString())
      response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', getResetTime(key).toString())
      return response
    }

    return null
  }
}

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: Partial<RateLimitConfig> = {}
): (req: NextRequest) => Promise<NextResponse> {
  const limiter = rateLimit(config)

  return async (req: NextRequest) => {
    const limited = await limiter(req)
    if (limited) return limited
    return handler(req)
  }
}

export const rateLimiters = {
  api: rateLimit({ windowMs: 60000, maxRequests: 100 }),
  auth: rateLimit({ windowMs: 900000, maxRequests: 5 }),
  upload: rateLimit({ windowMs: 3600000, maxRequests: 20 }),
  strict: rateLimit({ windowMs: 60000, maxRequests: 10 }),
}

export function createRateLimiter(config: Partial<RateLimitConfig>) {
  return rateLimit(config)
}

setInterval(cleanupExpiredEntries, 60000)

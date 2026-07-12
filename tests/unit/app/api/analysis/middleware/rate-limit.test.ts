import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const hybridMocks = vi.hoisted(() => ({
  createHybridRateLimiter: vi.fn(),
  check: vi.fn(),
}))

vi.mock('@/lib/security/rate-limit-hybrid', () => ({
  createHybridRateLimiter: hybridMocks.createHybridRateLimiter,
}))

import { withRateLimit, type RateLimitConfig } from '@/app/api/analysis/middleware/rate-limit'

const WINDOW_MS = 60000
const BASE_TIME = new Date('2025-01-01T00:00:00Z').getTime()

let seq = 0
const uniqueKey = () => `key-${seq}`
const uniqueIp = () => `${seq}.10.20.30`

const makeHandler = () =>
  vi.fn(async (_req: NextRequest) => NextResponse.json({ ok: true }, { status: 200 }))

const buildRequest = (headers: Record<string, string> = {}): NextRequest =>
  new NextRequest('http://localhost/api/analysis', { headers })

const wrap = (handler: ReturnType<typeof makeHandler>, config?: RateLimitConfig) =>
  withRateLimit(config ?? { windowMs: WINDOW_MS, maxRequests: 100 })(handler)

const enableHybrid = (
  result: { allowed: boolean; remaining: number; resetAt: number } = {
    allowed: true,
    remaining: 5,
    resetAt: BASE_TIME + 1000,
  }
) => {
  process.env.REDIS_URL = 'redis://localhost:6379'
  hybridMocks.createHybridRateLimiter.mockReturnValue({ check: hybridMocks.check })
  hybridMocks.check.mockResolvedValue(result)
}

beforeEach(() => {
  seq += 1
  vi.useFakeTimers({ now: BASE_TIME })
  delete process.env.REDIS_URL
  hybridMocks.createHybridRateLimiter.mockReset()
  hybridMocks.check.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.REDIS_URL
  vi.clearAllMocks()
})

describe('withRateLimit — memory store (no REDIS_URL)', () => {
  it('allows the first request, invokes the handler, and returns its response', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 2, keyGenerator: uniqueKey })

    const response = await wrapped(buildRequest())

    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('sets X-RateLimit headers on allowed responses and decrements Remaining', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 3, keyGenerator: uniqueKey })

    const r1 = await wrapped(buildRequest())
    expect(r1.headers.get('x-ratelimit-limit')).toBe('3')
    expect(r1.headers.get('x-ratelimit-remaining')).toBe('2')
    expect(r1.headers.get('x-ratelimit-reset')).toBe(String(BASE_TIME + WINDOW_MS))

    const r2 = await wrapped(buildRequest())
    expect(r2.headers.get('x-ratelimit-remaining')).toBe('1')

    const r3 = await wrapped(buildRequest())
    expect(r3.headers.get('x-ratelimit-remaining')).toBe('0')
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('blocks with 429 once count exceeds maxRequests and skips the handler', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 2, keyGenerator: uniqueKey })

    await wrapped(buildRequest())
    await wrapped(buildRequest())
    const third = await wrapped(buildRequest())

    expect(third.status).toBe(429)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('returns a well-formed RATE_LIMIT_EXCEEDED 429 body and headers', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 1, keyGenerator: uniqueKey })

    await wrapped(buildRequest({ 'x-request-id': 'req-abc' }))
    const blocked = await wrapped(buildRequest({ 'x-request-id': 'req-abc' }))
    const body = await blocked.json()

    expect(blocked.status).toBe(429)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(body.error.details.retryAfter).toBe(60)
    expect(body.metadata.requestId).toBe('req-abc')
    expect(blocked.headers.get('x-ratelimit-limit')).toBe('1')
    expect(blocked.headers.get('x-ratelimit-remaining')).toBe('0')
    expect(blocked.headers.get('x-ratelimit-reset')).toBe(String(BASE_TIME + WINDOW_MS))
    expect(blocked.headers.get('retry-after')).toBe('60')
  })

  it('defaults metadata.requestId to "unknown" when x-request-id is absent', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 1, keyGenerator: uniqueKey })

    await wrapped(buildRequest())
    const blocked = await wrapped(buildRequest())
    const body = await blocked.json()

    expect(body.metadata.requestId).toBe('unknown')
  })

  it('resets the counter after the window elapses', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 1, keyGenerator: uniqueKey })

    const first = await wrapped(buildRequest())
    expect(first.status).toBe(200)

    vi.advanceTimersByTime(WINDOW_MS + 1)

    const afterWindow = await wrapped(buildRequest())
    expect(afterWindow.status).toBe(200)
    expect(afterWindow.headers.get('x-ratelimit-reset')).toBe(String(BASE_TIME + 2 * WINDOW_MS))
    expect(afterWindow.headers.get('x-ratelimit-remaining')).toBe('0')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('uses the default RATE_LIMIT_CONFIG when no config is provided', async () => {
    const handler = makeHandler()
    const wrapped = withRateLimit()(handler)

    const response = await wrapped(buildRequest({ 'x-forwarded-for': uniqueIp() }))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-ratelimit-limit')).toBe('100')
  })

  it('rate-limits via the default getClientIdentifier IP key', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 1 })
    const ip = uniqueIp()
    const req = () => buildRequest({ 'x-forwarded-for': ip })

    const first = await wrapped(req())
    const second = await wrapped(req())

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('tracks distinct keys independently', async () => {
    const handler = makeHandler()
    let current = `a-${seq}`
    const wrapped = wrap(handler, {
      windowMs: WINDOW_MS,
      maxRequests: 1,
      keyGenerator: () => current,
    })

    const a1 = await wrapped(buildRequest())
    const a2 = await wrapped(buildRequest())
    current = `b-${seq}`
    const b1 = await wrapped(buildRequest())
    const b2 = await wrapped(buildRequest())

    expect(a1.status).toBe(200)
    expect(a2.status).toBe(429)
    expect(b1.status).toBe(200)
    expect(b2.status).toBe(429)
    expect(handler).toHaveBeenCalledTimes(2)
  })
})

describe('withRateLimit — getClientIdentifier key derivation', () => {
  const config = (): RateLimitConfig => ({ windowMs: WINDOW_MS, maxRequests: 10 })

  it('uses the first IP from a comma-separated x-forwarded-for', async () => {
    enableHybrid()
    const handler = makeHandler()
    const wrapped = wrap(handler, config())

    await wrapped(buildRequest({ 'x-forwarded-for': '203.0.113.9, 198.51.100.4' }))

    expect(hybridMocks.check).toHaveBeenCalledTimes(1)
    expect(hybridMocks.check).toHaveBeenCalledWith('203.0.113.9')
  })

  it('trims surrounding whitespace from the first forwarded IP', async () => {
    enableHybrid()
    const handler = makeHandler()
    const wrapped = wrap(handler, config())

    await wrapped(buildRequest({ 'x-forwarded-for': '  203.0.113.10  ' }))

    expect(hybridMocks.check).toHaveBeenCalledWith('203.0.113.10')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    enableHybrid()
    const handler = makeHandler()
    const wrapped = wrap(handler, config())

    await wrapped(buildRequest({ 'x-real-ip': '203.0.113.11' }))

    expect(hybridMocks.check).toHaveBeenCalledWith('203.0.113.11')
  })

  it('falls back to "unknown" when no IP headers are present', async () => {
    enableHybrid()
    const handler = makeHandler()
    const wrapped = wrap(handler, config())

    await wrapped(buildRequest())

    expect(hybridMocks.check).toHaveBeenCalledWith('unknown')
  })

  it('treats an empty x-forwarded-for as absent', async () => {
    enableHybrid()
    const handler = makeHandler()
    const wrapped = wrap(handler, config())

    await wrapped(buildRequest({ 'x-forwarded-for': '' }))

    expect(hybridMocks.check).toHaveBeenCalledWith('unknown')
  })
})

describe('withRateLimit — custom keyGenerator', () => {
  it('is invoked with the request and its return value drives the bucket', async () => {
    const handler = makeHandler()
    const keyGenerator = vi.fn((req: NextRequest) => req.headers.get('x-key') ?? 'default')
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 1, keyGenerator })
    const alpha = () => buildRequest({ 'x-key': 'alpha' })

    const first = await wrapped(alpha())
    const second = await wrapped(alpha())
    const beta = await wrapped(buildRequest({ 'x-key': 'beta' }))

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    expect(beta.status).toBe(200)
    expect(keyGenerator).toHaveBeenCalled()
    expect(keyGenerator.mock.calls[0][0]).toBeInstanceOf(Request)
    expect(handler).toHaveBeenCalledTimes(2)
  })
})

describe('withRateLimit — hybrid path (REDIS_URL set)', () => {
  it('honors an allowed hybrid result and stamps hybrid-derived headers', async () => {
    enableHybrid({ allowed: true, remaining: 7, resetAt: BASE_TIME + 5000 })
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 10, keyGenerator: uniqueKey })

    const response = await wrapped(buildRequest())

    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-ratelimit-limit')).toBe('10')
    expect(response.headers.get('x-ratelimit-remaining')).toBe('7')
    expect(response.headers.get('x-ratelimit-reset')).toBe(String(BASE_TIME + 5000))
    expect(hybridMocks.createHybridRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({ keyPrefix: 'analysis-api', windowMs: WINDOW_MS, maxRequests: 10 })
    )
  })

  it('blocks on a denied hybrid result without invoking the handler', async () => {
    enableHybrid({ allowed: false, remaining: 0, resetAt: BASE_TIME + 30000 })
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 10, keyGenerator: uniqueKey })

    const blocked = await wrapped(buildRequest({ 'x-request-id': 'hybrid-req' }))
    const body = await blocked.json()

    expect(blocked.status).toBe(429)
    expect(handler).not.toHaveBeenCalled()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(body.error.details.retryAfter).toBe(30)
    expect(blocked.headers.get('x-ratelimit-reset')).toBe(String(BASE_TIME + 30000))
    expect(blocked.headers.get('retry-after')).toBe('30')
    expect(blocked.headers.get('x-ratelimit-remaining')).toBe('0')
  })

  it('fails safe to the memory store when createHybridRateLimiter throws', async () => {
    enableHybrid()
    hybridMocks.createHybridRateLimiter.mockImplementation(() => {
      throw new Error('redis unavailable')
    })
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 4, keyGenerator: uniqueKey })

    const response = await wrapped(buildRequest())

    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-ratelimit-remaining')).toBe('3')
  })

  it('fails safe to the memory store when limiter.check rejects', async () => {
    enableHybrid()
    hybridMocks.check.mockRejectedValue(new Error('check boom'))
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 4, keyGenerator: uniqueKey })

    const response = await wrapped(buildRequest())

    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-ratelimit-remaining')).toBe('3')
  })
})

describe('withRateLimit — hybrid gating', () => {
  it('skips the hybrid path when useHybrid is false even with REDIS_URL set', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    const handler = makeHandler()
    const wrapped = wrap(handler, {
      windowMs: WINDOW_MS,
      maxRequests: 4,
      useHybrid: false,
      keyGenerator: uniqueKey,
    })

    const response = await wrapped(buildRequest())

    expect(hybridMocks.createHybridRateLimiter).not.toHaveBeenCalled()
    expect(hybridMocks.check).not.toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.headers.get('x-ratelimit-remaining')).toBe('3')
  })

  it('skips the hybrid path when REDIS_URL is absent', async () => {
    const handler = makeHandler()
    const wrapped = wrap(handler, { windowMs: WINDOW_MS, maxRequests: 4, keyGenerator: uniqueKey })

    await wrapped(buildRequest())

    expect(hybridMocks.createHybridRateLimiter).not.toHaveBeenCalled()
    expect(hybridMocks.check).not.toHaveBeenCalled()
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

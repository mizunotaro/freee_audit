import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { NextRequest, NextResponse } from 'next/server'
import {
  createHybridRateLimiter,
  withHybridRateLimit,
  hybridRateLimiters,
  destroyAllLimiters,
} from '@/lib/security/rate-limit-hybrid'

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => {
      const headers = new Map<string, string>()
      return {
        body,
        status: init?.status ?? 200,
        init,
        headers: {
          set: (k: string, v: string) => {
            headers.set(k, v)
          },
          get: (k: string) => headers.get(k) ?? null,
        },
      }
    }),
  },
}))

const BASE = new Date('2024-01-01T00:00:00.000Z').getTime()

const createMockRequest = (
  opts: { xff?: string; xRealIp?: string; method?: string } = {}
): NextRequest => {
  const headers = new Map<string, string>()
  if (opts.xff !== undefined) headers.set('x-forwarded-for', opts.xff)
  if (opts.xRealIp !== undefined) headers.set('x-real-ip', opts.xRealIp)
  return {
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
    method: opts.method ?? 'GET',
  } as unknown as NextRequest
}

const makeMockResponse = (body: unknown, status = 200): NextResponse => {
  const headers = new Map<string, string>()
  return {
    body,
    status,
    init: { status },
    headers: {
      set: (k: string, v: string) => {
        headers.set(k, v)
      },
      get: (k: string) => headers.get(k) ?? null,
    },
  } as unknown as NextResponse
}

describe('rate-limit-hybrid', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    delete process.env.REDIS_URL
    destroyAllLimiters()
  })

  describe('createHybridRateLimiter / check (memory store, default)', () => {
    it('allows the first request and reports remaining and resetAt', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
        keyPrefix: 'basic',
      })
      const result = await limiter.check('user-1')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
      expect(result.resetAt).toBe(BASE + 60000)
      expect(result.retryAfter).toBeUndefined()
    })

    it('decrements remaining and blocks at the boundary (count === max allowed, count === max+1 blocked)', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
        keyPrefix: 'boundary',
      })

      expect((await limiter.check('u')).remaining).toBe(2)
      expect((await limiter.check('u')).remaining).toBe(1)
      expect((await limiter.check('u')).remaining).toBe(0) // count === max -> still allowed

      const blocked = await limiter.check('u') // count === max + 1 -> blocked
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      expect(blocked.resetAt).toBe(BASE + 60000)
      expect(blocked.retryAfter).toBe(60)
    })

    it('tracks different keys independently', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'keys',
      })

      expect((await limiter.check('a')).allowed).toBe(true)
      expect((await limiter.check('b')).allowed).toBe(true)
      expect((await limiter.check('a')).allowed).toBe(false)
      expect((await limiter.check('b')).allowed).toBe(false)
    })

    it('accepts an empty string key (degrades to a usable bucket)', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'empty',
      })
      const result = await limiter.check('')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)
    })

    it('blocks the first request when maxRequests is 0', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 0,
        keyPrefix: 'zero',
      })
      const result = await limiter.check('k')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBe(60)
    })

    it('resets the count after the window elapses (sliding window)', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'slide',
      })

      expect((await limiter.check('k')).allowed).toBe(true) // count 1
      expect((await limiter.check('k')).allowed).toBe(true) // count 2 (=== max)
      expect((await limiter.check('k')).allowed).toBe(false) // count 3 blocked

      vi.setSystemTime(new Date(BASE + 61000)) // past resetAt
      const afterWindow = await limiter.check('k') // window expired -> reset branch
      expect(afterWindow.allowed).toBe(true)
      expect(afterWindow.remaining).toBe(1)
      expect(afterWindow.resetAt).toBe(BASE + 61000 + 60000)
    })

    it('handles concurrent checks deterministically (memory increment body is synchronous)', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'conc',
      })
      const results = await Promise.all(Array.from({ length: 10 }, () => limiter.check('same-key')))

      const allowed = results.filter((r) => r.allowed).length
      const blocked = results.filter((r) => !r.allowed).length
      expect(allowed).toBe(5)
      expect(blocked).toBe(5)
    })

    it('caches a limiter per config and reuses the same instance', () => {
      const a = createHybridRateLimiter({ windowMs: 60000, maxRequests: 5, keyPrefix: 'cache' })
      const b = createHybridRateLimiter({ windowMs: 60000, maxRequests: 5, keyPrefix: 'cache' })
      const c = createHybridRateLimiter({ windowMs: 60000, maxRequests: 5, keyPrefix: 'other' })

      expect(a).toBe(b)
      expect(a).not.toBe(c)
    })
  })

  describe('Redis store path (fail-safe to memory)', () => {
    // `ioredis` is an OPTIONAL dependency. When REDIS_URL is set but ioredis is not
    // installed, require('ioredis') throws inside createConnection(); the limiter is
    // designed to degrade to the in-memory store rather than fail open. These tests
    // pin that fail-safe contract (the only Redis-path branch reachable here).
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379' // forces useRedis = true
    })

    it('degrades to the memory store when REDIS_URL is set but Redis is unavailable', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'fs-basic',
      })
      const result = await limiter.check('k')

      expect(result.allowed).toBe(true) // memory count 1
      expect(result.remaining).toBe(1)
      expect(result.resetAt).toBe(BASE + 60000)
    })

    it('still enforces the limit after fail-over (does not fail open)', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'fs-block',
      })

      expect((await limiter.check('k')).allowed).toBe(true) // memory count 1
      expect((await limiter.check('k')).allowed).toBe(true) // memory count 2 (=== max)
      const blocked = await limiter.check('k') // memory count 3 -> blocked
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      expect(blocked.retryAfter).toBe(60)
    })

    it('tracks distinct keys independently even after fail-over', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'fs-keys',
      })

      expect((await limiter.check('a')).allowed).toBe(true)
      expect((await limiter.check('b')).allowed).toBe(true)
      expect((await limiter.check('a')).allowed).toBe(false)
    })

    it('middleware still returns a 429 once the memory fallback limit is exceeded', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'fs-mw',
      })
      const middleware = limiter.middleware()
      const req = createMockRequest({ xff: '1.1.1.1' })

      expect(await middleware(req)).toBeNull()
      const blocked = (await middleware(req)) as { status: number }
      expect(blocked).not.toBeNull()
      expect(blocked.status).toBe(429)
    })

    it('destroy() does not throw when Redis was never connected', () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'fs-destroy',
      })
      expect(() => limiter.destroy()).not.toThrow()
    })
  })

  describe('HybridRateLimiter.middleware', () => {
    it('returns null when the request is within the limit', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'mw-ok',
      })
      const middleware = limiter.middleware()
      const req = createMockRequest({ xff: '1.1.1.1' })

      expect(await middleware(req)).toBeNull()
    })

    it('returns a 429 response with rate-limit headers when over the limit (default handler)', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-default',
      })
      const middleware = limiter.middleware()
      const req = createMockRequest({ xff: '6.6.6.6' })

      await middleware(req) // allowed
      const blocked = (await middleware(req)) as {
        body: unknown
        status: number
        headers: { get: (k: string) => string | null }
      }

      expect(blocked).not.toBeNull()
      expect(blocked.body).toEqual({
        success: false,
        error: 'Too many requests. Please try again later.',
      })
      expect(blocked.headers.get('X-RateLimit-Limit')).toBe('1')
      expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(blocked.headers.get('X-RateLimit-Reset')).toBe(String(BASE + 60000))
      expect(blocked.headers.get('Retry-After')).toBe('60')
    })

    it('skips rate limiting entirely when skip() returns true', async () => {
      const skip = vi.fn(() => true)
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-skip',
        skip,
      })
      const middleware = limiter.middleware()
      const req = createMockRequest({ xff: '9.9.9.9' })

      expect(await middleware(req)).toBeNull()
      expect(await middleware(req)).toBeNull() // skipped, never counted
      expect(await middleware(req)).toBeNull()
      expect(skip).toHaveBeenCalledTimes(3)
    })

    it('uses a custom handler when the limit is exceeded', async () => {
      const customResponse = makeMockResponse({ custom: true }, 429)
      const handler = vi.fn(() => customResponse)
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-handler',
        handler,
      })
      const middleware = limiter.middleware()
      const req = createMockRequest({ xff: '8.8.8.8' })

      await middleware(req) // allowed
      const blocked = await middleware(req) // blocked -> custom handler

      expect(handler).toHaveBeenCalledTimes(1)
      expect(blocked).toBe(customResponse)
      expect(customResponse.headers.get('X-RateLimit-Limit')).toBe('1')
      expect(customResponse.headers.get('Retry-After')).toBe('60')
    })

    it('uses a custom key generator', async () => {
      const keyGenerator = vi.fn(() => 'custom-key')
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-keygen',
        keyGenerator,
      })
      const middleware = limiter.middleware()
      const req = createMockRequest({ xff: '7.7.7.7' })

      await middleware(req) // allowed
      const blocked = await middleware(req) // same custom-key -> blocked

      expect(blocked).not.toBeNull()
      expect(keyGenerator).toHaveBeenCalledWith(req)
      expect(keyGenerator).toHaveBeenCalledTimes(2)
    })

    it('derives the default key from x-forwarded-for (first IP) and isolates IPs', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-xff',
      })
      const middleware = limiter.middleware()
      const reqA = createMockRequest({ xff: '1.1.1.1, 2.2.2.2' })
      const reqB = createMockRequest({ xff: '3.3.3.3' })

      expect(await middleware(reqA)).toBeNull() // first IP 1.1.1.1 allowed
      expect(await middleware(reqA)).not.toBeNull() // 1.1.1.1 blocked
      expect(await middleware(reqB)).toBeNull() // 3.3.3.3 isolated -> allowed
    })

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-realip',
      })
      const middleware = limiter.middleware()
      const reqA = createMockRequest({ xRealIp: '4.4.4.4' })
      const reqB = createMockRequest({ xRealIp: '5.5.5.5' })

      expect(await middleware(reqA)).toBeNull()
      expect(await middleware(reqA)).not.toBeNull() // 4.4.4.4 blocked
      expect(await middleware(reqB)).toBeNull() // 5.5.5.5 isolated -> allowed
    })

    it('falls back to the "unknown" bucket when no IP header is present', async () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-unknown',
      })
      const middleware = limiter.middleware()
      const reqNoIp = createMockRequest({})

      expect(await middleware(reqNoIp)).toBeNull()
      expect(await middleware(reqNoIp)).not.toBeNull() // shared "unknown" bucket -> blocked
    })
  })

  describe('withHybridRateLimit', () => {
    it('invokes the wrapped handler and returns its response when allowed', async () => {
      const handlerResponse = makeMockResponse({ ok: true }, 200)
      const handler = vi.fn(async () => handlerResponse)
      const wrapped = withHybridRateLimit(handler, {
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'wrap-ok',
      })
      const req = createMockRequest({ xff: '1.1.1.1' })

      const result = await wrapped(req)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(result).toBe(handlerResponse)
    })

    it('blocks the wrapped handler and returns a 429 when over the limit', async () => {
      const handlerResponse = makeMockResponse({ ok: true }, 200)
      const handler = vi.fn(async () => handlerResponse)
      const wrapped = withHybridRateLimit(handler, {
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'wrap-block',
      })
      const req = createMockRequest({ xff: '2.2.2.2' })

      await wrapped(req) // allowed -> handler called once
      handler.mockClear()

      const result = (await wrapped(req)) as { status: number }
      expect(handler).not.toHaveBeenCalled()
      expect(result.status).toBe(429)
    })
  })

  describe('hybridRateLimiters factories', () => {
    it('exposes api/auth/upload/strict factory functions returning limiter instances', () => {
      for (const factory of [
        hybridRateLimiters.api,
        hybridRateLimiters.auth,
        hybridRateLimiters.upload,
        hybridRateLimiters.strict,
      ]) {
        expect(typeof factory).toBe('function')
        const limiter = factory()
        expect(typeof limiter.check).toBe('function')
        expect(typeof limiter.middleware).toBe('function')
        expect(typeof limiter.destroy).toBe('function')
      }
    })

    it('caches limiters per config (same factory returns an identical instance)', () => {
      expect(hybridRateLimiters.api()).toBe(hybridRateLimiters.api())
      expect(hybridRateLimiters.auth()).not.toBe(hybridRateLimiters.api())
    })

    it('auth factory enforces 5 requests per 15 minutes', async () => {
      const limiter = hybridRateLimiters.auth()
      for (let i = 0; i < 5; i++) {
        expect((await limiter.check('auth-user')).allowed).toBe(true)
      }
      expect((await limiter.check('auth-user')).allowed).toBe(false)
    })

    it('strict factory enforces 10 requests per minute', async () => {
      const limiter = hybridRateLimiters.strict()
      for (let i = 0; i < 10; i++) {
        expect((await limiter.check('strict-user')).allowed).toBe(true)
      }
      expect((await limiter.check('strict-user')).allowed).toBe(false)
    })
  })

  describe('destroy / destroyAllLimiters', () => {
    it('destroyAllLimiters clears the cache so a subsequent create returns a new instance', () => {
      const config = { windowMs: 60000, maxRequests: 5, keyPrefix: 'destroy-clear' }
      const first = createHybridRateLimiter(config)

      destroyAllLimiters()
      const second = createHybridRateLimiter(config)

      expect(second).not.toBe(first)
    })

    it('destroy is idempotent and does not throw', () => {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'destroy-idem',
      })
      expect(() => limiter.destroy()).not.toThrow()
      expect(() => limiter.destroy()).not.toThrow()
    })

    it('destroyAllLimiters is a no-op on an empty cache', () => {
      destroyAllLimiters()
      expect(() => destroyAllLimiters()).not.toThrow()
    })
  })
})

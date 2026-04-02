import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createHybridRateLimiter,
  withHybridRateLimit,
  hybridRateLimiters,
  destroyAllLimiters,
} from '@/lib/security/rate-limit-hybrid'
import { NextRequest, NextResponse } from 'next/server'

function createMockRequest(options: { ip?: string; forwardedFor?: string } = {}): NextRequest {
  const headers = new Headers()
  if (options.forwardedFor) {
    headers.set('x-forwarded-for', options.forwardedFor)
  }
  if (options.ip) {
    headers.set('x-real-ip', options.ip)
  }
  return new NextRequest(new URL('http://localhost/api/test'), { headers })
}

describe('Hybrid Rate Limiter', () => {
  beforeEach(function () {
    destroyAllLimiters()
    delete process.env.REDIS_URL
  })

  afterEach(function () {
    destroyAllLimiters()
  })

  describe('createHybridRateLimiter', function () {
    it('should create a rate limiter with config', function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      })
      expect(limiter).toBeDefined()
    })

    it('should return same instance for same config', function () {
      const limiter1 = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'dedup',
      })
      const limiter2 = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'dedup',
      })
      expect(limiter1).toBe(limiter2)
    })
  })

  describe('check', function () {
    it('should allow requests within limit', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'check-test',
      })
      const result = await limiter.check('test-key')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should block requests exceeding limit', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'block-test',
      })
      await limiter.check('key1')
      await limiter.check('key1')
      const result = await limiter.check('key1')
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('should track different keys independently', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'indep-test',
      })
      const r1 = await limiter.check('key-a')
      const r2 = await limiter.check('key-b')
      expect(r1.allowed).toBe(true)
      expect(r2.allowed).toBe(true)
    })
  })

  describe('middleware', function () {
    it('should return null for allowed requests', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        keyPrefix: 'mw-test',
      })
      const mw = limiter.middleware()
      const req = createMockRequest({ ip: '1.2.3.4' })
      const result = await mw(req)
      expect(result).toBeNull()
    })

    it('should return 429 response when rate limited', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-block',
      })
      const req = createMockRequest({ ip: '5.6.7.8' })
      const mw = limiter.middleware()
      await mw(req)
      const result = await mw(req)
      expect(result).not.toBeNull()
      expect(result!.status).toBe(429)
    })

    it('should skip when skip function returns true', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-skip',
        skip: function () {
          return true
        },
      })
      const req = createMockRequest()
      const mw = limiter.middleware()
      const result = await mw(req)
      expect(result).toBeNull()
    })

    it('should use custom key generator', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-custom',
        keyGenerator: function () {
          return 'fixed-key'
        },
      })
      const mw = limiter.middleware()
      const req1 = createMockRequest({ ip: '1.1.1.1' })
      const req2 = createMockRequest({ ip: '2.2.2.2' })
      await mw(req1)
      const result = await mw(req2)
      expect(result).not.toBeNull()
    })

    it('should use forwarded-for header for default key', async function () {
      const limiter = createHybridRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'mw-ff',
      })
      const mw = limiter.middleware()
      const req1 = createMockRequest({ forwardedFor: '9.9.9.9' })
      const req2 = createMockRequest({ forwardedFor: '9.9.9.9' })
      await mw(req1)
      const result = await mw(req2)
      expect(result).not.toBeNull()
    })
  })

  describe('withHybridRateLimit', function () {
    it('should call handler when allowed', async function () {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
      const wrapped = withHybridRateLimit(handler, {
        windowMs: 60000,
        maxRequests: 100,
        keyPrefix: 'wrap-ok',
      })
      const req = createMockRequest({ ip: '1.1.1.1' })
      const result = await wrapped(req)
      expect(handler).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })

    it('should return 429 when rate limited', async function () {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
      const wrapped = withHybridRateLimit(handler, {
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'wrap-block',
      })
      const req = createMockRequest({ ip: '2.2.2.2' })
      await wrapped(req)
      const result = await wrapped(req)
      expect(result.status).toBe(429)
    })
  })

  describe('hybridRateLimiters', function () {
    it('should export preconfigured limiters', function () {
      expect(hybridRateLimiters.api).toBeInstanceOf(Function)
      expect(hybridRateLimiters.auth).toBeInstanceOf(Function)
      expect(hybridRateLimiters.upload).toBeInstanceOf(Function)
      expect(hybridRateLimiters.strict).toBeInstanceOf(Function)
    })
  })

  describe('destroyAllLimiters', function () {
    it('should clean up all limiters', function () {
      createHybridRateLimiter({ windowMs: 60000, maxRequests: 10, keyPrefix: 'destroy-test' })
      expect(function () {
        destroyAllLimiters()
      }).not.toThrow()
    })
  })
})

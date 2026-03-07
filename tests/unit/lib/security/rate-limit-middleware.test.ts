import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  rateLimit,
  withRateLimit,
  rateLimiters,
  createRateLimiter,
} from '@/lib/security/rate-limit-middleware'
import { NextRequest, NextResponse } from 'next/server'

let uniqueId = 0

const createMockRequest = (ip: string = '127.0.0.1', method: string = 'GET'): NextRequest => {
  uniqueId++
  return {
    headers: {
      get: vi.fn((name: string) => {
        if (name === 'x-forwarded-for') return `${ip}-${uniqueId}`
        if (name === 'x-real-ip') return `${ip}-${uniqueId}`
        return null
      }),
    },
    method,
    ip: `${ip}-${uniqueId}`,
  } as unknown as NextRequest
}

const createMockResponse = (body: unknown, status: number = 200): NextResponse => {
  const headers = new Map<string, string>()
  return {
    body,
    init: { status },
    headers: {
      set: (key: string, value: string) => headers.set(key, value),
      get: (key: string) => headers.get(key) || null,
    },
    status,
  } as unknown as NextResponse
}

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => {
      const headers = new Map<string, string>()
      return {
        body,
        init,
        headers: {
          set: (key: string, value: string) => headers.set(key, value),
          get: (key: string) => headers.get(key) || null,
        },
      }
    }),
  },
}))

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    uniqueId = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('rateLimit', () => {
    it('should return null for first request within limit', async () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 5 })
      const req = createMockRequest()
      const result = await limiter(req)
      expect(result).toBeNull()
    })

    it('should return null for requests within limit', async () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 5 })
      const req = createMockRequest()

      for (let i = 0; i < 4; i++) {
        const result = await limiter(req)
        expect(result).toBeNull()
      }
    })

    it('should return 429 response when limit exceeded', async () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 2 })
      const req = createMockRequest()

      await limiter(req)
      await limiter(req)
      const result = await limiter(req)

      expect(result).not.toBeNull()
      expect((result as unknown as { body: unknown }).body).toEqual({
        success: false,
        error: 'Too many requests, please try again later',
      })
    })

    it('should use custom key generator', async () => {
      let callCount = 0
      const customKeyGenerator = vi.fn(() => `custom-key-${callCount++}`)
      const limiter = rateLimit({
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: customKeyGenerator,
      })
      const req = createMockRequest()

      await limiter(req)
      expect(customKeyGenerator).toHaveBeenCalledWith(req)
    })

    it('should skip requests when skip function returns true', async () => {
      const skipFn = vi.fn(() => true)
      const limiter = rateLimit({
        windowMs: 60000,
        maxRequests: 1,
        skip: skipFn,
      })
      const req = createMockRequest()

      await limiter(req)
      await limiter(req)
      await limiter(req)

      expect(skipFn).toHaveBeenCalled()
    })

    it('should use custom handler when provided', async () => {
      const customHandler = vi.fn(() => createMockResponse({ custom: 'error' }, 429))
      const limiter = rateLimit({
        windowMs: 60000,
        maxRequests: 1,
        handler: customHandler,
      })
      const req = createMockRequest()

      await limiter(req)
      await limiter(req)

      expect(customHandler).toHaveBeenCalled()
    })

    it('should track different IPs separately', async () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 1 })

      const req1 = createMockRequest('192.168.1.1')
      const req2 = createMockRequest('192.168.1.2')

      await limiter(req1)
      const result1 = await limiter(req1)
      expect(result1).not.toBeNull()

      const result2 = await limiter(req2)
      expect(result2).toBeNull()
    })

    it('should handle requests without IP gracefully', async () => {
      const reqWithoutIp = {
        headers: {
          get: vi.fn(() => null),
        },
        ip: undefined,
      } as unknown as NextRequest

      const limiter = rateLimit({ windowMs: 60000, maxRequests: 1 })
      const result = await limiter(reqWithoutIp)
      expect(result).toBeNull()
    })
  })

  describe('withRateLimit', () => {
    const mockHandler = vi.fn(async () => createMockResponse({ success: true }))

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should block handler when limit exceeded', async () => {
      const protectedHandler = withRateLimit(mockHandler, { windowMs: 60000, maxRequests: 1 })
      const req = createMockRequest()

      await protectedHandler(req)
      mockHandler.mockClear()
      await protectedHandler(req)

      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should use default config when no config provided', async () => {
      const protectedHandler = withRateLimit(mockHandler)
      const req = createMockRequest()

      const result = await protectedHandler(req)
      expect(result).toBeDefined()
    })
  })

  describe('rateLimiters', () => {
    it('should have api limiter configured', () => {
      expect(rateLimiters.api).toBeDefined()
      expect(typeof rateLimiters.api).toBe('function')
    })

    it('should have auth limiter configured', () => {
      expect(rateLimiters.auth).toBeDefined()
      expect(typeof rateLimiters.auth).toBe('function')
    })

    it('should have upload limiter configured', () => {
      expect(rateLimiters.upload).toBeDefined()
      expect(typeof rateLimiters.upload).toBe('function')
    })

    it('should have strict limiter configured', () => {
      expect(rateLimiters.strict).toBeDefined()
      expect(typeof rateLimiters.strict).toBe('function')
    })
  })

  describe('createRateLimiter', () => {
    it('should create a new rate limiter with custom config', async () => {
      const customLimiter = createRateLimiter({ windowMs: 5000, maxRequests: 3 })
      const req = createMockRequest()

      expect(customLimiter).toBeDefined()
      expect(typeof customLimiter).toBe('function')

      const result1 = await customLimiter(req)
      expect(result1).toBeDefined()
    })

    it('should create independent limiters', async () => {
      const req1 = createMockRequest('ip1')
      const req2 = createMockRequest('ip2')

      const limiter1 = createRateLimiter({ windowMs: 60000, maxRequests: 1 })
      const limiter2 = createRateLimiter({ windowMs: 60000, maxRequests: 1 })

      await limiter1(req1)
      const result1 = await limiter1(req1)
      expect(result1).not.toBeNull()

      const result2 = await limiter2(req2)
      expect(result2).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle concurrent requests', async () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 5 })
      const req = createMockRequest()

      const promises = Array(10)
        .fill(null)
        .map(() => limiter(req))
      const results = await Promise.all(promises)

      const blockedCount = results.filter((r) => r !== null).length
      expect(blockedCount).toBeGreaterThan(0)
    })
  })
})

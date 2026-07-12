import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimiters } from '@/lib/api/rate-limiters'
import { rateLimiters as securityRateLimiters } from '@/lib/security/rate-limit-middleware'
import type { NextRequest, NextResponse } from 'next/server'

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      const headers = new Map<string, string>()
      return {
        body,
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

type MockResponse = {
  body: unknown
  init?: { status?: number; headers?: Record<string, string> }
  headers: { set: (k: string, v: string) => void; get: (k: string) => string | null }
}

const BLOCKED_BODY = {
  success: false,
  error: 'Too many requests, please try again later',
}

let ipCounter = 0
const uniqueIp = (): string => `10.${++ipCounter}.0.1`

const makeReq = (ip: string, method = 'GET'): NextRequest =>
  ({
    headers: {
      get: vi.fn((name: string) => {
        if (name === 'x-forwarded-for') return ip
        if (name === 'x-real-ip') return ip
        return null
      }),
    },
    method,
    ip,
  }) as unknown as NextRequest

const blocked = async (fn: (req: NextRequest) => Promise<NextResponse | null>, ip: string) =>
  (await fn(makeReq(ip))) as unknown as MockResponse

describe('src/lib/api/rate-limiters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('re-export contract', () => {
    it('exposes a rateLimiters object', () => {
      expect(rateLimiters).toBeDefined()
      expect(typeof rateLimiters).toBe('object')
    })

    it('is the same reference as @/lib/security/rate-limit-middleware (no divergence)', () => {
      expect(rateLimiters).toBe(securityRateLimiters)
    })

    it('exposes exactly api, auth, strict, upload — each a function', () => {
      expect(Object.keys(rateLimiters).sort()).toEqual(['api', 'auth', 'strict', 'upload'])
      for (const key of Object.keys(rateLimiters)) {
        expect(typeof (rateLimiters as Record<string, unknown>)[key]).toBe('function')
      }
    })
  })

  describe('api limiter (100 req / 60s)', () => {
    it('allows requests well under the limit', async () => {
      const ip = uniqueIp()
      for (let i = 0; i < 50; i++) {
        expect(await rateLimiters.api(makeReq(ip))).toBeNull()
      }
    })

    it('blocks the 101st request with 429 + rate-limit headers (fail-safe: deny)', async () => {
      const ip = uniqueIp()
      for (let i = 0; i < 100; i++) await rateLimiters.api(makeReq(ip))
      const res = await blocked(rateLimiters.api, ip)
      expect(res).not.toBeNull()
      expect(res.body).toEqual(BLOCKED_BODY)
      expect(res.init?.status).toBe(429)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(res.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/)
      expect(Number(res.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0)
      expect(res.init?.headers?.['Retry-After']).toBe('60')
    })
  })

  describe('auth limiter (5 req / 15min)', () => {
    it('allows 5 requests then blocks the 6th', async () => {
      const ip = uniqueIp()
      for (let i = 0; i < 5; i++) {
        expect(await rateLimiters.auth(makeReq(ip))).toBeNull()
      }
      const res = await blocked(rateLimiters.auth, ip)
      expect(res).not.toBeNull()
      expect(res.init?.status).toBe(429)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
    })
  })

  describe('upload limiter (20 req / 1h)', () => {
    it('allows 20 requests then blocks the 21st', async () => {
      const ip = uniqueIp()
      for (let i = 0; i < 20; i++) {
        expect(await rateLimiters.upload(makeReq(ip))).toBeNull()
      }
      const res = await blocked(rateLimiters.upload, ip)
      expect(res).not.toBeNull()
      expect(res.init?.status).toBe(429)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('20')
    })
  })

  describe('strict limiter (10 req / 60s)', () => {
    it('allows 10 requests then blocks the 11th', async () => {
      const ip = uniqueIp()
      for (let i = 0; i < 10; i++) {
        expect(await rateLimiters.strict(makeReq(ip))).toBeNull()
      }
      const res = await blocked(rateLimiters.strict, ip)
      expect(res).not.toBeNull()
      expect(res.init?.status).toBe(429)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
    })
  })

  describe('isolation between clients', () => {
    it('tracks distinct IPs independently for the same limiter', async () => {
      const ipA = uniqueIp()
      const ipB = uniqueIp()
      for (let i = 0; i < 11; i++) await rateLimiters.strict(makeReq(ipA))
      expect(await rateLimiters.strict(makeReq(ipB))).toBeNull()
    })

    it('keeps a fresh limiter usable from a different IP after another limiter blocks its IP', async () => {
      const ipA = uniqueIp()
      const ipB = uniqueIp()
      for (let i = 0; i < 6; i++) await rateLimiters.auth(makeReq(ipA))
      expect(await blocked(rateLimiters.auth, ipA)).not.toBeNull()
      expect(await rateLimiters.api(makeReq(ipB))).toBeNull()
    })
  })

  describe('window reset (time-based recovery)', () => {
    it('restores the allowance once the 60s strict window elapses', async () => {
      const ip = uniqueIp()
      for (let i = 0; i < 10; i++) await rateLimiters.strict(makeReq(ip))
      expect(await blocked(rateLimiters.strict, ip)).not.toBeNull()
      vi.advanceTimersByTime(60_001)
      expect(await rateLimiters.strict(makeReq(ip))).toBeNull()
    })
  })

  describe('fail-safe behavior', () => {
    it('denies every over-limit request (never silently allows) within the window', async () => {
      const ip = uniqueIp()
      for (let i = 0; i < 5; i++) await rateLimiters.auth(makeReq(ip))
      for (let i = 0; i < 3; i++) {
        const res = await blocked(rateLimiters.auth, ip)
        expect(res).not.toBeNull()
        expect(res.init?.status).toBe(429)
        expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
      }
    })

    it('handles a request missing all IP headers without throwing (keyed unknown)', async () => {
      const req = {
        headers: { get: vi.fn(() => null) },
        method: 'GET',
        ip: undefined,
      } as unknown as NextRequest
      await expect(rateLimiters.api(req)).resolves.toBeNull()
    })
  })
})

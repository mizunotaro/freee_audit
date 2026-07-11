import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  OUTBOUND_USER_AGENT,
  OutboundRateLimitError,
  OutboundRateLimiter,
  assertOutboundAllowed,
  createOutboundRateLimiter,
  getOutboundRateLimiter,
  outboundRateLimiters,
  resetOutboundRateLimiters,
  resolveOutboundHost,
  withOutboundUserAgent,
} from '@/lib/api/outbound-rate-limiter'

describe('OUTBOUND_USER_AGENT', () => {
  it('advertises the application name and a contact link', () => {
    expect(OUTBOUND_USER_AGENT).toContain('freee_audit')
    expect(OUTBOUND_USER_AGENT.length).toBeGreaterThan(0)
  })
})

describe('withOutboundUserAgent', () => {
  it('adds the User-Agent when no headers are supplied', () => {
    expect(withOutboundUserAgent()).toEqual({ 'User-Agent': OUTBOUND_USER_AGENT })
  })

  it('adds the User-Agent alongside existing headers without clobbering them', () => {
    const merged = withOutboundUserAgent({ 'Content-Type': 'application/json' })
    expect(merged['Content-Type']).toBe('application/json')
    expect(merged['User-Agent']).toBe(OUTBOUND_USER_AGENT)
  })

  it('preserves a caller-supplied User-Agent (case-insensitive)', () => {
    for (const name of ['User-Agent', 'user-agent', 'USER-AGENT']) {
      const merged = withOutboundUserAgent({ [name]: 'custom-agent/9.9' })
      const uaKey = Object.keys(merged).find((k) => k.toLowerCase() === 'user-agent')
      expect(uaKey).toBeDefined()
      expect(merged[uaKey!]).toBe('custom-agent/9.9')
    }
  })

  it('honours an explicit userAgent override', () => {
    const merged = withOutboundUserAgent(undefined, 'override-agent/0.1')
    expect(merged['User-Agent']).toBe('override-agent/0.1')
  })
})

describe('resolveOutboundHost', () => {
  it('extracts the hostname from a URL', () => {
    expect(resolveOutboundHost('https://api.example.com/path?x=1')).toBe('api.example.com')
  })

  it('falls back when the URL is malformed', () => {
    expect(resolveOutboundHost('not-a-url')).toBe('unknown-host')
  })
})

describe('OutboundRateLimiter.tryAcquire', () => {
  let limiter: OutboundRateLimiter

  beforeEach(() => {
    limiter = new OutboundRateLimiter({ windowMs: 60_000, maxRequests: 3, keyPrefix: 'test' })
  })

  it('returns a failure Result for an empty key', () => {
    const result = limiter.tryAcquire('  ')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('allows up to maxRequests calls and reports the remaining budget', () => {
    const first = limiter.tryAcquire('host')
    expect(first.success).toBe(true)
    if (first.success) {
      expect(first.data.allowed).toBe(true)
      expect(first.data.remaining).toBe(2)
    }
    limiter.tryAcquire('host')
    const third = limiter.tryAcquire('host')
    if (third.success) expect(third.data.remaining).toBe(0)
  })

  it('denies once the budget is exhausted and reports retryAfterMs', () => {
    for (let i = 0; i < 3; i++) {
      const r = limiter.tryAcquire('host')
      if (r.success) expect(r.data.allowed).toBe(true)
    }
    const denied = limiter.tryAcquire('host')
    if (denied.success) {
      expect(denied.data.allowed).toBe(false)
      expect(denied.data.remaining).toBe(0)
      expect(denied.data.retryAfterMs).toBeGreaterThan(0)
    }
  })

  it('does not consume a token for a denied attempt', () => {
    for (let i = 0; i < 3; i++) limiter.tryAcquire('host')
    for (let i = 0; i < 5; i++) {
      const denied = limiter.tryAcquire('host')
      if (denied.success) expect(denied.data.allowed).toBe(false)
    }
    const stillDenied = limiter.tryAcquire('host')
    if (stillDenied.success) expect(stillDenied.data.allowed).toBe(false)
  })

  it('treats distinct keys independently', () => {
    for (let i = 0; i < 3; i++) limiter.tryAcquire('a')
    const otherHost = limiter.tryAcquire('b')
    if (otherHost.success) expect(otherHost.data.allowed).toBe(true)
  })

  it('replenishes the budget after the sliding window elapses', () => {
    vi.useFakeTimers()
    try {
      const sliding = new OutboundRateLimiter({
        windowMs: 1000,
        maxRequests: 1,
        keyPrefix: 'slide',
      })
      const first = sliding.tryAcquire('h')
      if (first.success) expect(first.data.allowed).toBe(true)

      vi.advanceTimersByTime(500)
      const mid = sliding.tryAcquire('h')
      if (mid.success) expect(mid.data.allowed).toBe(false)

      vi.advanceTimersByTime(501)
      const after = sliding.tryAcquire('h')
      if (after.success) expect(after.data.allowed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reset() clears all token state', () => {
    for (let i = 0; i < 3; i++) limiter.tryAcquire('host')
    limiter.reset()
    const after = limiter.tryAcquire('host')
    if (after.success) {
      expect(after.data.allowed).toBe(true)
      expect(after.data.remaining).toBe(2)
    }
  })
})

describe('createOutboundRateLimiter', () => {
  it('succeeds for valid config', () => {
    const result = createOutboundRateLimiter({
      windowMs: 1000,
      maxRequests: 5,
      keyPrefix: 'ok',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.config.maxRequests).toBe(5)
      expect(result.data).toBeInstanceOf(OutboundRateLimiter)
    }
  })

  it('fails for non-positive maxRequests', () => {
    const result = createOutboundRateLimiter({
      windowMs: 1000,
      maxRequests: 0,
      keyPrefix: 'bad',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('fails for non-integer windowMs', () => {
    const result = createOutboundRateLimiter({
      windowMs: 1.5,
      maxRequests: 5,
      keyPrefix: 'bad',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.details).toBeDefined()
    }
  })

  it('fails for an empty keyPrefix', () => {
    const result = createOutboundRateLimiter({
      windowMs: 1000,
      maxRequests: 5,
      keyPrefix: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('outboundRateLimiters registry', () => {
  beforeEach(() => {
    resetOutboundRateLimiters()
  })

  afterEach(() => {
    resetOutboundRateLimiters()
  })

  it('caches a limiter per config', () => {
    const a = outboundRateLimiters.marketData()
    const b = outboundRateLimiters.marketData()
    expect(a).toBe(b)
  })

  it('returns distinct limiters for distinct configs', () => {
    const market = outboundRateLimiters.marketData()
    const internal = outboundRateLimiters.internalService()
    expect(market).not.toBe(internal)
    expect(market.config.maxRequests).not.toBe(internal.config.maxRequests)
  })

  it('resetOutboundRateLimiters clears consumed tokens', () => {
    const limiter = getOutboundRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      keyPrefix: 'reset-probe',
    })
    expect(limiter.tryAcquire('k').success).toBe(true)
    const before = limiter.tryAcquire('k')
    if (before.success) expect(before.data.allowed).toBe(false)

    resetOutboundRateLimiters()
    const after = limiter.tryAcquire('k')
    if (after.success) expect(after.data.allowed).toBe(true)
  })
})

describe('assertOutboundAllowed', () => {
  let limiter: OutboundRateLimiter

  beforeEach(() => {
    limiter = new OutboundRateLimiter({ windowMs: 5000, maxRequests: 1, keyPrefix: 'assert' })
  })

  it('does not throw while under the limit', () => {
    expect(() => assertOutboundAllowed(limiter, 'host')).not.toThrow()
  })

  it('throws OutboundRateLimitError once the limit is exceeded', () => {
    assertOutboundAllowed(limiter, 'host')
    try {
      assertOutboundAllowed(limiter, 'host')
      throw new Error('expected OutboundRateLimitError')
    } catch (error) {
      expect(error).toBeInstanceOf(OutboundRateLimitError)
      const e = error as OutboundRateLimitError
      expect(e.key).toBe('host')
      expect(e.retryAfterMs).toBeGreaterThan(0)
    }
  })
})

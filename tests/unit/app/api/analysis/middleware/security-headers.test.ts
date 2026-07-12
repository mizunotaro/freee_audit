import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

import {
  addSecurityHeaders,
  withSecurityHeaders,
  SECURITY_HEADERS,
} from '@/app/api/analysis/middleware/security-headers'

const EXPECTED_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-xss-protection': '1; mode=block',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"

const makeResponse = (
  body: unknown = { ok: true },
  init: { status?: number; headers?: Record<string, string> } = {}
): NextResponse => {
  const response = NextResponse.json(body, { status: init.status ?? 200 })
  if (init.headers) {
    for (const [key, value] of Object.entries(init.headers)) response.headers.set(key, value)
  }
  return response
}

const makeHandler = (body: unknown = { ok: true }, status = 200) =>
  vi.fn(async (_req: Request) => NextResponse.json(body, { status }))

const expectAllBaseHeaders = (headers: Headers) => {
  for (const [key, value] of Object.entries(EXPECTED_HEADERS)) {
    expect(headers.get(key)).toBe(value)
  }
}

const setNodeEnv = (value: string | undefined) => {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

let originalNodeEnv: string | undefined

beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV
  setNodeEnv('test')
  vi.clearAllMocks()
})

afterEach(() => {
  setNodeEnv(originalNodeEnv)
  vi.clearAllMocks()
})

describe('SECURITY_HEADERS constant', () => {
  it('exposes exactly the five hardening headers', () => {
    expect(Object.keys(SECURITY_HEADERS).sort()).toEqual(
      [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
        'Permissions-Policy',
      ].sort()
    )
  })

  it('maps each header name to its canonical value', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block')
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(SECURITY_HEADERS['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()')
  })
})

describe('addSecurityHeaders', () => {
  it('stamps all five base headers onto a plain response', () => {
    const response = addSecurityHeaders(makeResponse())

    expectAllBaseHeaders(response.headers)
  })

  it('returns the same response instance it was given (in-place mutation, not a clone)', () => {
    const response = makeResponse()
    const result = addSecurityHeaders(response)

    expect(result).toBe(response)
  })

  it('preserves unrelated headers that were already on the response', () => {
    const response = makeResponse({ ok: true }, { headers: { 'x-request-id': 'req-123' } })

    addSecurityHeaders(response)

    expect(response.headers.get('x-request-id')).toBe('req-123')
    expectAllBaseHeaders(response.headers)
  })

  it('overwrites a weaker pre-existing security header with the canonical value', () => {
    const response = makeResponse({ ok: true }, { headers: { 'x-frame-options': 'SAMEORIGIN' } })

    addSecurityHeaders(response)

    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  it('is idempotent (applying twice yields the same single values, no duplication)', () => {
    const response = makeResponse()

    addSecurityHeaders(response)
    addSecurityHeaders(response)

    expectAllBaseHeaders(response.headers)
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  it('does not set Content-Security-Policy when NODE_ENV is not production', () => {
    setNodeEnv('test')

    const response = addSecurityHeaders(makeResponse())

    expect(response.headers.get('content-security-policy')).toBeNull()
  })

  it('preserves a caller-supplied CSP in non-production (never strips or overwrites it)', () => {
    setNodeEnv('test')
    const response = makeResponse(
      { ok: true },
      { headers: { 'content-security-policy': "default-src 'self'" } }
    )

    addSecurityHeaders(response)

    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'")
  })

  it.each(['development', 'staging', '', 'Production', 'prod'])(
    'does not set CSP for NODE_ENV=%j (only the exact value "production" qualifies)',
    (env) => {
      setNodeEnv(env)

      const response = addSecurityHeaders(makeResponse())

      expect(response.headers.get('content-security-policy')).toBeNull()
    }
  )

  it('sets the Content-Security-Policy header verbatim when NODE_ENV is "production"', () => {
    setNodeEnv('production')

    const response = addSecurityHeaders(makeResponse())

    expect(response.headers.get('content-security-policy')).toBe(EXPECTED_CSP)
  })

  it('still applies all five base headers in production alongside the CSP', () => {
    setNodeEnv('production')

    const response = addSecurityHeaders(makeResponse())

    expectAllBaseHeaders(response.headers)
    expect(response.headers.get('content-security-policy')).toBe(EXPECTED_CSP)
  })

  it('keeps the original body and status code intact after stamping headers', async () => {
    const response = addSecurityHeaders(makeResponse({ ok: true }, { status: 201 }))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('fails safe by never throwing for a well-formed response in any environment', () => {
    setNodeEnv('production')
    const response = makeResponse()

    expect(() => addSecurityHeaders(response)).not.toThrow()
  })
})

describe('withSecurityHeaders', () => {
  it('returns a wrapper that stamps the security headers onto the handler response', async () => {
    const handler = makeHandler({ ok: true })
    const wrapped = withSecurityHeaders()(handler)

    const response = await wrapped(new Request('http://localhost/api/analysis'))

    expect(handler).toHaveBeenCalledTimes(1)
    expectAllBaseHeaders(response.headers)
  })

  it('forwards the original request to the handler unchanged', async () => {
    const handler = makeHandler({ ok: true })
    const wrapped = withSecurityHeaders()(handler)
    const request = new Request('http://localhost/api/analysis')

    await wrapped(request)

    expect(handler).toHaveBeenCalledWith(request)
  })

  it('preserves the handler response body and status', async () => {
    const handler = makeHandler({ created: true }, 201)
    const wrapped = withSecurityHeaders()(handler)

    const response = await wrapped(new Request('http://localhost/api/analysis'))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ created: true })
  })

  it('sets the CSP through the wrapper in production', async () => {
    setNodeEnv('production')
    const handler = makeHandler({ ok: true })
    const wrapped = withSecurityHeaders()(handler)

    const response = await wrapped(new Request('http://localhost/api/analysis'))

    expect(response.headers.get('content-security-policy')).toBe(EXPECTED_CSP)
  })

  it('does not set the CSP through the wrapper in non-production', async () => {
    setNodeEnv('test')
    const handler = makeHandler({ ok: true })
    const wrapped = withSecurityHeaders()(handler)

    const response = await wrapped(new Request('http://localhost/api/analysis'))

    expect(response.headers.get('content-security-policy')).toBeNull()
  })

  it('returns the exact instance returned by the handler (mutated, not cloned)', async () => {
    const handlerResponse = NextResponse.json({ ok: true })
    const handler = vi.fn(async () => handlerResponse)
    const wrapped = withSecurityHeaders()(handler)

    const response = await wrapped(new Request('http://localhost/api/analysis'))

    expect(response).toBe(handlerResponse)
  })

  it('propagates handler errors instead of swallowing them (fails closed)', async () => {
    const handler = vi.fn(async () => {
      throw new Error('handler exploded')
    })
    const wrapped = withSecurityHeaders()(handler)

    await expect(wrapped(new Request('http://localhost/api/analysis'))).rejects.toThrow(
      'handler exploded'
    )
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('each withSecurityHeaders() call yields an independent wrapper', async () => {
    const wrapA = withSecurityHeaders()
    const wrapB = withSecurityHeaders()

    expect(wrapA).not.toBe(wrapB)

    const handlerA = makeHandler({ a: 1 })
    const handlerB = makeHandler({ b: 2 })

    const [responseA, responseB] = await Promise.all([
      wrapA(handlerA)(new Request('http://localhost/a')),
      wrapB(handlerB)(new Request('http://localhost/b')),
    ])

    expect(await responseA.json()).toEqual({ a: 1 })
    expect(await responseB.json()).toEqual({ b: 2 })
    expectAllBaseHeaders(responseA.headers)
    expectAllBaseHeaders(responseB.headers)
    expect(handlerA).toHaveBeenCalledTimes(1)
    expect(handlerB).toHaveBeenCalledTimes(1)
  })
})

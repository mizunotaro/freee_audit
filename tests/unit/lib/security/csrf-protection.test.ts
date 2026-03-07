import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createCsrfToken,
  validateCsrfToken,
  getCsrfTokenFromRequest,
  withCsrfProtection,
  setCsrfCookie,
  csrfMiddleware,
} from '@/lib/security/csrf-protection'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body, init) => ({ body, init, headers: new Map() })),
  },
}))

describe('CSRF Protection', () => {
  describe('createCsrfToken', () => {
    it('should generate a valid token', () => {
      const tokenData = createCsrfToken()

      expect(tokenData).toBeDefined()
      expect(tokenData.token).toBeDefined()
      expect(typeof tokenData.token).toBe('string')
      expect(tokenData.token.length).toBeGreaterThan(0)
      expect(tokenData.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should generate unique tokens', () => {
      const token1 = createCsrfToken()
      const token2 = createCsrfToken()
      expect(token1.token).not.toBe(token2.token)
    })

    it('should generate signed tokens with format token.signature', () => {
      const tokenData = createCsrfToken()
      const parts = tokenData.token.split('.')
      expect(parts.length).toBe(2)
    })

    it('should set expiry time to 1 hour in future', () => {
      const tokenData = createCsrfToken()
      const expectedExpiry = Date.now() + 60 * 60 * 1000
      const tolerance = 1000
      expect(tokenData.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - tolerance)
      expect(tokenData.expiresAt).toBeLessThanOrEqual(expectedExpiry + tolerance)
    })
  })

  describe('validateCsrfToken', () => {
    it('should validate a valid token', () => {
      const tokenData = createCsrfToken()
      expect(validateCsrfToken(tokenData.token)).toBe(true)
    })

    it('should reject tampered token', () => {
      const tokenData = createCsrfToken()
      const parts = tokenData.token.split('.')
      const tampered = `${parts[0]}.${parts[1].slice(0, -1)}x`
      expect(validateCsrfToken(tampered)).toBe(false)
    })

    it('should reject token with invalid signature', () => {
      const tokenData = createCsrfToken()
      const parts = tokenData.token.split('.')
      const invalidToken = `${parts[0]}.${'a'.repeat(parts[1].length)}`
      expect(validateCsrfToken(invalidToken)).toBe(false)
    })

    it('should reject empty token', () => {
      expect(validateCsrfToken('')).toBe(false)
    })

    it('should reject token without signature', () => {
      expect(validateCsrfToken('tokenwithoutdot')).toBe(false)
    })

    it('should reject token with multiple dots', () => {
      expect(validateCsrfToken('part1.part2.part3')).toBe(false)
    })
  })

  describe('getCsrfTokenFromRequest', () => {
    it('should get token from header', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((name: string) => (name === 'x-csrf-token' ? 'header-token' : null)),
        },
        cookies: {
          get: vi.fn(),
        },
      } as unknown as NextRequest

      const token = getCsrfTokenFromRequest(mockRequest)
      expect(token).toBe('header-token')
    })

    it('should get token from cookie if header not present', () => {
      const mockRequest = {
        headers: {
          get: vi.fn(() => null),
        },
        cookies: {
          get: vi.fn((name: string) =>
            name === 'csrf-token' ? { value: 'cookie-token' } : undefined
          ),
        },
      } as unknown as NextRequest

      const token = getCsrfTokenFromRequest(mockRequest)
      expect(token).toBe('cookie-token')
    })

    it('should prefer header over cookie', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((name: string) => (name === 'x-csrf-token' ? 'header-token' : null)),
        },
        cookies: {
          get: vi.fn(() => ({ value: 'cookie-token' })),
        },
      } as unknown as NextRequest

      const token = getCsrfTokenFromRequest(mockRequest)
      expect(token).toBe('header-token')
    })

    it('should return null if no token present', () => {
      const mockRequest = {
        headers: {
          get: vi.fn(() => null),
        },
        cookies: {
          get: vi.fn(() => undefined),
        },
      } as unknown as NextRequest

      const token = getCsrfTokenFromRequest(mockRequest)
      expect(token).toBeNull()
    })
  })

  describe('withCsrfProtection', () => {
    const mockHandler = vi.fn(async () => ({ success: true }) as unknown as NextResponse)

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should allow GET requests without token', async () => {
      const mockRequest = {
        method: 'GET',
        headers: { get: vi.fn() },
        cookies: { get: vi.fn() },
      } as unknown as NextRequest

      const protectedHandler = withCsrfProtection(mockHandler)
      await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should allow HEAD requests without token', async () => {
      const mockRequest = {
        method: 'HEAD',
        headers: { get: vi.fn() },
        cookies: { get: vi.fn() },
      } as unknown as NextRequest

      const protectedHandler = withCsrfProtection(mockHandler)
      await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should allow OPTIONS requests without token', async () => {
      const mockRequest = {
        method: 'OPTIONS',
        headers: { get: vi.fn() },
        cookies: { get: vi.fn() },
      } as unknown as NextRequest

      const protectedHandler = withCsrfProtection(mockHandler)
      await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should block POST requests without token', async () => {
      const mockRequest = {
        method: 'POST',
        headers: { get: vi.fn(() => null) },
        cookies: { get: vi.fn(() => undefined) },
      } as unknown as NextRequest

      const protectedHandler = withCsrfProtection(mockHandler)
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response).toEqual(
        expect.objectContaining({
          body: { success: false, error: 'CSRF token missing' },
          init: { status: 403 },
        })
      )
    })

    it('should block POST requests with invalid token', async () => {
      const mockRequest = {
        method: 'POST',
        headers: { get: vi.fn(() => 'invalid-token') },
        cookies: { get: vi.fn() },
      } as unknown as NextRequest

      const protectedHandler = withCsrfProtection(mockHandler)
      const response = await protectedHandler(mockRequest)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response).toEqual(
        expect.objectContaining({
          body: { success: false, error: 'Invalid CSRF token' },
          init: { status: 403 },
        })
      )
    })

    it('should allow POST requests with valid token', async () => {
      const tokenData = createCsrfToken()
      const mockRequest = {
        method: 'POST',
        headers: { get: vi.fn(() => tokenData.token) },
        cookies: { get: vi.fn() },
      } as unknown as NextRequest

      const protectedHandler = withCsrfProtection(mockHandler)
      await protectedHandler(mockRequest)

      expect(mockHandler).toHaveBeenCalled()
    })
  })

  describe('setCsrfCookie', () => {
    it('should set cookie with correct options', () => {
      const mockResponse = {
        cookies: {
          set: vi.fn(),
        },
      } as unknown as NextResponse

      setCsrfCookie(mockResponse, 'test-token')

      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'csrf-token',
        'test-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        })
      )
    })
  })

  describe('csrfMiddleware', () => {
    it('should return object with generateToken, validate, and protect functions', () => {
      const middleware = csrfMiddleware()

      expect(middleware).toHaveProperty('generateToken')
      expect(middleware).toHaveProperty('validate')
      expect(middleware).toHaveProperty('protect')
      expect(typeof middleware.generateToken).toBe('function')
      expect(typeof middleware.validate).toBe('function')
      expect(typeof middleware.protect).toBe('function')
    })

    it('should generate valid tokens through middleware', () => {
      const middleware = csrfMiddleware()
      const tokenData = middleware.generateToken()

      expect(middleware.validate(tokenData.token)).toBe(true)
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAuthenticatedUser,
  requireRole,
  requireCompanyAccess,
  validateCompanyId,
  extractCompanyId,
  AuthenticationError,
  AuthorizationError,
} from '@/lib/api/auth-helpers'
import { validateSession } from '@/lib/auth'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

function createMockRequest(options: {
  cookies?: Record<string, string>
  url?: string
}): NextRequest {
  const { cookies = {}, url = 'http://localhost/api/test' } = options

  const mockCookies = new Map<string, { value: string }>()
  Object.entries(cookies).forEach(([key, value]) => {
    mockCookies.set(key, { value })
  })

  return {
    cookies: {
      get: (name: string) => mockCookies.get(name),
    },
    url,
  } as unknown as NextRequest
}

function createMockUser(
  overrides: {
    id?: string
    email?: string
    name?: string
    role?: string
    companyId?: string | null
  } = {}
) {
  return {
    id: overrides.id || 'user-123',
    email: overrides.email || 'test@example.com',
    name: overrides.name || 'Test User',
    role: overrides.role || 'VIEWER',
    companyId: overrides.companyId !== undefined ? overrides.companyId : 'company-1',
  }
}

describe('Auth Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAuthenticatedUser', () => {
    it('should throw AuthenticationError when no token', async () => {
      const request = createMockRequest({ cookies: {} })
      await expect(getAuthenticatedUser(request)).rejects.toThrow(AuthenticationError)
      await expect(getAuthenticatedUser(request)).rejects.toThrow('No session token provided')
    })

    it('should throw AuthenticationError when invalid token', async () => {
      vi.mocked(validateSession).mockResolvedValueOnce(null)
      const request = createMockRequest({
        cookies: { session: 'invalid_token' },
      })
      await expect(getAuthenticatedUser(request)).rejects.toThrow(AuthenticationError)
      await expect(getAuthenticatedUser(request)).rejects.toThrow('Invalid or expired session')
    })

    it('should return user when valid token', async () => {
      const mockUser = createMockUser()
      vi.mocked(validateSession).mockResolvedValueOnce(mockUser)

      const request = createMockRequest({
        cookies: { session: 'valid_token' },
      })

      const user = await getAuthenticatedUser(request)
      expect(user).toBeDefined()
      expect(user.id).toBe('user-123')
      expect(user.email).toBe('test@example.com')
    })
  })

  describe('requireRole', () => {
    it('should not throw when user has required role', async () => {
      const user = createMockUser({ role: 'ADMIN' })
      await expect(requireRole(user, ['ADMIN', 'SUPER_ADMIN'])).resolves.not.toThrow()
    })

    it('should throw AuthorizationError when user lacks role', async () => {
      const user = createMockUser({ role: 'VIEWER' })
      await expect(requireRole(user, ['ADMIN'])).rejects.toThrow(AuthorizationError)
      await expect(requireRole(user, ['ADMIN'])).rejects.toThrow(/Required roles: ADMIN/)
    })

    it('should allow user with any of the required roles', async () => {
      const user = createMockUser({ role: 'ACCOUNTANT' })
      await expect(requireRole(user, ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'])).resolves.not.toThrow()
    })

    it('should throw when required roles array is empty', async () => {
      const user = createMockUser({ role: 'VIEWER' })
      await expect(requireRole(user, [])).rejects.toThrow(AuthorizationError)
    })
  })

  describe('requireCompanyAccess', () => {
    it('should allow SUPER_ADMIN to access any company', async () => {
      const user = createMockUser({ role: 'SUPER_ADMIN', companyId: 'company1' })
      await expect(requireCompanyAccess(user, 'company2')).resolves.not.toThrow()
    })

    it('should allow user to access own company', async () => {
      const user = createMockUser({ role: 'ACCOUNTANT', companyId: 'company1' })
      await expect(requireCompanyAccess(user, 'company1')).resolves.not.toThrow()
    })

    it('should deny user access to other company', async () => {
      const user = createMockUser({ role: 'ACCOUNTANT', companyId: 'company1' })
      await expect(requireCompanyAccess(user, 'company2')).rejects.toThrow(AuthorizationError)
      await expect(requireCompanyAccess(user, 'company2')).rejects.toThrow(
        'Access denied to this company'
      )
    })

    it('should deny user without company access to any company', async () => {
      const user = createMockUser({ role: 'VIEWER', companyId: null })
      await expect(requireCompanyAccess(user, 'company1')).rejects.toThrow(AuthorizationError)
    })
  })

  describe('extractCompanyId', () => {
    it('should extract companyId from URL query params', () => {
      const request = createMockRequest({
        url: 'http://localhost/api/test?companyId=company-123',
      })
      const companyId = extractCompanyId(request)
      expect(companyId).toBe('company-123')
    })

    it('should return null when companyId not in query params', () => {
      const request = createMockRequest({
        url: 'http://localhost/api/test',
      })
      const companyId = extractCompanyId(request)
      expect(companyId).toBeNull()
    })
  })

  describe('validateCompanyId', () => {
    it('should return user companyId when no param provided', async () => {
      const user = createMockUser({ companyId: 'company-1' })
      const result = await validateCompanyId(user, null)
      expect(result).toBe('company-1')
    })

    it('should throw when user has no company and no param', async () => {
      const user = createMockUser({ companyId: null })
      await expect(validateCompanyId(user, null)).rejects.toThrow(AuthorizationError)
      await expect(validateCompanyId(user, null)).rejects.toThrow('Company ID is required')
    })

    it('should validate and return companyId when user has access', async () => {
      const user = createMockUser({ companyId: 'company-1' })
      const result = await validateCompanyId(user, 'company-1')
      expect(result).toBe('company-1')
    })

    it('should allow SUPER_ADMIN to access any companyId', async () => {
      const user = createMockUser({ role: 'SUPER_ADMIN', companyId: 'company-1' })
      const result = await validateCompanyId(user, 'company-2')
      expect(result).toBe('company-2')
    })

    it('should deny access when user tries to access different company', async () => {
      const user = createMockUser({ role: 'ACCOUNTANT', companyId: 'company-1' })
      await expect(validateCompanyId(user, 'company-2')).rejects.toThrow(AuthorizationError)
    })
  })

  describe('Error classes', () => {
    it('AuthenticationError should have correct name', () => {
      const error = new AuthenticationError('Test error')
      expect(error.name).toBe('AuthenticationError')
      expect(error.message).toBe('Test error')
    })

    it('AuthenticationError should have default message', () => {
      const error = new AuthenticationError()
      expect(error.message).toBe('Unauthorized')
    })

    it('AuthorizationError should have correct name', () => {
      const error = new AuthorizationError('Test error')
      expect(error.name).toBe('AuthorizationError')
      expect(error.message).toBe('Test error')
    })

    it('AuthorizationError should have default message', () => {
      const error = new AuthorizationError()
      expect(error.message).toBe('Insufficient permissions')
    })
  })
})

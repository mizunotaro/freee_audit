import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAuthUser, hasMinimumRole, ROLE_HIERARCHY } from '@/lib/api'
import { validateSession } from '@/lib/auth'
import type { NextRequest } from 'next/server'

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

function createMockUser(overrides: { role?: string; companyId?: string | null } = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: overrides.role || 'VIEWER',
    companyId: overrides.companyId !== undefined ? overrides.companyId : 'company-1',
  }
}

describe('lib/api index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ROLE_HIERARCHY', () => {
    it('ranks roles as expected', () => {
      expect(ROLE_HIERARCHY).toEqual({
        VIEWER: 0,
        ACCOUNTANT: 10,
        ADMIN: 50,
        SUPER_ADMIN: 100,
        INVESTOR: 5,
      })
    })

    it('orders INVESTOR above VIEWER but below ACCOUNTANT', () => {
      expect(ROLE_HIERARCHY.VIEWER).toBeLessThan(ROLE_HIERARCHY.INVESTOR)
      expect(ROLE_HIERARCHY.INVESTOR).toBeLessThan(ROLE_HIERARCHY.ACCOUNTANT)
    })
  })

  describe('hasMinimumRole', () => {
    it('grants access when role equals the minimum', () => {
      expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true)
    })

    it('grants access when role exceeds the minimum', () => {
      expect(hasMinimumRole('ADMIN', 'ACCOUNTANT')).toBe(true)
      expect(hasMinimumRole('SUPER_ADMIN', 'ADMIN')).toBe(true)
    })

    it('denies access when role is below the minimum', () => {
      expect(hasMinimumRole('VIEWER', 'ACCOUNTANT')).toBe(false)
      expect(hasMinimumRole('ACCOUNTANT', 'SUPER_ADMIN')).toBe(false)
    })

    it('denies access for an unknown user role against a known minimum', () => {
      expect(hasMinimumRole('GHOST', 'VIEWER')).toBe(false)
    })

    it('grants access for a known role against an unknown minimum (treated as 0)', () => {
      expect(hasMinimumRole('ADMIN', 'NONEXISTENT')).toBe(true)
    })

    it('denies access when both role and minimum are unknown', () => {
      expect(hasMinimumRole('GHOST', 'PHANTOM')).toBe(false)
    })

    it('lets INVESTOR satisfy the VIEWER minimum', () => {
      expect(hasMinimumRole('INVESTOR', 'VIEWER')).toBe(true)
    })
  })

  describe('getAuthUser', () => {
    it('returns the user when the session token is valid', async () => {
      const user = createMockUser({ role: 'ADMIN' })
      vi.mocked(validateSession).mockResolvedValueOnce(user)

      const result = await getAuthUser(createMockRequest({ cookies: { session: 'valid' } }))

      expect(validateSession).toHaveBeenCalledWith('valid')
      expect(result).toEqual(user)
    })

    it('returns null when there is no session cookie', async () => {
      const result = await getAuthUser(createMockRequest({ cookies: {} }))

      expect(result).toBeNull()
      expect(validateSession).not.toHaveBeenCalled()
    })

    it('returns null when the session is invalid or expired', async () => {
      vi.mocked(validateSession).mockResolvedValueOnce(null)

      const result = await getAuthUser(createMockRequest({ cookies: { session: 'stale' } }))

      expect(result).toBeNull()
    })

    it('returns null when session validation throws', async () => {
      vi.mocked(validateSession).mockRejectedValueOnce(new Error('db down'))

      const result = await getAuthUser(createMockRequest({ cookies: { session: 'token' } }))

      expect(result).toBeNull()
    })
  })
})

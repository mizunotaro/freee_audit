import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withAuth,
  withAuthForGet,
  withAuthForPost,
  withAuthForPut,
  withAuthForDelete,
  withAdminAuth,
  withAccountantAuth,
} from '@/lib/api/with-auth'
import {
  getAuthenticatedUser,
  requireRole,
  handleAuthError,
  createAuthenticatedRequest,
  type AuthenticatedRequest,
} from '@/lib/api/auth-helpers'
import type { AuthUser } from '@/lib/auth'
import { rateLimiters } from '@/lib/api/rate-limiters'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthenticatedUser: vi.fn(),
  requireRole: vi.fn(),
  handleAuthError: vi.fn(),
  createAuthenticatedRequest: vi.fn(),
}))

vi.mock('@/lib/api/rate-limiters', () => ({
  rateLimiters: {
    api: vi.fn(),
    auth: vi.fn(),
    upload: vi.fn(),
    strict: vi.fn(),
  },
}))

function fakeRequest(): NextRequest {
  return { url: 'http://localhost/api/test' } as unknown as NextRequest
}

function fakeUser(overrides: { role?: string; companyId?: string | null } = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'u@example.com',
    name: 'U',
    role: overrides.role ?? 'ADMIN',
    companyId: overrides.companyId !== undefined ? overrides.companyId : 'company-1',
  }
}

describe('with-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedUser).mockResolvedValue(fakeUser())
    vi.mocked(requireRole).mockResolvedValue(undefined)
    vi.mocked(createAuthenticatedRequest).mockImplementation(
      (request: NextRequest, user: AuthUser): AuthenticatedRequest => {
        const authenticated = request as AuthenticatedRequest
        authenticated.user = user
        return authenticated
      }
    )
    vi.mocked(handleAuthError).mockReturnValue(
      NextResponse.json({ success: false, error: 'handled' }, { status: 500 })
    )
    for (const key of ['api', 'auth', 'upload', 'strict'] as const) {
      vi.mocked(rateLimiters[key]).mockReset()
    }
  })

  describe('withAuth', () => {
    it('authenticates, builds the authenticated request, and invokes the handler', async () => {
      const req = fakeRequest()
      const user = fakeUser()
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(user)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }, { status: 200 }))

      const response = await withAuth(handler)(req)

      expect(getAuthenticatedUser).toHaveBeenCalledWith(req)
      expect(createAuthenticatedRequest).toHaveBeenCalledWith(req, user)
      expect(handler).toHaveBeenCalledTimes(1)
      const [receivedReq, receivedCtx] = handler.mock.calls[0]
      expect(receivedReq).toBe(req)
      expect((receivedReq as AuthenticatedRequest).user).toEqual(user)
      expect(receivedCtx).toBeUndefined()
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: 1 })
    })

    it('forwards the route context to the handler', async () => {
      const req = fakeRequest()
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))
      const context = { params: { id: 'abc' } }

      await withAuth(handler)(req, context)

      expect(handler.mock.calls[0][1]).toEqual(context)
    })

    it('short-circuits on rate limit without authenticating', async () => {
      const req = fakeRequest()
      const limited = NextResponse.json({ error: 'too many' }, { status: 429 })
      vi.mocked(rateLimiters.api).mockResolvedValueOnce(limited)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      const response = await withAuth(handler, { rateLimit: 'api' })(req)

      expect(rateLimiters.api).toHaveBeenCalledWith(req)
      expect(getAuthenticatedUser).not.toHaveBeenCalled()
      expect(handler).not.toHaveBeenCalled()
      expect(response).toBe(limited)
    })

    it('continues past a rate limiter that does not block', async () => {
      const req = fakeRequest()
      vi.mocked(rateLimiters.strict).mockResolvedValueOnce(null)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAuth(handler, { rateLimit: 'strict' })(req)

      expect(rateLimiters.strict).toHaveBeenCalledWith(req)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('delegates role enforcement to requireRole', async () => {
      const req = fakeRequest()
      const user = fakeUser({ role: 'ACCOUNTANT' })
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(user)
      vi.mocked(requireRole).mockResolvedValueOnce(undefined)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAuth(handler, { requiredRoles: ['ACCOUNTANT', 'ADMIN'] })(req)

      expect(requireRole).toHaveBeenCalledWith(user, ['ACCOUNTANT', 'ADMIN'])
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('routes requireRole rejection to handleAuthError', async () => {
      const req = fakeRequest()
      const denied = new Error('forbidden')
      vi.mocked(requireRole).mockRejectedValueOnce(denied)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      const response = await withAuth(handler, { requiredRoles: ['ADMIN'] })(req)

      expect(handleAuthError).toHaveBeenCalledWith(denied)
      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(500)
    })

    it('returns 403 when requireCompany is set but the user has no company', async () => {
      const req = fakeRequest()
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(fakeUser({ companyId: null }))
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      const response = await withAuth(handler, { requireCompany: true })(req)

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        error: 'Company association required',
      })
      expect(handler).not.toHaveBeenCalled()
    })

    it('proceeds when requireCompany is set and the user has a company', async () => {
      const req = fakeRequest()
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(fakeUser({ companyId: 'company-1' }))
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      const response = await withAuth(handler, { requireCompany: true })(req)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
    })

    it('routes authentication failure to handleAuthError', async () => {
      const req = fakeRequest()
      const authError = new Error('unauthenticated')
      vi.mocked(getAuthenticatedUser).mockRejectedValueOnce(authError)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      const response = await withAuth(handler)(req)

      expect(handleAuthError).toHaveBeenCalledWith(authError)
      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(500)
    })
  })

  describe('method-specific wrappers', () => {
    it('withAuthForGet applies no rate limit by default', async () => {
      const req = fakeRequest()
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAuthForGet(handler)(req)

      expect(rateLimiters.api).not.toHaveBeenCalled()
      expect(rateLimiters.strict).not.toHaveBeenCalled()
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('withAuthForPost applies the api rate limiter by default', async () => {
      const req = fakeRequest()
      vi.mocked(rateLimiters.api).mockResolvedValueOnce(null)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAuthForPost(handler)(req)

      expect(rateLimiters.api).toHaveBeenCalledWith(req)
      expect(rateLimiters.strict).not.toHaveBeenCalled()
    })

    it('withAuthForPut applies the api rate limiter by default', async () => {
      const req = fakeRequest()
      vi.mocked(rateLimiters.api).mockResolvedValueOnce(null)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAuthForPut(handler)(req)

      expect(rateLimiters.api).toHaveBeenCalledWith(req)
    })

    it('withAuthForDelete applies the strict rate limiter by default', async () => {
      const req = fakeRequest()
      vi.mocked(rateLimiters.strict).mockResolvedValueOnce(null)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAuthForDelete(handler)(req)

      expect(rateLimiters.strict).toHaveBeenCalledWith(req)
      expect(rateLimiters.api).not.toHaveBeenCalled()
    })
  })

  describe('role-specific wrappers', () => {
    it('withAdminAuth requires ADMIN and SUPER_ADMIN', async () => {
      const req = fakeRequest()
      const user = fakeUser({ role: 'ADMIN' })
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(user)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAdminAuth(handler)(req)

      expect(requireRole).toHaveBeenCalledWith(user, ['ADMIN', 'SUPER_ADMIN'])
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('withAccountantAuth requires ACCOUNTANT, ADMIN and SUPER_ADMIN', async () => {
      const req = fakeRequest()
      const user = fakeUser({ role: 'ACCOUNTANT' })
      vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(user)
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }))

      await withAccountantAuth(handler)(req)

      expect(requireRole).toHaveBeenCalledWith(user, ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'])
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})

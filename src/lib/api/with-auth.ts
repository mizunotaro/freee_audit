import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedUser,
  requireRole,
  handleAuthError,
  createAuthenticatedRequest,
  type AuthenticatedRequest,
  type ApiHandler,
  type AuthOptions,
} from './auth-helpers'
import { rateLimiters } from './rate-limiters'

export function withAuth(
  handler: ApiHandler,
  options: AuthOptions = {}
): (req: NextRequest, context?: { params?: Record<string, string> }) => Promise<NextResponse> {
  return async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    try {
      if (options.rateLimit) {
        const limiter = rateLimiters[options.rateLimit]
        const limitedResponse = await limiter(req)
        if (limitedResponse) {
          return limitedResponse
        }
      }

      const user = await getAuthenticatedUser(req)

      if (options.requiredRoles && options.requiredRoles.length > 0) {
        await requireRole(user, options.requiredRoles)
      }

      if (options.requireCompany && !user.companyId) {
        return NextResponse.json(
          { success: false, error: 'Company association required' },
          { status: 403 }
        )
      }

      const authenticatedRequest = createAuthenticatedRequest(req, user)

      return await handler(authenticatedRequest, context)
    } catch (error) {
      return handleAuthError(error)
    }
  }
}

export function withAuthForGet(handler: ApiHandler, options?: AuthOptions) {
  return withAuth(handler, options)
}

export function withAuthForPost(handler: ApiHandler, options?: AuthOptions) {
  return withAuth(handler, { ...options, rateLimit: options?.rateLimit || 'api' })
}

export function withAuthForPut(handler: ApiHandler, options?: AuthOptions) {
  return withAuth(handler, { ...options, rateLimit: options?.rateLimit || 'api' })
}

export function withAuthForDelete(handler: ApiHandler, options?: AuthOptions) {
  return withAuth(handler, { ...options, rateLimit: options?.rateLimit || 'strict' })
}

export function withAdminAuth(handler: ApiHandler, options?: Omit<AuthOptions, 'requiredRoles'>) {
  return withAuth(handler, {
    ...options,
    requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
  })
}

export function withAccountantAuth(
  handler: ApiHandler,
  options?: Omit<AuthOptions, 'requiredRoles'>
) {
  return withAuth(handler, {
    ...options,
    requiredRoles: ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'],
  })
}

export {
  type AuthenticatedRequest,
  type ApiHandler,
  type AuthOptions,
  AuthenticationError,
  AuthorizationError,
  getAuthenticatedUser,
  requireRole,
  requireCompanyAccess,
  createAuthenticatedRequest,
  handleAuthError,
  extractCompanyId,
  validateCompanyId,
} from './auth-helpers'

export {
  withAuth,
  withAuthForGet,
  withAuthForPost,
  withAuthForPut,
  withAuthForDelete,
  withAdminAuth,
  withAccountantAuth,
} from './with-auth'

export { rateLimiters } from './rate-limiters'

import { NextRequest } from 'next/server'
import { validateSession, type AuthUser } from '@/lib/auth'
import { getAuthenticatedUser } from './auth-helpers'

export type { AuthUser }

function getTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('session')?.value
  if (cookieToken) return cookieToken

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    return await getAuthenticatedUser(request)
  } catch {
    return null
  }
}

export const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  ACCOUNTANT: 10,
  ADMIN: 50,
  SUPER_ADMIN: 100,
  INVESTOR: 5,
}

export function hasMinimumRole(userRole: string, minimumRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? -1
  const minimumLevel = ROLE_HIERARCHY[minimumRole] ?? 0
  return userLevel >= minimumLevel
}

export function withRole(
  minimumRole: string,
  handler: Parameters<typeof import('./with-auth').withAuth>[0],
  options: Omit<import('./auth-helpers').AuthOptions, 'requiredRoles'> = {}
) {
  return import('./with-auth').then(({ withAuth }) =>
    withAuth(
      async (req) => {
        if (!hasMinimumRole(req.user.role, minimumRole)) {
          return NextResponse.json(
            { success: false, error: 'Insufficient role', code: 'FORBIDDEN' },
            { status: 403 }
          )
        }
        return handler(req)
      },
      { ...options }
    )
  )
}

import { NextResponse } from 'next/server'

export function withSuperAdminAuth(
  handler: Parameters<typeof import('./with-auth').withAuth>[0],
  options: Omit<import('./auth-helpers').AuthOptions, 'requiredRoles'> = {}
) {
  return import('./with-auth').then(({ withAuth }) =>
    withAuth(handler, {
      ...options,
      requiredRoles: ['SUPER_ADMIN'],
    })
  )
}

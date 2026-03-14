import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'
import type { Result, AppError } from '@/types/result'
import { failure, createAppError, ERROR_CODES } from '@/types/result'

export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser
}

export type ApiHandler = (
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) => Promise<NextResponse>

export type AuthenticatedHandler = (req: NextRequest, user: AuthUser) => Promise<NextResponse>

export interface AuthOptions {
  requiredRoles?: string[]
  requireCompany?: boolean
  rateLimit?: 'api' | 'auth' | 'upload' | 'strict'
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Get authenticated user from request (returns null instead of throwing)
 *
 * @param request - NextRequest with cookies
 * @returns AuthUser if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * const user = await getAuthUser(request)
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 * }
 * // proceed with user
 * ```
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

/**
 * Require authentication, returning 401 response if not authenticated
 *
 * @param request - NextRequest with cookies
 * @returns AuthUser if authenticated, or NextResponse with 401 status
 *
 * @example
 * ```typescript
 * const user = await requireAuth(request)
 * if (user instanceof NextResponse) {
 *   return user // 401 response
 * }
 * // proceed with user
 * ```
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}

/**
 * Get company ID from user
 *
 * @param user - Authenticated user
 * @returns Company ID if available, null otherwise
 *
 * @example
 * ```typescript
 * const companyId = getCompanyId(user)
 * if (!companyId) {
 *   return NextResponse.json({ error: 'No company associated' }, { status: 400 })
 * }
 * ```
 */
export function getCompanyId(user: AuthUser): string | null {
  return user.companyId ?? null
}

/**
 * Require company ID from user, returning Result type
 *
 * @param user - Authenticated user
 * @returns Result with company ID or error
 *
 * @example
 * ```typescript
 * const result = requireCompanyId(user)
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error.message }, { status: 400 })
 * }
 * const companyId = result.data
 * ```
 */
export function requireCompanyId(user: AuthUser): Result<string, AppError> {
  const companyId = getCompanyId(user)
  if (!companyId) {
    return failure(
      createAppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Company ID is required but not associated with this user'
      )
    )
  }
  return { success: true, data: companyId }
}

/**
 * Wrap an API handler with automatic authentication
 *
 * @param handler - Handler function that receives request and authenticated user
 * @returns Handler with authentication check applied
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (request, user) => {
 *   const companyId = getCompanyId(user)
 *   // handler logic
 *   return NextResponse.json({ data: 'result' })
 * })
 * ```
 */
export function withAuth(
  handler: AuthenticatedHandler
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, user)
  }
}

/**
 * Get authenticated user (throws on failure)
 *
 * @deprecated Use getAuthUser or requireAuth instead
 * @param request - NextRequest with cookies
 * @returns AuthUser
 * @throws AuthenticationError if not authenticated
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthUser> {
  const token = request.cookies.get('session')?.value

  if (!token) {
    throw new AuthenticationError('No session token provided')
  }

  const user = await validateSession(token)

  if (!user) {
    throw new AuthenticationError('Invalid or expired session')
  }

  return user
}

export async function requireRole(user: AuthUser, requiredRoles: string[]): Promise<void> {
  if (!requiredRoles.includes(user.role)) {
    throw new AuthorizationError(
      `Required roles: ${requiredRoles.join(', ')}, but user has: ${user.role}`
    )
  }
}

export async function requireCompanyAccess(user: AuthUser, companyId: string): Promise<void> {
  if (user.role === 'SUPER_ADMIN') {
    return
  }

  if (!user.companyId || user.companyId !== companyId) {
    throw new AuthorizationError('Access denied to this company')
  }
}

export function createAuthenticatedRequest(
  request: NextRequest,
  user: AuthUser
): AuthenticatedRequest {
  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.user = user
  return authenticatedRequest
}

export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 401 })
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 403 })
  }

  console.error('Unexpected auth error:', error)
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
}

export function extractCompanyId(request: NextRequest): string | null {
  const url = new URL(request.url)
  return url.searchParams.get('companyId')
}

export async function validateCompanyId(user: AuthUser, companyId: string | null): Promise<string> {
  if (!companyId) {
    if (!user.companyId) {
      throw new AuthorizationError('Company ID is required')
    }
    return user.companyId
  }

  await requireCompanyAccess(user, companyId)
  return companyId
}

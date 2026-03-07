import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser
}

export type ApiHandler = (
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) => Promise<NextResponse>

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

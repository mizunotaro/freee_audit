import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const CSRF_SECRET: string = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000
const CSRF_HEADER = 'x-csrf-token'
const CSRF_COOKIE = 'csrf-token'

interface CsrfTokenData {
  token: string
  expiresAt: number
}

function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function signToken(token: string): string {
  const hmac = crypto.createHmac('sha256', CSRF_SECRET)
  hmac.update(token)
  return `${token}.${hmac.digest('hex')}`
}

function verifySignedToken(signedToken: string): string | null {
  const parts = signedToken.split('.')
  if (parts.length !== 2) return null

  const [token, signature] = parts
  const expectedSignature = crypto.createHmac('sha256', CSRF_SECRET).update(token).digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null
  }

  return token
}

export function createCsrfToken(): CsrfTokenData {
  const token = generateCsrfToken()
  return {
    token: signToken(token),
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY,
  }
}

export function validateCsrfToken(token: string): boolean {
  const verified = verifySignedToken(token)
  return verified !== null
}

export function getCsrfTokenFromRequest(req: NextRequest): string | null {
  const headerToken = req.headers.get(CSRF_HEADER)
  if (headerToken) return headerToken

  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value
  if (cookieToken) return cookieToken

  return null
}

export function withCsrfProtection(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return handler(req)
    }

    const token = getCsrfTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ success: false, error: 'CSRF token missing' }, { status: 403 })
    }

    if (!validateCsrfToken(token)) {
      return NextResponse.json({ success: false, error: 'Invalid CSRF token' }, { status: 403 })
    }

    return handler(req)
  }
}

export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
    path: '/',
  })
}

export function csrfMiddleware(): {
  generateToken: () => CsrfTokenData
  validate: (token: string) => boolean
  protect: (
    handler: (req: NextRequest) => Promise<NextResponse>
  ) => (req: NextRequest) => Promise<NextResponse>
} {
  return {
    generateToken: createCsrfToken,
    validate: validateCsrfToken,
    protect: withCsrfProtection,
  }
}

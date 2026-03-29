import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  if (value.length < 32) {
    throw new Error(`Environment variable ${name} must be at least 32 characters`)
  }
  return value
}

const VERSION = '2.0.0'

const CSRF_SECRET: string = getRequiredEnvVar('CSRF_SECRET')
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000
const CSRF_HEADER = 'x-csrf-token'
const CSRF_COOKIE = 'csrf-token'
const NEW_CSRF_HEADER = 'x-new-csrf-token'

const consumedTokens = new Map<string, number>()
const CLEANUP_INTERVAL = 5 * 60 * 1000
const MAX_CONSUMED_CACHE = 10000

let lastCleanup = Date.now()

function cleanupConsumedTokens(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL && consumedTokens.size < MAX_CONSUMED_CACHE) return
  lastCleanup = now
  const expiryThreshold = now - CSRF_TOKEN_EXPIRY
  for (const [token, consumedAt] of consumedTokens) {
    if (consumedAt < expiryThreshold) {
      consumedTokens.delete(token)
    }
  }
}

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

  const sigBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expectedBuf.length) return null

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
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

export function consumeCsrfToken(token: string): boolean {
  cleanupConsumedTokens()

  if (consumedTokens.has(token)) {
    return false
  }

  const verified = verifySignedToken(token)
  if (verified === null) {
    return false
  }

  consumedTokens.set(token, Date.now())
  return true
}

export function isTokenConsumed(token: string): boolean {
  return consumedTokens.has(token)
}

export function getCsrfTokenFromRequest(req: NextRequest): string | null {
  return req.headers.get(CSRF_HEADER)
}

export function attachNewCsrfToken(response: NextResponse): NextResponse {
  const newToken = createCsrfToken()
  response.headers.set(NEW_CSRF_HEADER, newToken.token)
  setCsrfCookie(response, newToken.token)
  return response
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

    if (!consumeCsrfToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or reused CSRF token' },
        { status: 403 }
      )
    }

    const response = await handler(req)
    return attachNewCsrfToken(response)
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
  consume: (token: string) => boolean
  protect: (
    handler: (req: NextRequest) => Promise<NextResponse>
  ) => (req: NextRequest) => Promise<NextResponse>
} {
  return {
    generateToken: createCsrfToken,
    validate: validateCsrfToken,
    consume: consumeCsrfToken,
    protect: withCsrfProtection,
  }
}

export { NEW_CSRF_HEADER, VERSION }

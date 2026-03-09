import { NextResponse } from 'next/server'

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const

export function addSecurityHeaders<T>(response: NextResponse<T>): NextResponse<T> {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    )
  }

  return response
}

export function withSecurityHeaders() {
  return function <T>(
    handler: (request: Request) => Promise<NextResponse<T>>
  ): (request: Request) => Promise<NextResponse<T>> {
    return async (request: Request) => {
      const response = await handler(request)
      return addSecurityHeaders(response)
    }
  }
}

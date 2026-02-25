import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['ja', 'en'] as const
const defaultLocale = 'ja'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout', '/api/health']

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.includes(path))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle API routes first
  if (pathname.startsWith('/api/')) {
    if (isPublicPath(pathname)) {
      return NextResponse.next()
    }

    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Check for locale in path
  const localeMatch = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )

  // If no locale, redirect to default
  if (!localeMatch && pathname !== '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url))
  }

  // Root redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}/login`, request.url))
  }

  // Auth check for protected pages
  if (localeMatch && !isPublicPath(pathname)) {
    const token = request.cookies.get('session')?.value
    if (!token) {
      const loginUrl = new URL(`/${localeMatch}/login`, request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}

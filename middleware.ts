import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { locales, defaultLocale } from './src/lib/i18n/types'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout', '/api/health']

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.includes(path))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const localeMatch = locales.find((locale) => pathname.startsWith(`/${locale}`))
  if (!localeMatch && pathname !== '/') {
    return intlMiddleware(request)
  }

  if (pathname === '/') {
    return intlMiddleware(request)
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get('session')?.value

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value

  if (!token) {
    const locale = localeMatch || defaultLocale
    const loginUrl = new URL(`/${locale}/login`, request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/(ja|en)/:path*', '/api/:path*'],
}

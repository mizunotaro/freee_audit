import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateSessionEdge } from '@/lib/auth-edge'

const locales = ['ja', 'en'] as const
const defaultLocale = 'ja'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout', '/api/health']

const staticPaths = [
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
]

const staticExtensions = [
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.css',
  '.js',
  '.map',
  '.json',
  '.xml',
  '.txt',
]

function isStaticFile(pathname: string): boolean {
  if (staticPaths.includes(pathname)) {
    return true
  }
  return staticExtensions.some((ext) => pathname.endsWith(ext))
}

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname === `/ja${path}` || pathname === `/en${path}`
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticFile(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicPath(pathname)) {
      return NextResponse.next()
    }

    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSessionEdge(token)
    if (!user) {
      const response = NextResponse.json(
        { success: false, error: 'Invalid or expired session' },
        { status: 401 }
      )
      response.cookies.delete('session')
      return response
    }

    const response = NextResponse.next()
    response.headers.set('x-user-id', user.id)
    response.headers.set('x-user-role', user.role)
    response.headers.set('x-user-company-id', user.companyId || '')

    return response
  }

  if (pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  const localeMatch = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )

  if (!localeMatch && pathname !== '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url))
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}/login`, request.url))
  }

  if (localeMatch && !isPublicPath(pathname)) {
    const token = request.cookies.get('session')?.value
    if (!token) {
      const loginUrl = new URL(`/${localeMatch}/login`, request.url)
      return NextResponse.redirect(loginUrl)
    }

    const user = await validateSessionEdge(token)
    if (!user) {
      const loginUrl = new URL(`/${localeMatch}/login`, request.url)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('session')
      return response
    }
  }

  if (localeMatch) {
    return intlMiddleware(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png|manifest.json|robots.txt|sitemap.xml).*)',
  ],
}

import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateSessionEdge } from '@/lib/auth-edge'

const locales = ['ja', 'en']
const defaultLocale = 'ja'

const publicPaths = ['/login']
const publicApiPaths = ['/api/auth/login', '/api/auth/logout', '/api/health']

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
  const pathWithoutLocale = pathname.replace(/^\/(ja|en)(\/|$)/, '/')
  return publicPaths.some((path) => pathWithoutLocale === path || pathWithoutLocale === `${path}/`)
}

function isPublicApiPath(pathname: string): boolean {
  return publicApiPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticFile(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicApiPath(pathname)) {
      return NextResponse.next()
    }

    const token = request.cookies.get('session')?.value
    if (!token) {
      const response = NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      response.cookies.delete('session')
      return response
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

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/ja/login', request.url))
  }

  const localeMatch = pathname.match(/^\/(ja|en)(\/|$)/)
  const locale = localeMatch?.[1] || 'ja'

  if (localeMatch && !isPublicPath(pathname)) {
    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    }

    const user = await validateSessionEdge(token)
    if (!user) {
      const response = NextResponse.redirect(new URL(`/${locale}/login`, request.url))
      response.cookies.delete('session')
      return response
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png|manifest.json|robots.txt|sitemap.xml).*)',
  ],
}

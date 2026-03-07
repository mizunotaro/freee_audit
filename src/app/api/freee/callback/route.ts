import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { saveToken } from '@/lib/integrations/freee/token-store'

const client = new FreeeClient()

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session')?.value
    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/settings/freee?error=${encodeURIComponent(errorDescription || error)}`,
          request.url
        )
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings/freee?error=missing_parameters', request.url))
    }

    const storedState = request.cookies.get('freee_oauth_state')?.value
    const [companyId, stateToken] = state.split(':')

    if (!storedState || storedState !== stateToken) {
      return NextResponse.redirect(new URL('/settings/freee?error=invalid_state', request.url))
    }

    if (companyId !== user.companyId) {
      return NextResponse.redirect(new URL('/settings/freee?error=company_mismatch', request.url))
    }

    const tokenResponse = await client.exchangeCodeForToken(code)

    await saveToken(companyId, tokenResponse)

    const response = NextResponse.redirect(new URL('/settings/freee?connected=true', request.url))

    response.cookies.delete('freee_oauth_state')

    return response
  } catch (error) {
    console.error('Failed to handle freee callback:', error)
    return NextResponse.redirect(
      new URL('/settings/freee?error=authentication_failed', request.url)
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { generateSecureToken } from '@/lib/crypto/encryption'

const client = new FreeeClient()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('company_id') || 'default'

    const state = generateSecureToken(16)
    const authUrl = client.getAuthorizationUrl(`${companyId}:${state}`)

    const response = NextResponse.redirect(authUrl)

    response.cookies.set('freee_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Failed to initiate freee auth:', error)
    return NextResponse.json({ error: 'Failed to initiate authentication' }, { status: 500 })
  }
}

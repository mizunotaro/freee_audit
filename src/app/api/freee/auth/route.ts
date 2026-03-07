import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { generateSecureToken } from '@/lib/crypto/encryption'

const client = new FreeeClient()

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const state = generateSecureToken(16)
    const authUrl = client.getAuthorizationUrl(`${user.companyId}:${state}`)

    const response = NextResponse.redirect(authUrl)

    response.cookies.set('freee_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 600,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Failed to initiate freee auth:', error)
    return NextResponse.json({ error: 'Failed to initiate authentication' }, { status: 500 })
  }
}

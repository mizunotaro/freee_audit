import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { getToken, saveToken } from '@/lib/integrations/freee/token-store'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = user.companyId

    const token = await getToken(companyId)
    if (!token) {
      return NextResponse.json(
        { error: 'No token found. Please authenticate first.' },
        { status: 401 }
      )
    }

    const client = new FreeeClient(undefined, companyId)
    const newTokenResponse = await client.refreshToken(token.refreshToken)

    await saveToken(companyId, newTokenResponse)

    return NextResponse.json({
      success: true,
      expires_at: new Date(Date.now() + newTokenResponse.expires_in * 1000).toISOString(),
    })
  } catch (error) {
    console.error('Failed to refresh token:', error)
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { getToken, saveToken } from '@/lib/integrations/freee/token-store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id } = body

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const token = await getToken(company_id)
    if (!token) {
      return NextResponse.json(
        { error: 'No token found. Please authenticate first.' },
        { status: 401 }
      )
    }

    const client = new FreeeClient(undefined, company_id)
    const newTokenResponse = await client.refreshToken(token.refreshToken)

    await saveToken(company_id, newTokenResponse)

    return NextResponse.json({
      success: true,
      expires_at: new Date(Date.now() + newTokenResponse.expires_in * 1000).toISOString(),
    })
  } catch (error) {
    console.error('Failed to refresh token:', error)
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 })
  }
}

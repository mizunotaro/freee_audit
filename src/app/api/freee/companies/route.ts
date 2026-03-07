import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { FreeeClient } from '@/lib/integrations/freee/client'

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

    const client = new FreeeClient()
    const companies = await client.getCompanies()

    return NextResponse.json({
      companies,
      mock_mode: process.env.FREEE_MOCK_MODE === 'true',
    })
  } catch (error) {
    console.error('Failed to fetch companies:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }
}

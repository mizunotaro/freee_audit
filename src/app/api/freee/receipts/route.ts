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

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const client = new FreeeClient()
    const documents = await client.getDocuments(
      parseInt(user.companyId, 10),
      startDate || undefined,
      endDate || undefined,
      limit,
      offset
    )

    return NextResponse.json({
      receipts: documents.data,
      meta: documents.meta,
      mock_mode: process.env.FREEE_MOCK_MODE === 'true',
    })
  } catch (error) {
    console.error('Failed to fetch receipts:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
  }
}

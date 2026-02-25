import { NextRequest, NextResponse } from 'next/server'
import { FreeeClient } from '@/lib/integrations/freee/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('company_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const client = new FreeeClient()
    const journals = await client.getJournals(
      parseInt(companyId, 10),
      startDate || undefined,
      endDate || undefined,
      limit,
      offset
    )

    return NextResponse.json({
      journals: journals.data,
      meta: journals.meta,
      mock_mode: process.env.FREEE_MOCK_MODE === 'true',
    })
  } catch (error) {
    console.error('Failed to fetch journals:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 })
  }
}

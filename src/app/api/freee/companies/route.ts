import { NextRequest, NextResponse } from 'next/server'
import { FreeeClient } from '@/lib/integrations/freee/client'

export async function GET(_request: NextRequest) {
  try {
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

import { NextRequest, NextResponse } from 'next/server'
import { FreeeClient } from '@/lib/integrations/freee/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('company_id')
    const fiscalYear = searchParams.get('fiscal_year')
    const startMonth = searchParams.get('start_month')
    const endMonth = searchParams.get('end_month')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const client = new FreeeClient()
    const trialBalance = await client.getTrialBalance({
      company_id: parseInt(companyId, 10),
      fiscal_year: fiscalYear ? parseInt(fiscalYear, 10) : undefined,
      start_month: startMonth ? parseInt(startMonth, 10) : undefined,
      end_month: endMonth ? parseInt(endMonth, 10) : undefined,
    })

    return NextResponse.json({
      trial_balance: trialBalance.trial_balance,
      mock_mode: process.env.FREEE_MOCK_MODE === 'true',
    })
  } catch (error) {
    console.error('Failed to fetch trial balance:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to fetch trial balance' }, { status: 500 })
  }
}

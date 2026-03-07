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
    const fiscalYear = searchParams.get('fiscal_year')
    const startMonth = searchParams.get('start_month')
    const endMonth = searchParams.get('end_month')

    const client = new FreeeClient()
    const trialBalance = await client.getTrialBalance({
      company_id: parseInt(user.companyId, 10),
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

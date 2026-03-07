import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import {
  getCashOutForecasts,
  getMonthlyCashOutSummary,
  syncDebtsFromFreee,
} from '@/services/debt/debt-service'
import { prisma } from '@/lib/db'

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

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'forecast'
    const targetCompanyId = user.companyId

    switch (action) {
      case 'forecast': {
        const forecasts = await getCashOutForecasts(targetCompanyId, 3)
        return NextResponse.json({ forecasts })
      }

      case 'monthly': {
        const monthsParam = searchParams.get('months')
        const months = monthsParam ? parseInt(monthsParam) : 6
        const monthlySummary = await getMonthlyCashOutSummary(targetCompanyId, months)
        return NextResponse.json({ monthlySummary })
      }

      case 'sync': {
        const company = await prisma.company.findFirst({
          where: { id: targetCompanyId },
        })
        if (!company?.freeeCompanyId) {
          return NextResponse.json({ error: 'freee連携が設定されていません' }, { status: 400 })
        }
        const result = await syncDebtsFromFreee(targetCompanyId, parseInt(company.freeeCompanyId))
        return NextResponse.json(result)
      }

      default: {
        const allForecasts = await getCashOutForecasts(targetCompanyId, 3)
        const allMonthlySummary = await getMonthlyCashOutSummary(targetCompanyId, 6)
        return NextResponse.json({
          forecasts: allForecasts,
          monthlySummary: allMonthlySummary,
        })
      }
    }
  } catch (error) {
    console.error('Debt API error:', error)
    return NextResponse.json({ error: 'Failed to process debt request' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, freeeCompanyId } = body

    if (action === 'sync') {
      if (!freeeCompanyId) {
        return NextResponse.json({ error: 'freeeCompanyId is required' }, { status: 400 })
      }

      const result = await syncDebtsFromFreee(user.companyId, freeeCompanyId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Debt POST error:', error)
    return NextResponse.json({ error: 'Failed to process debt request' }, { status: 500 })
  }
}

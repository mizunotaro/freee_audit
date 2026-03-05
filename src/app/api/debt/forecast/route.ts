import { NextRequest, NextResponse } from 'next/server'
import {
  getCashOutForecasts,
  getMonthlyCashOutSummary,
  syncDebtsFromFreee,
} from '@/services/debt/debt-service'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'forecast'
    const companyId = searchParams.get('companyId')

    let targetCompanyId = companyId

    if (!targetCompanyId) {
      const companies = await prisma.company.findMany({ take: 1 })
      if (companies.length === 0) {
        const company = await prisma.company.create({
          data: { name: 'サンプル株式会社', fiscalYearStart: 4 },
        })
        targetCompanyId = company.id
      } else {
        targetCompanyId = companies[0].id
      }
    }

    switch (action) {
      case 'forecast':
        const forecasts = await getCashOutForecasts(targetCompanyId, 3)
        return NextResponse.json({ forecasts })

      case 'monthly':
        const monthsParam = searchParams.get('months')
        const months = monthsParam ? parseInt(monthsParam) : 6
        const monthlySummary = await getMonthlyCashOutSummary(targetCompanyId, months)
        return NextResponse.json({ monthlySummary })

      case 'sync':
        const company = await prisma.company.findFirst({
          where: { id: targetCompanyId },
        })
        if (!company?.freeeCompanyId) {
          return NextResponse.json({ error: 'freee連携が設定されていません' }, { status: 400 })
        }
        const result = await syncDebtsFromFreee(targetCompanyId, parseInt(company.freeeCompanyId))
        return NextResponse.json(result)

      default:
        const allForecasts = await getCashOutForecasts(targetCompanyId, 3)
        const allMonthlySummary = await getMonthlyCashOutSummary(targetCompanyId, 6)
        return NextResponse.json({
          forecasts: allForecasts,
          monthlySummary: allMonthlySummary,
        })
    }
  } catch (error) {
    console.error('Debt API error:', error)
    return NextResponse.json({ error: 'Failed to process debt request' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, companyId, freeeCompanyId } = body

    if (action === 'sync') {
      if (!companyId || !freeeCompanyId) {
        return NextResponse.json(
          { error: 'companyId and freeeCompanyId are required' },
          { status: 400 }
        )
      }

      const result = await syncDebtsFromFreee(companyId, freeeCompanyId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Debt POST error:', error)
    return NextResponse.json({ error: 'Failed to process debt request' }, { status: 500 })
  }
}

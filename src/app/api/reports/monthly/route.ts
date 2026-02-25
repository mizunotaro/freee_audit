import { NextRequest, NextResponse } from 'next/server'
import {
  generateMonthlyReport,
  getMonthlyTrend,
  getMultiMonthReport,
} from '@/services/report/monthly-report'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())
    const endMonth = parseInt(searchParams.get('endMonth') || month.toString())
    const monthCountParam = searchParams.get('monthCount')
    const monthCount = monthCountParam ? (parseInt(monthCountParam) as 3 | 6 | 12) : 3
    const mode = searchParams.get('mode') || 'table'
    const companyId = searchParams.get('companyId')

    let resolvedCompanyId = companyId
    if (!resolvedCompanyId) {
      const companies = await prisma.company.findMany({ take: 1 })
      if (companies.length === 0) {
        const company = await prisma.company.create({
          data: { name: 'サンプル株式会社', fiscalYearStart: 4 },
        })
        resolvedCompanyId = company.id
      } else {
        resolvedCompanyId = companies[0].id
      }
    }

    if (mode === 'single') {
      const report = await generateMonthlyReport({
        companyId: resolvedCompanyId,
        fiscalYear,
        month,
      })
      const trend = await getMonthlyTrend(resolvedCompanyId, fiscalYear)
      return NextResponse.json({ report, trend })
    }

    const report = await getMultiMonthReport(resolvedCompanyId, fiscalYear, endMonth, monthCount)
    const trend = await getMonthlyTrend(resolvedCompanyId, fiscalYear)
    return NextResponse.json({ report, trend })
  } catch (error) {
    console.error('Monthly report error:', error)
    return NextResponse.json({ error: 'Failed to generate monthly report' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { generateMonthlyReport, getMonthlyTrend } from '@/services/report/monthly-report'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      const companies = await prisma.company.findMany({ take: 1 })
      if (companies.length === 0) {
        const company = await prisma.company.create({
          data: { name: 'サンプル株式会社', fiscalYearStart: 4 },
        })
        return NextResponse.json(await generateReportWithCompanyId(company.id, fiscalYear, month))
      }
      return NextResponse.json(
        await generateReportWithCompanyId(companies[0].id, fiscalYear, month)
      )
    }

    const report = await generateReportWithCompanyId(companyId, fiscalYear, month)
    return NextResponse.json(report)
  } catch (error) {
    console.error('Monthly report error:', error)
    return NextResponse.json({ error: 'Failed to generate monthly report' }, { status: 500 })
  }
}

async function generateReportWithCompanyId(companyId: string, fiscalYear: number, month: number) {
  const report = await generateMonthlyReport({ companyId, fiscalYear, month })
  const trend = await getMonthlyTrend(companyId, fiscalYear)
  return { report, trend }
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import {
  generateMonthlyReport,
  getMonthlyTrend,
  getMultiMonthReport,
} from '@/services/report/monthly-report'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())
    const endMonth = parseInt(searchParams.get('endMonth') || month.toString())
    const monthCountParam = searchParams.get('monthCount')
    const monthCount = monthCountParam ? (parseInt(monthCountParam) as 3 | 6 | 12) : 3
    const mode = searchParams.get('mode') || 'table'
    const resolvedCompanyId = user.companyId

    if (mode === 'single') {
      const reportResult = await generateMonthlyReport({
        companyId: resolvedCompanyId,
        fiscalYear,
        month,
      })
      if (!reportResult.success) {
        return NextResponse.json({ error: reportResult.error.message }, { status: 404 })
      }
      const trend = await getMonthlyTrend(resolvedCompanyId, fiscalYear)
      return NextResponse.json({ report: reportResult.data, trend })
    }

    const reportResult = await getMultiMonthReport(
      resolvedCompanyId,
      fiscalYear,
      endMonth,
      monthCount
    )
    if (!reportResult.success) {
      return NextResponse.json({ error: reportResult.error.message }, { status: 404 })
    }
    const trend = await getMonthlyTrend(resolvedCompanyId, fiscalYear)
    return NextResponse.json({ report: reportResult.data, trend })
  } catch (error) {
    console.error('Monthly report error:', error)
    return NextResponse.json({ error: 'Failed to generate monthly report' }, { status: 500 })
  }
}

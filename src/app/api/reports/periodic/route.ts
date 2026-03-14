import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { withRateLimit } from '@/lib/security'
import {
  generatePeriodicReport,
  formatPeriodicReportForExport,
  type PeriodicReportConfig,
} from '@/services/report/periodic-report'

async function handler(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (request.method !== 'GET') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { searchParams } = new URL(request.url)
  const periodType = (searchParams.get('periodType') || '12months') as
    | '3months'
    | '6months'
    | '12months'
  const includePreviousYear = searchParams.get('includePreviousYear') === 'true'
  const exportFormat = searchParams.get('export')

  const fiscalYearEndMonth = parseInt(searchParams.get('fiscalYearEndMonth') || '12', 10)

  const config: PeriodicReportConfig = {
    companyId: user.companyId,
    fiscalYearEndMonth,
    periodType,
    includePreviousYear,
  }

  const report = await generatePeriodicReport(config)

  if (exportFormat === 'csv') {
    const rows = formatPeriodicReportForExport(report)
    const csv = rows.map((row) => row.join(',')).join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="periodic-report.csv"',
      },
    })
  }

  return NextResponse.json(report)
}

export const GET = withRateLimit(handler, { windowMs: 60000, maxRequests: 60 })

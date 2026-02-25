import { NextRequest, NextResponse } from 'next/server'
import {
  createExcelExportService,
  ExportRequest,
  DEFAULT_EXPORT_OPTIONS,
  ReportType,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  MonthlyReportData,
} from '@/services/export'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const reportType = searchParams.get('reportType') as ReportType
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || '0')
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const language = (searchParams.get('language') || 'ja') as 'ja' | 'en'

    if (!reportType || !fiscalYear) {
      return NextResponse.json(
        { error: 'Missing required parameters: reportType, fiscalYear' },
        { status: 400 }
      )
    }

    const options = {
      ...DEFAULT_EXPORT_OPTIONS,
      format: 'csv' as const,
      language,
      currency: (searchParams.get('currency') || 'JPY') as 'JPY' | 'USD',
      includeCharts: false,
    }

    const mockData = getMockReportData({ reportType, fiscalYear, month, options })
    const exportService = createExcelExportService()
    const result = await exportService.exportCSV(mockData, options)

    return NextResponse.json({
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
      fileSize: result.fileSize,
      filename: result.filename,
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: 'Failed to generate CSV' }, { status: 500 })
  }
}

function getMockReportData(
  request: ExportRequest
): BalanceSheetData | ProfitLossData | CashFlowData | MonthlyReportData {
  const { reportType, fiscalYear, month } = request

  switch (reportType) {
    case 'balance_sheet':
      return {
        fiscalYear,
        month: month || 12,
        asOfDate: new Date(fiscalYear, (month || 12) - 1, 31),
        assets: {
          current: [
            { name: '現金', nameEn: 'Cash', amount: 500000 },
            { name: '普通預金', nameEn: 'Ordinary Deposits', amount: 10000000 },
            { name: '売掛金', nameEn: 'Accounts Receivable', amount: 3000000 },
          ],
          fixed: [{ name: '建物', nameEn: 'Buildings', amount: 20000000 }],
          total: 33500000,
        },
        liabilities: {
          current: [{ name: '買掛金', nameEn: 'Accounts Payable', amount: 2000000 }],
          fixed: [],
          total: 2000000,
        },
        equity: {
          items: [
            { name: '資本金', nameEn: 'Capital Stock', amount: 10000000 },
            { name: '利益剰余金', nameEn: 'Retained Earnings', amount: 21500000 },
          ],
          total: 31500000,
        },
      }

    case 'profit_loss':
      return {
        fiscalYear,
        startMonth: 1,
        endMonth: month || 12,
        revenue: 50000000,
        costOfSales: 20000000,
        grossProfit: 30000000,
        sgaExpenses: [{ name: '給与手当', nameEn: 'Salaries', amount: 12000000 }],
        operatingIncome: 14500000,
        nonOperatingIncome: 0,
        nonOperatingExpenses: 0,
        ordinaryIncome: 14500000,
        extraordinaryIncome: 0,
        extraordinaryLoss: 0,
        incomeBeforeTax: 14500000,
        corporateTax: 4350000,
        netIncome: 10150000,
      }

    case 'cash_flow':
      return {
        fiscalYear,
        month: month || 12,
        operatingActivities: {
          netIncome: 10150000,
          adjustments: [{ name: '減価償却費', nameEn: 'Depreciation', amount: 3000000 }],
          netCashFromOperating: 13150000,
        },
        investingActivities: {
          items: [],
          netCashFromInvesting: 0,
        },
        financingActivities: {
          items: [],
          netCashFromFinancing: 0,
        },
        netChangeInCash: 13150000,
        beginningCash: 10000000,
        endingCash: 23150000,
      }

    default:
      return {
        fiscalYear,
        month: month || 1,
        balanceSheet: getMockReportData({
          ...request,
          reportType: 'balance_sheet',
        }) as BalanceSheetData,
        profitLoss: getMockReportData({ ...request, reportType: 'profit_loss' }) as ProfitLossData,
        cashFlow: getMockReportData({ ...request, reportType: 'cash_flow' }) as CashFlowData,
        kpi: {
          fiscalYear,
          month: month || 1,
          profitability: [],
          efficiency: [],
          safety: [],
          growth: [],
          cashFlow: [],
        },
        summary: {
          highlights: [],
          issues: [],
          nextMonthGoals: [],
        },
      } as MonthlyReportData
  }
}

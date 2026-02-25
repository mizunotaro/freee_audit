import { NextRequest, NextResponse } from 'next/server'
import {
  createExportService,
  ExportRequest,
  DEFAULT_EXPORT_OPTIONS,
  BalanceSheetData,
  ProfitLossData,
  MonthlyReportData,
} from '@/services/export'

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json()

    if (!body.reportType || !body.fiscalYear) {
      return NextResponse.json(
        { error: 'Missing required fields: reportType, fiscalYear' },
        { status: 400 }
      )
    }

    const options = {
      ...DEFAULT_EXPORT_OPTIONS,
      ...body.options,
      format: 'pptx' as const,
    }

    const mockData = getMockReportData(body)
    const exportService = createExportService('pptx')
    const result = await exportService.export(mockData, options)

    return NextResponse.json({
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
      fileSize: result.fileSize,
      filename: result.filename,
    })
  } catch (error) {
    console.error('PPTX export error:', error)
    return NextResponse.json({ error: 'Failed to generate PowerPoint' }, { status: 500 })
  }
}

function getMockReportData(
  request: ExportRequest
): BalanceSheetData | ProfitLossData | MonthlyReportData {
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
          fixed: [
            { name: '建物', nameEn: 'Buildings', amount: 20000000 },
            { name: '車両', nameEn: 'Vehicles', amount: 5000000 },
          ],
          total: 38500000,
        },
        liabilities: {
          current: [{ name: '買掛金', nameEn: 'Accounts Payable', amount: 2000000 }],
          fixed: [{ name: '長期借入金', nameEn: 'Long-Term Loans', amount: 10000000 }],
          total: 12000000,
        },
        equity: {
          items: [
            { name: '資本金', nameEn: 'Capital Stock', amount: 10000000 },
            { name: '利益剰余金', nameEn: 'Retained Earnings', amount: 16500000 },
          ],
          total: 26500000,
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
        sgaExpenses: [
          { name: '給与手当', nameEn: 'Salaries', amount: 12000000 },
          { name: '福利厚生費', nameEn: 'Welfare', amount: 2000000 },
        ],
        operatingIncome: 14500000,
        nonOperatingIncome: 500000,
        nonOperatingExpenses: 300000,
        ordinaryIncome: 14700000,
        extraordinaryIncome: 0,
        extraordinaryLoss: 0,
        incomeBeforeTax: 14700000,
        corporateTax: 4410000,
        netIncome: 10290000,
      }

    case 'monthly':
    default:
      return {
        fiscalYear,
        month: month || 1,
        balanceSheet: getMockReportData({
          ...request,
          reportType: 'balance_sheet',
        }) as BalanceSheetData,
        profitLoss: getMockReportData({ ...request, reportType: 'profit_loss' }) as ProfitLossData,
        cashFlow: {
          fiscalYear,
          month: month || 12,
          operatingActivities: {
            netIncome: 10290000,
            adjustments: [{ name: '減価償却費', nameEn: 'Depreciation', amount: 3000000 }],
            netCashFromOperating: 12790000,
          },
          investingActivities: {
            items: [{ name: '固定資産取得', nameEn: 'CapEx', amount: -2000000 }],
            netCashFromInvesting: -2000000,
          },
          financingActivities: {
            items: [{ name: '借入金返済', nameEn: 'Repayment', amount: -1000000 }],
            netCashFromFinancing: -1000000,
          },
          netChangeInCash: 9790000,
          beginningCash: 10000000,
          endingCash: 19790000,
        },
        kpi: {
          fiscalYear,
          month: month || 1,
          profitability: [{ key: 'roe', name: 'ROE', nameEn: 'ROE', value: 38.8, unit: '%' }],
          efficiency: [],
          safety: [],
          growth: [],
          cashFlow: [],
        },
        summary: {
          highlights: ['売上目標達成'],
          issues: ['売掛金回収期間の長期化'],
          nextMonthGoals: ['回収期間短縮施策の実施'],
        },
      } as MonthlyReportData
  }
}

import { NextRequest, NextResponse } from 'next/server'
import {
  createExcelExportService,
  ExportRequest,
  DEFAULT_EXPORT_OPTIONS,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  CashFlowStatementData,
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
      format: 'excel' as const,
    }

    const mockData = getMockReportData(body)
    const exportService = createExcelExportService()
    const result = await exportService.export(mockData, options)

    return NextResponse.json({
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
      fileSize: result.fileSize,
      filename: result.filename,
    })
  } catch (error) {
    console.error('Excel export error:', error)
    return NextResponse.json({ error: 'Failed to generate Excel' }, { status: 500 })
  }
}

function getMockReportData(
  request: ExportRequest
): BalanceSheetData | ProfitLossData | CashFlowData | CashFlowStatementData | MonthlyReportData {
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
          { name: '旅費交通費', nameEn: 'Travel', amount: 1000000 },
          { name: '通信費', nameEn: 'Communication', amount: 500000 },
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

    case 'cash_flow':
      return {
        fiscalYear,
        month: month || 12,
        operatingActivities: {
          netIncome: 10290000,
          adjustments: [
            { name: '減価償却費', nameEn: 'Depreciation', amount: 3000000 },
            { name: '売掛金増減', nameEn: 'AR Change', amount: -500000 },
          ],
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
      }

    case 'cash_flow_statement':
      return {
        fiscalYear,
        months: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          openingBalance: 10000000 + i * 500000,
          operatingReceipts: [
            { name: '売上入金', nameEn: 'Sales Receipts', amount: 4000000 + i * 100000 },
          ],
          operatingPayments: [
            { name: '仕入支払', nameEn: 'Purchase Payments', amount: 2000000 },
            { name: '人件費', nameEn: 'Labor Costs', amount: 1000000 },
          ],
          operatingCashFlow: 1000000 + i * 50000,
          investingCashFlow: i === 5 ? -500000 : 0,
          financingCashFlow: i % 6 === 0 ? -200000 : 0,
          netChange: 800000 + i * 50000,
          closingBalance: 10800000 + i * 550000,
        })),
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
        cashFlow: getMockReportData({ ...request, reportType: 'cash_flow' }) as CashFlowData,
        kpi: {
          fiscalYear,
          month: month || 1,
          profitability: [
            { key: 'roe', name: 'ROE', nameEn: 'ROE', value: 38.8, unit: '%' },
            { key: 'roa', name: 'ROA', nameEn: 'ROA', value: 26.7, unit: '%' },
            {
              key: 'gross_margin',
              name: '売上総利益率',
              nameEn: 'Gross Margin',
              value: 60,
              unit: '%',
            },
          ],
          efficiency: [
            {
              key: 'asset_turnover',
              name: '総資産回転率',
              nameEn: 'Asset Turnover',
              value: 1.3,
              unit: '回',
            },
          ],
          safety: [
            {
              key: 'current_ratio',
              name: '流動比率',
              nameEn: 'Current Ratio',
              value: 675,
              unit: '%',
            },
            {
              key: 'equity_ratio',
              name: '自己資本比率',
              nameEn: 'Equity Ratio',
              value: 68.8,
              unit: '%',
            },
          ],
          growth: [
            {
              key: 'revenue_growth',
              name: '売上成長率',
              nameEn: 'Revenue Growth',
              value: 15.2,
              unit: '%',
            },
          ],
          cashFlow: [
            { key: 'fcf', name: 'FCF', nameEn: 'Free Cash Flow', value: 10790000, unit: '円' },
          ],
        },
        summary: {
          highlights: ['売上目標達成', '営業利益率向上'],
          issues: ['売掛金回収期間の長期化'],
          nextMonthGoals: ['回収期間短縮施策の実施'],
        },
      } as MonthlyReportData
  }
}

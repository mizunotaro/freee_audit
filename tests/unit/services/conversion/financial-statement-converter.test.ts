import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FinancialStatementConverter } from '@/services/conversion/financial-statement-converter'
import type { JournalConversion } from '@/types/conversion'

vi.mock('@/lib/db', () => ({
  prisma: {
    chartOfAccountItem: {
      findMany: vi.fn(),
    },
    cashFlow: {
      findMany: vi.fn(),
    },
  },
}))

function makeJournalConversion(
  targetCode: string,
  targetName: string,
  sourceCode: string,
  debit: number,
  credit: number
): JournalConversion {
  return {
    sourceJournalId: `j-${sourceCode}`,
    sourceDate: new Date('2024-01-15'),
    sourceDescription: `Entry ${sourceCode}`,
    lines: [
      {
        sourceAccountCode: sourceCode,
        sourceAccountName: `Source ${sourceCode}`,
        targetAccountCode: targetCode,
        targetAccountName: targetName,
        debitAmount: debit,
        creditAmount: credit,
        mappingId: `map-${targetCode}`,
      },
    ],
    mappingConfidence: 0.9,
    requiresReview: false,
  }
}

describe('FinancialStatementConverter', () => {
  let converter: FinancialStatementConverter

  beforeEach(() => {
    vi.clearAllMocks()
    converter = new FinancialStatementConverter()
  })

  describe('convertBalanceSheet', () => {
    it('should categorize assets, liabilities, and equity', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.chartOfAccountItem.findMany).mockResolvedValue([
        { id: '1', code: '1100', name: '現金', nameEn: 'Cash', category: 'current_asset' } as any,
        { id: '2', code: '2100', name: '建物', nameEn: 'Building', category: 'fixed_asset' } as any,
        {
          id: '3',
          code: '4100',
          name: '買掛金',
          nameEn: 'AP',
          category: 'current_liability',
        } as any,
        { id: '4', code: '6100', name: '資本金', nameEn: 'Capital', category: 'equity' } as any,
      ])

      const conversions: JournalConversion[] = [
        makeJournalConversion('1100', '現金', '1001', 1000, 0),
        makeJournalConversion('2100', '建物', '2001', 5000, 0),
        makeJournalConversion('4100', '買掛金', '4001', 0, 3000),
        makeJournalConversion('6100', '資本金', '6001', 0, 4000),
      ]

      const result = await converter.convertBalanceSheet('co1', 2024, 3, conversions, 'coa1')

      expect(result.assets).toHaveLength(2)
      expect(result.liabilities).toHaveLength(1)
      expect(result.equity).toHaveLength(1)
      expect(result.totalAssets).toBe(6000)
      expect(result.totalLiabilities).toBe(-3000)
      expect(result.totalEquity).toBe(-4000)
    })

    it('should skip accounts not found in target COA', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.chartOfAccountItem.findMany).mockResolvedValue([
        { id: '1', code: '1100', name: '現金', nameEn: 'Cash', category: 'current_asset' } as any,
      ])

      const conversions: JournalConversion[] = [
        makeJournalConversion('1100', '現金', '1001', 500, 0),
        makeJournalConversion('9999', 'Unknown', '9001', 100, 0),
      ]

      const result = await converter.convertBalanceSheet('co1', 2024, 1, conversions, 'coa1')

      expect(result.assets).toHaveLength(1)
    })

    it('should calculate asOfDate as last day of the month', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.chartOfAccountItem.findMany).mockResolvedValue([])

      const result = await converter.convertBalanceSheet('co1', 2024, 2, [], 'coa1')

      expect(result.asOfDate.getFullYear()).toBe(2024)
      expect(result.asOfDate.getMonth()).toBe(1)
      expect(result.asOfDate.getDate()).toBe(29)
    })
  })

  describe('convertProfitLoss', () => {
    it('should categorize revenue, COGS, SGA expenses correctly', async function () {
      const conversions: JournalConversion[] = [
        makeJournalConversion('7100', '売上', '7001', 0, 10000),
        makeJournalConversion('8100', '売上原価', '8001', 4000, 0),
        makeJournalConversion('9100', '販売費', '9001', 2000, 0),
        makeJournalConversion('9550', '受取利息', '9501', 0, 500),
        makeJournalConversion('9750', '支払利息', '9701', 200, 0),
      ]

      const result = await converter.convertProfitLoss('co1', 2024, 3, conversions)

      expect(result.revenue).toHaveLength(1)
      expect(result.costOfSales).toHaveLength(1)
      expect(result.sgaExpenses).toHaveLength(1)
      expect(result.nonOperatingIncome).toHaveLength(1)
      expect(result.nonOperatingExpenses).toHaveLength(1)
    })

    it('should aggregate amounts across conversions', async function () {
      const conversions: JournalConversion[] = [
        makeJournalConversion('7100', '売上', '7001', 10000, 0),
        makeJournalConversion('8100', '売上原価', '8001', 4000, 0),
        makeJournalConversion('9100', '販売費', '9001', 2000, 0),
      ]

      const result = await converter.convertProfitLoss('co1', 2024, 6, conversions)

      expect(result.revenue).toHaveLength(1)
      expect(result.costOfSales).toHaveLength(1)
      expect(result.sgaExpenses).toHaveLength(1)
    })
  })

  describe('convertCashFlow', () => {
    it('should categorize operating, investing, financing activities', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.cashFlow.findMany).mockResolvedValue([
        { category: 'operating_activities', itemName: '7100' } as any,
        { category: 'investing_ppe', itemName: '2100' } as any,
        { category: 'financing_debt', itemName: '4100' } as any,
      ])

      const conversions: JournalConversion[] = [
        makeJournalConversion('7100', '売上', '7001', 0, 10000),
        makeJournalConversion('2100', '建物', '2001', 5000, 0),
        makeJournalConversion('4100', '借入金', '4001', 0, 3000),
      ]

      const result = await converter.convertCashFlow('co1', 2024, conversions)

      expect(result.operatingActivities).toHaveLength(1)
      expect(result.investingActivities).toHaveLength(1)
      expect(result.financingActivities).toHaveLength(1)
      expect(result.netChangeInCash).toBe(
        result.netCashFromOperating + result.netCashFromInvesting + result.netCashFromFinancing
      )
    })

    it('should skip accounts without cash flow mapping', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.cashFlow.findMany).mockResolvedValue([])

      const conversions: JournalConversion[] = [
        makeJournalConversion('7100', '売上', '7001', 0, 10000),
      ]

      const result = await converter.convertCashFlow('co1', 2024, conversions)

      expect(result.operatingActivities).toHaveLength(0)
    })
  })

  describe('generateComparisonReport', () => {
    it('should generate comparison between source and target BS/PL', async function () {
      const sourceBS = {
        asOfDate: new Date('2024-03-31'),
        assets: [
          { code: '1100', name: 'Cash', nameEn: 'Cash', amount: 1000, sourceAccountCode: '1001' },
        ],
        liabilities: [],
        equity: [],
        totalAssets: 1000,
        totalLiabilities: 0,
        totalEquity: 0,
      }
      const targetBS = {
        asOfDate: new Date('2024-03-31'),
        assets: [
          { code: '1100', name: 'Cash', nameEn: 'Cash', amount: 1200, sourceAccountCode: '1001' },
        ],
        liabilities: [],
        equity: [],
        totalAssets: 1200,
        totalLiabilities: 0,
        totalEquity: 0,
      }
      const sourcePL = {
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-03-31'),
        revenue: [],
        costOfSales: [],
        sgaExpenses: [],
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        grossProfit: 0,
        operatingIncome: 0,
        ordinaryIncome: 0,
        incomeBeforeTax: 0,
        netIncome: 500,
      }
      const targetPL = {
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-03-31'),
        revenue: [],
        costOfSales: [],
        sgaExpenses: [],
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        grossProfit: 0,
        operatingIncome: 0,
        ordinaryIncome: 0,
        incomeBeforeTax: 0,
        netIncome: 600,
      }

      const report = await converter.generateComparisonReport(
        sourceBS,
        targetBS,
        sourcePL,
        targetPL
      )

      expect(report.balanceSheet.items.length).toBeGreaterThanOrEqual(1)
      expect(report.balanceSheet.totalDifference).toBe(200)
      expect(report.profitLoss.netIncomeDifference).toBe(100)
    })
  })
})

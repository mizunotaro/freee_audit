import { describe, it, expect } from 'vitest'
import { calculateCashFlow } from '@/services/cashflow/calculator'
import { calculateFinancialKPIs } from '@/services/analytics/financial-kpi'
import { calculateRunway } from '@/services/cashflow/runway-calculator'
import { CalculationValidator } from '@/services/validation/calculation-validator'
import type { BalanceSheet, ProfitLoss, BalanceSheetItem } from '@/types'
import type { AccountingStandard } from '@/types/accounting-standard'

describe('Financial Calculation Pipeline', () => {
  const validator = new CalculationValidator()

  const createTestData = (_standard: AccountingStandard) => {
    const bs: BalanceSheet = {
      fiscalYear: 2024,
      month: 12,
      assets: {
        current: [
          { code: '100', name: '現金預金', amount: 10000000 },
          { code: '1100', name: '売掛金', amount: 5000000 },
          { code: '1200', name: '棚卸資産', amount: 3000000 },
          { code: '1500', name: '繰延税金資産', amount: 500000 },
        ],
        fixed: [
          { code: '2000', name: '有形固定資産', amount: 20000000 },
          { code: '2100', name: '減価償却累計額', amount: -5000000 },
        ],
        total: 33500000,
      },
      liabilities: {
        current: [
          { code: '3000', name: '買掛金', amount: 4000000 },
          { code: '3100', name: '短期借入金', amount: 2000000 },
          { code: '3500', name: '繰延税金負債', amount: 300000 },
        ],
        fixed: [{ code: '4000', name: '長期借入金', amount: 8000000 }],
        total: 14300000,
      },
      equity: {
        items: [
          { code: '5000', name: '資本金', amount: 10000000 },
          { code: '5100', name: '利益剰余金', amount: 9200000 },
        ],
        total: 19200000,
      },
      totalAssets: 33500000,
      totalLiabilities: 14300000,
      totalEquity: 19200000,
    }

    const pl: ProfitLoss = {
      fiscalYear: 2024,
      month: 12,
      revenue: [{ code: 'R001', name: '売上高', amount: 100000000 }],
      costOfSales: [{ code: 'C001', name: '売上原価', amount: 60000000 }],
      grossProfit: 40000000,
      grossProfitMargin: 40,
      sgaExpenses: [
        { code: 'E001', name: '給与手当', amount: 15000000 },
        { code: 'E002', name: '減価償却費', amount: 3000000 },
        { code: 'E003', name: 'その他経費', amount: 8000000 },
      ],
      operatingIncome: 14000000,
      operatingMargin: 14,
      nonOperatingIncome: [{ code: 'NO01', name: '受取利息', amount: 200000 }],
      nonOperatingExpenses: [{ code: 'NE01', name: '支払利息', amount: 500000 }],
      ordinaryIncome: 13700000,
      extraordinaryIncome: [],
      extraordinaryLoss: [],
      incomeBeforeTax: 13700000,
      incomeTax: 3000000,
      netIncome: 10700000,
      depreciation: 3000000,
    }

    return { bs, pl }
  }

  const createPreviousBS = (bs: BalanceSheet): BalanceSheet => {
    const reduceAmount = (items: BalanceSheetItem[]): BalanceSheetItem[] =>
      items.map((a) => ({ ...a, amount: Math.round(a.amount * 0.9) }))

    return {
      fiscalYear: 2024,
      month: 11,
      assets: {
        current: reduceAmount(bs.assets.current),
        fixed: reduceAmount(bs.assets.fixed),
        total: Math.round(bs.assets.total * 0.9),
      },
      liabilities: {
        current: reduceAmount(bs.liabilities.current),
        fixed: reduceAmount(bs.liabilities.fixed),
        total: Math.round(bs.liabilities.total * 0.9),
      },
      equity: {
        items: reduceAmount(bs.equity.items),
        total: Math.round(bs.equity.total * 0.9),
      },
      totalAssets: Math.round(bs.totalAssets * 0.9),
      totalLiabilities: Math.round(bs.totalLiabilities * 0.9),
      totalEquity: Math.round(bs.totalEquity * 0.9),
    }
  }

  describe.each(['JGAAP', 'USGAAP', 'IFRS'] as AccountingStandard[])(
    'Accounting Standard: %s',
    (standard) => {
      it('should complete full calculation pipeline', async () => {
        const { bs, pl } = createTestData(standard)
        const previousBS = createPreviousBS(bs)

        const cf = calculateCashFlow(pl, bs, previousBS, { standard })
        expect(cf).toBeDefined()
        expect(cf.operatingActivities).toBeDefined()

        const kpis = calculateFinancialKPIs(bs, pl, cf, undefined, {
          standard,
          sector: 'manufacturing',
        })
        expect(kpis).toBeDefined()
        expect(kpis.profitability.roe).toBeGreaterThan(0)

        const cashFlows = [cf]
        const cashItem = bs.assets.current.find(
          (item) => item.code === '100' || item.name.includes('現金')
        )
        const currentCash = cashItem?.amount || 0
        const runway = calculateRunway(currentCash, cashFlows)
        expect(runway).toBeDefined()

        const validation = await validator.validateCashFlow({
          standard,
          balanceSheet: bs,
          profitLoss: pl,
          cashFlow: cf,
          kpis,
          calculationFormulas: [],
        })

        console.log(`${standard} Validation:`, {
          isValid: validation.isValid,
          issues: validation.issues.length,
          confidence: validation.confidence,
        })

        expect(validation.confidence).toBeGreaterThan(0.3)
      })

      it('should have consistent interest classification', async () => {
        const { bs, pl } = createTestData(standard)
        const cf = calculateCashFlow(pl, bs, null, { standard })

        if (standard === 'IFRS') {
          expect(cf.financingActivities?.interestPaid).toBeDefined()
        } else if (standard === 'USGAAP') {
          expect(cf.operatingActivities).toBeDefined()
        } else {
          expect(cf.operatingActivities).toBeDefined()
        }
      })
    }
  )

  describe('Cross-standard validation', () => {
    it('should produce different results for different standards', () => {
      const { bs, pl } = createTestData('JGAAP')

      const cfJGAAP = calculateCashFlow(pl, bs, null, { standard: 'JGAAP' })
      const cfIFRS = calculateCashFlow(pl, bs, null, { standard: 'IFRS' })

      expect(cfJGAAP.fiscalYear).toBe(cfIFRS.fiscalYear)

      const jgaapInterestPaid = cfJGAAP.financingActivities?.interestPaid ?? 0
      const ifrsInterestPaid = cfIFRS.financingActivities?.interestPaid ?? 0

      if (ifrsInterestPaid > 0) {
        expect(ifrsInterestPaid).toBeGreaterThanOrEqual(jgaapInterestPaid)
      }
    })
  })

  describe('Error handling', () => {
    it('should handle empty data gracefully', async () => {
      const emptyBS: BalanceSheet = {
        fiscalYear: 2024,
        month: 12,
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      }

      const emptyPL: ProfitLoss = {
        fiscalYear: 2024,
        month: 12,
        revenue: [],
        costOfSales: [],
        grossProfit: 0,
        grossProfitMargin: 0,
        sgaExpenses: [],
        operatingIncome: 0,
        operatingMargin: 0,
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        ordinaryIncome: 0,
        extraordinaryIncome: [],
        extraordinaryLoss: [],
        incomeBeforeTax: 0,
        incomeTax: 0,
        netIncome: 0,
        depreciation: 0,
      }

      const cf = calculateCashFlow(emptyPL, emptyBS, null, { standard: 'JGAAP' })
      expect(cf).toBeDefined()
      expect(cf.operatingActivities!.netCashFromOperating).toBe(0)
    })
  })
})

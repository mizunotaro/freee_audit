import { describe, it, expect } from 'vitest'
import { sampleTherapeuticsData as d } from '@/lib/data/sample-therapeutics-data'

describe('sampleTherapeuticsData', () => {
  describe('shape', () => {
    it('exposes the expected top-level sections', () => {
      expect(d).toHaveProperty('company')
      expect(d).toHaveProperty('balanceSheet')
      expect(d).toHaveProperty('profitLoss')
      expect(d).toHaveProperty('cashFlow')
      expect(d).toHaveProperty('kpis')
    })

    it('identifies as a JPY therapeutics company', () => {
      expect(d.company.currency).toBe('JPY')
      expect(d.company.industry).toContain('バイオテクノロジー')
    })
  })

  describe('balance sheet identity', () => {
    it('satisfies assets = liabilities + equity', () => {
      const { assets, liabilities, equity } = d.balanceSheet
      expect(assets.totalAssets).toBe(liabilities.totalLiabilities + equity.totalEquity)
    })

    it('balances against totalLiabilitiesAndEquity', () => {
      expect(d.balanceSheet.assets.totalAssets).toBe(d.balanceSheet.totalLiabilitiesAndEquity)
    })

    it('sums current-asset line items into totalCurrentAssets', () => {
      const ca = d.balanceSheet.assets.currentAssets
      const sum =
        ca.cash +
        ca.ordinaryDeposits +
        ca.restrictedCash +
        ca.accountsReceivable +
        ca.prepaidExpenses +
        ca.prepaidCRO +
        ca.otherCurrentAssets
      expect(sum).toBe(ca.totalCurrentAssets)
    })

    it('sums fixed-asset groups into totalFixedAssets', () => {
      const fa = d.balanceSheet.assets.fixedAssets
      expect(
        fa.tangible.netTangibleAssets +
          fa.intangible.totalIntangibleAssets +
          fa.investments.totalInvestments
      ).toBe(fa.totalFixedAssets)
    })
  })

  describe('profit & loss consistency', () => {
    it('derives netLossBeforeTax from operating loss + non-operating', () => {
      const pl = d.profitLoss
      expect(pl.operatingLoss + pl.nonOperating.totalNonOperating).toBe(pl.netLossBeforeTax)
    })

    it('reports netLoss == netLossBeforeTax when taxEffect is zero', () => {
      expect(d.profitLoss.taxEffect).toBe(0)
      expect(d.profitLoss.netLoss).toBe(d.profitLoss.netLossBeforeTax)
    })
  })

  describe('cash flow reconciliation', () => {
    it('reconciles netChangeInCash with beginning/ending balances', () => {
      const cf = d.cashFlow
      expect(cf.endingCash - cf.beginningCash).toBe(cf.netChangeInCash)
    })

    it('builds operating cash flow from net loss + adjustments + working capital', () => {
      const op = d.cashFlow.operating
      expect(
        op.netLoss +
          op.adjustments.totalAdjustments +
          op.changesInWorkingCapital.totalWorkingCapital
      ).toBe(op.netCashFromOperating)
    })
  })

  describe('monthly burn', () => {
    it('provides exactly 12 months of burn data', () => {
      expect(d.monthlyBurn).toHaveLength(12)
    })

    it('keeps totalBurn = rdSpend + sgaSpend for every month', () => {
      for (const m of d.monthlyBurn) {
        expect(m.totalBurn).toBe(m.rdSpend + m.sgaSpend)
      }
    })

    it('records a positive cash infusion in the Series A month', () => {
      const before = d.monthlyBurn[2].cashBalance
      const after = d.monthlyBurn[3].cashBalance
      expect(after).toBeGreaterThan(before)
    })
  })

  describe('budgets', () => {
    it('totals the R&D budget from its line items', () => {
      const sum = d.budgets.rdBudget.reduce((acc, row) => acc + row.budget, 0)
      expect(sum).toBe(d.budgets.totalRdBudget)
    })

    it('totals the SGA budget from its line items', () => {
      const sum = d.budgets.sgaBudget.reduce((acc, row) => acc + row.budget, 0)
      expect(sum).toBe(d.budgets.totalSgaBudget)
    })

    it('sums R&D + SGA into the total budget', () => {
      expect(d.budgets.totalRdBudget + d.budgets.totalSgaBudget).toBe(d.budgets.totalBudget)
    })
  })

  describe('kpis', () => {
    it('orders runway scenarios optimistic > base > pessimistic', () => {
      const { optimistic, base, pessimistic } = d.kpis.runwayByScenario
      expect(optimistic).toBeGreaterThan(base)
      expect(base).toBeGreaterThan(pessimistic)
    })

    it('reports current ratio equal to quick ratio when receivables are zero', () => {
      expect(d.balanceSheet.assets.currentAssets.accountsReceivable).toBe(0)
      expect(d.kpis.liquidity.currentRatio).toBe(d.kpis.liquidity.quickRatio)
    })

    it('keeps the cash ratio below the current ratio', () => {
      expect(d.kpis.liquidity.cashRatio).toBeLessThan(d.kpis.liquidity.currentRatio)
    })
  })

  describe('team headcount', () => {
    it('totals headcount across departments', () => {
      const h = d.team.headcount
      expect(h.research + h.cmc + h.regulatory + h.management + h.admin).toBe(h.total)
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  sampleTherapeuticsData as d,
  type SampleTherapeuticsData,
} from '@/lib/data/sample-therapeutics-data'

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

  describe('company profile', () => {
    it('exposes a complete bilingual profile', () => {
      const c = d.company
      expect(c.name).toBe('Sample Therapeutics株式会社')
      expect(c.nameEn).toBe('Sample Therapeutics, Inc.')
      expect(c.stage).toBe('Series A')
      expect(c.leadCompound).toBe('STX-001')
      expect(c.indication).toContain('オンコロジー')
      expect(c.developmentPhase).toContain('Preclinical')
    })

    it('uses a valid calendar month for fiscalYearStart', () => {
      expect(d.company.fiscalYearStart).toBeGreaterThanOrEqual(1)
      expect(d.company.fiscalYearStart).toBeLessThanOrEqual(12)
    })
  })

  describe('funding history', () => {
    it('records a Series A larger than the seed round', () => {
      expect(d.funding.seriesA.amount).toBeGreaterThan(d.funding.seed.amount)
    })

    it('caps the post-money valuation above the raised amount', () => {
      expect(d.funding.seriesA.postMoneyValuation).toBeGreaterThan(d.funding.seriesA.amount)
    })

    it('names at least one investor per round', () => {
      expect(d.funding.seriesA.leadInvestor).toBeTruthy()
      expect(d.funding.seriesA.otherInvestors.length).toBeGreaterThan(0)
      expect(d.funding.seed.investors.length).toBeGreaterThan(0)
    })
  })

  describe('balance sheet sub-structure', () => {
    it('sums intangible line items into totalIntangibleAssets', () => {
      const i = d.balanceSheet.assets.fixedAssets.intangible
      expect(i.patents + i.licenses + i.software).toBe(i.totalIntangibleAssets)
    })

    it('sums investment line items into totalInvestments', () => {
      const inv = d.balanceSheet.assets.fixedAssets.investments
      expect(inv.investmentSecurities + inv.deposits).toBe(inv.totalInvestments)
    })

    it('sums current-liability line items into totalCurrentLiabilities', () => {
      const cl = d.balanceSheet.liabilities.currentLiabilities
      expect(
        cl.accountsPayable +
          cl.accruedCROExpenses +
          cl.accruedSalaries +
          cl.accruedBonus +
          cl.otherAccruedExpenses +
          cl.deferredRevenue
      ).toBe(cl.totalCurrentLiabilities)
    })

    it('sums fixed-liability line items into totalFixedLiabilities', () => {
      const fl = d.balanceSheet.liabilities.fixedLiabilities
      expect(fl.longTermDebt + fl.retirementAllowances + fl.researchGrants).toBe(
        fl.totalFixedLiabilities
      )
    })

    it('stacks current + fixed liabilities into totalLiabilities', () => {
      const l = d.balanceSheet.liabilities
      expect(
        l.currentLiabilities.totalCurrentLiabilities + l.fixedLiabilities.totalFixedLiabilities
      ).toBe(l.totalLiabilities)
    })
  })

  describe('profit & loss sub-structure', () => {
    it('sums revenue streams into totalRevenue', () => {
      const r = d.profitLoss.revenue
      expect(r.grants + r.collaborativeResearch).toBe(r.totalRevenue)
    })

    it('splits R&D into internal + external', () => {
      const rd = d.profitLoss.expenses.rdExpenses
      expect(rd.internal.totalInternal + rd.external.totalExternal).toBe(rd.totalRd)
    })

    it('aggregates SGA groups into totalSga', () => {
      const sga = d.profitLoss.expenses.sgaExpenses
      expect(
        sga.personnel.totalPersonnel +
          sga.professional.totalProfessional +
          sga.facilities.totalFacilities +
          sga.other.totalOther
      ).toBe(sga.totalSga)
    })

    it('derives totalExpenses from R&D + SGA + depreciation', () => {
      const e = d.profitLoss.expenses
      expect(e.rdExpenses.totalRd + e.sgaExpenses.totalSga + e.depreciation).toBe(e.totalExpenses)
    })

    it('derives operatingLoss from totalRevenue - totalExpenses', () => {
      expect(d.profitLoss.revenue.totalRevenue - d.profitLoss.expenses.totalExpenses).toBe(
        d.profitLoss.operatingLoss
      )
    })
  })

  describe('cash flow sub-structure', () => {
    it('totals investing line items', () => {
      const inv = d.cashFlow.investing
      expect(inv.purchaseOfLabEquipment + inv.purchaseOfIntangibles + inv.purchaseOfDeposits).toBe(
        inv.totalInvesting
      )
    })

    it('totals financing line items', () => {
      const fin = d.cashFlow.financing
      expect(fin.proceedsFromSeriesA + fin.proceedsFromGrants - fin.repaymentOfDebt).toBe(
        fin.totalFinancing
      )
    })

    it('reconciles the three sections into netChangeInCash', () => {
      const cf = d.cashFlow
      expect(
        cf.operating.netCashFromOperating +
          cf.investing.netCashUsedInInvesting +
          cf.financing.netCashFromFinancing
      ).toBe(cf.netChangeInCash)
    })
  })

  describe('monthly burn (extended)', () => {
    it('walks the fiscal year starting at fiscalYearStart', () => {
      const months = d.monthlyBurn.map((m) => m.month)
      expect(months[0]).toBe(d.company.fiscalYearStart)
      expect(months).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3])
    })

    it('trends R&D spend strictly upward across the year', () => {
      for (let i = 1; i < d.monthlyBurn.length; i++) {
        expect(d.monthlyBurn[i].rdSpend).toBeGreaterThan(d.monthlyBurn[i - 1].rdSpend)
      }
    })

    it('ends on the same balance as the cash-flow statement', () => {
      const last = d.monthlyBurn[d.monthlyBurn.length - 1]
      expect(last.cashBalance).toBe(d.cashFlow.endingCash)
    })

    it('keeps every burn figure non-negative', () => {
      for (const m of d.monthlyBurn) {
        expect(m.rdSpend).toBeGreaterThanOrEqual(0)
        expect(m.sgaSpend).toBeGreaterThanOrEqual(0)
        expect(m.totalBurn).toBeGreaterThanOrEqual(0)
        expect(m.cashBalance).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('R&D pipeline', () => {
    it('describes the lead program with a dated timeline', () => {
      const lead = d.rdPipeline.leadProgram
      expect(lead.code).toBe('STX-001')
      expect(lead.phase).toBe('Preclinical')
      expect(lead.estimatedTimeline.indSubmission).toBeTruthy()
      expect(lead.estimatedTimeline.phase1Start).toBeTruthy()
    })

    it('lists discovery programs with stable codes', () => {
      expect(d.rdPipeline.discoveryPrograms.length).toBeGreaterThan(0)
      for (const p of d.rdPipeline.discoveryPrograms) {
        expect(p.code).toBeTruthy()
        expect(p.phase).toBeTruthy()
      }
    })
  })

  describe('CRO / CDMO partners', () => {
    it('separates CRO and CDMO partners', () => {
      expect(d.croCdmoPartners.cro.length).toBeGreaterThan(0)
      expect(d.croCdmoPartners.cdmo.length).toBeGreaterThan(0)
    })

    it('gives every partner a name, service line, contract value and status', () => {
      for (const p of [...d.croCdmoPartners.cro, ...d.croCdmoPartners.cdmo]) {
        expect(p.name).toBeTruthy()
        expect(p.services).toBeTruthy()
        expect(p.contractValue).toBeGreaterThanOrEqual(0)
        expect(p.status).toBeTruthy()
      }
    })
  })

  describe('team (extended)', () => {
    it('profiles the C-suite key personnel', () => {
      expect(d.team.keyPersonnel.length).toBe(4)
      for (const k of d.team.keyPersonnel) {
        expect(k.name).toBeTruthy()
        expect(k.title).toBeTruthy()
        expect(k.background).toBeTruthy()
      }
    })
  })

  describe('KPIs (extended)', () => {
    it('reconciles burn-rate peak/lowest against the monthly series', () => {
      const burns = d.monthlyBurn.map((m) => m.totalBurn)
      expect(d.kpis.monthlyBurnRate.peak).toBe(Math.max(...burns))
      expect(d.kpis.monthlyBurnRate.lowest).toBe(Math.min(...burns))
    })

    it('keeps external + internal R&D ratios summing to ~1', () => {
      const { externalRdRatio, internalRdRatio } = d.kpis.rdEfficiency
      expect(externalRdRatio + internalRdRatio).toBeCloseTo(1, 2)
    })

    it('keeps every liquidity ratio positive', () => {
      const l = d.kpis.liquidity
      expect(l.currentRatio).toBeGreaterThan(0)
      expect(l.quickRatio).toBeGreaterThan(0)
      expect(l.cashRatio).toBeGreaterThan(0)
    })
  })

  describe('budgets (extended)', () => {
    it('tags every R&D budget row with a category and amounts', () => {
      for (const row of d.budgets.rdBudget) {
        expect(row.category).toBeTruthy()
        expect(typeof row.budget).toBe('number')
        expect(typeof row.actual).toBe('number')
      }
    })

    it('tags every SGA budget row with a category and amounts', () => {
      for (const row of d.budgets.sgaBudget) {
        expect(row.category).toBeTruthy()
        expect(typeof row.budget).toBe('number')
        expect(typeof row.actual).toBe('number')
      }
    })
  })

  describe('milestones', () => {
    const allowedStatuses = ['completed', 'in_progress', 'planned']

    it('exposes a non-empty milestone timeline', () => {
      expect(d.milestones.length).toBeGreaterThan(0)
    })

    it('uses only known statuses', () => {
      for (const m of d.milestones) {
        expect(allowedStatuses).toContain(m.status)
      }
    })

    it('carries a date and numeric impact for every milestone', () => {
      for (const m of d.milestones) {
        expect(m.milestone).toBeTruthy()
        expect(m.date).toBeTruthy()
        expect(typeof m.impact).toBe('number')
      }
    })
  })

  describe('peer companies', () => {
    it('ships a non-empty peer set', () => {
      expect(d.peerCompanies.length).toBeGreaterThan(0)
    })

    it('gives every peer positive cash and a finite runway', () => {
      for (const p of d.peerCompanies) {
        expect(p.name).toBeTruthy()
        expect(p.stage).toBeTruthy()
        expect(p.marketCap).toBeGreaterThan(0)
        expect(p.cash).toBeGreaterThan(0)
        expect(p.burnRate).toBeGreaterThan(0)
        expect(p.runway).toBeGreaterThan(0)
      }
    })
  })

  describe('type & fail-safe consumption', () => {
    it('round-trips losslessly through JSON (serializable: no Dates, functions, undefined or cycles)', () => {
      expect(JSON.parse(JSON.stringify(d))).toEqual(d)
    })

    it('contains only JSON-native scalar leaves (string/number/boolean) or null', () => {
      const leaves: unknown[] = []
      const walk = (node: unknown): void => {
        if (node === null || typeof node !== 'object') {
          leaves.push(node)
          return
        }
        for (const v of Object.values(node)) walk(v)
      }
      walk(d)
      for (const leaf of leaves) {
        const t = typeof leaf
        expect(t === 'string' || t === 'number' || t === 'boolean' || leaf === null).toBe(true)
      }
    })

    it('is a plain object (no class instance or prototype methods)', () => {
      expect(Object.getPrototypeOf(d)).toBe(Object.prototype)
    })

    it('is assignable to its exported SampleTherapeuticsData type', () => {
      const typed: SampleTherapeuticsData = d
      expect(typed).toBe(d)
    })
  })
})

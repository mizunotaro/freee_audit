import { describe, it, expect } from 'vitest'
import {
  calcROE,
  calcROA,
  calcROIC,
  calcNOPAT,
  calcGrossMargin,
  calcOperatingMargin,
  calcNetMargin,
  calcEBITMargin,
  calcEBITDAMargin,
  calcCurrentRatio,
  calcQuickRatio,
  calcCashRatio,
  calcWorkingCapital,
  calcDIO,
  calcDSO,
  calcDPO,
  calcCCC,
  calcDebtToEquity,
  calcEquityRatio,
  calcDebtRatio,
  calcLongTermDebtToEquity,
  calcEquityMultiplier,
  calcDebtToEBITDA,
  calcNetDebtToEBITDA,
  calcTimesInterestEarned,
  calcInterestCoverageRatio,
  calcAssetTurnover,
  calcInventoryTurnover,
  calcReceivablesTurnover,
  calcPayablesTurnover,
  calcFixedAssetTurnover,
  calcWorkingCapitalTurnover,
  calcRevenueGrowth,
  calcProfitGrowth,
  calcGrossProfitGrowth,
  calcOperatingIncomeGrowth,
  calcOrdinaryIncomeGrowth,
  calcEBITDAGrowth,
  calcAssetGrowth,
  calcEquityGrowth,
  calcDuPont,
  calculateFinancialRatios,
} from '@/services/analytics/financial-kpi'
import type { BalanceSheet, ProfitLoss } from '@/types'

// Unwrap a numeric Result for value assertions: returns undefined on failure so
// a golden `expect(num(...)).toBe(N)` fails loudly instead of bypassing the
// success check via two independent calls.
function num(r: { success: boolean; data?: number }): number | undefined {
  return r.success ? r.data : undefined
}

// ---------------------------------------------------------------------------
// Representative fixture (FY2024) with a full prior period (FY2023).
// Hand-computed golden values accompany each assertion below.
// ---------------------------------------------------------------------------

const bs: BalanceSheet = {
  fiscalYear: 2024,
  month: 12,
  assets: {
    current: [
      { code: '1000', name: '現金', amount: 1_000_000 },
      { code: '1100', name: '売掛金', amount: 2_000_000 },
      { code: '1200', name: '棚卸資産', amount: 3_000_000 },
    ],
    fixed: [
      { code: '2000', name: '建物', amount: 10_000_000 },
      { code: '2100', name: '減価償却累計額', amount: -2_000_000 },
    ],
    total: 14_000_000,
  },
  liabilities: {
    current: [
      { code: '3000', name: '買掛金', amount: 1_500_000 },
      { code: '3100', name: '短期借入金', amount: 500_000 },
    ],
    fixed: [{ code: '4000', name: '長期借入金', amount: 3_000_000 }],
    total: 5_000_000,
  },
  equity: {
    items: [
      { code: '5000', name: '資本金', amount: 5_000_000 },
      { code: '5100', name: '利益剰余金', amount: 4_000_000 },
    ],
    total: 9_000_000,
  },
  totalAssets: 14_000_000,
  totalLiabilities: 5_000_000,
  totalEquity: 9_000_000,
}

const pl: ProfitLoss = {
  fiscalYear: 2024,
  month: 12,
  revenue: [{ code: 'R001', name: '売上高', amount: 10_000_000 }],
  costOfSales: [{ code: 'C001', name: '売上原価', amount: 6_000_000 }],
  grossProfit: 4_000_000,
  grossProfitMargin: 40,
  sgaExpenses: [{ code: 'E001', name: '販売費及び一般管理費', amount: 1_000_000 }],
  operatingIncome: 3_000_000,
  operatingMargin: 30,
  nonOperatingIncome: [],
  nonOperatingExpenses: [{ code: 'NE01', name: '支払利息', amount: 200_000 }],
  ordinaryIncome: 2_800_000,
  extraordinaryIncome: [],
  extraordinaryLoss: [],
  incomeBeforeTax: 2_800_000,
  incomeTax: 700_000,
  netIncome: 2_100_000,
  depreciation: 500_000,
}

const prevBS: BalanceSheet = {
  fiscalYear: 2023,
  month: 12,
  assets: {
    current: [
      { code: '1000', name: '現金', amount: 800_000 },
      { code: '1100', name: '売掛金', amount: 1_600_000 },
      { code: '1200', name: '棚卸資産', amount: 2_400_000 },
    ],
    fixed: [
      { code: '2000', name: '建物', amount: 9_000_000 },
      { code: '2100', name: '減価償却累計額', amount: -1_800_000 },
    ],
    total: 12_000_000,
  },
  liabilities: {
    current: [
      { code: '3000', name: '買掛金', amount: 1_200_000 },
      { code: '3100', name: '短期借入金', amount: 400_000 },
    ],
    fixed: [{ code: '4000', name: '長期借入金', amount: 2_400_000 }],
    total: 4_000_000,
  },
  equity: {
    items: [
      { code: '5000', name: '資本金', amount: 5_000_000 },
      { code: '5100', name: '利益剰余金', amount: 3_000_000 },
    ],
    total: 8_000_000,
  },
  totalAssets: 12_000_000,
  totalLiabilities: 4_000_000,
  totalEquity: 8_000_000,
}

const prevPL: ProfitLoss = {
  fiscalYear: 2023,
  month: 12,
  revenue: [{ code: 'R001', name: '売上高', amount: 8_000_000 }],
  costOfSales: [{ code: 'C001', name: '売上原価', amount: 5_000_000 }],
  grossProfit: 3_000_000,
  grossProfitMargin: 37.5,
  sgaExpenses: [{ code: 'E001', name: '販売費及び一般管理費', amount: 800_000 }],
  operatingIncome: 2_200_000,
  operatingMargin: 27.5,
  nonOperatingIncome: [],
  nonOperatingExpenses: [{ code: 'NE01', name: '支払利息', amount: 200_000 }],
  ordinaryIncome: 2_000_000,
  extraordinaryIncome: [],
  extraordinaryLoss: [],
  incomeBeforeTax: 2_000_000,
  incomeTax: 500_000,
  netIncome: 1_500_000,
  depreciation: 400_000,
}

describe('FIN-IMPL-04 profitability ratios (golden)', () => {
  it('ROE on average equity = netIncome / ((equity+prevEquity)/2) * 100', () => {
    // 2,100,000 / ((9,000,000+8,000,000)/2) * 100 = 24.7058...% → 24.71
    expect(num(calcROE(bs, pl, prevBS))).toBe(24.71)
  })

  it('ROE falls back to period-end equity when no prior balance sheet', () => {
    // 2,100,000 / 9,000,000 * 100 = 23.33...% → 23.33
    expect(num(calcROE(bs, pl))).toBe(23.33)
  })

  it('ROA on average assets = netIncome / ((assets+prevAssets)/2) * 100', () => {
    // 2,100,000 / ((14,000,000+12,000,000)/2) * 100 = 16.1538...% → 16.15
    expect(num(calcROA(bs, pl, prevBS))).toBe(16.15)
  })

  it('NOPAT = EBIT * (1 - effectiveTaxRate)', () => {
    // EBIT = opInc 3,000,000; t = 700,000/2,800,000 = 0.25; NOPAT = 2,250,000
    const r = calcNOPAT(pl)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.ebit).toBe(3_000_000)
      expect(r.data.effectiveTaxRate).toBe(0.25)
      expect(r.data.nopat).toBe(2_250_000)
    }
  })

  it('ROIC = NOPAT / average invested capital * 100', () => {
    // current IC = 9,000,000 + 3,500,000 - 1,000,000 = 11,500,000
    // prev IC    = 8,000,000 + 2,800,000 -   800,000 = 10,000,000
    // avg IC = 10,750,000; ROIC = 2,250,000 / 10,750,000 * 100 = 20.9302...% → 20.93
    const r = calcROIC(bs, pl, prevBS)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.roic).toBe(20.93)
      expect(r.data.nopat).toBe(2_250_000)
      expect(r.data.investedCapital).toBe(10_750_000)
    }
  })

  it('margins computed from components', () => {
    expect(num(calcGrossMargin(pl))).toBe(40)
    expect(num(calcOperatingMargin(pl))).toBe(30)
    expect(num(calcNetMargin(pl))).toBe(21)
    expect(num(calcEBITMargin(pl))).toBe(30)
    expect(num(calcEBITDAMargin(pl))).toBe(35)
  })
})

describe('FIN-IMPL-04 liquidity ratios (golden)', () => {
  it('current / quick / cash ratios', () => {
    // current 6,000,000/2,000,000*100 = 300; quick (6,000,000-3,000,000)/2,000,000*100 = 150;
    // cash 1,000,000/2,000,000*100 = 50
    expect(num(calcCurrentRatio(bs))).toBe(300)
    expect(num(calcQuickRatio(bs))).toBe(150)
    expect(num(calcCashRatio(bs))).toBe(50)
  })

  it('working capital = current assets - current liabilities', () => {
    // 6,000,000 - 2,000,000 = 4,000,000
    expect(num(calcWorkingCapital(bs))).toBe(4_000_000)
  })

  it('DIO = inventory / COGS * 365 = 3,000,000/6,000,000*365 = 182.5', () => {
    expect(num(calcDIO(bs, pl))).toBe(182.5)
  })

  it('DSO = receivables / revenue * 365 = 2,000,000/10,000,000*365 = 73', () => {
    expect(num(calcDSO(bs, pl))).toBe(73)
  })

  it('DPO = payables / COGS * 365 = 1,500,000/6,000,000*365 = 91.25', () => {
    expect(num(calcDPO(bs, pl))).toBe(91.25)
  })

  it('CCC = DIO + DSO - DPO = 182.5 + 73 - 91.25 = 164.25', () => {
    expect(num(calcCCC(bs, pl))).toBe(164.25)
  })
})

describe('FIN-IMPL-04 leverage ratios (golden)', () => {
  it('debt-to-equity = 5,000,000/9,000,000 = 0.56', () => {
    expect(num(calcDebtToEquity(bs))).toBe(0.56)
  })

  it('equity ratio = 9,000,000/14,000,000*100 = 64.29', () => {
    expect(num(calcEquityRatio(bs))).toBe(64.29)
  })

  it('debt ratio = 5,000,000/14,000,000*100 = 35.71', () => {
    expect(num(calcDebtRatio(bs))).toBe(35.71)
  })

  it('long-term debt-to-equity = 3,000,000/9,000,000 = 0.33', () => {
    expect(num(calcLongTermDebtToEquity(bs))).toBe(0.33)
  })

  it('equity multiplier = 14,000,000/9,000,000 = 1.56', () => {
    expect(num(calcEquityMultiplier(bs))).toBe(1.56)
  })

  it('debt/EBITDA = 3,500,000/3,500,000 = 1', () => {
    expect(num(calcDebtToEBITDA(bs, pl))).toBe(1)
  })

  it('net debt/EBITDA = (3,500,000-1,000,000)/3,500,000 = 0.71', () => {
    expect(num(calcNetDebtToEBITDA(bs, pl))).toBe(0.71)
  })

  it('times interest earned = EBIT/interest = 3,000,000/200,000 = 15', () => {
    expect(num(calcTimesInterestEarned(bs, pl))).toBe(15)
  })

  it('interest coverage = EBITDA/interest = 3,500,000/200,000 = 17.5', () => {
    expect(num(calcInterestCoverageRatio(bs, pl))).toBe(17.5)
  })

  it('reads interest from nonOperatingExpenses (not sgaExpenses)', () => {
    // Same P&L but with 支払利息 moved into sgaExpenses (wrong bucket) must
    // therefore read 0 interest from the correct nonOperatingExpenses bucket.
    const wrongBucketPL: ProfitLoss = {
      ...pl,
      nonOperatingExpenses: [],
      sgaExpenses: [...pl.sgaExpenses, { code: 'E002', name: '支払利息', amount: 200_000 }],
    }
    expect(num(calcTimesInterestEarned(bs, wrongBucketPL))).toBe(0)
  })
})

describe('FIN-IMPL-04 efficiency turnovers (golden)', () => {
  it('asset turnover on average assets = 10,000,000/13,000,000 = 0.77', () => {
    expect(num(calcAssetTurnover(bs, pl, prevBS))).toBe(0.77)
  })

  it('inventory turnover = COGS/inventory = 6,000,000/3,000,000 = 2', () => {
    expect(num(calcInventoryTurnover(bs, pl))).toBe(2)
  })

  it('receivables turnover = 10,000,000/2,000,000 = 5', () => {
    expect(num(calcReceivablesTurnover(bs, pl))).toBe(5)
  })

  it('payables turnover = 6,000,000/1,500,000 = 4', () => {
    expect(num(calcPayablesTurnover(bs, pl))).toBe(4)
  })

  it('fixed-asset turnover = revenue/net fixed assets = 10,000,000/8,000,000 = 1.25', () => {
    expect(num(calcFixedAssetTurnover(bs, pl))).toBe(1.25)
  })

  it('working-capital turnover = 10,000,000/4,000,000 = 2.5', () => {
    expect(num(calcWorkingCapitalTurnover(bs, pl))).toBe(2.5)
  })

  it('inventory turnover is 0 for inventory-less sectors', () => {
    expect(num(calcInventoryTurnover(bs, pl, 'service'))).toBe(0)
    expect(num(calcInventoryTurnover(bs, pl, 'technology'))).toBe(0)
    expect(num(calcInventoryTurnover(bs, pl, 'finance'))).toBe(0)
  })
})

describe('FIN-IMPL-04 growth ratios (golden)', () => {
  it('revenue growth = (10,000,000-8,000,000)/8,000,000*100 = 25', () => {
    expect(num(calcRevenueGrowth(pl, prevPL))).toBe(25)
  })

  it('profit growth = (2,100,000-1,500,000)/1,500,000*100 = 40', () => {
    expect(num(calcProfitGrowth(pl, prevPL))).toBe(40)
  })

  it('gross-profit growth = (4,000,000-3,000,000)/3,000,000*100 = 33.33', () => {
    expect(num(calcGrossProfitGrowth(pl, prevPL))).toBe(33.33)
  })

  it('operating-income growth = (3,000,000-2,200,000)/2,200,000*100 = 36.36', () => {
    expect(num(calcOperatingIncomeGrowth(pl, prevPL))).toBe(36.36)
  })

  it('ordinary-income growth = (2,800,000-2,000,000)/2,000,000*100 = 40', () => {
    expect(num(calcOrdinaryIncomeGrowth(pl, prevPL))).toBe(40)
  })

  it('EBITDA growth = (3,500,000-2,600,000)/2,600,000*100 = 34.62', () => {
    expect(num(calcEBITDAGrowth(pl, prevPL))).toBe(34.62)
  })

  it('asset growth = (14,000,000-12,000,000)/12,000,000*100 = 16.67', () => {
    expect(num(calcAssetGrowth(bs, prevBS))).toBe(16.67)
  })

  it('equity growth = (9,000,000-8,000,000)/8,000,000*100 = 12.5', () => {
    expect(num(calcEquityGrowth(bs, prevBS))).toBe(12.5)
  })
})

describe('FIN-IMPL-04 DuPont decomposition (golden + property)', () => {
  const dp = calcDuPont(bs, pl, prevBS)

  it('returns the 3-step factors', () => {
    expect(dp.success).toBe(true)
    if (dp.success) {
      expect(dp.data.netMargin).toBe(0.21)
      expect(dp.data.assetTurnover).toBe(0.7692)
      expect(dp.data.equityMultiplier).toBe(1.5294)
    }
  })

  it('ROE = netMargin * assetTurnover * equityMultiplier * 100 = 24.71', () => {
    expect(dp.success ? dp.data.roe : undefined).toBe(24.71)
  })

  it('DuPont ROE reconciles with calcROE (both average-based)', () => {
    const roe = calcROE(bs, pl, prevBS)
    if (dp.success && roe.success) {
      expect(dp.data.roe).toBeCloseTo(roe.data, 1)
    }
  })

  it('populates the 5-step factors', () => {
    if (dp.success) {
      expect(dp.data.taxBurden).toBe(0.75) // 2,100,000/2,800,000
      expect(dp.data.interestBurden).toBe(0.9333) // 2,800,000/3,000,000
      expect(dp.data.ebitMargin).toBe(0.3) // 3,000,000/10,000,000
    }
  })

  it('5-step product reconciles to ROE', () => {
    if (dp.success && dp.data.taxBurden !== null && dp.data.interestBurden !== null) {
      const product5 =
        dp.data.taxBurden *
        dp.data.interestBurden *
        (dp.data.ebitMargin ?? 0) *
        dp.data.assetTurnover *
        dp.data.equityMultiplier *
        100
      expect(product5).toBeCloseTo(dp.data.roe, 1)
    }
  })
})

describe('FIN-IMPL-04 edge cases: divide-by-zero', () => {
  it('zero equity → ROE / D-E / equity-multiplier are 0 (safeDivide)', () => {
    const zeroEquityBS: BalanceSheet = { ...bs, totalEquity: 0 }
    expect(num(calcROE(zeroEquityBS, pl))).toBe(0)
    expect(num(calcDebtToEquity(zeroEquityBS))).toBe(0)
    expect(num(calcEquityMultiplier(zeroEquityBS))).toBe(0)
  })

  it('zero total assets → ROA / asset-turnover are 0', () => {
    const zeroAssetBS: BalanceSheet = { ...bs, totalAssets: 0 }
    expect(num(calcROA(zeroAssetBS, pl))).toBe(0)
    expect(num(calcAssetTurnover(zeroAssetBS, pl))).toBe(0)
  })

  it('zero revenue → margins are 0', () => {
    const zeroRevPL: ProfitLoss = { ...pl, revenue: [] }
    expect(num(calcNetMargin(zeroRevPL))).toBe(0)
    expect(num(calcGrossMargin(zeroRevPL))).toBe(0)
    expect(num(calcEBITDAMargin(zeroRevPL))).toBe(0)
  })

  it('zero COGS → DIO / DPO / inventory-turnover are 0', () => {
    const zeroCogsPL: ProfitLoss = { ...pl, costOfSales: [] }
    expect(num(calcDIO(bs, zeroCogsPL))).toBe(0)
    expect(num(calcDPO(bs, zeroCogsPL))).toBe(0)
    expect(num(calcInventoryTurnover(bs, zeroCogsPL))).toBe(0)
  })

  it('zero current liabilities → current/quick/cash ratios are 0', () => {
    const zeroCLBS: BalanceSheet = {
      ...bs,
      liabilities: { ...bs.liabilities, current: [], total: 3_000_000 },
    }
    expect(num(calcCurrentRatio(zeroCLBS))).toBe(0)
    expect(num(calcQuickRatio(zeroCLBS))).toBe(0)
    expect(num(calcCashRatio(zeroCLBS))).toBe(0)
  })

  it('no interest expense → TIE / interest coverage are 0', () => {
    const noInterestPL: ProfitLoss = { ...pl, nonOperatingExpenses: [] }
    expect(num(calcTimesInterestEarned(bs, noInterestPL))).toBe(0)
    expect(num(calcInterestCoverageRatio(bs, noInterestPL))).toBe(0)
  })

  it('zero EBITDA → debt/EBITDA is 0', () => {
    const zeroEbitdaPL: ProfitLoss = {
      ...pl,
      operatingIncome: 0,
      depreciation: 0,
      ordinaryIncome: -200_000,
      incomeBeforeTax: -200_000,
      netIncome: -200_000,
    }
    expect(num(calcDebtToEBITDA(bs, zeroEbitdaPL))).toBe(0)
  })

  it('NOPAT effective-tax-rate fallback to 0 when income before tax <= 0', () => {
    const lossPL: ProfitLoss = {
      ...pl,
      operatingIncome: -200_000,
      ordinaryIncome: -400_000,
      incomeBeforeTax: 0,
      incomeTax: 0,
      netIncome: 0,
    }
    const r = calcNOPAT(lossPL)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.effectiveTaxRate).toBe(0)
      // NOPAT = EBIT * (1 - 0) = -200,000
      expect(r.data.nopat).toBe(-200_000)
    }
  })
})

describe('FIN-IMPL-04 edge cases: missing period & validation', () => {
  it('growth helpers fail when prior period is absent', () => {
    const r = calcRevenueGrowth(pl)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND')
  })

  it('invalid input is rejected via Zod safeParse', () => {
    const badBS = { ...bs, totalEquity: 'not-a-number' } as unknown as BalanceSheet
    const r = calcROE(badBS, pl)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe('VALIDATION_ERROR')
  })

  it('invalid prior balance sheet is rejected', () => {
    const badPrevBS = { ...prevBS, totalAssets: 'x' } as unknown as BalanceSheet
    const r = calcROE(bs, pl, badPrevBS)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('FIN-IMPL-04 calculateFinancialRatios aggregator', () => {
  it('returns the complete ratio set with golden values (full prior period)', () => {
    const r = calculateFinancialRatios(bs, pl, {
      previousBS: prevBS,
      previousPL: prevPL,
      sector: 'manufacturing',
    })
    expect(r.success).toBe(true)
    if (!r.success) return

    const set = r.data
    expect(set.fiscalYear).toBe(2024)
    expect(set.month).toBe(12)

    expect(set.profitability.roe).toBe(24.71)
    expect(set.profitability.roa).toBe(16.15)
    expect(set.profitability.roic).toBe(20.93)
    expect(set.profitability.nopat).toBe(2_250_000)
    expect(set.profitability.ebit).toBe(3_000_000)
    expect(set.profitability.ebitda).toBe(3_500_000)
    expect(set.profitability.grossMargin).toBe(40)
    expect(set.profitability.netMargin).toBe(21)
    expect(set.profitability.ebitdaMargin).toBe(35)

    expect(set.liquidity.currentRatio).toBe(300)
    expect(set.liquidity.quickRatio).toBe(150)
    expect(set.liquidity.cashRatio).toBe(50)
    expect(set.liquidity.workingCapital).toBe(4_000_000)
    expect(set.liquidity.ccc).toBe(164.25)

    expect(set.leverage.debtToEquity).toBe(0.56)
    expect(set.leverage.equityMultiplier).toBe(1.56)
    expect(set.leverage.debtToEBITDA).toBe(1)
    expect(set.leverage.timesInterestEarned).toBe(15)
    expect(set.leverage.interestCoverageRatio).toBe(17.5)

    expect(set.efficiency.assetTurnover).toBe(0.77)
    expect(set.efficiency.inventoryTurnover).toBe(2)
    expect(set.efficiency.fixedAssetTurnover).toBe(1.25)
    expect(set.efficiency.workingCapitalTurnover).toBe(2.5)

    expect(set.growth.revenueGrowth).toBe(25)
    expect(set.growth.profitGrowth).toBe(40)
    expect(set.growth.ebitdaGrowth).toBe(34.62)
    expect(set.growth.assetGrowth).toBe(16.67)
    expect(set.growth.equityGrowth).toBe(12.5)

    expect(set.dupont.roe).toBe(24.71)
  })

  it('growth fields are null when prior period is omitted', () => {
    const r = calculateFinancialRatios(bs, pl, { sector: 'manufacturing' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.growth.revenueGrowth).toBeNull()
    expect(r.data.growth.profitGrowth).toBeNull()
    expect(r.data.growth.assetGrowth).toBeNull()
    expect(r.data.growth.equityGrowth).toBeNull()
    // Without prior BS, ROE uses period-end equity = 23.33
    expect(r.data.profitability.roe).toBe(23.33)
  })

  it('inventory-less sector zeroes DIO/inventory-turnover inside the set', () => {
    const r = calculateFinancialRatios(bs, pl, { sector: 'service' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.efficiency.inventoryTurnover).toBe(0)
    expect(r.data.liquidity.dio).toBe(0)
    // CCC still reflects DSO - DPO = 73 - 91.25 = -18.25
    expect(r.data.liquidity.ccc).toBe(-18.25)
  })

  it('fails on invalid input', () => {
    const badPL = { ...pl, netIncome: 'x' } as unknown as ProfitLoss
    const r = calculateFinancialRatios(bs, badPL)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe('VALIDATION_ERROR')
  })

  it('negative working capital yields a negative turnover (no crash)', () => {
    const invertedBS: BalanceSheet = {
      ...bs,
      liabilities: {
        current: [
          { code: '3000', name: '買掛金', amount: 8_000_000 },
          { code: '3100', name: '短期借入金', amount: 500_000 },
        ],
        fixed: bs.liabilities.fixed,
        total: 11_500_000,
      },
      totalLiabilities: 11_500_000,
    }
    const r = calculateFinancialRatios(invertedBS, pl)
    expect(r.success).toBe(true)
    if (r.success) {
      // WC = 6,000,000 - 8,500,000 = -2,500,000
      expect(r.data.liquidity.workingCapital).toBe(-2_500_000)
    }
  })
})

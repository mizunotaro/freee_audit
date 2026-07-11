import type {
  BalanceSheet,
  ProfitLoss,
  FinancialKPIs,
  CashFlowStatement,
  IndustrySector,
  CompanySize,
  BenchmarkComparison,
} from '@/types'
import type { AccountingStandard } from '@/types/accounting-standard'
import { safeDivide, calculateGrowthRate } from '@/lib/utils'
import { calculateFreeCashFlow } from '@/services/cashflow/calculator'
import { kpiCache } from '@/lib/cache'
import { z } from 'zod'
import {
  success,
  failure,
  createAppError,
  ERROR_CODES,
  type Result,
  type AppError,
} from '@/types/result'

export interface IndustryBenchmark {
  sector: IndustrySector
  grossProfitMargin: { min: number; median: number; max: number }
  operatingMargin: { min: number; median: number; max: number }
  currentRatio: { min: number; median: number; max: number }
  debtToEquity: { min: number; median: number; max: number }
  inventoryTurnover: { min: number; median: number; max: number }
}

/**
 * Industry benchmark ranges (min/median/max) keyed by sector, used to position a
 * company's metrics against typical peers. Keys correspond to {@link IndustrySector}.
 */
export const INDUSTRY_BENCHMARKS: Record<IndustrySector, IndustryBenchmark> = {
  manufacturing: {
    sector: 'manufacturing',
    grossProfitMargin: { min: 15, median: 25, max: 40 },
    operatingMargin: { min: 3, median: 8, max: 15 },
    currentRatio: { min: 100, median: 140, max: 200 },
    debtToEquity: { min: 0.5, median: 1.0, max: 2.0 },
    inventoryTurnover: { min: 4, median: 8, max: 12 },
  },
  retail: {
    sector: 'retail',
    grossProfitMargin: { min: 20, median: 30, max: 50 },
    operatingMargin: { min: 2, median: 5, max: 10 },
    currentRatio: { min: 100, median: 150, max: 250 },
    debtToEquity: { min: 0.3, median: 0.8, max: 1.5 },
    inventoryTurnover: { min: 6, median: 12, max: 20 },
  },
  service: {
    sector: 'service',
    grossProfitMargin: { min: 30, median: 45, max: 70 },
    operatingMargin: { min: 5, median: 12, max: 25 },
    currentRatio: { min: 100, median: 160, max: 250 },
    debtToEquity: { min: 0.2, median: 0.6, max: 1.2 },
    inventoryTurnover: { min: 0, median: 0, max: 0 },
  },
  technology: {
    sector: 'technology',
    grossProfitMargin: { min: 40, median: 60, max: 80 },
    operatingMargin: { min: 5, median: 15, max: 30 },
    currentRatio: { min: 120, median: 200, max: 350 },
    debtToEquity: { min: 0.1, median: 0.4, max: 1.0 },
    inventoryTurnover: { min: 0, median: 0, max: 0 },
  },
  finance: {
    sector: 'finance',
    grossProfitMargin: { min: 50, median: 70, max: 90 },
    operatingMargin: { min: 15, median: 25, max: 40 },
    currentRatio: { min: 100, median: 120, max: 180 },
    debtToEquity: { min: 5.0, median: 10.0, max: 20.0 },
    inventoryTurnover: { min: 0, median: 0, max: 0 },
  },
  real_estate: {
    sector: 'real_estate',
    grossProfitMargin: { min: 20, median: 35, max: 50 },
    operatingMargin: { min: 10, median: 20, max: 35 },
    currentRatio: { min: 80, median: 120, max: 200 },
    debtToEquity: { min: 2.0, median: 4.0, max: 8.0 },
    inventoryTurnover: { min: 0.5, median: 1.0, max: 2.0 },
  },
  construction: {
    sector: 'construction',
    grossProfitMargin: { min: 10, median: 18, max: 30 },
    operatingMargin: { min: 2, median: 5, max: 10 },
    currentRatio: { min: 100, median: 130, max: 180 },
    debtToEquity: { min: 1.0, median: 2.0, max: 4.0 },
    inventoryTurnover: { min: 3, median: 6, max: 10 },
  },
  other: {
    sector: 'other',
    grossProfitMargin: { min: 10, median: 25, max: 50 },
    operatingMargin: { min: 2, median: 8, max: 20 },
    currentRatio: { min: 100, median: 150, max: 250 },
    debtToEquity: { min: 0.5, median: 1.0, max: 2.5 },
    inventoryTurnover: { min: 2, median: 6, max: 12 },
  },
}

export interface KPIOptions {
  standard?: AccountingStandard
  sector?: IndustrySector
  companySize?: CompanySize
}

export interface StartupKPIs {
  burnRate: number
  runwayMonths: number
  cac: number | null
  ltv: number | null
  ltvCacRatio: number | null
  mrr: number
  arr: number
  churnRate: number | null
}

export interface VCKPIs {
  revenueMultiple: number | null
  growthRate: number
  grossMargin: number
  nrr: number | null
  magicNumber: number | null
  ruleOf40: number
}

export interface BankKPIs {
  dscr: number
  interestCoverageRatio: number
  fixedChargeCoverageRatio: number
  debtToEquityRatio: number
  debtServiceRatio: number
}

export interface KPIAdvice {
  category: string
  kpiName: string
  currentValue: number
  targetValue: number | string
  status: 'good' | 'warning' | 'critical'
  advice: string
  actionItems: string[]
}

export interface ExtendedFinancialKPIs extends FinancialKPIs {
  startup: StartupKPIs
  vc: VCKPIs
  bank: BankKPIs
  advice: KPIAdvice[]
}

/**
 * Calculates the core financial KPIs (profitability, efficiency, safety, growth,
 * cash flow) plus a benchmark comparison against the company's sector.
 *
 * Results are memoized in an in-process cache keyed by a hash of the inputs, so
 * repeated calls with the same arguments return the cached object.
 *
 * @param bs - Balance sheet.
 * @param pl - Profit & loss statement.
 * @param cf - Cash flow statement.
 * @param previousPL - Prior-period P&L for growth metrics; growth is 0 when omitted.
 * @param options - Accounting standard (defaults to JGAAP), sector (defaults to
 *   'other'), and company size; omitted fields fall back to defaults.
 * @returns The assembled FinancialKPIs.
 */
export function calculateFinancialKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  previousPL?: ProfitLoss,
  options: KPIOptions = {}
): FinancialKPIs {
  const standard = options.standard || 'JGAAP'
  const sector = options.sector || 'other'
  const benchmark = INDUSTRY_BENCHMARKS[sector]

  const cacheKey = generateKPIHash(bs, pl, cf, previousPL, options)

  const cached = kpiCache.get(cacheKey)
  if (cached) {
    return cached as unknown as FinancialKPIs
  }

  const kpis: FinancialKPIs = {
    fiscalYear: pl.fiscalYear,
    month: pl.month,
    profitability: calculateProfitabilityKPIs(bs, pl, standard),
    efficiency: calculateEfficiencyKPIs(bs, pl, sector),
    safety: calculateSafetyKPIs(bs, standard),
    growth: calculateGrowthKPIs(pl, previousPL),
    cashFlow: calculateCashFlowKPIs(pl, cf),
    benchmark: {
      sector,
      comparison: generateBenchmarkComparison(bs, pl, benchmark),
    },
  }

  kpiCache.set(cacheKey, kpis as unknown as Record<string, unknown>)
  return kpis
}

function generateKPIHash(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  previousPL?: ProfitLoss,
  options?: KPIOptions
): string {
  return JSON.stringify({
    bsTotal: bs.assets.total,
    plNetIncome: pl.netIncome,
    cfNetCash: cf.netChangeInCash,
    prevNetIncome: previousPL?.netIncome,
    standard: options?.standard,
    sector: options?.sector,
  })
}

/**
 * Calculates the extended KPI set: core {@link FinancialKPIs} plus startup (burn
 * rate, runway, CAC/LTV), VC (Rule of 40, growth, NRR), and bank (DSCR, interest
 * coverage) metrics, together with generated advisory items.
 *
 * @param bs - Balance sheet.
 * @param pl - Profit & loss statement.
 * @param cf - Cash flow statement.
 * @param previousPL - Prior-period P&L for growth metrics.
 * @param options - Optional operational inputs (marketing spend, customer counts,
 *   interest expense, principal payments, valuation, etc.); each derived metric
 *   degrades gracefully to `null`/default when its inputs are absent.
 * @returns ExtendedFinancialKPIs combining base, startup, VC, bank, and advice.
 */
export function calculateExtendedKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  previousPL?: ProfitLoss,
  options?: {
    marketingSpend?: number
    newCustomers?: number
    churnedCustomers?: number
    totalCustomers?: number
    arRevenue?: number
    interestExpense?: number
    principalPayments?: number
    valuation?: number
  }
): ExtendedFinancialKPIs {
  const baseKPIs = calculateFinancialKPIs(bs, pl, cf, previousPL)
  const startup = calculateStartupKPIs(bs, pl, cf, options)
  const vc = calculateVCKPIs(bs, pl, previousPL, options)
  const bank = calculateBankKPIs(bs, pl, options)
  const advice = generateKPIAdvice(baseKPIs, startup, vc, bank)

  return {
    ...baseKPIs,
    startup,
    vc,
    bank,
    advice,
  }
}

function calculateStartupKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  options?: {
    marketingSpend?: number
    newCustomers?: number
    churnedCustomers?: number
    totalCustomers?: number
  }
): StartupKPIs {
  const cash = bs.assets.current.reduce((sum, a) => sum + a.amount, 0)
  const monthlyExpenses = pl.sgaExpenses.reduce((sum, e) => sum + e.amount, 0)
  const burnRate = pl.netIncome < 0 ? Math.abs(pl.netIncome) : monthlyExpenses - pl.grossProfit
  const runwayMonths = burnRate > 0 ? Math.floor(cash / burnRate) : 999

  let cac: number | null = null
  let ltv: number | null = null
  let ltvCacRatio: number | null = null
  let churnRate: number | null = null

  if (options?.marketingSpend && options?.newCustomers && options.newCustomers > 0) {
    cac = options.marketingSpend / options.newCustomers
  }

  if (options?.totalCustomers && options.totalCustomers > 0) {
    const avgRevenuePerCustomer =
      pl.revenue.reduce((s, r) => s + r.amount, 0) / options.totalCustomers
    if (options.churnedCustomers !== undefined) {
      churnRate = (options.churnedCustomers / options.totalCustomers) * 100
    }
    if (churnRate !== null && churnRate > 0) {
      ltv = avgRevenuePerCustomer / (churnRate / 100)
    }
  }

  if (cac && ltv) {
    ltvCacRatio = ltv / cac
  }

  const mrr = pl.revenue.reduce((s, r) => s + r.amount, 0) / 12

  return {
    burnRate: Math.round(burnRate),
    runwayMonths: Math.min(runwayMonths, 999),
    cac,
    ltv,
    ltvCacRatio,
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    churnRate,
  }
}

function calculateVCKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousPL?: ProfitLoss,
  options?: {
    arRevenue?: number
    valuation?: number
  }
): VCKPIs {
  const revenue = pl.revenue.reduce((s, r) => s + r.amount, 0)
  const growthRate = previousPL
    ? calculateGrowthRate(
        revenue,
        previousPL.revenue.reduce((s, r) => s + r.amount, 0)
      )
    : 0

  const grossMargin = pl.grossProfitMargin

  let revenueMultiple: number | null = null
  if (options?.valuation && revenue > 0) {
    revenueMultiple = options.valuation / revenue
  }

  let nrr: number | null = null
  if (options?.arRevenue && previousPL) {
    const previousRevenue = previousPL.revenue.reduce((s, r) => s + r.amount, 0)
    if (previousRevenue > 0) {
      nrr = ((options.arRevenue - (revenue - options.arRevenue)) / previousRevenue) * 100
    }
  }

  let magicNumber: number | null = null
  if (previousPL) {
    const previousArr = previousPL.revenue.reduce((s, r) => s + r.amount, 0)
    const arrGrowth = revenue - previousArr
    const salesMarketingSpend = pl.sgaExpenses
      .filter(
        (e) => e.name.includes('広告') || e.name.includes('販売') || e.name.includes('マーケ')
      )
      .reduce((s, e) => s + e.amount, 0)
    if (salesMarketingSpend > 0) {
      magicNumber = arrGrowth / salesMarketingSpend
    }
  }

  const ruleOf40 = growthRate + grossMargin

  return {
    revenueMultiple,
    growthRate: roundTo2(growthRate),
    grossMargin: roundTo2(grossMargin),
    nrr,
    magicNumber: magicNumber !== null ? roundTo2(magicNumber) : null,
    ruleOf40: roundTo2(ruleOf40),
  }
}

function calculateBankKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  options?: {
    interestExpense?: number
    principalPayments?: number
  }
): BankKPIs {
  const ebitda = pl.operatingIncome + (pl.depreciation || 0)
  const interestExpense =
    options?.interestExpense ||
    pl.sgaExpenses
      .filter((e) => e.name.includes('支払利息') || e.name.includes('利息'))
      .reduce((s, e) => s + e.amount, 0)

  const principalPayments =
    options?.principalPayments ||
    bs.liabilities.fixed.filter((l) => l.name.includes('借入')).reduce((s, l) => s + l.amount, 0) /
      12

  const debtService = interestExpense + principalPayments

  const dscr = debtService > 0 ? ebitda / debtService : 999
  const interestCoverageRatio = interestExpense > 0 ? ebitda / interestExpense : 999
  const fixedChargeCoverageRatio =
    debtService > 0 ? (ebitda + principalPayments) / debtService : 999

  const totalDebt =
    bs.liabilities.current.reduce((s, l) => s + l.amount, 0) +
    bs.liabilities.fixed.reduce((s, l) => s + l.amount, 0)
  const debtToEquityRatio = bs.totalEquity > 0 ? totalDebt / bs.totalEquity : 999

  const debtServiceRatio = bs.totalAssets > 0 ? (totalDebt / bs.totalAssets) * 100 : 0

  return {
    dscr: roundTo2(dscr),
    interestCoverageRatio: roundTo2(interestCoverageRatio),
    fixedChargeCoverageRatio: roundTo2(fixedChargeCoverageRatio),
    debtToEquityRatio: roundTo2(debtToEquityRatio),
    debtServiceRatio: roundTo2(debtServiceRatio),
  }
}

function generateKPIAdvice(
  baseKPIs: FinancialKPIs,
  startup: StartupKPIs,
  vc: VCKPIs,
  bank: BankKPIs
): KPIAdvice[] {
  const advice: KPIAdvice[] = []

  if (startup.runwayMonths < 6) {
    advice.push({
      category: 'startup',
      kpiName: 'Runway',
      currentValue: startup.runwayMonths,
      targetValue: '12ヶ月以上',
      status: 'critical',
      advice: '資金繰りが危険水域です。早急な資金調達または支出削減が必要です。',
      actionItems: [
        '投資家への追加資金調達相談',
        '非中核事業の縮小・撤退',
        '人件費等の変動費削減',
        '売掛金の早期回収',
      ],
    })
  } else if (startup.runwayMonths < 12) {
    advice.push({
      category: 'startup',
      kpiName: 'Runway',
      currentValue: startup.runwayMonths,
      targetValue: '12ヶ月以上',
      status: 'warning',
      advice: '資金調達の準備を開始すべきタイミングです。',
      actionItems: [
        '次ラウンドの投資家リスト作成',
        '事業計画の更新',
        'キャッシュフロー予測の精緻化',
      ],
    })
  }

  if (startup.ltvCacRatio !== null) {
    if (startup.ltvCacRatio < 3) {
      advice.push({
        category: 'startup',
        kpiName: 'LTV/CAC比率',
        currentValue: startup.ltvCacRatio,
        targetValue: 3,
        status: 'critical',
        advice: '顧客獲得コストに対して収益性が低すぎます。',
        actionItems: [
          'マーケティングチャネルの効率化',
          'ターゲット顧客の絞り込み',
          'アップセル・クロスセル施策の強化',
          '顧客維持期間の延長',
        ],
      })
    } else if (startup.ltvCacRatio < 5) {
      advice.push({
        category: 'startup',
        kpiName: 'LTV/CAC比率',
        currentValue: startup.ltvCacRatio,
        targetValue: 5,
        status: 'warning',
        advice: '健全な範囲ですが、さらに改善の余地があります。',
        actionItems: ['チャーン抑制施策の強化', '単価向上施策の検討'],
      })
    }
  }

  if (vc.ruleOf40 < 40) {
    advice.push({
      category: 'vc',
      kpiName: 'Rule of 40',
      currentValue: vc.ruleOf40,
      targetValue: 40,
      status: vc.ruleOf40 < 20 ? 'critical' : 'warning',
      advice: '成長率と利益率のバランスが投資家の期待を下回っています。',
      actionItems: [
        '成長率向上または利益率改善の優先順位決定',
        '収益性の高い事業領域へのシフト',
        'コスト構造の見直し',
      ],
    })
  }

  if (vc.growthRate < 20) {
    advice.push({
      category: 'vc',
      kpiName: '成長率',
      currentValue: vc.growthRate,
      targetValue: '20%以上',
      status: vc.growthRate < 10 ? 'critical' : 'warning',
      advice: 'VC投資の観点からは成長率が不十分です。',
      actionItems: ['新規顧客獲得施策の強化', '既存顧客の拡販', '新市場・新製品の検討'],
    })
  }

  if (bank.dscr < 1.2) {
    advice.push({
      category: 'bank',
      kpiName: 'DSCR',
      currentValue: bank.dscr,
      targetValue: 1.2,
      status: bank.dscr < 1.0 ? 'critical' : 'warning',
      advice: '借入金返済能力が不十分です。融資審査で厳しい評価となります。',
      actionItems: [
        'キャッシュフロー改善計画の策定',
        '借入条件の再交渉検討',
        '不要資産の売却による現金化',
        '借入金の返済スケジュール見直し',
      ],
    })
  }

  if (bank.debtToEquityRatio > 2.0) {
    advice.push({
      category: 'bank',
      kpiName: 'D/E比率',
      currentValue: bank.debtToEquityRatio,
      targetValue: 1.0,
      status: bank.debtToEquityRatio > 3.0 ? 'critical' : 'warning',
      advice: '財務レバレッジが高く、銀行融資の獲得が困難になる可能性があります。',
      actionItems: [
        '自己資本の充実（増資、利益留保）',
        '借入金の段階的返済',
        '財務体質改善計画の策定',
      ],
    })
  }

  if (baseKPIs.profitability.grossProfitMargin < 30) {
    advice.push({
      category: 'general',
      kpiName: '売上総利益率',
      currentValue: baseKPIs.profitability.grossProfitMargin,
      targetValue: 30,
      status: baseKPIs.profitability.grossProfitMargin < 20 ? 'critical' : 'warning',
      advice: '粗利益率が低く、事業モデルの持続可能性に課題があります。',
      actionItems: [
        '原価構造の見直し',
        '価格戦略の再検討',
        '高付加価値製品・サービスへのシフト',
        '仕入れ条件の見直し',
      ],
    })
  }

  return advice
}

function generateBenchmarkComparison(
  bs: BalanceSheet,
  pl: ProfitLoss,
  benchmark: IndustryBenchmark
): BenchmarkComparison[] {
  const comparisons: BenchmarkComparison[] = []

  comparisons.push(
    createComparison('売上総利益率', pl.grossProfitMargin, benchmark.grossProfitMargin)
  )

  comparisons.push(createComparison('営業利益率', pl.operatingMargin, benchmark.operatingMargin))

  const currentAssets = bs.assets.current.reduce((sum, a) => sum + a.amount, 0)
  const currentLiabilities = bs.liabilities.current.reduce((sum, l) => sum + l.amount, 0)
  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) * 100 : 999
  comparisons.push(createComparison('流動比率', currentRatio, benchmark.currentRatio))

  const totalDebt = bs.totalLiabilities
  const debtToEquity = bs.totalEquity > 0 ? totalDebt / bs.totalEquity : 999
  comparisons.push(createComparison('D/E比率', debtToEquity, benchmark.debtToEquity))

  return comparisons
}

function createComparison(
  metric: string,
  value: number,
  benchmarkRange: { min: number; median: number; max: number }
): BenchmarkComparison {
  let percentile = 50
  let status: BenchmarkComparison['status'] = 'above_median'

  if (value < benchmarkRange.min) {
    percentile = 0
    status = 'below_range'
  } else if (value > benchmarkRange.max) {
    percentile = 100
    status = 'above_range'
  } else if (value < benchmarkRange.median) {
    percentile = ((value - benchmarkRange.min) / (benchmarkRange.median - benchmarkRange.min)) * 50
    status = 'below_median'
  } else {
    percentile =
      50 + ((value - benchmarkRange.median) / (benchmarkRange.max - benchmarkRange.median)) * 50
    status = 'above_median'
  }

  return {
    metric,
    value,
    benchmark: benchmarkRange,
    percentile: Math.round(percentile),
    status,
  }
}

function calculateProfitabilityKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  _standard: AccountingStandard
): FinancialKPIs['profitability'] {
  const totalAssets = bs.totalAssets
  const equity = bs.totalEquity
  const revenue = getTotalRevenue(pl)

  const roe = safeDivide(pl.netIncome, equity) * 100
  const roa = safeDivide(pl.netIncome, totalAssets) * 100
  const ros = safeDivide(pl.operatingIncome, revenue) * 100
  const grossProfitMargin = pl.grossProfitMargin
  const operatingMargin = pl.operatingMargin
  const ebitdaMargin = calculateEBITDAMargin(pl)

  return {
    roe: roundTo2(roe),
    roa: roundTo2(roa),
    ros: roundTo2(ros),
    grossProfitMargin: roundTo2(grossProfitMargin),
    operatingMargin: roundTo2(operatingMargin),
    ebitdaMargin: roundTo2(ebitdaMargin),
  }
}

function calculateEfficiencyKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  sector: IndustrySector
): FinancialKPIs['efficiency'] {
  const revenue = getTotalRevenue(pl)
  const costOfSales = pl.costOfSales.reduce((sum, item) => sum + item.amount, 0)

  const totalAssets = bs.totalAssets
  const inventory = getTotalInventory(bs)
  const receivables = getTotalReceivables(bs)
  const payables = getTotalPayables(bs)

  const assetTurnover = safeDivide(revenue, totalAssets)

  let inventoryTurnover = 0
  if (!['service', 'technology', 'finance'].includes(sector) && inventory > 0) {
    inventoryTurnover = safeDivide(costOfSales, inventory)
  }

  const receivablesTurnover = safeDivide(revenue, receivables)
  const payablesTurnover = safeDivide(costOfSales, payables)

  return {
    assetTurnover: roundTo2(assetTurnover),
    inventoryTurnover: roundTo2(inventoryTurnover),
    receivablesTurnover: roundTo2(receivablesTurnover),
    payablesTurnover: roundTo2(payablesTurnover),
  }
}

function calculateSafetyKPIs(
  bs: BalanceSheet,
  _standard: AccountingStandard
): FinancialKPIs['safety'] {
  const currentAssets = bs.assets.current.reduce((sum, item) => sum + item.amount, 0)
  const currentLiabilities = bs.liabilities.current.reduce((sum, item) => sum + item.amount, 0)
  const inventory = getTotalInventory(bs)
  const totalLiabilities = bs.totalLiabilities
  const equity = bs.totalEquity
  const totalAssets = bs.totalAssets

  const currentRatio = safeDivide(currentAssets, currentLiabilities) * 100
  const quickRatio = safeDivide(currentAssets - inventory, currentLiabilities) * 100
  const debtToEquity = safeDivide(totalLiabilities, equity)
  const equityRatio = safeDivide(equity, totalAssets) * 100

  return {
    currentRatio: roundTo2(currentRatio),
    quickRatio: roundTo2(quickRatio),
    debtToEquity: roundTo2(debtToEquity),
    equityRatio: roundTo2(equityRatio),
  }
}

function calculateGrowthKPIs(pl: ProfitLoss, previousPL?: ProfitLoss): FinancialKPIs['growth'] {
  if (!previousPL) {
    return {
      revenueGrowth: 0,
      profitGrowth: 0,
    }
  }

  const currentRevenue = getTotalRevenue(pl)
  const previousRevenue = getTotalRevenue(previousPL)
  const currentProfit = pl.netIncome
  const previousProfit = previousPL.netIncome

  return {
    revenueGrowth: roundTo2(calculateGrowthRate(currentRevenue, previousRevenue)),
    profitGrowth: roundTo2(calculateGrowthRate(currentProfit, previousProfit)),
  }
}

function calculateCashFlowKPIs(pl: ProfitLoss, cf: CashFlowStatement): FinancialKPIs['cashFlow'] {
  const fcf = calculateFreeCashFlow(cf)
  const revenue = getTotalRevenue(pl)
  const fcfMargin = safeDivide(fcf, revenue) * 100

  return {
    fcf: Math.round(fcf),
    fcfMargin: roundTo2(fcfMargin),
  }
}

function calculateEBITDAMargin(pl: ProfitLoss): number {
  const ebitda = pl.operatingIncome + (pl.depreciation || 0)
  const revenue = getTotalRevenue(pl)
  return safeDivide(ebitda, revenue) * 100
}

function getTotalRevenue(pl: ProfitLoss): number {
  return pl.revenue.reduce((sum, item) => sum + item.amount, 0)
}

function getTotalInventory(bs: BalanceSheet): number {
  return bs.assets.current
    .filter(
      (item) =>
        item.name.includes('棚卸') ||
        item.name.includes('商品') ||
        item.name.includes('製品') ||
        item.name.includes('材料')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

function getTotalReceivables(bs: BalanceSheet): number {
  return bs.assets.current
    .filter(
      (item) =>
        item.name.includes('売掛') || item.name.includes('受取手形') || item.name.includes('未収')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

function getTotalPayables(bs: BalanceSheet): number {
  return bs.liabilities.current
    .filter(
      (item) =>
        item.name.includes('買掛') || item.name.includes('支払手形') || item.name.includes('未払')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface KPIBenchmark {
  kpi: string
  value: number
  benchmark: number
  status: 'good' | 'warning' | 'bad'
  description: string
}

/**
 * Maps a FinancialKPIs result into a flat list of benchmark evaluations (value,
 * target, and good/warning/bad status) for dashboard display.
 *
 * @param kpis - Previously computed financial KPIs.
 * @returns KPIBenchmark entries for ROE, ROA, current ratio, D/E ratio, equity
 *   ratio, gross margin, operating margin, and EBITDA margin.
 */
export function getKPIBenchmarks(kpis: FinancialKPIs): KPIBenchmark[] {
  return [
    {
      kpi: 'ROE',
      value: kpis.profitability.roe,
      benchmark: 10,
      status:
        kpis.profitability.roe >= 10 ? 'good' : kpis.profitability.roe >= 5 ? 'warning' : 'bad',
      description: '自己資本利益率。10%以上が望ましい',
    },
    {
      kpi: 'ROA',
      value: kpis.profitability.roa,
      benchmark: 5,
      status:
        kpis.profitability.roa >= 5 ? 'good' : kpis.profitability.roa >= 2 ? 'warning' : 'bad',
      description: '総資産利益率。5%以上が望ましい',
    },
    {
      kpi: '流動比率',
      value: kpis.safety.currentRatio,
      benchmark: 150,
      status:
        kpis.safety.currentRatio >= 150
          ? 'good'
          : kpis.safety.currentRatio >= 100
            ? 'warning'
            : 'bad',
      description: '短期的な支払能力。150%以上が望ましい',
    },
    {
      kpi: 'D/E比率',
      value: kpis.safety.debtToEquity,
      benchmark: 1.0,
      status:
        kpis.safety.debtToEquity <= 1.0
          ? 'good'
          : kpis.safety.debtToEquity <= 2.0
            ? 'warning'
            : 'bad',
      description: '財務リスク。1.0以下が望ましい',
    },
    {
      kpi: '自己資本比率',
      value: kpis.safety.equityRatio,
      benchmark: 30,
      status:
        kpis.safety.equityRatio >= 30 ? 'good' : kpis.safety.equityRatio >= 20 ? 'warning' : 'bad',
      description: '財務の安定性。30%以上が望ましい',
    },
    {
      kpi: '売上総利益率',
      value: kpis.profitability.grossProfitMargin,
      benchmark: 30,
      status:
        kpis.profitability.grossProfitMargin >= 30
          ? 'good'
          : kpis.profitability.grossProfitMargin >= 20
            ? 'warning'
            : 'bad',
      description: '収益力の基本指標',
    },
    {
      kpi: '営業利益率',
      value: kpis.profitability.operatingMargin,
      benchmark: 10,
      status:
        kpis.profitability.operatingMargin >= 10
          ? 'good'
          : kpis.profitability.operatingMargin >= 5
            ? 'warning'
            : 'bad',
      description: '本業の収益性。10%以上推奨',
    },
    {
      kpi: 'EBITDAマージン',
      value: kpis.profitability.ebitdaMargin,
      benchmark: 15,
      status:
        kpis.profitability.ebitdaMargin >= 15
          ? 'good'
          : kpis.profitability.ebitdaMargin >= 10
            ? 'warning'
            : 'bad',
      description: 'キャッシュ創出力。15%以上推奨',
    },
  ]
}

// ============================================================================
// FIN-IMPL-04 — Strengthened financial-ratio set.
//
// Additive surface: the legacy calculateFinancialKPIs / calculateExtendedKPIs
// above are intentionally untouched (consumed by monthly-report / reports+kpi
// / analysis routes). Everything below is new, returns Result<T, AppError>,
// validates inputs with Zod safeParse, and cites a standard definition per
// docs/proposals/fin-design-03-accounting-metrics.md §5. Judgemental treatments
// are marked `// PENDING HUMAN DETERMINATION` and default to the most
// conservative / most standard option.
//
// Module-wide convention (matches existing safeDivide usage): a zero
// denominator yields 0, never Infinity/NaN. "Not computable" outcomes that are
// NOT a zero-denominator (e.g. a missing prior period for a growth metric) are
// surfaced as a Result failure (helper) or null (aggregator field).
// ============================================================================

const DAYS_IN_YEAR = 365

const balanceSheetItemSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
  })
  .passthrough()

const profitLossItemSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
  })
  .passthrough()

const balanceSheetSchema = z
  .object({
    fiscalYear: z.number(),
    month: z.number(),
    assets: z.object({
      current: z.array(balanceSheetItemSchema),
      fixed: z.array(balanceSheetItemSchema),
      total: z.number(),
    }),
    liabilities: z.object({
      current: z.array(balanceSheetItemSchema),
      fixed: z.array(balanceSheetItemSchema),
      total: z.number(),
    }),
    equity: z.object({
      items: z.array(balanceSheetItemSchema),
      total: z.number(),
    }),
    totalAssets: z.number(),
    totalLiabilities: z.number(),
    totalEquity: z.number(),
  })
  .passthrough()

const profitLossSchema = z
  .object({
    fiscalYear: z.number(),
    month: z.number(),
    revenue: z.array(profitLossItemSchema),
    costOfSales: z.array(profitLossItemSchema),
    grossProfit: z.number(),
    grossProfitMargin: z.number(),
    sgaExpenses: z.array(profitLossItemSchema),
    operatingIncome: z.number(),
    operatingMargin: z.number(),
    nonOperatingIncome: z.array(profitLossItemSchema),
    nonOperatingExpenses: z.array(profitLossItemSchema),
    ordinaryIncome: z.number(),
    extraordinaryIncome: z.array(profitLossItemSchema),
    extraordinaryLoss: z.array(profitLossItemSchema),
    incomeBeforeTax: z.number(),
    incomeTax: z.number(),
    netIncome: z.number(),
    depreciation: z.number(),
  })
  .passthrough()

function parseOrFail<T>(schema: z.ZodType<T>, value: unknown, field: string): Result<T, AppError> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, `Invalid ${field}: schema validation failed`, {
        details: {
          field,
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      })
    )
  }
  return success(parsed.data)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function averageOf(current: number, previous?: number): number {
  return previous === undefined ? current : (current + previous) / 2
}

function grow(r: Result<number, AppError>): number | null {
  return r.success ? r.data : null
}

// Interest-bearing debt: short + long-term borrowings, bonds, leases by name.
// PENDING HUMAN DETERMINATION: scope (include leases / short-term bonds?).
function getInterestBearingDebt(bs: BalanceSheet): number {
  return [...bs.liabilities.current, ...bs.liabilities.fixed]
    .filter((l) => l.name.includes('借入') || l.name.includes('社債') || l.name.includes('リース'))
    .reduce((sum, l) => sum + l.amount, 0)
}

// Cash & deposits only.
// PENDING HUMAN DETERMINATION: include marketable securities (有価証券)?
function getCashAndEquivalents(bs: BalanceSheet): number {
  return bs.assets.current
    .filter((a) => a.name.includes('現金') || a.name.includes('預金'))
    .reduce((sum, a) => sum + a.amount, 0)
}

// Net fixed assets = sum of fixed-asset items (accumulated depreciation is a
// negative contra-asset line, so the sum is already net).
function getNetFixedAssets(bs: BalanceSheet): number {
  return bs.assets.fixed.reduce((sum, a) => sum + a.amount, 0)
}

// EBIT = operating income (operating-only view; standard for ROIC/NOPAT which
// measure return on operating capital).
// PENDING HUMAN DETERMINATION: alternative EBIT = ordinaryIncome + interestExpense.
function getEBIT(pl: ProfitLoss): number {
  return pl.operatingIncome
}

// EBITDA = operating income + depreciation + amortization. Amortization is not
// carried on the ProfitLoss model (always 0), so this collapses to opInc + dep.
function getEBITDA(pl: ProfitLoss): number {
  return pl.operatingIncome + (pl.depreciation || 0)
}

// Interest expense MUST be read from nonOperatingExpenses (支払利息), NOT
// sgaExpenses — fixes the bucket bug noted in fin-design-03 §4 (the legacy
// bank KPIs read sgaExpenses, which yields 0/wrong).
function getInterestExpense(pl: ProfitLoss): number {
  return pl.nonOperatingExpenses
    .filter((e) => e.name.includes('支払利息') || e.name.includes('利息'))
    .reduce((sum, e) => sum + e.amount, 0)
}

function validateOptionalBS(previousBS?: BalanceSheet): Result<void, AppError> {
  if (!previousBS) return success(undefined)
  const parsed = parseOrFail(balanceSheetSchema, previousBS, 'previousBalanceSheet')
  if (!parsed.success) return parsed
  return success(undefined)
}

// ----------------------------------------------------------------------------
// Profitability
// ----------------------------------------------------------------------------

export interface NOPATResult {
  ebit: number
  effectiveTaxRate: number
  nopat: number
}

export interface ROICResult {
  roic: number
  nopat: number
  ebit: number
  effectiveTaxRate: number
  investedCapital: number
}

/**
 * NOPAT = EBIT × (1 − effectiveTaxRate). Cited: standard NOPAT definition.
 * effectiveTaxRate = incomeTax / incomeBeforeTax, clamped to [0, 1].
 * PENDING HUMAN DETERMINATION: when incomeBeforeTax ≤ 0 the effective rate is
 * not meaningful; defaults to 0 (NOPAT = EBIT, i.e. assumes no tax shield).
 */
export function calcNOPAT(pl: ProfitLoss): Result<NOPATResult, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const ebit = getEBIT(plOk.data)
  const effectiveTaxRate =
    plOk.data.incomeBeforeTax > 0 ? clamp(plOk.data.incomeTax / plOk.data.incomeBeforeTax, 0, 1) : 0
  const nopat = ebit * (1 - effectiveTaxRate)
  return success({ ebit: roundTo2(ebit), effectiveTaxRate: roundTo4(effectiveTaxRate), nopat })
}

/**
 * ROE = Net Income / Average Shareholders' Equity × 100. Cited: standard ROE
 * (average-equity is the GAAP-correct form). Uses (current+previous)/2 when a
 * prior balance sheet is supplied, else period-end equity.
 * PENDING HUMAN DETERMINATION: average vs period-end denominator.
 */
export function calcROE(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk
  const equity = averageOf(bsOk.data.totalEquity, previousBS?.totalEquity)
  return success(roundTo2(safeDivide(plOk.data.netIncome, equity) * 100))
}

/**
 * ROA = Net Income / Average Total Assets × 100. Cited: standard ROA.
 * PENDING HUMAN DETERMINATION: average vs period-end denominator.
 */
export function calcROA(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk
  const assets = averageOf(bsOk.data.totalAssets, previousBS?.totalAssets)
  return success(roundTo2(safeDivide(plOk.data.netIncome, assets) * 100))
}

/**
 * ROIC = NOPAT / Average Invested Capital × 100. Cited: standard ROIC.
 * Invested capital (financing approach) = equity + interestBearingDebt − cash.
 * PENDING HUMAN DETERMINATION: (a) invested-capital definition (financing vs
 * operating NWC+netFA approach); (b) average vs period-end; (c) whether to net
 * cash (netting raises ROIC — the non-netting alternative is more conservative).
 */
export function calcROIC(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<ROICResult, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk

  const nopatResult = calcNOPAT(plOk.data)
  if (!nopatResult.success) return nopatResult
  const { nopat, ebit, effectiveTaxRate } = nopatResult.data

  const currentIC =
    bsOk.data.totalEquity + getInterestBearingDebt(bsOk.data) - getCashAndEquivalents(bsOk.data)
  const previousIC = previousBS
    ? previousBS.totalEquity +
      getInterestBearingDebt(previousBS) -
      getCashAndEquivalents(previousBS)
    : undefined
  const investedCapital = averageOf(currentIC, previousIC)
  const roic = safeDivide(nopat, investedCapital) * 100
  return success({
    roic: roundTo2(roic),
    nopat: roundTo2(nopat),
    ebit,
    effectiveTaxRate,
    investedCapital: roundTo2(investedCapital),
  })
}

/** Gross profit margin = Gross Profit / Revenue × 100. */
export function calcGrossMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(plOk.data.grossProfit, getTotalRevenue(plOk.data)) * 100))
}

/** Operating margin = Operating Income / Revenue × 100. */
export function calcOperatingMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(plOk.data.operatingIncome, getTotalRevenue(plOk.data)) * 100))
}

/** Net margin = Net Income / Revenue × 100. */
export function calcNetMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(plOk.data.netIncome, getTotalRevenue(plOk.data)) * 100))
}

/** EBIT margin = EBIT / Revenue × 100. EBIT = operatingIncome (see getEBIT). */
export function calcEBITMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBIT(plOk.data), getTotalRevenue(plOk.data)) * 100))
}

/** EBITDA margin = EBITDA / Revenue × 100. */
export function calcEBITDAMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBITDA(plOk.data), getTotalRevenue(plOk.data)) * 100))
}

// ----------------------------------------------------------------------------
// Liquidity
// ----------------------------------------------------------------------------

/** Current ratio = Current Assets / Current Liabilities × 100 (%). */
export function calcCurrentRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const ca = bsOk.data.assets.current.reduce((s, a) => s + a.amount, 0)
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(ca, cl) * 100))
}

/** Quick ratio = (Current Assets − Inventory) / Current Liabilities × 100 (%). */
export function calcQuickRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const ca = bsOk.data.assets.current.reduce((s, a) => s + a.amount, 0)
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(ca - getTotalInventory(bsOk.data), cl) * 100))
}

/** Cash ratio = Cash & equivalents / Current Liabilities × 100 (%). */
export function calcCashRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(getCashAndEquivalents(bsOk.data), cl) * 100))
}

/** Working capital = Current Assets − Current Liabilities. */
export function calcWorkingCapital(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const ca = bsOk.data.assets.current.reduce((s, a) => s + a.amount, 0)
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(ca - cl))
}

/**
 * Days Inventory Outstanding = Inventory / COGS × 365.
 * PENDING HUMAN DETERMINATION: 365 vs 360 day convention.
 */
export function calcDIO(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(getTotalInventory(bsOk.data), cogs) * DAYS_IN_YEAR))
}

/**
 * Days Sales Outstanding = Receivables / Revenue × 365.
 * PENDING HUMAN DETERMINATION: revenue vs credit-sales denominator.
 */
export function calcDSO(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const revenue = getTotalRevenue(plOk.data)
  return success(roundTo2(safeDivide(getTotalReceivables(bsOk.data), revenue) * DAYS_IN_YEAR))
}

/**
 * Days Payable Outstanding = Payables / COGS × 365.
 * PENDING HUMAN DETERMINATION: COGS vs purchases denominator.
 */
export function calcDPO(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(getTotalPayables(bsOk.data), cogs) * DAYS_IN_YEAR))
}

/**
 * Cash Conversion Cycle = DIO + DSO − DPO (days). Cited: standard CCC.
 * Demanded by DD checklist MA-WC-001. For inventory-less sectors DIO is 0 and
 * the cycle reflects only the receivables/payables gap.
 */
export function calcCCC(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const dio = calcDIO(bs, pl)
  if (!dio.success) return dio
  const dso = calcDSO(bs, pl)
  if (!dso.success) return dso
  const dpo = calcDPO(bs, pl)
  if (!dpo.success) return dpo
  return success(roundTo2(dio.data + dso.data - dpo.data))
}

// ----------------------------------------------------------------------------
// Leverage / safety
// ----------------------------------------------------------------------------

/** Debt-to-equity = Total Liabilities / Equity. */
export function calcDebtToEquity(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalLiabilities, bsOk.data.totalEquity)))
}

/** Equity ratio = Equity / Total Assets × 100 (%). */
export function calcEquityRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalEquity, bsOk.data.totalAssets) * 100))
}

/** Debt ratio = Total Liabilities / Total Assets × 100 (%). */
export function calcDebtRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalLiabilities, bsOk.data.totalAssets) * 100))
}

/** Long-term debt-to-equity = Fixed Liabilities / Equity. */
export function calcLongTermDebtToEquity(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const fixedLiab = bsOk.data.liabilities.fixed.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(fixedLiab, bsOk.data.totalEquity)))
}

/** Equity multiplier = Total Assets / Equity (also the DuPont leverage factor). */
export function calcEquityMultiplier(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalAssets, bsOk.data.totalEquity)))
}

/** Debt-to-EBITDA = Interest-bearing debt / EBITDA (covenant-common). */
export function calcDebtToEBITDA(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getInterestBearingDebt(bsOk.data), getEBITDA(plOk.data))))
}

/** Net debt-to-EBITDA = (IBD − cash) / EBITDA. */
export function calcNetDebtToEBITDA(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const netDebt = getInterestBearingDebt(bsOk.data) - getCashAndEquivalents(bsOk.data)
  return success(roundTo2(safeDivide(netDebt, getEBITDA(plOk.data))))
}

/**
 * Times Interest Earned = EBIT / Interest Expense.
 * Interest read from nonOperatingExpenses (支払利息). Returns 0 when there is
 * no interest expense (module-wide zero-denominator convention).
 * PENDING HUMAN DETERMINATION: 0 vs null/∞ when interest = 0.
 */
export function calcTimesInterestEarned(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBIT(plOk.data), getInterestExpense(plOk.data))))
}

/**
 * Interest coverage ratio = EBITDA / Interest Expense (EBITDA-based coverage).
 * Interest read from nonOperatingExpenses (支払利息). Returns 0 when no interest.
 * PENDING HUMAN DETERMINATION: EBIT vs EBITDA base; 0 vs null when interest = 0.
 */
export function calcInterestCoverageRatio(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBITDA(plOk.data), getInterestExpense(plOk.data))))
}

// ----------------------------------------------------------------------------
// Efficiency turnovers
// ----------------------------------------------------------------------------

/**
 * Asset turnover = Revenue / Average Total Assets.
 * PENDING HUMAN DETERMINATION: average vs period-end denominator.
 */
export function calcAssetTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk
  const assets = averageOf(bsOk.data.totalAssets, previousBS?.totalAssets)
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), assets)))
}

/**
 * Inventory turnover = COGS / Inventory. Forced to 0 for inventory-less sectors
 * (service/technology/finance), matching the legacy calculateEfficiencyKPIs
 * sector gating.
 */
export function calcInventoryTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss,
  sector?: IndustrySector
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  if (sector && ['service', 'technology', 'finance'].includes(sector)) {
    return success(0)
  }
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(cogs, getTotalInventory(bsOk.data))))
}

/** Receivables turnover = Revenue / Receivables. */
export function calcReceivablesTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), getTotalReceivables(bsOk.data))))
}

/** Payables turnover = COGS / Payables. */
export function calcPayablesTurnover(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(cogs, getTotalPayables(bsOk.data))))
}

/** Fixed-asset turnover = Revenue / Net Fixed Assets. */
export function calcFixedAssetTurnover(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), getNetFixedAssets(bsOk.data))))
}

/** Working-capital turnover = Revenue / Working Capital. */
export function calcWorkingCapitalTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const wc = calcWorkingCapital(bs)
  if (!wc.success) return wc
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), wc.data)))
}

// ----------------------------------------------------------------------------
// Growth (period-over-period). Returns failure when the prior period is absent.
// PENDING HUMAN DETERMINATION: sign convention for loss-making bases — the
// shared calculateGrowthRate divides by |previous|, so a negative base yields a
// sign-misleading % (a halved loss shows −50%). Consumers should treat growth
// as non-meaningful when previous ≤ 0.
// ----------------------------------------------------------------------------

export function calcRevenueGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, 'Previous-period P&L is required for revenue growth')
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(
    roundTo2(calculateGrowthRate(getTotalRevenue(plOk.data), getTotalRevenue(prevOk.data)))
  )
}

export function calcProfitGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, 'Previous-period P&L is required for profit growth')
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(plOk.data.netIncome, prevOk.data.netIncome)))
}

export function calcGrossProfitGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period P&L is required for gross-profit growth'
      )
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(plOk.data.grossProfit, prevOk.data.grossProfit)))
}

export function calcOperatingIncomeGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period P&L is required for operating-income growth'
      )
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(
    roundTo2(calculateGrowthRate(plOk.data.operatingIncome, prevOk.data.operatingIncome))
  )
}

export function calcOrdinaryIncomeGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period P&L is required for ordinary-income growth'
      )
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(
    roundTo2(calculateGrowthRate(plOk.data.ordinaryIncome, prevOk.data.ordinaryIncome))
  )
}

export function calcEBITDAGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, 'Previous-period P&L is required for EBITDA growth')
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(getEBITDA(plOk.data), getEBITDA(prevOk.data))))
}

export function calcAssetGrowth(
  bs: BalanceSheet,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  if (!previousBS) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period balance sheet is required for asset growth'
      )
    )
  }
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const prevOk = parseOrFail(balanceSheetSchema, previousBS, 'previousBalanceSheet')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(bsOk.data.totalAssets, prevOk.data.totalAssets)))
}

export function calcEquityGrowth(
  bs: BalanceSheet,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  if (!previousBS) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period balance sheet is required for equity growth'
      )
    )
  }
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const prevOk = parseOrFail(balanceSheetSchema, previousBS, 'previousBalanceSheet')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(bsOk.data.totalEquity, prevOk.data.totalEquity)))
}

// ----------------------------------------------------------------------------
// DuPont decomposition
// ----------------------------------------------------------------------------

export interface DuPontResult {
  /** ROE (percent) = netMargin × assetTurnover × equityMultiplier × 100. */
  roe: number
  /** Net income / revenue (decimal). */
  netMargin: number
  /** Revenue / average total assets (ratio). */
  assetTurnover: number
  /** Average total assets / average equity (ratio). */
  equityMultiplier: number
  /** Net income / income before tax (5-step tax burden; null if not computable). */
  taxBurden: number | null
  /** Income before tax / EBIT (5-step interest burden; null if not computable). */
  interestBurden: number | null
  /** EBIT / revenue (5-step operating margin; null if not computable). */
  ebitMargin: number | null
}

/**
 * DuPont decomposition of ROE. 3-step: ROE = netMargin × assetTurnover ×
 * equityMultiplier (all on average balances). 5-step factors are populated when
 * EBIT and income-before-tax are positive.
 * PENDING HUMAN DETERMINATION: average vs period-end balances.
 */
export function calcDuPont(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<DuPontResult, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk

  const revenue = getTotalRevenue(plOk.data)
  const avgAssets = averageOf(bsOk.data.totalAssets, previousBS?.totalAssets)
  const avgEquity = averageOf(bsOk.data.totalEquity, previousBS?.totalEquity)

  const netMargin = safeDivide(plOk.data.netIncome, revenue)
  const assetTurnover = safeDivide(revenue, avgAssets)
  const equityMultiplier = safeDivide(avgAssets, avgEquity)
  const roe = roundTo2(netMargin * assetTurnover * equityMultiplier * 100)

  const ebit = getEBIT(plOk.data)
  const taxBurden =
    plOk.data.incomeBeforeTax !== 0
      ? roundTo4(safeDivide(plOk.data.netIncome, plOk.data.incomeBeforeTax))
      : null
  const interestBurden = ebit !== 0 ? roundTo4(safeDivide(plOk.data.incomeBeforeTax, ebit)) : null
  const ebitMargin = revenue !== 0 ? roundTo4(safeDivide(ebit, revenue)) : null

  return success({
    roe,
    netMargin: roundTo4(netMargin),
    assetTurnover: roundTo4(assetTurnover),
    equityMultiplier: roundTo4(equityMultiplier),
    taxBurden,
    interestBurden,
    ebitMargin,
  })
}

function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000
}

// ----------------------------------------------------------------------------
// Aggregator
// ----------------------------------------------------------------------------

export interface FinancialRatioSet {
  fiscalYear: number
  month: number
  profitability: {
    roe: number
    roa: number
    roic: number
    nopat: number
    ebit: number
    ebitda: number
    grossMargin: number
    operatingMargin: number
    netMargin: number
    ebitMargin: number
    ebitdaMargin: number
  }
  liquidity: {
    currentRatio: number
    quickRatio: number
    cashRatio: number
    workingCapital: number
    dio: number
    dso: number
    dpo: number
    ccc: number
  }
  leverage: {
    debtToEquity: number
    equityRatio: number
    debtRatio: number
    longTermDebtToEquity: number
    equityMultiplier: number
    debtToEBITDA: number
    netDebtToEBITDA: number
    timesInterestEarned: number
    interestCoverageRatio: number
  }
  efficiency: {
    assetTurnover: number
    inventoryTurnover: number
    receivablesTurnover: number
    payablesTurnover: number
    fixedAssetTurnover: number
    workingCapitalTurnover: number
  }
  growth: {
    revenueGrowth: number | null
    profitGrowth: number | null
    grossProfitGrowth: number | null
    operatingIncomeGrowth: number | null
    ordinaryIncomeGrowth: number | null
    ebitdaGrowth: number | null
    assetGrowth: number | null
    equityGrowth: number | null
  }
  dupont: DuPontResult
}

export interface FinancialRatioOptions {
  previousBS?: BalanceSheet
  previousPL?: ProfitLoss
  sector?: IndustrySector
}

/**
 * Computes the complete strengthened financial-ratio set (profitability incl.
 * ROE/ROA/ROIC/NOPAT/EBIT/EBITDA + margins, liquidity incl. CCC, leverage incl.
 * debt/EBITDA + coverage, efficiency turnovers, growth, DuPont). All inputs are
 * Zod-validated; a validation failure short-circuits with a Result failure.
 * Growth fields are null when the prior period is not supplied.
 */
export function calculateFinancialRatios(
  bs: BalanceSheet,
  pl: ProfitLoss,
  options: FinancialRatioOptions = {}
): Result<FinancialRatioSet, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  if (options.previousBS) {
    const prevBSOk = parseOrFail(balanceSheetSchema, options.previousBS, 'previousBalanceSheet')
    if (!prevBSOk.success) return prevBSOk
  }
  if (options.previousPL) {
    const prevPLOk = parseOrFail(profitLossSchema, options.previousPL, 'previousProfitLoss')
    if (!prevPLOk.success) return prevPLOk
  }

  const { previousBS, previousPL, sector } = options

  const roe = calcROE(bsOk.data, plOk.data, previousBS)
  if (!roe.success) return roe
  const roa = calcROA(bsOk.data, plOk.data, previousBS)
  if (!roa.success) return roa
  const roic = calcROIC(bsOk.data, plOk.data, previousBS)
  if (!roic.success) return roic
  const nopat = calcNOPAT(plOk.data)
  if (!nopat.success) return nopat
  const grossMargin = calcGrossMargin(plOk.data)
  if (!grossMargin.success) return grossMargin
  const operatingMargin = calcOperatingMargin(plOk.data)
  if (!operatingMargin.success) return operatingMargin
  const netMargin = calcNetMargin(plOk.data)
  if (!netMargin.success) return netMargin
  const ebitMargin = calcEBITMargin(plOk.data)
  if (!ebitMargin.success) return ebitMargin
  const ebitdaMargin = calcEBITDAMargin(plOk.data)
  if (!ebitdaMargin.success) return ebitdaMargin

  const currentRatio = calcCurrentRatio(bsOk.data)
  if (!currentRatio.success) return currentRatio
  const quickRatio = calcQuickRatio(bsOk.data)
  if (!quickRatio.success) return quickRatio
  const cashRatio = calcCashRatio(bsOk.data)
  if (!cashRatio.success) return cashRatio
  const workingCapital = calcWorkingCapital(bsOk.data)
  if (!workingCapital.success) return workingCapital
  const dio =
    sector && ['service', 'technology', 'finance'].includes(sector)
      ? success(0)
      : calcDIO(bsOk.data, plOk.data)
  if (!dio.success) return dio
  const dso = calcDSO(bsOk.data, plOk.data)
  if (!dso.success) return dso
  const dpo = calcDPO(bsOk.data, plOk.data)
  if (!dpo.success) return dpo
  const ccc = roundTo2(dio.data + dso.data - dpo.data)

  const debtToEquity = calcDebtToEquity(bsOk.data)
  if (!debtToEquity.success) return debtToEquity
  const equityRatio = calcEquityRatio(bsOk.data)
  if (!equityRatio.success) return equityRatio
  const debtRatio = calcDebtRatio(bsOk.data)
  if (!debtRatio.success) return debtRatio
  const longTermDebtToEquity = calcLongTermDebtToEquity(bsOk.data)
  if (!longTermDebtToEquity.success) return longTermDebtToEquity
  const equityMultiplier = calcEquityMultiplier(bsOk.data)
  if (!equityMultiplier.success) return equityMultiplier
  const debtToEBITDA = calcDebtToEBITDA(bsOk.data, plOk.data)
  if (!debtToEBITDA.success) return debtToEBITDA
  const netDebtToEBITDA = calcNetDebtToEBITDA(bsOk.data, plOk.data)
  if (!netDebtToEBITDA.success) return netDebtToEBITDA
  const timesInterestEarned = calcTimesInterestEarned(bsOk.data, plOk.data)
  if (!timesInterestEarned.success) return timesInterestEarned
  const interestCoverageRatio = calcInterestCoverageRatio(bsOk.data, plOk.data)
  if (!interestCoverageRatio.success) return interestCoverageRatio

  const assetTurnover = calcAssetTurnover(bsOk.data, plOk.data, previousBS)
  if (!assetTurnover.success) return assetTurnover
  const inventoryTurnover = calcInventoryTurnover(bsOk.data, plOk.data, sector)
  if (!inventoryTurnover.success) return inventoryTurnover
  const receivablesTurnover = calcReceivablesTurnover(bsOk.data, plOk.data)
  if (!receivablesTurnover.success) return receivablesTurnover
  const payablesTurnover = calcPayablesTurnover(bsOk.data, plOk.data)
  if (!payablesTurnover.success) return payablesTurnover
  const fixedAssetTurnover = calcFixedAssetTurnover(bsOk.data, plOk.data)
  if (!fixedAssetTurnover.success) return fixedAssetTurnover
  const workingCapitalTurnover = calcWorkingCapitalTurnover(bsOk.data, plOk.data)
  if (!workingCapitalTurnover.success) return workingCapitalTurnover

  const dupont = calcDuPont(bsOk.data, plOk.data, previousBS)
  if (!dupont.success) return dupont

  return success({
    fiscalYear: plOk.data.fiscalYear,
    month: plOk.data.month,
    profitability: {
      roe: roe.data,
      roa: roa.data,
      roic: roic.data.roic,
      nopat: roic.data.nopat,
      ebit: roic.data.ebit,
      ebitda: roundTo2(getEBITDA(plOk.data)),
      grossMargin: grossMargin.data,
      operatingMargin: operatingMargin.data,
      netMargin: netMargin.data,
      ebitMargin: ebitMargin.data,
      ebitdaMargin: ebitdaMargin.data,
    },
    liquidity: {
      currentRatio: currentRatio.data,
      quickRatio: quickRatio.data,
      cashRatio: cashRatio.data,
      workingCapital: workingCapital.data,
      dio: dio.data,
      dso: dso.data,
      dpo: dpo.data,
      ccc,
    },
    leverage: {
      debtToEquity: debtToEquity.data,
      equityRatio: equityRatio.data,
      debtRatio: debtRatio.data,
      longTermDebtToEquity: longTermDebtToEquity.data,
      equityMultiplier: equityMultiplier.data,
      debtToEBITDA: debtToEBITDA.data,
      netDebtToEBITDA: netDebtToEBITDA.data,
      timesInterestEarned: timesInterestEarned.data,
      interestCoverageRatio: interestCoverageRatio.data,
    },
    efficiency: {
      assetTurnover: assetTurnover.data,
      inventoryTurnover: inventoryTurnover.data,
      receivablesTurnover: receivablesTurnover.data,
      payablesTurnover: payablesTurnover.data,
      fixedAssetTurnover: fixedAssetTurnover.data,
      workingCapitalTurnover: workingCapitalTurnover.data,
    },
    growth: {
      revenueGrowth: previousPL ? grow(calcRevenueGrowth(plOk.data, previousPL)) : null,
      profitGrowth: previousPL ? grow(calcProfitGrowth(plOk.data, previousPL)) : null,
      grossProfitGrowth: previousPL ? grow(calcGrossProfitGrowth(plOk.data, previousPL)) : null,
      operatingIncomeGrowth: previousPL
        ? grow(calcOperatingIncomeGrowth(plOk.data, previousPL))
        : null,
      ordinaryIncomeGrowth: previousPL
        ? grow(calcOrdinaryIncomeGrowth(plOk.data, previousPL))
        : null,
      ebitdaGrowth: previousPL ? grow(calcEBITDAGrowth(plOk.data, previousPL)) : null,
      assetGrowth: previousBS ? grow(calcAssetGrowth(bsOk.data, previousBS)) : null,
      equityGrowth: previousBS ? grow(calcEquityGrowth(bsOk.data, previousBS)) : null,
    },
    dupont: dupont.data,
  })
}

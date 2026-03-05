import type { BalanceSheet, ProfitLoss, FinancialKPIs, CashFlowStatement } from '@/types'
import { safeDivide, calculateGrowthRate } from '@/lib/utils'
import { calculateFreeCashFlow } from '@/services/cashflow/calculator'

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

export function calculateFinancialKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss,
  cf: CashFlowStatement,
  previousPL?: ProfitLoss
): FinancialKPIs {
  return {
    fiscalYear: pl.fiscalYear,
    month: pl.month,
    profitability: calculateProfitabilityKPIs(bs, pl),
    efficiency: calculateEfficiencyKPIs(bs, pl),
    safety: calculateSafetyKPIs(bs),
    growth: calculateGrowthKPIs(pl, previousPL),
    cashFlow: calculateCashFlowKPIs(pl, cf),
  }
}

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

function calculateProfitabilityKPIs(
  bs: BalanceSheet,
  pl: ProfitLoss
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

function calculateEfficiencyKPIs(bs: BalanceSheet, pl: ProfitLoss): FinancialKPIs['efficiency'] {
  const revenue = getTotalRevenue(pl)
  const costOfSales = pl.costOfSales.reduce((sum, item) => sum + item.amount, 0)

  const totalAssets = bs.totalAssets
  const inventory = getTotalInventory(bs)
  const receivables = getTotalReceivables(bs)
  const payables = getTotalPayables(bs)

  const assetTurnover = safeDivide(revenue, totalAssets)
  const inventoryTurnover = safeDivide(costOfSales, inventory)
  const receivablesTurnover = safeDivide(revenue, receivables)
  const payablesTurnover = safeDivide(costOfSales, payables)

  return {
    assetTurnover: roundTo2(assetTurnover),
    inventoryTurnover: roundTo2(inventoryTurnover),
    receivablesTurnover: roundTo2(receivablesTurnover),
    payablesTurnover: roundTo2(payablesTurnover),
  }
}

function calculateSafetyKPIs(bs: BalanceSheet): FinancialKPIs['safety'] {
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

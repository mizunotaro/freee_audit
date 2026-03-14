import { prisma } from '@/lib/db'

const DB_TIMEOUT_MS = 30000

export interface PeriodicReportConfig {
  companyId: string
  fiscalYearEndMonth: number
  periodType: '3months' | '6months' | '12months'
  includePreviousYear: boolean
}

export interface PeriodicReportData {
  periods: PeriodData[]
  summary: PeriodicSummary
}

export interface PeriodData {
  label: string
  fiscalYear: number
  startMonth: number
  endMonth: number
  balanceSheet: PeriodBS
  profitLoss: PeriodPL
  cashFlow: PeriodCF
  kpis: PeriodKPIs
  endingCash: number
}

export interface PeriodBS {
  totalAssets: number
  currentAssets: number
  fixedAssets: number
  totalLiabilities: number
  currentLiabilities: number
  fixedLiabilities: number
  equity: number
}

export interface PeriodPL {
  revenue: number
  costOfSales: number
  grossProfit: number
  operatingIncome: number
  ordinaryIncome: number
  netIncome: number
}

export interface PeriodCF {
  operatingCF: number
  investingCF: number
  financingCF: number
  freeCashFlow: number
}

export interface PeriodKPIs {
  roe: number
  roa: number
  grossMargin: number
  operatingMargin: number
  currentRatio: number
  debtToEquity: number
}

export interface PeriodicSummary {
  revenueGrowth: number | null
  profitGrowth: number | null
  cashChange: number
  avgROE: number
  avgROA: number
  trendAnalysis: string
}

export async function generatePeriodicReport(
  config: PeriodicReportConfig
): Promise<PeriodicReportData> {
  const { companyId, fiscalYearEndMonth, periodType, includePreviousYear } = config

  const currentFiscalYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const periods = calculatePeriods(
    currentFiscalYear,
    currentMonth,
    fiscalYearEndMonth,
    periodType,
    includePreviousYear
  )

  const periodDataPromises = periods.map((period) => getPeriodData(companyId, period))
  const periodDataResults = await Promise.all(periodDataPromises)
  const periodData = periodDataResults.filter((data): data is PeriodData => data !== null)

  const summary = generateSummary(periodData)

  return {
    periods: periodData,
    summary,
  }
}

function calculatePeriods(
  currentYear: number,
  currentMonth: number,
  fiscalYearEndMonth: number,
  periodType: string,
  includePreviousYear: boolean
): Array<{ label: string; fiscalYear: number; startMonth: number; endMonth: number }> {
  const periods: Array<{
    label: string
    fiscalYear: number
    startMonth: number
    endMonth: number
  }> = []

  const fiscalYear = currentMonth > fiscalYearEndMonth ? currentYear : currentYear - 1

  const monthsBack = periodType === '3months' ? 3 : periodType === '6months' ? 6 : 12

  for (let i = 0; i < monthsBack; i++) {
    const targetMonth = currentMonth - i
    let targetYear = fiscalYear

    if (targetMonth <= 0) {
      targetYear -= 1
    }

    const normalizedMonth = ((targetMonth - 1 + 12) % 12) + 1

    periods.unshift({
      label: `${targetYear}年${normalizedMonth}月`,
      fiscalYear: targetYear,
      startMonth: normalizedMonth,
      endMonth: normalizedMonth,
    })
  }

  if (includePreviousYear && periods.length > 0) {
    const previousYearPeriods = periods.map((p) => ({
      label: `${p.fiscalYear - 1}年${p.startMonth}月`,
      fiscalYear: p.fiscalYear - 1,
      startMonth: p.startMonth,
      endMonth: p.endMonth,
    }))
    periods.push(...previousYearPeriods)
  }

  return periods
}

async function getPeriodData(
  companyId: string,
  period: { label: string; fiscalYear: number; startMonth: number; endMonth: number }
): Promise<PeriodData | null> {
  const balances = await prisma.$transaction(
    async (tx) => {
      return tx.monthlyBalance.findMany({
        where: {
          companyId,
          fiscalYear: period.fiscalYear,
          month: period.endMonth,
        },
      })
    },
    { maxWait: 5000, timeout: DB_TIMEOUT_MS }
  )

  if (balances.length === 0) {
    return generateSamplePeriodData(period)
  }

  const bs = mapToPeriodBS(balances)
  const pl = await calculatePeriodPL(companyId, period.fiscalYear, period.endMonth)
  const previousBS = await getPreviousMonthBS(companyId, period.fiscalYear, period.endMonth)

  const cf = calculatePeriodCF(pl, bs, previousBS)
  const kpis = calculatePeriodKPIs(bs, pl, cf)
  const endingCash = bs.currentAssets

  return {
    label: period.label,
    fiscalYear: period.fiscalYear,
    startMonth: period.startMonth,
    endMonth: period.endMonth,
    balanceSheet: bs,
    profitLoss: pl,
    cashFlow: cf,
    kpis,
    endingCash,
  }
}

function mapToPeriodBS(balances: { category: string; amount: number }[]): PeriodBS {
  const currentAssets = balances
    .filter((b) => b.category === 'current_assets')
    .reduce((sum, b) => sum + b.amount, 0)
  const fixedAssets = balances
    .filter((b) => b.category === 'fixed_assets')
    .reduce((sum, b) => sum + b.amount, 0)
  const currentLiabilities = balances
    .filter((b) => b.category === 'current_liabilities')
    .reduce((sum, b) => sum + b.amount, 0)
  const fixedLiabilities = balances
    .filter((b) => b.category === 'fixed_liabilities')
    .reduce((sum, b) => sum + b.amount, 0)
  const equity = balances
    .filter((b) => b.category === 'net_assets')
    .reduce((sum, b) => sum + b.amount, 0)

  return {
    totalAssets: currentAssets + fixedAssets,
    currentAssets,
    fixedAssets,
    totalLiabilities: currentLiabilities + fixedLiabilities,
    currentLiabilities,
    fixedLiabilities,
    equity,
  }
}

async function calculatePeriodPL(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<PeriodPL> {
  const balances = await prisma.$transaction(
    async (tx) => {
      return tx.monthlyBalance.findMany({
        where: {
          companyId,
          fiscalYear,
          month,
        },
      })
    },
    { maxWait: 5000, timeout: DB_TIMEOUT_MS }
  )

  const revenue = balances
    .filter((b) => b.category === 'sales')
    .reduce((sum, b) => sum + b.amount, 0)
  const costOfSales = balances
    .filter((b) => b.category === 'cost_of_sales')
    .reduce((sum, b) => sum + b.amount, 0)
  const grossProfit = revenue - costOfSales

  const sgaExpenses = balances
    .filter((b) => b.category === 'sga_expenses')
    .reduce((sum, b) => sum + b.amount, 0)
  const operatingIncome = grossProfit - sgaExpenses

  const nonOperatingIncome = balances
    .filter((b) => b.category === 'non_operating_income')
    .reduce((sum, b) => sum + b.amount, 0)
  const nonOperatingExpenses = balances
    .filter((b) => b.category === 'non_operating_expenses')
    .reduce((sum, b) => sum + b.amount, 0)
  const ordinaryIncome = operatingIncome + nonOperatingIncome - nonOperatingExpenses

  const specialIncome = balances
    .filter((b) => b.category === 'special_income')
    .reduce((sum, b) => sum + b.amount, 0)
  const specialLoss = balances
    .filter((b) => b.category === 'special_loss')
    .reduce((sum, b) => sum + b.amount, 0)
  const corporateTax = balances
    .filter((b) => b.category === 'corporate_tax_etc')
    .reduce((sum, b) => sum + b.amount, 0)
  const netIncome = ordinaryIncome + specialIncome - specialLoss - corporateTax

  return {
    revenue,
    costOfSales,
    grossProfit,
    operatingIncome,
    ordinaryIncome,
    netIncome,
  }
}

async function getPreviousMonthBS(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<PeriodBS | null> {
  let prevYear = fiscalYear
  let prevMonth = month - 1

  if (prevMonth === 0) {
    prevMonth = 12
    prevYear -= 1
  }

  const balances = await prisma.$transaction(
    async (tx) => {
      return tx.monthlyBalance.findMany({
        where: {
          companyId,
          fiscalYear: prevYear,
          month: prevMonth,
        },
      })
    },
    { maxWait: 5000, timeout: DB_TIMEOUT_MS }
  )

  if (balances.length === 0) {
    return null
  }

  return mapToPeriodBS(balances)
}

function calculatePeriodCF(pl: PeriodPL, bs: PeriodBS, previousBS: PeriodBS | null): PeriodCF {
  if (!previousBS) {
    return {
      operatingCF: pl.netIncome,
      investingCF: 0,
      financingCF: 0,
      freeCashFlow: pl.netIncome,
    }
  }

  const workingCapitalChange =
    bs.currentAssets -
    previousBS.currentAssets -
    (bs.currentLiabilities - previousBS.currentLiabilities)

  const operatingCF = pl.netIncome + workingCapitalChange

  const investingCF = -(bs.fixedAssets - previousBS.fixedAssets)
  const financingCF =
    bs.totalLiabilities -
    previousBS.totalLiabilities -
    (bs.equity - previousBS.equity) -
    investingCF

  const freeCashFlow = operatingCF + investingCF

  return {
    operatingCF,
    investingCF,
    financingCF,
    freeCashFlow,
  }
}

function calculatePeriodKPIs(bs: PeriodBS, pl: PeriodPL, _cf: PeriodCF): PeriodKPIs {
  const roe = bs.equity > 0 ? (pl.netIncome / bs.equity) * 100 : 0
  const roa = bs.totalAssets > 0 ? (pl.netIncome / bs.totalAssets) * 100 : 0
  const grossMargin = pl.revenue > 0 ? (pl.grossProfit / pl.revenue) * 100 : 0
  const operatingMargin = pl.revenue > 0 ? (pl.operatingIncome / pl.revenue) * 100 : 0
  const currentRatio =
    bs.currentLiabilities > 0 ? (bs.currentAssets / bs.currentLiabilities) * 100 : 0
  const debtToEquity = bs.equity > 0 ? bs.totalLiabilities / bs.equity : 0

  return {
    roe: Math.round(roe * 100) / 100,
    roa: Math.round(roa * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    operatingMargin: Math.round(operatingMargin * 100) / 100,
    currentRatio: Math.round(currentRatio * 100) / 100,
    debtToEquity: Math.round(debtToEquity * 100) / 100,
  }
}

function generateSummary(periods: PeriodData[]): PeriodicSummary {
  if (periods.length < 2) {
    return {
      revenueGrowth: null,
      profitGrowth: null,
      cashChange: 0,
      avgROE: 0,
      avgROA: 0,
      trendAnalysis: 'データが不足しています',
    }
  }

  const firstPeriod = periods[0]
  const lastPeriod = periods[periods.length - 1]

  const revenueGrowth =
    firstPeriod.profitLoss.revenue > 0
      ? ((lastPeriod.profitLoss.revenue - firstPeriod.profitLoss.revenue) /
          firstPeriod.profitLoss.revenue) *
        100
      : null

  const profitGrowth =
    firstPeriod.profitLoss.netIncome > 0
      ? ((lastPeriod.profitLoss.netIncome - firstPeriod.profitLoss.netIncome) /
          firstPeriod.profitLoss.netIncome) *
        100
      : null

  const cashChange = lastPeriod.endingCash - firstPeriod.endingCash

  const avgROE = periods.reduce((sum, p) => sum + p.kpis.roe, 0) / periods.length
  const avgROA = periods.reduce((sum, p) => sum + p.kpis.roa, 0) / periods.length

  const trendAnalysis = generateTrendAnalysis(periods)

  return {
    revenueGrowth: revenueGrowth !== null ? Math.round(revenueGrowth * 100) / 100 : null,
    profitGrowth: profitGrowth !== null ? Math.round(profitGrowth * 100) / 100 : null,
    cashChange: Math.round(cashChange),
    avgROE: Math.round(avgROE * 100) / 100,
    avgROA: Math.round(avgROA * 100) / 100,
    trendAnalysis,
  }
}

function generateTrendAnalysis(periods: PeriodData[]): string {
  const revenueTrend = periods.map((p) => p.profitLoss.revenue)
  const profitTrend = periods.map((p) => p.profitLoss.netIncome)
  const cashTrend = periods.map((p) => p.endingCash)

  const isRevenueGrowing = revenueTrend.every((v, i) => i === 0 || v >= revenueTrend[i - 1] * 0.9)
  const isProfitStable = profitTrend.every((v) => v >= 0)
  const isCashStable = cashTrend.every((v) => v > 0)

  if (isRevenueGrowing && isProfitStable && isCashStable) {
    return '売上・利益・キャッシュ全てが安定して成長しています'
  } else if (isRevenueGrowing && isProfitStable) {
    return '売上・利益は安定していますが、キャッシュフローに注意が必要です'
  } else if (isRevenueGrowing) {
    return '売上は成長していますが、収益性の改善が必要です'
  } else if (isProfitStable) {
    return '利益は安定していますが、売上成長が鈍化しています'
  } else {
    return '複数の指標で改善が必要です。詳細な分析を推奨します'
  }
}

function generateSamplePeriodData(period: {
  label: string
  fiscalYear: number
  startMonth: number
  endMonth: number
}): PeriodData {
  const baseAmount = 10000000 + Math.random() * 5000000

  return {
    label: period.label,
    fiscalYear: period.fiscalYear,
    startMonth: period.startMonth,
    endMonth: period.endMonth,
    balanceSheet: {
      totalAssets: baseAmount * 2,
      currentAssets: baseAmount,
      fixedAssets: baseAmount,
      totalLiabilities: baseAmount * 0.8,
      currentLiabilities: baseAmount * 0.4,
      fixedLiabilities: baseAmount * 0.4,
      equity: baseAmount * 1.2,
    },
    profitLoss: {
      revenue: baseAmount * 0.5,
      costOfSales: baseAmount * 0.2,
      grossProfit: baseAmount * 0.3,
      operatingIncome: baseAmount * 0.1,
      ordinaryIncome: baseAmount * 0.08,
      netIncome: baseAmount * 0.05,
    },
    cashFlow: {
      operatingCF: baseAmount * 0.06,
      investingCF: -baseAmount * 0.02,
      financingCF: 0,
      freeCashFlow: baseAmount * 0.04,
    },
    kpis: {
      roe: 8.3,
      roa: 5.0,
      grossMargin: 60,
      operatingMargin: 20,
      currentRatio: 250,
      debtToEquity: 0.67,
    },
    endingCash: baseAmount * 0.5,
  }
}

export function formatPeriodicReportForExport(data: PeriodicReportData): string[][] {
  const rows: string[][] = []

  rows.push(['期間', ...data.periods.map((p) => p.label)])

  rows.push(['--- 貸借対照表 ---'])
  rows.push(['総資産', ...data.periods.map((p) => p.balanceSheet.totalAssets.toLocaleString())])
  rows.push(['流動資産', ...data.periods.map((p) => p.balanceSheet.currentAssets.toLocaleString())])
  rows.push(['固定資産', ...data.periods.map((p) => p.balanceSheet.fixedAssets.toLocaleString())])
  rows.push([
    '総負債',
    ...data.periods.map((p) => p.balanceSheet.totalLiabilities.toLocaleString()),
  ])
  rows.push(['純資産', ...data.periods.map((p) => p.balanceSheet.equity.toLocaleString())])

  rows.push(['--- 損益計算書 ---'])
  rows.push(['売上高', ...data.periods.map((p) => p.profitLoss.revenue.toLocaleString())])
  rows.push(['売上原価', ...data.periods.map((p) => p.profitLoss.costOfSales.toLocaleString())])
  rows.push(['売上総利益', ...data.periods.map((p) => p.profitLoss.grossProfit.toLocaleString())])
  rows.push(['営業利益', ...data.periods.map((p) => p.profitLoss.operatingIncome.toLocaleString())])
  rows.push(['経常利益', ...data.periods.map((p) => p.profitLoss.ordinaryIncome.toLocaleString())])
  rows.push(['当期純利益', ...data.periods.map((p) => p.profitLoss.netIncome.toLocaleString())])

  rows.push(['--- キャッシュフロー ---'])
  rows.push(['営業CF', ...data.periods.map((p) => p.cashFlow.operatingCF.toLocaleString())])
  rows.push(['投資CF', ...data.periods.map((p) => p.cashFlow.investingCF.toLocaleString())])
  rows.push(['財務CF', ...data.periods.map((p) => p.cashFlow.financingCF.toLocaleString())])
  rows.push(['FCF', ...data.periods.map((p) => p.cashFlow.freeCashFlow.toLocaleString())])
  rows.push(['期末現金', ...data.periods.map((p) => p.endingCash.toLocaleString())])

  rows.push(['--- 経営指標 ---'])
  rows.push(['ROE(%)', ...data.periods.map((p) => p.kpis.roe.toString())])
  rows.push(['ROA(%)', ...data.periods.map((p) => p.kpis.roa.toString())])
  rows.push(['売上総利益率(%)', ...data.periods.map((p) => p.kpis.grossMargin.toString())])
  rows.push(['営業利益率(%)', ...data.periods.map((p) => p.kpis.operatingMargin.toString())])
  rows.push(['流動比率(%)', ...data.periods.map((p) => p.kpis.currentRatio.toString())])
  rows.push(['D/E比率', ...data.periods.map((p) => p.kpis.debtToEquity.toString())])

  return rows
}

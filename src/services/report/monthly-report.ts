import type {
  MonthlyReport,
  BalanceSheet,
  ProfitLoss,
  CashFlowStatement,
  MonthlyTrend,
  MultiMonthReport,
  ReportSection,
  ReportTableRow,
} from '@/types'
import { calculateCashFlow } from '@/services/cashflow/calculator'
import { generateCashPosition } from '@/services/cashflow/cash-position'
import { calculateRunway } from '@/services/cashflow/runway-calculator'
import { calculateFinancialKPIs } from '@/services/analytics/financial-kpi'
import { calculateActualVsBudget } from '@/services/budget/actual-vs-budget'
import { prisma } from '@/lib/db'

export interface MonthlyReportInput {
  companyId: string
  fiscalYear: number
  month: number
}

export async function generateMonthlyReport(input: MonthlyReportInput): Promise<MonthlyReport> {
  const company = await prisma.company.findFirst({
    where: { id: input.companyId },
  })

  if (!company) {
    throw new Error('Company not found')
  }

  const balanceSheet = await getBalanceSheet(input.companyId, input.fiscalYear, input.month)
  const previousBS = await getBalanceSheet(input.companyId, input.fiscalYear, input.month - 1)
  const profitLoss = await getProfitLoss(input.companyId, input.fiscalYear, input.month)
  const previousPL = await getProfitLoss(input.companyId, input.fiscalYear - 1, input.month)

  const cashFlow = calculateCashFlow(profitLoss, balanceSheet, previousBS)

  const yearCashFlows = await getYearCashFlows(input.companyId, input.fiscalYear)
  const cashPosition = generateCashPosition(
    yearCashFlows,
    previousBS?.assets.current[0]?.amount || 0
  )

  const kpis = calculateFinancialKPIs(balanceSheet, profitLoss, cashFlow, previousPL)

  const budget = await calculateActualVsBudget(
    input.companyId,
    input.fiscalYear,
    input.month,
    profitLoss
  )

  const runway = calculateRunway(balanceSheet.assets.current[0]?.amount || 0, yearCashFlows)

  return {
    fiscalYear: input.fiscalYear,
    month: input.month,
    companyName: company.name,
    balanceSheet,
    profitLoss,
    cashFlow,
    cashPosition,
    kpis,
    budget,
    runway,
  }
}

async function getBalanceSheet(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<BalanceSheet> {
  const balances = await prisma.monthlyBalance.findMany({
    where: {
      companyId,
      fiscalYear,
      month,
    },
  })

  if (balances.length === 0) {
    return generateSampleBalanceSheet(fiscalYear, month)
  }

  return mapBalancesToBalanceSheet(balances, fiscalYear, month)
}

async function getProfitLoss(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<ProfitLoss> {
  const balances = await prisma.monthlyBalance.findMany({
    where: {
      companyId,
      fiscalYear,
      month,
    },
  })

  if (balances.length === 0) {
    return generateSampleProfitLoss(fiscalYear, month)
  }

  return mapBalancesToProfitLoss(balances, fiscalYear, month)
}

async function getYearCashFlows(
  companyId: string,
  fiscalYear: number
): Promise<CashFlowStatement[]> {
  const cashFlows: CashFlowStatement[] = []

  for (let month = 1; month <= 12; month++) {
    const bs = await getBalanceSheet(companyId, fiscalYear, month)
    const previousBS = month > 1 ? await getBalanceSheet(companyId, fiscalYear, month - 1) : null
    const pl = await getProfitLoss(companyId, fiscalYear, month)

    cashFlows.push(calculateCashFlow(pl, bs, previousBS))
  }

  return cashFlows
}

function mapBalancesToBalanceSheet(
  balances: { accountCode: string; accountName: string; category: string; amount: number }[],
  fiscalYear: number,
  month: number
): BalanceSheet {
  const currentAssets = balances
    .filter((b) => b.category === 'current_asset')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const fixedAssets = balances
    .filter((b) => b.category === 'fixed_asset')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const currentLiabilities = balances
    .filter((b) => b.category === 'current_liability')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const fixedLiabilities = balances
    .filter((b) => b.category === 'fixed_liability')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const equityItems = balances
    .filter((b) => b.category === 'equity')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const totalAssets = [...currentAssets, ...fixedAssets].reduce((sum, a) => sum + a.amount, 0)
  const totalLiabilities = [...currentLiabilities, ...fixedLiabilities].reduce(
    (sum, l) => sum + l.amount,
    0
  )
  const totalEquity = equityItems.reduce((sum, e) => sum + e.amount, 0)

  return {
    fiscalYear,
    month,
    assets: {
      current: currentAssets,
      fixed: fixedAssets,
      total: totalAssets,
    },
    liabilities: {
      current: currentLiabilities,
      fixed: fixedLiabilities,
      total: totalLiabilities,
    },
    equity: {
      items: equityItems,
      total: totalEquity,
    },
    totalAssets,
    totalLiabilities,
    totalEquity,
  }
}

function mapBalancesToProfitLoss(
  balances: { accountCode: string; accountName: string; category: string; amount: number }[],
  fiscalYear: number,
  month: number
): ProfitLoss {
  const revenue = balances
    .filter((b) => b.category === 'revenue')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const costOfSales = balances
    .filter((b) => b.category === 'cost_of_sales')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const sgaExpenses = balances
    .filter((b) => b.category === 'sga_expense')
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.amount }))

  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0)
  const totalCost = costOfSales.reduce((sum, c) => sum + c.amount, 0)
  const grossProfit = totalRevenue - totalCost
  const grossProfitMargin = (grossProfit / totalRevenue) * 100

  const totalSga = sgaExpenses.reduce((sum, e) => sum + e.amount, 0)
  const operatingIncome = grossProfit - totalSga
  const operatingMargin = (operatingIncome / totalRevenue) * 100

  const depreciationItem = sgaExpenses.find((e) => e.name.includes('減価償却'))
  const depreciation = depreciationItem?.amount || 0

  return {
    fiscalYear,
    month,
    revenue,
    costOfSales,
    grossProfit,
    grossProfitMargin,
    sgaExpenses,
    operatingIncome,
    operatingMargin,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: operatingIncome,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: operatingIncome,
    incomeTax: Math.round(operatingIncome * 0.3),
    netIncome: Math.round(operatingIncome * 0.7),
    depreciation,
  }
}

function generateSampleBalanceSheet(fiscalYear: number, month: number): BalanceSheet {
  const baseMultiplier = 1 + (month - 1) * 0.02

  return {
    fiscalYear,
    month,
    assets: {
      current: [
        { code: '100', name: '現金及び預金', amount: Math.round(15000000 * baseMultiplier) },
        { code: '110', name: '売掛金', amount: Math.round(8000000 * baseMultiplier) },
        { code: '120', name: '棚卸資産', amount: Math.round(3000000 * baseMultiplier) },
        { code: '130', name: '前払費用', amount: Math.round(500000 * baseMultiplier) },
      ],
      fixed: [
        { code: '200', name: '建物', amount: 10000000 },
        { code: '210', name: '車両運搬具', amount: 3000000 },
        { code: '220', name: '工具器具備品', amount: 2000000 },
        { code: '230', name: 'ソフトウェア', amount: 1500000 },
      ],
      total: Math.round(43000000 * baseMultiplier),
    },
    liabilities: {
      current: [
        { code: '300', name: '買掛金', amount: Math.round(5000000 * baseMultiplier) },
        { code: '310', name: '未払金', amount: Math.round(1000000 * baseMultiplier) },
        { code: '320', name: '未払費用', amount: Math.round(800000 * baseMultiplier) },
      ],
      fixed: [{ code: '400', name: '長期借入金', amount: 5000000 }],
      total: Math.round(11800000 * baseMultiplier),
    },
    equity: {
      items: [
        { code: '500', name: '資本金', amount: 10000000 },
        { code: '510', name: '利益剰余金', amount: Math.round(21200000 * baseMultiplier) },
      ],
      total: Math.round(31200000 * baseMultiplier),
    },
    totalAssets: Math.round(43000000 * baseMultiplier),
    totalLiabilities: Math.round(11800000 * baseMultiplier),
    totalEquity: Math.round(31200000 * baseMultiplier),
  }
}

function generateSampleProfitLoss(fiscalYear: number, month: number): ProfitLoss {
  const baseMultiplier = 1 + (month - 1) * 0.03

  const revenue = Math.round(5000000 * baseMultiplier)
  const costOfSales = Math.round(2000000 * baseMultiplier)
  const grossProfit = revenue - costOfSales

  const sga = [
    { code: '600', name: '給与手当', amount: 800000 },
    { code: '610', name: '福利厚生費', amount: 160000 },
    { code: '620', name: '旅費交通費', amount: 50000 },
    { code: '630', name: '通信費', amount: 30000 },
    { code: '640', name: '水道光熱費', amount: 40000 },
    { code: '650', name: '地代家賃', amount: 200000 },
    { code: '660', name: '広告宣伝費', amount: 100000 },
    { code: '670', name: '減価償却費', amount: 50000 },
  ]

  const totalSga = sga.reduce((sum, e) => sum + e.amount, 0)
  const operatingIncome = grossProfit - totalSga

  return {
    fiscalYear,
    month,
    revenue: [{ code: '400', name: '売上高', amount: revenue }],
    costOfSales: [{ code: '500', name: '売上原価', amount: costOfSales }],
    grossProfit,
    grossProfitMargin: (grossProfit / revenue) * 100,
    sgaExpenses: sga,
    operatingIncome,
    operatingMargin: (operatingIncome / revenue) * 100,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: operatingIncome,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: operatingIncome,
    incomeTax: Math.round(operatingIncome * 0.3),
    netIncome: Math.round(operatingIncome * 0.7),
    depreciation: 50000,
  }
}

export async function getMonthlyTrend(
  companyId: string,
  fiscalYear: number
): Promise<MonthlyTrend[]> {
  const trends: MonthlyTrend[] = []

  for (let month = 1; month <= 12; month++) {
    const pl = await getProfitLoss(companyId, fiscalYear, month)
    const bs = await getBalanceSheet(companyId, fiscalYear, month)

    trends.push({
      month: `${month}月`,
      revenue: pl.revenue.reduce((sum, r) => sum + r.amount, 0),
      grossProfit: pl.grossProfit,
      operatingIncome: pl.operatingIncome,
      netIncome: pl.netIncome,
      cash: bs.assets.current[0]?.amount || 0,
    })
  }

  return trends
}

export function formatReportForExport(report: MonthlyReport): string {
  const lines: string[] = []

  lines.push(`月次決算報告書`)
  lines.push(`${report.companyName}`)
  lines.push(`${report.fiscalYear}年${report.month}月度`)
  lines.push('')

  lines.push('【貸借対照表】')
  lines.push('資産の部')
  report.balanceSheet.assets.current.forEach((a) => {
    lines.push(`  ${a.name}: ${a.amount.toLocaleString()}`)
  })
  lines.push(
    `流動資産合計: ${report.balanceSheet.assets.current.reduce((s, a) => s + a.amount, 0).toLocaleString()}`
  )
  lines.push('')

  lines.push('【損益計算書】')
  lines.push(
    `売上高: ${report.profitLoss.revenue.reduce((s, r) => s + r.amount, 0).toLocaleString()}`
  )
  lines.push(`売上総利益: ${report.profitLoss.grossProfit.toLocaleString()}`)
  lines.push(`営業利益: ${report.profitLoss.operatingIncome.toLocaleString()}`)
  lines.push(`当期純利益: ${report.profitLoss.netIncome.toLocaleString()}`)
  lines.push('')

  lines.push('【経営指標】')
  lines.push(`ROE: ${report.kpis.profitability.roe}%`)
  lines.push(`ROA: ${report.kpis.profitability.roa}%`)
  lines.push(`流動比率: ${report.kpis.safety.currentRatio}%`)
  lines.push(`自己資本比率: ${report.kpis.safety.equityRatio}%`)
  lines.push('')

  lines.push('【Runway】')
  lines.push(`月次Burn Rate: ${report.runway.monthlyBurnRate.toLocaleString()}円`)
  lines.push(`Runway: ${report.runway.runwayMonths}ヶ月`)

  return lines.join('\n')
}

export async function getMultiMonthReport(
  companyId: string,
  fiscalYear: number,
  endMonth: number,
  monthCount: 3 | 6 | 12
): Promise<MultiMonthReport> {
  const company = await prisma.company.findFirst({
    where: { id: companyId },
  })

  if (!company) {
    throw new Error('Company not found')
  }

  const months: number[] = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const m = endMonth - i
    months.push(m > 0 ? m : m + 12)
  }

  const balanceSheets: BalanceSheet[] = []
  const profitLosses: ProfitLoss[] = []
  const cashFlows: CashFlowStatement[] = []

  for (const month of months) {
    const bs = await getBalanceSheet(companyId, fiscalYear, month)
    const previousBS = month > 1 ? await getBalanceSheet(companyId, fiscalYear, month - 1) : null
    const pl = await getProfitLoss(companyId, fiscalYear, month)
    const cf = calculateCashFlow(pl, bs, previousBS)

    balanceSheets.push(bs)
    profitLosses.push(pl)
    cashFlows.push(cf)
  }

  const sections: ReportSection[] = []

  sections.push(buildBSSection(balanceSheets, months))
  sections.push(buildPLSection(profitLosses, months))
  sections.push(buildCFSection(cashFlows, months))
  sections.push(buildKPISection(balanceSheets, profitLosses, cashFlows, months))

  return {
    fiscalYear,
    endMonth,
    monthCount,
    months,
    companyName: company.name,
    sections,
  }
}

function buildBSSection(balanceSheets: BalanceSheet[], _months: number[]): ReportSection {
  const rows: ReportTableRow[] = []

  const addItems = (
    items: Array<{ code: string; name: string; amount: number }>,
    indent: number = 0
  ) => {
    items.forEach((item) => {
      const values = balanceSheets.map((bs) => {
        const found = [
          ...bs.assets.current,
          ...bs.assets.fixed,
          ...bs.liabilities.current,
          ...bs.liabilities.fixed,
          ...bs.equity.items,
        ].find((i) => i.code === item.code)
        return found?.amount || 0
      })
      rows.push({
        code: item.code,
        name: item.name,
        rowType: 'item',
        indent,
        values,
        total: values.reduce((s, v) => s + v, 0),
      })
    })
  }

  const addSubtotal = (name: string, values: number[]) => {
    rows.push({
      name,
      rowType: 'subtotal',
      indent: 1,
      values,
      total: values.reduce((s, v) => s + v, 0),
    })
  }

  const addTotal = (name: string, values: number[]) => {
    rows.push({
      name,
      rowType: 'total',
      indent: 0,
      values,
      total: values.reduce((s, v) => s + v, 0),
    })
  }

  if (balanceSheets.length > 0) {
    const bs = balanceSheets[0]

    addItems(bs.assets.current, 0)
    const currentAssetValues = balanceSheets.map((b) =>
      b.assets.current.reduce((s, a) => s + a.amount, 0)
    )
    addSubtotal('流動資産計', currentAssetValues)

    addItems(bs.assets.fixed, 0)
    const fixedAssetValues = balanceSheets.map((b) =>
      b.assets.fixed.reduce((s, a) => s + a.amount, 0)
    )
    addSubtotal('固定資産計', fixedAssetValues)

    addTotal(
      '資産合計',
      balanceSheets.map((b) => b.totalAssets)
    )

    addItems(bs.liabilities.current, 0)
    const currentLiabValues = balanceSheets.map((b) =>
      b.liabilities.current.reduce((s, l) => s + l.amount, 0)
    )
    addSubtotal('流動負債計', currentLiabValues)

    addItems(bs.liabilities.fixed, 0)
    const fixedLiabValues = balanceSheets.map((b) =>
      b.liabilities.fixed.reduce((s, l) => s + l.amount, 0)
    )
    addSubtotal('固定負債計', fixedLiabValues)

    addTotal(
      '負債合計',
      balanceSheets.map((b) => b.totalLiabilities)
    )

    addItems(bs.equity.items, 0)
    addTotal(
      '純資産合計',
      balanceSheets.map((b) => b.totalEquity)
    )
  }

  return {
    title: '貸借対照表',
    type: 'bs',
    rows,
  }
}

function buildPLSection(profitLosses: ProfitLoss[], _months: number[]): ReportSection {
  const rows: ReportTableRow[] = []

  const addItems = (
    items: Array<{ code: string; name: string; amount: number }>,
    indent: number = 0
  ) => {
    items.forEach((item) => {
      const values = profitLosses.map((pl) => {
        const allItems = [...pl.revenue, ...pl.costOfSales, ...pl.sgaExpenses]
        const found = allItems.find((i) => i.code === item.code)
        return found?.amount || 0
      })
      rows.push({
        code: item.code,
        name: item.name,
        rowType: 'item',
        indent,
        values,
        total: values.reduce((s, v) => s + v, 0),
        average: values.reduce((s, v) => s + v, 0) / values.length,
      })
    })
  }

  const addSubtotal = (name: string, getValues: (pl: ProfitLoss) => number) => {
    const values = profitLosses.map(getValues)
    rows.push({
      name,
      rowType: 'subtotal',
      indent: 1,
      values,
      total: values.reduce((s, v) => s + v, 0),
      average: values.reduce((s, v) => s + v, 0) / values.length,
    })
  }

  const addTotal = (name: string, getValues: (pl: ProfitLoss) => number) => {
    const values = profitLosses.map(getValues)
    rows.push({
      name,
      rowType: 'total',
      indent: 0,
      values,
      total: values.reduce((s, v) => s + v, 0),
      average: values.reduce((s, v) => s + v, 0) / values.length,
    })
  }

  if (profitLosses.length > 0) {
    const pl = profitLosses[0]

    addItems(pl.revenue, 0)
    addSubtotal('売上高計', (p) => p.revenue.reduce((s, r) => s + r.amount, 0))

    addItems(pl.costOfSales, 0)
    addSubtotal('売上原価計', (p) => p.costOfSales.reduce((s, c) => s + c.amount, 0))

    addSubtotal('売上総利益', (p) => p.grossProfit)

    addItems(pl.sgaExpenses, 0)
    addSubtotal('販管費計', (p) => p.sgaExpenses.reduce((s, e) => s + e.amount, 0))

    addSubtotal('営業利益', (p) => p.operatingIncome)

    addTotal('当期純利益', (p) => p.netIncome)
  }

  return {
    title: '損益計算書',
    type: 'pl',
    rows,
  }
}

function buildCFSection(cashFlows: CashFlowStatement[], _months: number[]): ReportSection {
  const rows: ReportTableRow[] = []

  const addItem = (
    name: string,
    getValues: (cf: CashFlowStatement) => number,
    rowType: 'item' | 'subtotal' | 'total' = 'item'
  ) => {
    const values = cashFlows.map(getValues)
    rows.push({
      name,
      rowType,
      indent: rowType === 'subtotal' ? 1 : 0,
      values,
      total: values.reduce((s, v) => s + v, 0),
    })
  }

  addItem(
    '営業CF',
    (cf) => cf.operatingActivities?.netCashFromOperating ?? cf.operating?.netCashFromOperating ?? 0,
    'subtotal'
  )
  addItem(
    '投資CF',
    (cf) => cf.investingActivities?.netCashFromInvesting ?? cf.investing?.netCashFromInvesting ?? 0,
    'item'
  )
  addItem(
    '財務CF',
    (cf) => cf.financingActivities?.netCashFromFinancing ?? cf.financing?.netCashFromFinancing ?? 0,
    'item'
  )
  addItem('現金増減', (cf) => cf.netChangeInCash, 'subtotal')
  addItem('期末現金', (cf) => cf.endingCash, 'total')

  return {
    title: 'キャッシュフロー計算書',
    type: 'cf',
    rows,
  }
}

function buildKPISection(
  balanceSheets: BalanceSheet[],
  profitLosses: ProfitLoss[],
  _cashFlows: CashFlowStatement[],
  _months: number[]
): ReportSection {
  const rows: ReportTableRow[] = []

  const calcROE = (pl: ProfitLoss, bs: BalanceSheet) => {
    const equity = bs.totalEquity
    return equity > 0 ? (pl.netIncome / equity) * 100 : 0
  }

  const calcROA = (pl: ProfitLoss, bs: BalanceSheet) => {
    const assets = bs.totalAssets
    return assets > 0 ? (pl.netIncome / assets) * 100 : 0
  }

  const calcCurrentRatio = (_pl: ProfitLoss, bs: BalanceSheet) => {
    const currentLiab = bs.liabilities.current.reduce((s, l) => s + l.amount, 0)
    const currentAssets = bs.assets.current.reduce((s, a) => s + a.amount, 0)
    return currentLiab > 0 ? (currentAssets / currentLiab) * 100 : 0
  }

  const calcEquityRatio = (_pl: ProfitLoss, bs: BalanceSheet) => {
    const total = bs.totalAssets
    return total > 0 ? (bs.totalEquity / total) * 100 : 0
  }

  const calcGrossMargin = (pl: ProfitLoss, _bs: BalanceSheet) => pl.grossProfitMargin

  const calcOperatingMargin = (pl: ProfitLoss, _bs: BalanceSheet) => pl.operatingMargin

  const addKPI = (name: string, calcFn: (pl: ProfitLoss, bs: BalanceSheet) => number) => {
    const values: number[] = []
    for (let i = 0; i < balanceSheets.length; i++) {
      values.push(calcFn(profitLosses[i], balanceSheets[i]))
    }
    rows.push({
      name,
      rowType: 'item',
      indent: 0,
      values,
      total: values.reduce((s, v) => s + v, 0),
      average: values.reduce((s, v) => s + v, 0) / values.length,
    })
  }

  addKPI('ROE (%)', calcROE)
  addKPI('ROA (%)', calcROA)
  addKPI('流動比率 (%)', calcCurrentRatio)
  addKPI('自己資本比率 (%)', calcEquityRatio)
  addKPI('売上総利益率 (%)', calcGrossMargin)
  addKPI('営業利益率 (%)', calcOperatingMargin)

  return {
    title: '経営指標',
    type: 'kpi',
    rows,
  }
}

import { sampleTherapeuticsData } from '@/lib/data/sample-therapeutics-data'
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

const DB_TIMEOUT_MS = 30000

export interface MonthlyReportInput {
  companyId: string
  fiscalYear: number
  month: number
}

export async function generateMonthlyReport(input: MonthlyReportInput): Promise<MonthlyReport> {
  const company = await prisma.$transaction(
    async (tx) => {
      return tx.company.findFirst({
        where: { id: input.companyId },
      })
    },
    { maxWait: 5000, timeout: DB_TIMEOUT_MS }
  )

  if (!company) {
    throw new Error('Company not found')
  }

  const [balanceSheet, previousBS, profitLoss, previousPL] = await Promise.all([
    getBalanceSheet(input.companyId, input.fiscalYear, input.month),
    getBalanceSheet(input.companyId, input.fiscalYear, input.month - 1),
    getProfitLoss(input.companyId, input.fiscalYear, input.month),
    getProfitLoss(input.companyId, input.fiscalYear - 1, input.month),
  ])

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
  const monthlyBurn = sampleTherapeuticsData.monthlyBurn.find(m => m.month === month)
  const bs = sampleTherapeuticsData.balanceSheet
  
  const cashBalance = monthlyBurn?.cashBalance ?? bs.assets.currentAssets.cash
  const prepaidCRO = month >= 7 ? bs.assets.currentAssets.prepaidCRO : Math.round(bs.assets.currentAssets.prepaidCRO * 0.5)
  const accruedCRO = month >= 7 ? bs.liabilities.currentLiabilities.accruedCROExpenses : Math.round(bs.liabilities.currentLiabilities.accruedCROExpenses * 0.5)
  
  const currentAssets = [
    { code: '1000', name: '現金及び預金', amount: cashBalance },
    { code: '1010', name: '制限付き現金', amount: bs.assets.currentAssets.restrictedCash },
    { code: '1100', name: '前払費用', amount: bs.assets.currentAssets.prepaidExpenses },
    { code: '1110', name: '前払CRO費用', amount: prepaidCRO },
  ]
  
  const fixedAssets = [
    { code: '2000', name: '研究用建物（純額）', amount: bs.assets.fixedAssets.tangible.laboratoryBuilding + bs.assets.fixedAssets.tangible.accumulatedDepreciationBuilding },
    { code: '2100', name: '実験設備（純額）', amount: bs.assets.fixedAssets.tangible.labEquipment + bs.assets.fixedAssets.tangible.accumulatedDepreciationEquipment },
    { code: '2200', name: '事務設備（純額）', amount: bs.assets.fixedAssets.tangible.officeEquipment + bs.assets.fixedAssets.tangible.accumulatedDepreciationOffice },
    { code: '2300', name: '特許権', amount: bs.assets.fixedAssets.intangible.patents },
    { code: '2310', name: 'ソフトウェア', amount: bs.assets.fixedAssets.intangible.software },
  ]
  
  const currentLiabilities = [
    { code: '3000', name: '買掛金', amount: bs.liabilities.currentLiabilities.accountsPayable },
    { code: '3010', name: '未払CRO費用', amount: accruedCRO },
    { code: '3020', name: '未払給与', amount: bs.liabilities.currentLiabilities.accruedSalaries },
    { code: '3030', name: '未払賞与', amount: bs.liabilities.currentLiabilities.accruedBonus },
  ]
  
  const fixedLiabilities = [
    { code: '4000', name: '退職給付引当金', amount: bs.liabilities.fixedLiabilities.retirementAllowances },
    { code: '4010', name: '研究助成金', amount: bs.liabilities.fixedLiabilities.researchGrants },
  ]
  
  const equityItems = [
    { code: '5000', name: '資本金', amount: bs.equity.capitalStock },
    { code: '5010', name: '資本剰余金', amount: bs.equity.capitalSurplus },
    { code: '5020', name: '繰越利益剰余金', amount: bs.equity.deficit },
  ]
  
  const totalCurrentAssets = currentAssets.reduce((s, a) => s + a.amount, 0)
  const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.amount, 0)
  const totalAssets = totalCurrentAssets + totalFixedAssets
  
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
      total: 358000000,
    },
    equity: {
      items: equityItems,
      total: bs.equity.totalEquity,
    },
    totalAssets,
    totalLiabilities: 358000000,
    totalEquity: bs.equity.totalEquity,
  }
}

function generateSampleProfitLoss(fiscalYear: number, month: number): ProfitLoss {
  const monthlyBurn = sampleTherapeuticsData.monthlyBurn.find(m => m.month === month)
  const pl = sampleTherapeuticsData.profitLoss
  
  const monthlyRdSpend = monthlyBurn?.rdSpend ?? Math.round(pl.expenses.rdExpenses.totalRd / 12)
  const monthlySgaSpend = monthlyBurn?.sgaSpend ?? Math.round(pl.expenses.sgaExpenses.totalSga / 12)
  const monthlyRevenue = Math.round(pl.revenue.totalRevenue / 12)
  
  const rdInternal = Math.round(monthlyRdSpend * 0.468)
  const rdExternal = Math.round(monthlyRdSpend * 0.532)
  
  const sgaPersonnel = Math.round(monthlySgaSpend * 0.45)
  const sgaProfessional = Math.round(monthlySgaSpend * 0.21)
  const sgaFacilities = Math.round(monthlySgaSpend * 0.20)
  const sgaOther = monthlySgaSpend - sgaPersonnel - sgaProfessional - sgaFacilities
  
  const sgaExpenses = [
    { code: '5000', name: '研究開発費（内部）', amount: rdInternal },
    { code: '5010', name: '研究開発費（外部CRO/CDMO）', amount: rdExternal },
    { code: '5100', name: '管理部門人件費', amount: sgaPersonnel },
    { code: '5110', name: '専門サービス費用', amount: sgaProfessional },
    { code: '5120', name: '施設費', amount: sgaFacilities },
    { code: '5130', name: 'その他経費', amount: sgaOther },
  ]
  
  const totalSga = sgaExpenses.reduce((s, e) => s + e.amount, 0)
  const operatingLoss = -(totalSga - monthlyRevenue)
  const interestIncome = Math.round(pl.nonOperating.interestIncome / 12)
  
  return {
    fiscalYear,
    month,
    revenue: [
      { code: '4000', name: '助成金収入', amount: Math.round(monthlyRevenue * 0.73) },
      { code: '4010', name: '共同研究収入', amount: Math.round(monthlyRevenue * 0.27) },
    ],
    costOfSales: [],
    grossProfit: monthlyRevenue,
    grossProfitMargin: 100,
    sgaExpenses,
    operatingIncome: operatingLoss,
    operatingMargin: monthlyRevenue > 0 ? (operatingLoss / monthlyRevenue) * 100 : 0,
    nonOperatingIncome: [{ code: '6000', name: '受取利息', amount: interestIncome }],
    nonOperatingExpenses: [],
    ordinaryIncome: operatingLoss + interestIncome,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: operatingLoss + interestIncome,
    incomeTax: 0,
    netIncome: operatingLoss + interestIncome,
    depreciation: Math.round(pl.expenses.depreciation / 12),
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
  const company = await prisma.$transaction(
    async (tx) => {
      return tx.company.findFirst({
        where: { id: companyId },
      })
    },
    { maxWait: 5000, timeout: DB_TIMEOUT_MS }
  )

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
      })
    })
  }

  const addSubtotal = (name: string, values: number[]) => {
    rows.push({
      name,
      rowType: 'subtotal',
      indent: 1,
      values,
    })
  }

  const addTotal = (name: string, values: number[]) => {
    rows.push({
      name,
      rowType: 'total',
      indent: 0,
      values,
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

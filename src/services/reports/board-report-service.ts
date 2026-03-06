import { prisma } from '@/lib/db'
import type { ProfitLoss, BalanceSheet, CashFlowStatement, RunwayCalculation } from '@/types'
import {
  calculateDetailedActualVsBudget,
  type DetailedActualVsBudget,
} from '@/services/budget/detailed-actual-vs-budget'
import { calculateRunway, getRunwayAlert } from '@/services/cashflow/runway-calculator'

export type BoardReportStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PRESENTED'
export type SectionType =
  | 'FINANCIAL_SUMMARY'
  | 'BUDGET_VARIANCE'
  | 'CASH_POSITION'
  | 'FUND_FLOW'
  | 'KEY_METRICS'
  | 'RISKS'
  | 'OPPORTUNITIES'
  | 'LLM_ANALYSIS'

export interface BoardReportSectionData {
  sectionType: SectionType
  title: string
  content: string
  data?: string
  sortOrder: number
}

export interface BoardReportDetail {
  id: string
  companyId: string
  fiscalYear: number
  month: number
  title: string
  summary: string | null
  sections: BoardReportSectionData[]
  status: BoardReportStatus
  generatedAt: Date | null
  presentedAt: Date | null
  approvedBy: string | null
  approvedAt: Date | null
}

export interface BoardReportData {
  financialSummary: {
    stageLevelPL: StageLevelComparison[]
    keyAccounts: AccountLevelComparison[]
    comparisons: {
      mom: number
      yoy: number
    }
  }
  budgetVariance: {
    summary: DetailedActualVsBudget['summary']
    significantVariances: VarianceItem[]
    achievementRate: number
  }
  cashPosition: {
    currentCash: number
    burnRate: number
    runwayMonths: number
    runwayStatus: 'safe' | 'warning' | 'critical'
    scenarios: RunwayCalculation['scenarios']
  }
  fundFlow: {
    upcomingPayments: UpcomingPayment[]
    monthlyCashOutSummary: MonthlyCashOutSummary[]
    significantExpenses: SignificantExpense[]
  }
  keyMetrics: KeyMetric[]
}

export interface StageLevelComparison {
  stage: string
  budget: number
  actual: number
  variance: number
  rate: number
  status: 'good' | 'warning' | 'bad'
}

export interface AccountLevelComparison {
  code: string
  name: string
  category: string
  budget: number
  actual: number
  variance: number
  rate: number
  status: 'good' | 'warning' | 'bad'
}

export interface VarianceItem {
  item: string
  budget: number
  actual: number
  variance: number
  variancePercent: number
  severity: 'high' | 'medium' | 'low'
}

export interface UpcomingPayment {
  description: string
  amount: number
  dueDate: Date
  category: string
}

export interface MonthlyCashOutSummary {
  month: number
  totalCashOut: number
  categories: Record<string, number>
}

export interface SignificantExpense {
  description: string
  amount: number
  date: Date
  category: string
  threshold: number
}

export interface KeyMetric {
  kpi: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  status: 'good' | 'warning' | 'critical'
}

export interface GenerateReportOptions {
  includeLlmAnalysis: boolean
  language: 'ja' | 'en'
  detailLevel: 'summary' | 'detailed'
}

export async function getBoardReports(companyId: string): Promise<BoardReportDetail[]> {
  const reports = await prisma.boardReport.findMany({
    where: { companyId },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: [{ fiscalYear: 'desc' }, { month: 'desc' }],
  })

  return reports.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    fiscalYear: r.fiscalYear,
    month: r.month,
    title: r.title,
    summary: r.summary,
    sections: r.sections.map((s) => ({
      sectionType: s.sectionType as SectionType,
      title: s.title,
      content: s.content,
      data: s.data ?? undefined,
      sortOrder: s.sortOrder,
    })),
    status: r.status as BoardReportStatus,
    generatedAt: r.generatedAt,
    presentedAt: r.presentedAt,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt,
  }))
}

export async function getBoardReport(id: string): Promise<BoardReportDetail | null> {
  const report = await prisma.boardReport.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!report) return null

  return {
    id: report.id,
    companyId: report.companyId,
    fiscalYear: report.fiscalYear,
    month: report.month,
    title: report.title,
    summary: report.summary,
    sections: report.sections.map((s) => ({
      sectionType: s.sectionType as SectionType,
      title: s.title,
      content: s.content,
      data: s.data ?? undefined,
      sortOrder: s.sortOrder,
    })),
    status: report.status as BoardReportStatus,
    generatedAt: report.generatedAt,
    presentedAt: report.presentedAt,
    approvedBy: report.approvedBy,
    approvedAt: report.approvedAt,
  }
}

export async function generateBoardReport(
  companyId: string,
  fiscalYear: number,
  month: number,
  financialData: {
    pl: ProfitLoss
    bs: BalanceSheet
    cf: CashFlowStatement[]
  },
  options: GenerateReportOptions
): Promise<BoardReportDetail> {
  const reportData = await collectReportData(companyId, fiscalYear, month, financialData)

  const sections: BoardReportSectionData[] = []
  let sortOrder = 0

  sections.push({
    ...generateFinancialSummarySection(reportData),
    sortOrder: sortOrder++,
  })

  sections.push({
    ...generateBudgetVarianceSection(reportData),
    sortOrder: sortOrder++,
  })

  sections.push({
    ...generateCashPositionSection(reportData),
    sortOrder: sortOrder++,
  })

  sections.push({
    ...generateFundFlowSection(reportData),
    sortOrder: sortOrder++,
  })

  sections.push({
    ...generateKeyMetricsSection(reportData),
    sortOrder: sortOrder++,
  })

  if (options.includeLlmAnalysis) {
    sections.push({
      sectionType: 'LLM_ANALYSIS',
      title: 'AI分析による状況報告',
      content: '',
      sortOrder: sortOrder++,
    })
  }

  const report = await prisma.boardReport.create({
    data: {
      companyId,
      fiscalYear,
      month,
      title: `${fiscalYear}年度 ${month}月 取締役会報告資料`,
      status: 'DRAFT',
      generatedAt: new Date(),
      sections: {
        create: sections.map((s) => ({
          sectionType: s.sectionType,
          title: s.title,
          content: s.content,
          data: s.data,
          sortOrder: s.sortOrder,
        })),
      },
    },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  return {
    id: report.id,
    companyId: report.companyId,
    fiscalYear: report.fiscalYear,
    month: report.month,
    title: report.title,
    summary: report.summary,
    sections: report.sections.map((s) => ({
      sectionType: s.sectionType as SectionType,
      title: s.title,
      content: s.content,
      data: s.data ?? undefined,
      sortOrder: s.sortOrder,
    })),
    status: report.status as BoardReportStatus,
    generatedAt: report.generatedAt,
    presentedAt: report.presentedAt,
    approvedBy: report.approvedBy,
    approvedAt: report.approvedAt,
  }
}

async function collectReportData(
  companyId: string,
  fiscalYear: number,
  month: number,
  financialData: {
    pl: ProfitLoss
    bs: BalanceSheet
    cf: CashFlowStatement[]
  }
): Promise<BoardReportData> {
  const detailedBudget = await calculateDetailedActualVsBudget(
    companyId,
    fiscalYear,
    month,
    financialData.pl
  )

  const currentCash = financialData.cf[financialData.cf.length - 1]?.endingCash ?? 0
  const runwayCalc = calculateRunway(currentCash, financialData.cf)
  const runwayAlert = getRunwayAlert(runwayCalc.runwayMonths)

  const significantVariances = extractSignificantVariances(detailedBudget)

  const upcomingPayments = await getUpcomingPayments(companyId)

  const monthlyCashOutSummary = getMonthlyCashOutSummary(financialData.cf)

  const significantExpenses = extractSignificantExpenses(financialData.cf, 1000000)

  const keyMetrics = extractKeyMetrics(financialData, runwayCalc)

  return {
    financialSummary: {
      stageLevelPL: detailedBudget.stageLevel,
      keyAccounts: detailedBudget.accountLevel.slice(0, 10),
      comparisons: {
        mom: 0,
        yoy: 0,
      },
    },
    budgetVariance: {
      summary: detailedBudget.summary,
      significantVariances,
      achievementRate:
        detailedBudget.summary.totalBudget > 0
          ? (detailedBudget.summary.totalActual / detailedBudget.summary.totalBudget) * 100
          : 0,
    },
    cashPosition: {
      currentCash,
      burnRate: runwayCalc.monthlyBurnRate,
      runwayMonths: runwayCalc.runwayMonths,
      runwayStatus: runwayAlert.level,
      scenarios: runwayCalc.scenarios,
    },
    fundFlow: {
      upcomingPayments,
      monthlyCashOutSummary,
      significantExpenses,
    },
    keyMetrics,
  }
}

function extractSignificantVariances(budget: DetailedActualVsBudget): VarianceItem[] {
  const variances: VarianceItem[] = []

  for (const stage of budget.stageLevel) {
    const variancePercent = Math.abs(stage.rate - 100)
    if (variancePercent >= 10) {
      variances.push({
        item: stage.stage,
        budget: stage.budget,
        actual: stage.actual,
        variance: stage.variance,
        variancePercent: stage.rate,
        severity: variancePercent >= 30 ? 'high' : variancePercent >= 20 ? 'medium' : 'low',
      })
    }
  }

  for (const account of budget.accountLevel) {
    const variancePercent = Math.abs(account.rate - 100)
    if (variancePercent >= 15 && Math.abs(account.variance) >= 100000) {
      variances.push({
        item: account.name,
        budget: account.budget,
        actual: account.actual,
        variance: account.variance,
        variancePercent: account.rate,
        severity: variancePercent >= 30 ? 'high' : variancePercent >= 20 ? 'medium' : 'low',
      })
    }
  }

  return variances.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

async function getUpcomingPayments(companyId: string): Promise<UpcomingPayment[]> {
  const debts = await prisma.debt.findMany({
    where: {
      companyId,
      status: 'PENDING',
      dueDate: { gte: new Date() },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  return debts.map((d) => ({
    description: d.description || d.category,
    amount: d.amount,
    dueDate: d.dueDate,
    category: d.category,
  }))
}

function getMonthlyCashOutSummary(cfData: CashFlowStatement[]): MonthlyCashOutSummary[] {
  return cfData.slice(-6).map((cf) => {
    const categories: Record<string, number> = {}

    if (cf.investingActivities) {
      categories['設備投資'] = Math.abs(cf.investingActivities.purchaseOfFixedAssets ?? 0)
    }
    if (cf.financingActivities) {
      categories['借入金返済'] = Math.abs(cf.financingActivities.repaymentOfBorrowing ?? 0)
      categories['配当支払'] = Math.abs(cf.financingActivities.dividendPaid ?? 0)
    }

    const totalCashOut = Object.values(categories).reduce((s, v) => s + v, 0)

    return {
      month: cf.month ?? 0,
      totalCashOut,
      categories,
    }
  })
}

function extractSignificantExpenses(
  cfData: CashFlowStatement[],
  threshold: number
): SignificantExpense[] {
  const expenses: SignificantExpense[] = []

  for (const cf of cfData) {
    if (cf.investingActivities?.purchaseOfFixedAssets) {
      const amount = Math.abs(cf.investingActivities.purchaseOfFixedAssets)
      if (amount >= threshold) {
        expenses.push({
          description: '固定資産購入',
          amount,
          date: new Date(cf.fiscalYear ?? 2024, (cf.month ?? 1) - 1),
          category: 'investing',
          threshold,
        })
      }
    }
  }

  return expenses
}

function extractKeyMetrics(
  financialData: { pl: ProfitLoss; bs: BalanceSheet; cf: CashFlowStatement[] },
  runwayCalc: RunwayCalculation
): KeyMetric[] {
  const metrics: KeyMetric[] = []

  const revenue = financialData.pl.revenue.reduce((s, r) => s + r.amount, 0)
  metrics.push({
    kpi: '売上高',
    value: revenue,
    unit: '円',
    trend: 'stable',
    status: revenue > 0 ? 'good' : 'warning',
  })

  const operatingIncome = financialData.pl.operatingIncome
  metrics.push({
    kpi: '営業利益',
    value: operatingIncome,
    unit: '円',
    trend: 'stable',
    status: operatingIncome > 0 ? 'good' : operatingIncome < 0 ? 'warning' : 'critical',
  })

  const grossMargin = revenue > 0 ? (financialData.pl.grossProfit / revenue) * 100 : 0
  metrics.push({
    kpi: '粗利率',
    value: grossMargin,
    unit: '%',
    trend: 'stable',
    status: grossMargin >= 30 ? 'good' : grossMargin >= 20 ? 'warning' : 'critical',
  })

  const cash = financialData.cf[financialData.cf.length - 1]?.endingCash ?? 0
  metrics.push({
    kpi: '現金預金',
    value: cash,
    unit: '円',
    trend: 'stable',
    status: cash > runwayCalc.monthlyBurnRate * 6 ? 'good' : 'warning',
  })

  metrics.push({
    kpi: 'Runway',
    value: runwayCalc.runwayMonths,
    unit: 'ヶ月',
    trend: 'stable',
    status:
      runwayCalc.runwayMonths >= 12
        ? 'good'
        : runwayCalc.runwayMonths >= 6
          ? 'warning'
          : 'critical',
  })

  return metrics
}

function generateFinancialSummarySection(
  data: BoardReportData
): Omit<BoardReportSectionData, 'sortOrder'> {
  const stageTable = data.financialSummary.stageLevelPL
    .map(
      (s) =>
        `| ${s.stage} | ¥${s.budget.toLocaleString()} | ¥${s.actual.toLocaleString()} | ¥${s.variance.toLocaleString()} | ${s.rate.toFixed(1)}% |`
    )
    .join('\n')

  return {
    sectionType: 'FINANCIAL_SUMMARY',
    title: '月次決算サマリー',
    content: `## 段階損益

| 項目 | 予算 | 実績 | 差異 | 達成率 |
|------|------|------|------|--------|
${stageTable}

## 主要勘定科目の状況

${data.financialSummary.keyAccounts
  .slice(0, 5)
  .map((a) => `- **${a.name}**: ¥${a.actual.toLocaleString()} (予算比 ${a.rate.toFixed(1)}%)`)
  .join('\n')}
`,
    data: JSON.stringify(data.financialSummary),
  }
}

function generateBudgetVarianceSection(
  data: BoardReportData
): Omit<BoardReportSectionData, 'sortOrder'> {
  const varianceTable = data.budgetVariance.significantVariances
    .slice(0, 5)
    .map(
      (v) =>
        `| ${v.item} | ¥${v.budget.toLocaleString()} | ¥${v.actual.toLocaleString()} | ¥${v.variance.toLocaleString()} | ${v.severity} |`
    )
    .join('\n')

  return {
    sectionType: 'BUDGET_VARIANCE',
    title: '予実分析',
    content: `## 予実サマリー

- 予算合計: ¥${data.budgetVariance.summary.totalBudget.toLocaleString()}
- 実績合計: ¥${data.budgetVariance.summary.totalActual.toLocaleString()}
- 差異合計: ¥${data.budgetVariance.summary.totalVariance.toLocaleString()}
- 達成率: ${data.budgetVariance.achievementRate.toFixed(1)}%

## 重要な差異

| 項目 | 予算 | 実績 | 差異 | 重要度 |
|------|------|------|------|--------|
${varianceTable || '| (重要な差異はありません) | - | - | - | - |'}
`,
    data: JSON.stringify(data.budgetVariance),
  }
}

function generateCashPositionSection(
  data: BoardReportData
): Omit<BoardReportSectionData, 'sortOrder'> {
  const { cashPosition } = data

  return {
    sectionType: 'CASH_POSITION',
    title: 'キャッシュポジション',
    content: `## 現在のキャッシュ

- 現金預金残高: ¥${cashPosition.currentCash.toLocaleString()}

## Burn Rate & Runway

- 月次Burn Rate: ¥${cashPosition.burnRate.toLocaleString()}/月
- Runway: ${cashPosition.runwayMonths}ヶ月
- ステータス: **${cashPosition.runwayStatus === 'safe' ? '安全' : cashPosition.runwayStatus === 'warning' ? '注意' : '危険'}**

### シナリオ分析

| シナリオ | Burn Rate | Runway |
|---------|-----------|--------|
| 楽観 | ¥${cashPosition.scenarios.optimistic.burnRate.toLocaleString()}/月 | ${cashPosition.scenarios.optimistic.runwayMonths}ヶ月 |
| 現実 | ¥${cashPosition.scenarios.realistic.burnRate.toLocaleString()}/月 | ${cashPosition.scenarios.realistic.runwayMonths}ヶ月 |
| 悲観 | ¥${cashPosition.scenarios.pessimistic.burnRate.toLocaleString()}/月 | ${cashPosition.scenarios.pessimistic.runwayMonths}ヶ月 |
`,
    data: JSON.stringify(cashPosition),
  }
}

function generateFundFlowSection(data: BoardReportData): Omit<BoardReportSectionData, 'sortOrder'> {
  const { fundFlow } = data

  const upcomingTable = fundFlow.upcomingPayments
    .slice(0, 5)
    .map(
      (p) =>
        `| ${p.description} | ¥${p.amount.toLocaleString()} | ${p.dueDate.toLocaleDateString('ja-JP')} | ${p.category} |`
    )
    .join('\n')

  return {
    sectionType: 'FUND_FLOW',
    title: '資金繰り',
    content: `## 今後の支払予定

| 内容 | 金額 | 期限 | カテゴリ |
|------|------|------|----------|
${upcomingTable || '| (予定はありません) | - | - | - |'}

## 大口支出（直近）

${
  fundFlow.significantExpenses
    .slice(0, 3)
    .map(
      (e) =>
        `- ${e.description}: ¥${e.amount.toLocaleString()} (${e.date.toLocaleDateString('ja-JP')})`
    )
    .join('\n') || '(該当なし)'
}
`,
    data: JSON.stringify(fundFlow),
  }
}

function generateKeyMetricsSection(
  data: BoardReportData
): Omit<BoardReportSectionData, 'sortOrder'> {
  const metricsTable = data.keyMetrics
    .map(
      (m) =>
        `| ${m.kpi} | ${m.value.toLocaleString()} ${m.unit} | ${m.trend === 'up' ? '↗' : m.trend === 'down' ? '↘' : '→'} | ${m.status === 'good' ? '✓' : m.status === 'warning' ? '⚠' : '✗'} |`
    )
    .join('\n')

  return {
    sectionType: 'KEY_METRICS',
    title: '主要KPI',
    content: `## 経営指標サマリー

| 指標 | 値 | トレンド | ステータス |
|------|-----|---------|-----------|
${metricsTable}
`,
    data: JSON.stringify(data.keyMetrics),
  }
}

export async function updateBoardReport(
  id: string,
  data: Partial<{
    title: string
    summary: string
    status: BoardReportStatus
    approvedBy: string
    presentedAt: Date
  }>
): Promise<BoardReportDetail> {
  const updateData: Record<string, unknown> = {}

  if (data.title !== undefined) updateData.title = data.title
  if (data.summary !== undefined) updateData.summary = data.summary
  if (data.status !== undefined) updateData.status = data.status
  if (data.approvedBy !== undefined) {
    updateData.approvedBy = data.approvedBy
    updateData.approvedAt = new Date()
  }
  if (data.presentedAt !== undefined) updateData.presentedAt = data.presentedAt

  const report = await prisma.boardReport.update({
    where: { id },
    data: updateData,
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  return {
    id: report.id,
    companyId: report.companyId,
    fiscalYear: report.fiscalYear,
    month: report.month,
    title: report.title,
    summary: report.summary,
    sections: report.sections.map((s) => ({
      sectionType: s.sectionType as SectionType,
      title: s.title,
      content: s.content,
      data: s.data ?? undefined,
      sortOrder: s.sortOrder,
    })),
    status: report.status as BoardReportStatus,
    generatedAt: report.generatedAt,
    presentedAt: report.presentedAt,
    approvedBy: report.approvedBy,
    approvedAt: report.approvedAt,
  }
}

export async function updateBoardReportSection(
  sectionId: string,
  data: Partial<{
    title: string
    content: string
  }>
): Promise<void> {
  await prisma.boardReportSection.update({
    where: { id: sectionId },
    data,
  })
}

export async function deleteBoardReport(id: string): Promise<void> {
  await prisma.boardReport.delete({
    where: { id },
  })
}

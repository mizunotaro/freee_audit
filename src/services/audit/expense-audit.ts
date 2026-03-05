import { prisma } from '@/lib/db'

export interface ExpenseAuditItem {
  id: string
  journalId: string
  date: Date
  accountName: string
  amount: number
  description: string
  origin?: string
  destination?: string
  transport?: string
  hasDocument: boolean
}

export interface ExpenseAuditResult {
  itemId: string
  status: 'pass' | 'warning' | 'error'
  issues: ExpenseAuditIssue[]
  confidenceScore: number
  aiAnalysis?: string
}

export interface ExpenseAuditIssue {
  type: ExpenseIssueType
  severity: 'info' | 'warning' | 'error'
  message: string
  details?: Record<string, unknown>
}

export type ExpenseIssueType =
  | 'future_date'
  | 'weekend_travel'
  | 'holiday_travel'
  | 'invalid_route'
  | 'unusual_transport'
  | 'amount_anomaly'
  | 'missing_document'
  | 'distance_mismatch'
  | 'duplicate_expense'
  | 'inconsistent_trip'

export interface TransportRoute {
  origin: string
  destination: string
  estimatedDistance: number
  estimatedTime: number
  typicalMethods: string[]
  typicalCostRange: { min: number; max: number }
}

export async function auditExpenseItems(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<ExpenseAuditResult[]> {
  const startDate = new Date(fiscalYear, month - 1, 1)
  const endDate = new Date(fiscalYear, month, 0)

  const journals = await prisma.journal.findMany({
    where: {
      companyId,
      entryDate: {
        gte: startDate,
        lte: endDate,
      },
      debitAccount: {
        contains: '旅費',
      },
    },
    include: {
      document: true,
    },
  })

  const expenseItems: ExpenseAuditItem[] = journals.map((j) => ({
    id: j.id,
    journalId: j.id,
    date: j.entryDate,
    accountName: j.debitAccount,
    amount: j.amount,
    description: j.description,
    hasDocument: !!j.document,
  }))

  const results: ExpenseAuditResult[] = []

  for (const item of expenseItems) {
    const result = await auditSingleExpense(item)
    results.push(result)
  }

  return results
}

async function auditSingleExpense(item: ExpenseAuditItem): Promise<ExpenseAuditResult> {
  const issues: ExpenseAuditIssue[] = []

  const dateIssues = checkDateValidity(item)
  issues.push(...dateIssues)

  if (item.origin && item.destination && item.transport) {
    const routeIssues = checkRouteValidity(item)
    issues.push(...routeIssues)
  }

  const amountIssues = checkAmountAnomaly(item)
  issues.push(...amountIssues)

  if (!item.hasDocument && item.amount > 30000) {
    issues.push({
      type: 'missing_document',
      severity: 'warning',
      message: '3万円を超える経費に証憑が添付されていません',
      details: { amount: item.amount },
    })
  }

  if (item.transport && ['新幹線', '特急', '航空機', '高速バス'].includes(item.transport)) {
    if (!item.hasDocument) {
      issues.push({
        type: 'missing_document',
        severity: 'error',
        message: `${item.transport}の利用には証憑の添付が必要です`,
        details: { transport: item.transport },
      })
    }
  }

  const status = determineStatus(issues)
  const confidenceScore = calculateConfidenceScore(issues)

  return {
    itemId: item.id,
    status,
    issues,
    confidenceScore,
  }
}

function checkDateValidity(item: ExpenseAuditItem): ExpenseAuditIssue[] {
  const issues: ExpenseAuditIssue[] = []
  const today = new Date()

  if (item.date > today) {
    issues.push({
      type: 'future_date',
      severity: 'error',
      message: '未来の日付で経費が登録されています',
      details: { expenseDate: item.date.toISOString(), today: today.toISOString() },
    })
  }

  const dayOfWeek = item.date.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    issues.push({
      type: 'weekend_travel',
      severity: 'info',
      message: '週末の移動です。業務関連性を確認してください',
      details: { dayOfWeek },
    })
  }

  return issues
}

function checkRouteValidity(item: ExpenseAuditItem): ExpenseAuditIssue[] {
  const issues: ExpenseAuditIssue[] = []

  const route = estimateRoute(item.origin!, item.destination!)

  if (route) {
    if (item.transport && !route.typicalMethods.includes(item.transport)) {
      issues.push({
        type: 'unusual_transport',
        severity: 'warning',
        message: `${route.estimatedDistance}kmの移動に${item.transport}の利用は一般的ではありません`,
        details: {
          distance: route.estimatedDistance,
          transport: item.transport,
          typicalMethods: route.typicalMethods,
        },
      })
    }

    if (
      item.amount > 0 &&
      (item.amount < route.typicalCostRange.min * 0.5 ||
        item.amount > route.typicalCostRange.max * 1.5)
    ) {
      issues.push({
        type: 'amount_anomaly',
        severity: 'warning',
        message: '金額が通常範囲から大きく逸脱しています',
        details: {
          amount: item.amount,
          typicalRange: route.typicalCostRange,
        },
      })
    }
  }

  return issues
}

function checkAmountAnomaly(item: ExpenseAuditItem): ExpenseAuditIssue[] {
  const issues: ExpenseAuditIssue[] = []

  const thresholds: Record<string, { warning: number; error: number }> = {
    タクシー: { warning: 5000, error: 10000 },
    電車: { warning: 10000, error: 30000 },
    新幹線: { warning: 30000, error: 50000 },
    航空機: { warning: 50000, error: 100000 },
    バス: { warning: 3000, error: 5000 },
  }

  if (item.transport && thresholds[item.transport]) {
    const threshold = thresholds[item.transport]
    if (item.amount > threshold.error) {
      issues.push({
        type: 'amount_anomaly',
        severity: 'error',
        message: `${item.transport}の金額が異常に高いです`,
        details: { amount: item.amount, threshold: threshold.error },
      })
    } else if (item.amount > threshold.warning) {
      issues.push({
        type: 'amount_anomaly',
        severity: 'warning',
        message: `${item.transport}の金額が高めです。確認してください`,
        details: { amount: item.amount, threshold: threshold.warning },
      })
    }
  }

  return issues
}

function estimateRoute(origin: string, destination: string): TransportRoute | null {
  const majorRoutes: Record<string, TransportRoute> = {
    '東京-大阪': {
      origin: '東京',
      destination: '大阪',
      estimatedDistance: 500,
      estimatedTime: 150,
      typicalMethods: ['新幹線', '航空機', '高速バス'],
      typicalCostRange: { min: 8000, max: 25000 },
    },
    '東京-名古屋': {
      origin: '東京',
      destination: '名古屋',
      estimatedDistance: 350,
      estimatedTime: 100,
      typicalMethods: ['新幹線', '高速バス'],
      typicalCostRange: { min: 5000, max: 15000 },
    },
    '東京-福岡': {
      origin: '東京',
      destination: '福岡',
      estimatedDistance: 1100,
      estimatedTime: 120,
      typicalMethods: ['航空機'],
      typicalCostRange: { min: 15000, max: 60000 },
    },
    '東京-札幌': {
      origin: '東京',
      destination: '札幌',
      estimatedDistance: 1200,
      estimatedTime: 100,
      typicalMethods: ['航空機'],
      typicalCostRange: { min: 15000, max: 70000 },
    },
  }

  const key1 = `${origin}-${destination}`
  const key2 = `${destination}-${origin}`

  return majorRoutes[key1] || majorRoutes[key2] || null
}

function determineStatus(issues: ExpenseAuditIssue[]): 'pass' | 'warning' | 'error' {
  if (issues.some((i) => i.severity === 'error')) {
    return 'error'
  }
  if (issues.some((i) => i.severity === 'warning')) {
    return 'warning'
  }
  return 'pass'
}

function calculateConfidenceScore(issues: ExpenseAuditIssue[]): number {
  if (issues.length === 0) return 100

  let score = 100
  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 30
        break
      case 'warning':
        score -= 15
        break
      case 'info':
        score -= 5
        break
    }
  }

  return Math.max(0, score)
}

export async function checkDuplicateExpenses(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<Array<{ items: ExpenseAuditItem[]; reason: string }>> {
  const startDate = new Date(fiscalYear, month - 1, 1)
  const endDate = new Date(fiscalYear, month, 0)

  const journals = await prisma.journal.findMany({
    where: {
      companyId,
      entryDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  })

  const duplicates: Array<{ items: ExpenseAuditItem[]; reason: string }> = []

  const groupedByAmount = new Map<number, typeof journals>()

  for (const journal of journals) {
    const key = Math.round(journal.amount / 100) * 100
    if (!groupedByAmount.has(key)) {
      groupedByAmount.set(key, [])
    }
    groupedByAmount.get(key)!.push(journal)
  }

  for (const [, items] of groupedByAmount) {
    if (items.length > 1) {
      const sameDescription = items.filter((i) => i.description === items[0].description)
      if (sameDescription.length > 1) {
        duplicates.push({
          items: sameDescription.map((j) => ({
            id: j.id,
            journalId: j.id,
            date: j.entryDate,
            accountName: j.debitAccount,
            amount: j.amount,
            description: j.description,
            hasDocument: false,
          })),
          reason: '同じ金額と説明の経費が複数存在します',
        })
      }
    }
  }

  return duplicates
}

export async function checkTripConsistency(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<Array<{ tripId: string; issues: string[] }>> {
  const startDate = new Date(fiscalYear, month - 1, 1)
  const endDate = new Date(fiscalYear, month, 0)

  const journals = await prisma.journal.findMany({
    where: {
      companyId,
      entryDate: {
        gte: startDate,
        lte: endDate,
      },
      debitAccount: { contains: '旅費' },
    },
    orderBy: { entryDate: 'asc' },
  })

  const trips: Array<{ tripId: string; issues: string[] }> = []
  let currentTrip: typeof journals = []
  let tripId = 1

  for (const journal of journals) {
    currentTrip.push(journal)

    if (currentTrip.length >= 2) {
      const lastItem = currentTrip[currentTrip.length - 1]
      const prevItem = currentTrip[currentTrip.length - 2]
      const daysDiff = Math.abs(
        (lastItem.entryDate.getTime() - prevItem.entryDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysDiff > 3) {
        if (currentTrip.length > 1) {
          const issues = analyzeTripIssues(currentTrip.slice(0, -1))
          if (issues.length > 0) {
            trips.push({ tripId: `trip-${tripId}`, issues })
          }
          tripId++
        }
        currentTrip = [lastItem]
      }
    }
  }

  if (currentTrip.length > 1) {
    const issues = analyzeTripIssues(currentTrip)
    if (issues.length > 0) {
      trips.push({ tripId: `trip-${tripId}`, issues })
    }
  }

  return trips
}

function analyzeTripIssues(
  items: { description: string; amount: number; entryDate: Date }[]
): string[] {
  const issues: string[] = []

  const hasOutbound = items.some(
    (i) => i.description.includes('→') || i.description.includes('から')
  )
  const hasReturn = items.some((i) => i.description.includes('←') || i.description.includes('戻り'))

  if (hasOutbound && !hasReturn) {
    issues.push('帰路の交通費が見つかりません')
  }

  const accommodationCount = items.filter(
    (i) => i.description.includes('宿泊') || i.description.includes('ホテル')
  ).length
  const tripDays =
    Math.ceil(
      (items[items.length - 1].entryDate.getTime() - items[0].entryDate.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1

  if (tripDays > 1 && accommodationCount === 0) {
    issues.push('複数日の出張ですが宿泊費が記録されていません')
  }

  return issues
}

export function generateExpenseAuditPrompt(item: ExpenseAuditItem): string {
  return `
以下の交通費精算データを分析し、異常がないか確認してください：

移動日: ${item.date.toLocaleDateString('ja-JP')}
出発地: ${item.origin || '不明'}
目的地: ${item.destination || '不明'}
交通手段: ${item.transport || '不明'}
金額: ${item.amount.toLocaleString()}円
説明: ${item.description}
証憑添付: ${item.hasDocument ? 'あり' : 'なし'}

確認事項：
1. 日付の妥当性（営業日か、未来日付ではないか）
2. 経路の整合性（出発地から目的地への移動として妥当か）
3. 交通手段の適正（距離に対して適切な手段か）
4. 金額の妥当性（通常料金範囲内か）

異常がある場合は、具体的に指摘してください。
`
}

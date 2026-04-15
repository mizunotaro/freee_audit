import { prisma } from '@/lib/db'
import { failure, createAppError, tryCatch, type Result, type AppError } from '@/types/result'

export interface ExpenseRecord {
  id: string
  employeeName: string
  date: string
  category: string
  description: string
  amount: number
  route?: string
  destination?: string
}

export interface CommuteRoute {
  employeeName: string
  homeStation: string
  officeStation: string
  routeStations: string[]
  monthlyPassAmount: number
}

export interface CompanyExpensePolicy {
  dailyAllowanceLimit?: number
  hotelLimitDomestic?: number
  hotelLimitInternational?: number
  taxiApprovalRequired: boolean
  entertainmentApprovalLimit?: number
  maxMealExpense?: number
}

export interface ExpenseCheckAlert {
  checkType: string
  severity: string
  message: string
  details?: string
  expenseId?: string
  employeeName?: string
}

export function checkDuplicateExpenses(expenses: ExpenseRecord[]): ExpenseCheckAlert[] {
  const alerts: ExpenseCheckAlert[] = []
  const seen = new Map<string, ExpenseRecord[]>()

  for (const exp of expenses) {
    const key = `${exp.employeeName}|${exp.date}|${exp.amount}|${exp.route ?? ''}`
    if (!seen.has(key)) {
      seen.set(key, [])
    }
    seen.get(key)!.push(exp)
  }

  for (const [, group] of seen) {
    if (group.length > 1) {
      alerts.push({
        checkType: 'duplicate_expense',
        severity: 'high',
        message: `重複申請の可能性: ${group[0].employeeName} ${group[0].date} ${group[0].amount}円 (${group.length}件)`,
        expenseId: group[0].id,
        employeeName: group[0].employeeName,
      })
    }
  }

  return alerts
}

export function checkCommuteOverlap(
  expenses: ExpenseRecord[],
  commuteRoutes: CommuteRoute[]
): ExpenseCheckAlert[] {
  const alerts: ExpenseCheckAlert[] = []

  const routeMap = new Map<string, CommuteRoute>()
  for (const route of commuteRoutes) {
    routeMap.set(route.employeeName, route)
  }

  for (const exp of expenses) {
    if (exp.category !== 'transportation' || !exp.route) continue

    const commute = routeMap.get(exp.employeeName)
    if (!commute) continue

    const expRouteNorm = exp.route.replace(/[\s\u3000]/g, '').toLowerCase()
    const commuteStations = [commute.homeStation, ...commute.routeStations, commute.officeStation]

    let overlapCount = 0
    for (const station of commuteStations) {
      if (expRouteNorm.includes(station.toLowerCase())) {
        overlapCount++
      }
    }

    if (overlapCount >= 2) {
      alerts.push({
        checkType: 'commute_overlap',
        severity: 'medium',
        message: `通勤経路との重複: ${exp.employeeName} ${exp.date} "${exp.route}" が通勤定期区間と重複しています`,
        details: `通勤区間: ${commute.homeStation} → ${commute.officeStation}`,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
    }
  }

  return alerts
}

export function checkDateConsistency(expenses: ExpenseRecord[]): ExpenseCheckAlert[] {
  const alerts: ExpenseCheckAlert[] = []

  for (const exp of expenses) {
    const date = new Date(exp.date)
    if (isNaN(date.getTime())) {
      alerts.push({
        checkType: 'invalid_date',
        severity: 'high',
        message: `無効な日付: ${exp.employeeName} "${exp.date}"`,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
      continue
    }

    const dayOfWeek = date.getDay()
    if ((dayOfWeek === 0 || dayOfWeek === 6) && exp.category === 'transportation') {
      alerts.push({
        checkType: 'weekend_expense',
        severity: 'low',
        message: `休日の交通費: ${exp.employeeName} ${exp.date} (${dayOfWeek === 0 ? '日' : '土'}曜日)`,
        details: exp.description,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
    }

    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays > 90) {
      alerts.push({
        checkType: 'stale_expense',
        severity: 'medium',
        message: `90日以上前の経費: ${exp.employeeName} ${exp.date} (${diffDays}日前)`,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
    }
  }

  return alerts
}

export function checkPolicyCompliance(
  expenses: ExpenseRecord[],
  policy: CompanyExpensePolicy
): ExpenseCheckAlert[] {
  const alerts: ExpenseCheckAlert[] = []

  for (const exp of expenses) {
    if (
      exp.category === 'hotel' &&
      policy.hotelLimitDomestic &&
      exp.amount > policy.hotelLimitDomestic
    ) {
      alerts.push({
        checkType: 'policy_violation',
        severity: 'high',
        message: `宿泊費上限超過: ${exp.employeeName} ${exp.amount}円 (上限: ${policy.hotelLimitDomestic}円)`,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
    }

    if (exp.category === 'taxi' && policy.taxiApprovalRequired) {
      alerts.push({
        checkType: 'approval_required',
        severity: 'medium',
        message: `タクシー利用要承認: ${exp.employeeName} ${exp.date} ${exp.amount}円`,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
    }

    if (
      exp.category === 'entertainment' &&
      policy.entertainmentApprovalLimit &&
      exp.amount > policy.entertainmentApprovalLimit
    ) {
      alerts.push({
        checkType: 'policy_violation',
        severity: 'high',
        message: `交際費上限超過: ${exp.employeeName} ${exp.amount}円 (上限: ${policy.entertainmentApprovalLimit}円)`,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
    }

    if (exp.category === 'meal' && policy.maxMealExpense && exp.amount > policy.maxMealExpense) {
      alerts.push({
        checkType: 'policy_violation',
        severity: 'medium',
        message: `食事代上限超過: ${exp.employeeName} ${exp.amount}円 (上限: ${policy.maxMealExpense}円)`,
        expenseId: exp.id,
        employeeName: exp.employeeName,
      })
    }
  }

  return alerts
}

export async function runFullExpenseCheck(options: {
  companyId: string
  expenses: ExpenseRecord[]
  commuteRoutes?: CommuteRoute[]
  policy?: CompanyExpensePolicy
}): Promise<Result<{ totalAlerts: number; alerts: ExpenseCheckAlert[] }, AppError>> {
  const { companyId, expenses, commuteRoutes, policy } = options

  if (!companyId) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId is required'))
  }

  const allAlerts: ExpenseCheckAlert[] = []

  allAlerts.push(...checkDuplicateExpenses(expenses))
  allAlerts.push(...checkDateConsistency(expenses))

  if (commuteRoutes && commuteRoutes.length > 0) {
    allAlerts.push(...checkCommuteOverlap(expenses, commuteRoutes))
  }

  if (policy) {
    allAlerts.push(...checkPolicyCompliance(expenses, policy))
  }

  return tryCatch(async () => {
    for (const alert of allAlerts) {
      await prisma.expenseCheckResult.create({
        data: {
          companyId,
          checkDate: new Date(),
          expenseId: alert.expenseId,
          employeeName: alert.employeeName,
          checkType: alert.checkType,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
        },
      })
    }

    return {
      totalAlerts: allAlerts.length,
      alerts: allAlerts,
    }
  }, 'DATABASE_ERROR')
}

import { describe, it, expect } from 'vitest'
import {
  checkDuplicateExpenses,
  checkCommuteOverlap,
  checkDateConsistency,
  checkPolicyCompliance,
  type ExpenseRecord,
  type CommuteRoute,
  type CompanyExpensePolicy,
} from '@/services/expense-check'

const baseExpense: ExpenseRecord = {
  id: 'exp-1',
  employeeName: '田中太郎',
  date: '2026-04-10',
  category: 'transportation',
  description: '新宿→渋谷 電車',
  amount: 200,
}

describe('Expense Check Service', () => {
  describe('checkDuplicateExpenses', () => {
    it('should detect duplicate expenses', () => {
      const expenses: ExpenseRecord[] = [
        { ...baseExpense, id: 'exp-1' },
        { ...baseExpense, id: 'exp-2' },
      ]
      const alerts = checkDuplicateExpenses(expenses)
      expect(alerts.length).toBe(1)
      expect(alerts[0].checkType).toBe('duplicate_expense')
      expect(alerts[0].severity).toBe('high')
    })

    it('should not flag unique expenses', () => {
      const expenses: ExpenseRecord[] = [
        { ...baseExpense, id: 'exp-1', amount: 200 },
        { ...baseExpense, id: 'exp-2', amount: 300 },
      ]
      const alerts = checkDuplicateExpenses(expenses)
      expect(alerts.length).toBe(0)
    })

    it('should handle empty array', () => {
      expect(checkDuplicateExpenses([]).length).toBe(0)
    })
  })

  describe('checkCommuteOverlap', () => {
    const commuteRoutes: CommuteRoute[] = [
      {
        employeeName: '田中太郎',
        homeStation: '新宿',
        officeStation: '渋谷',
        routeStations: ['代々木'],
        monthlyPassAmount: 5000,
      },
    ]

    it('should detect commute route overlap', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, route: '新宿→渋谷' }]
      const alerts = checkCommuteOverlap(expenses, commuteRoutes)
      expect(alerts.length).toBe(1)
      expect(alerts[0].checkType).toBe('commute_overlap')
    })

    it('should not flag non-overlapping routes', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, route: '東京→横浜' }]
      const alerts = checkCommuteOverlap(expenses, commuteRoutes)
      expect(alerts.length).toBe(0)
    })

    it('should skip non-transportation expenses', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, category: 'hotel', route: '新宿→渋谷' }]
      const alerts = checkCommuteOverlap(expenses, commuteRoutes)
      expect(alerts.length).toBe(0)
    })

    it('should handle missing route field', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, route: undefined }]
      const alerts = checkCommuteOverlap(expenses, commuteRoutes)
      expect(alerts.length).toBe(0)
    })
  })

  describe('checkDateConsistency', () => {
    it('should flag weekend transportation expenses', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, date: '2026-04-11' }]
      const alerts = checkDateConsistency(expenses)
      const weekendAlerts = alerts.filter((a) => a.checkType === 'weekend_expense')
      expect(weekendAlerts.length).toBe(1)
    })

    it('should flag very old expenses (>90 days)', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 100)
      const expenses: ExpenseRecord[] = [
        { ...baseExpense, date: oldDate.toISOString().split('T')[0] },
      ]
      const alerts = checkDateConsistency(expenses)
      const staleAlerts = alerts.filter((a) => a.checkType === 'stale_expense')
      expect(staleAlerts.length).toBe(1)
    })

    it('should flag invalid dates', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, date: 'invalid-date' }]
      const alerts = checkDateConsistency(expenses)
      expect(alerts.some((a) => a.checkType === 'invalid_date')).toBe(true)
    })
  })

  describe('checkPolicyCompliance', () => {
    const policy: CompanyExpensePolicy = {
      hotelLimitDomestic: 15000,
      taxiApprovalRequired: true,
      entertainmentApprovalLimit: 50000,
      maxMealExpense: 3000,
    }

    it('should flag hotel over limit', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, category: 'hotel', amount: 20000 }]
      const alerts = checkPolicyCompliance(expenses, policy)
      expect(alerts.some((a) => a.checkType === 'policy_violation')).toBe(true)
    })

    it('should flag taxi without approval', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, category: 'taxi', amount: 3000 }]
      const alerts = checkPolicyCompliance(expenses, policy)
      expect(alerts.some((a) => a.checkType === 'approval_required')).toBe(true)
    })

    it('should flag entertainment over limit', () => {
      const expenses: ExpenseRecord[] = [
        { ...baseExpense, category: 'entertainment', amount: 60000 },
      ]
      const alerts = checkPolicyCompliance(expenses, policy)
      expect(alerts.some((a) => a.message.includes('交際費'))).toBe(true)
    })

    it('should flag meal over limit', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, category: 'meal', amount: 5000 }]
      const alerts = checkPolicyCompliance(expenses, policy)
      expect(alerts.some((a) => a.message.includes('食事代'))).toBe(true)
    })

    it('should pass compliant expenses', () => {
      const expenses: ExpenseRecord[] = [{ ...baseExpense, category: 'hotel', amount: 10000 }]
      const alerts = checkPolicyCompliance(expenses, policy)
      expect(alerts.length).toBe(0)
    })
  })
})

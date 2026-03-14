'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { BudgetVsActual, DetailedBudget, VarianceData, BudgetRecord } from '@/types/reports'

interface UseBudgetDataResult {
  budgetVsActual: BudgetVsActual | null
  detailedBudget: DetailedBudget | null
  variance: VarianceData | null
  budgets: BudgetRecord[]
  loading: boolean
  refetch: () => void
}

export function useBudgetData(fiscalYear: number, month: number): UseBudgetDataResult {
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActual | null>(null)
  const [detailedBudget, setDetailedBudget] = useState<DetailedBudget | null>(null)
  const [variance, setVariance] = useState<VarianceData | null>(null)
  const [budgets, setBudgets] = useState<BudgetRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [varianceResult, budgetsResult, detailedResult] = await Promise.allSettled([
        fetchWithTimeout(
          `/api/reports/budget?action=variance&fiscalYear=${fiscalYear}&month=${month}`,
          { timeout: 30000 }
        ),
        fetchWithTimeout(`/api/reports/budget?fiscalYear=${fiscalYear}&month=${month}`, {
          timeout: 30000,
        }),
        fetchWithTimeout(
          `/api/reports/budget?action=detailed&fiscalYear=${fiscalYear}&month=${month}`,
          { timeout: 30000 }
        ),
      ])

      if (varianceResult.status === 'fulfilled') {
        const varianceData = await varianceResult.value.json()
        setBudgetVsActual(varianceData.budgetVsActual)
        setVariance(varianceData.variance)
      } else {
        if (varianceResult.reason instanceof FetchTimeoutError) {
          toast.error('差異データの取得がタイムアウトしました')
        } else {
          console.error('Failed to fetch variance:', varianceResult.reason)
        }
      }

      if (budgetsResult.status === 'fulfilled') {
        const budgetsData = await budgetsResult.value.json()
        setBudgets(budgetsData.budgets || [])
      } else {
        if (budgetsResult.reason instanceof FetchTimeoutError) {
          toast.error('予算一覧の取得がタイムアウトしました')
        } else {
          console.error('Failed to fetch budgets:', budgetsResult.reason)
        }
      }

      if (detailedResult.status === 'fulfilled') {
        const detailedData = await detailedResult.value.json()
        setDetailedBudget(detailedData)
      } else {
        if (detailedResult.reason instanceof FetchTimeoutError) {
          toast.error('詳細データの取得がタイムアウトしました')
        } else {
          console.error('Failed to fetch detailed budget:', detailedResult.reason)
        }
      }
    } catch (error) {
      console.error('Failed to fetch budget:', error)
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { budgetVsActual, detailedBudget, variance, budgets, loading, refetch: fetchData }
}

export async function deleteBudget(id: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`/api/reports/budget?id=${id}`, {
      method: 'DELETE',
      timeout: 30000,
    })
    if (!res.ok) throw new Error('削除に失敗しました')
    return true
  } catch (error) {
    console.error('Failed to delete budget:', error)
    return false
  }
}

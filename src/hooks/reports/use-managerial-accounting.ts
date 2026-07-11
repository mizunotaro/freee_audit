'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { ManagerialMetrics, VarianceBridge } from '@/types/reports/managerial'

interface UseManagerialAccountingResult {
  metrics: ManagerialMetrics | null
  bridge: VarianceBridge | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * /api/reports/budget/managerial から管理会計指標と予実ブリッジを取得する。
 * 財務計算式は API（サービス層）で計算済みの結果を受け取るのみ。
 */
export function useManagerialAccounting(
  fiscalYear: number,
  month: number
): UseManagerialAccountingResult {
  const [metrics, setMetrics] = useState<ManagerialMetrics | null>(null)
  const [bridge, setBridge] = useState<VarianceBridge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithTimeout(
        `/api/reports/budget/managerial?fiscalYear=${fiscalYear}&month=${month}`,
        { timeout: 30000 }
      )
      if (!res.ok) {
        setError('管理会計データの取得に失敗しました')
        return
      }
      const data = (await res.json()) as {
        metrics: ManagerialMetrics | null
        bridge: VarianceBridge | null
      }
      setMetrics(data.metrics)
      setBridge(data.bridge)
    } catch (err) {
      if (err instanceof FetchTimeoutError) {
        setError('管理会計データの取得がタイムアウトしました')
      } else {
        setError('管理会計データの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { metrics, bridge, loading, error, refetch: fetchData }
}

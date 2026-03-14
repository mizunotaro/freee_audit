'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { KPIReportData } from '@/types/reports/kpi'

interface UseKPIDataResult {
  data: KPIReportData | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useKPIData(fiscalYear: number, month: number): UseKPIDataResult {
  const [data, setData] = useState<KPIReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithTimeout(
        `/api/reports/kpi?fiscalYear=${fiscalYear}&month=${month}`,
        { timeout: 30000 }
      )
      const kpiData = await res.json()
      setData(kpiData)
    } catch (err) {
      console.error('Failed to fetch KPIs:', err)
      if (err instanceof FetchTimeoutError) {
        setError(new Error('リクエストがタイムアウトしました'))
      } else {
        setError(err instanceof Error ? err : new Error('データの取得に失敗しました'))
      }
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

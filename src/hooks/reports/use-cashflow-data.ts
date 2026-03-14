'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type {
  CashFlowStatementItem,
  CashFlowPosition,
  RunwayData,
  RunwayAlert,
  CashOutForecast,
  MonthlyCashOutSummary,
  CashFlowChartData,
} from '@/types/reports/cashflow'

interface UseCashflowDataResult {
  cashFlows: CashFlowStatementItem[]
  cashPosition: CashFlowPosition | null
  runway: RunwayData | null
  alert: RunwayAlert | null
  cashOutForecasts: CashOutForecast[]
  monthlyCashOut: MonthlyCashOutSummary[]
  loading: boolean
  refetch: () => void
}

export function useCashflowData(fiscalYear: number): UseCashflowDataResult {
  const [cashFlows, setCashFlows] = useState<CashFlowStatementItem[]>([])
  const [cashPosition, setCashPosition] = useState<CashFlowPosition | null>(null)
  const [runway, setRunway] = useState<RunwayData | null>(null)
  const [alert, setAlert] = useState<RunwayAlert | null>(null)
  const [cashOutForecasts, setCashOutForecasts] = useState<CashOutForecast[]>([])
  const [monthlyCashOut, setMonthlyCashOut] = useState<MonthlyCashOutSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [cashflowResult, debtResult] = await Promise.allSettled([
        fetchWithTimeout(`/api/reports/cashflow?fiscalYear=${fiscalYear}`, { timeout: 30000 }),
        fetchWithTimeout('/api/debt/forecast', { timeout: 30000 }),
      ])

      if (cashflowResult.status === 'fulfilled') {
        const cashflowData = await cashflowResult.value.json()
        setCashFlows(cashflowData.cashFlows || [])
        setCashPosition(cashflowData.cashPosition)
        setRunway(cashflowData.runway)
        setAlert(cashflowData.alert)
      } else {
        if (cashflowResult.reason instanceof FetchTimeoutError) {
          console.error('Cashflow request timed out')
        } else {
          console.error('Failed to fetch cashflow:', cashflowResult.reason)
        }
      }

      if (debtResult.status === 'fulfilled') {
        const debtData = await debtResult.value.json()
        setCashOutForecasts(debtData.forecasts || [])
        setMonthlyCashOut(debtData.monthlySummary || [])
      } else {
        if (debtResult.reason instanceof FetchTimeoutError) {
          console.error('Debt forecast request timed out')
        } else {
          console.error('Failed to fetch debt forecast:', debtResult.reason)
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [fiscalYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    cashFlows,
    cashPosition,
    runway,
    alert,
    cashOutForecasts,
    monthlyCashOut,
    loading,
    refetch: fetchData,
  }
}

export function buildChartData(cashFlows: CashFlowStatementItem[]): CashFlowChartData[] {
  return cashFlows.map((cf, index) => {
    const cumulative = cashFlows
      .slice(0, index + 1)
      .reduce(
        (sum, c) =>
          sum +
          c.operatingActivities.netCashFromOperating +
          c.investingActivities.netCashFromInvesting +
          c.financingActivities.netCashFromFinancing,
        0
      )
    return {
      month: `${cf.month}月`,
      operating: cf.operatingActivities.netCashFromOperating,
      investing: cf.investingActivities.netCashFromInvesting,
      financing: cf.financingActivities.netCashFromFinancing,
      netCash:
        cf.operatingActivities.netCashFromOperating +
        cf.investingActivities.netCashFromInvesting +
        cf.financingActivities.netCashFromFinancing,
      cumulative,
    }
  })
}

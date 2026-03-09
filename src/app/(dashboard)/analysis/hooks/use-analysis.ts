'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ApiResponse } from '@/app/api/analysis/types/response'
import type { FinancialAnalysisOutput } from '@/app/api/analysis/types/output'

export interface FiscalPeriod {
  fiscalYear: number
  month: number
}

export interface AnalysisState {
  financialData: ApiResponse<FinancialAnalysisOutput> | null
  ratioData: ApiResponse<unknown> | null
  benchmarkData: ApiResponse<unknown> | null
  isLoading: boolean
  error: string | null
}

export function useAnalysis(period: FiscalPeriod) {
  const [state, setState] = useState<AnalysisState>({
    financialData: null,
    ratioData: null,
    benchmarkData: null,
    isLoading: true,
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const cacheRef = useRef<Map<string, { data: unknown; timestamp: number }>>(new Map())
  const CACHE_TTL_MS = 5 * 60 * 1000

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    const cacheKey = `analysis_${period.fiscalYear}_${period.month}`
    const cached = cacheRef.current.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setState({
        financialData: cached.data as ApiResponse<FinancialAnalysisOutput>,
        ratioData: null,
        benchmarkData: null,
        isLoading: false,
        error: null,
      })
      return
    }

    try {
      const mockBalanceSheet = {
        fiscalYear: period.fiscalYear,
        month: period.month,
        assets: {
          current: [
            { code: '1001', name: '現金・預金', amount: 50000000 },
            { code: '1003', name: '売掛金', amount: 30000000 },
            { code: '1005', name: '棚卸資産', amount: 20000000 },
          ],
          fixed: [
            { code: '1101', name: '建物', amount: 80000000 },
            { code: '1102', name: '機械装置', amount: 40000000 },
          ],
          total: 220000000,
        },
        liabilities: {
          current: [
            { code: '2001', name: '買掛金', amount: 25000000 },
            { code: '2002', name: '短期借入金', amount: 15000000 },
          ],
          fixed: [{ code: '2101', name: '長期借入金', amount: 50000000 }],
          total: 90000000,
        },
        equity: {
          items: [
            { code: '3001', name: '資本金', amount: 50000000 },
            { code: '3300', name: '利益剰余金', amount: 80000000 },
          ],
          total: 130000000,
        },
        totalAssets: 220000000,
        totalLiabilities: 90000000,
        totalEquity: 130000000,
      }

      const mockProfitLoss = {
        fiscalYear: period.fiscalYear,
        month: period.month,
        revenue: [{ code: '4001', name: '売上高', amount: 300000000 }],
        costOfSales: [{ code: '5001', name: '売上原価', amount: 180000000 }],
        grossProfit: 120000000,
        grossProfitMargin: 40,
        sgaExpenses: [{ code: '5101', name: '販管費', amount: 70000000 }],
        operatingIncome: 50000000,
        operatingMargin: 16.7,
        nonOperatingIncome: [],
        nonOperatingExpenses: [{ code: '5201', name: '支払利息', amount: 2000000 }],
        ordinaryIncome: 48000000,
        extraordinaryIncome: [],
        extraordinaryLoss: [],
        incomeBeforeTax: 48000000,
        incomeTax: 12000000,
        netIncome: 36000000,
        depreciation: 8000000,
      }

      const response = await fetch('/api/analysis/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balanceSheet: mockBalanceSheet,
          profitLoss: mockProfitLoss,
          options: {
            depth: 'detailed',
            includeAlerts: true,
            includeRecommendations: true,
            includeBenchmark: true,
          },
          benchmarkOptions: {
            sector: 'manufacturing',
          },
        }),
        signal: abortControllerRef.current.signal,
      })

      const data = await response.json()

      if (data.success) {
        cacheRef.current.set(cacheKey, { data, timestamp: Date.now() })
      }

      setState({
        financialData: data,
        ratioData: null,
        benchmarkData: data.data?.benchmark ?? null,
        isLoading: false,
        error: data.success ? null : (data.error?.message ?? 'Unknown error'),
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [period])

  useEffect(() => {
    fetchData()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])

  const refetch = useCallback(() => {
    const cacheKey = `analysis_${period.fiscalYear}_${period.month}`
    cacheRef.current.delete(cacheKey)
    fetchData()
  }, [fetchData, period])

  return {
    ...state,
    refetch,
  }
}

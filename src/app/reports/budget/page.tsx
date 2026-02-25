'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { BudgetVsActualHorizontalChart } from '@/components/charts/BudgetVsActualChart'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface BudgetItem {
  accountCode: string
  accountName: string
  budgetAmount: number
  actualAmount: number
  variance: number
  achievementRate: number
}

interface BudgetVsActual {
  fiscalYear: number
  month: number
  items: BudgetItem[]
  totals: {
    revenue: { budget: number; actual: number; variance: number; rate: number }
    expenses: { budget: number; actual: number; variance: number; rate: number }
    operatingIncome: { budget: number; actual: number; variance: number; rate: number }
  }
}

interface VarianceItem {
  accountName: string
  budget: number
  actual: number
  variancePercent: number
  type: 'over' | 'under'
}

interface VarianceData {
  significantVariances: VarianceItem[]
}

export default function BudgetPage() {
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActual | null>(null)
  const [variance, setVariance] = useState<VarianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/reports/budget?action=variance&fiscalYear=${fiscalYear}&month=${month}`
      )
      const data = await res.json()
      setBudgetVsActual(data.budgetVsActual)
      setVariance(data.variance)
    } catch (error) {
      console.error('Failed to fetch budget:', error)
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData =
    budgetVsActual?.items.slice(0, 8).map((item) => ({
      name:
        item.accountName.length > 6 ? item.accountName.substring(0, 6) + '...' : item.accountName,
      budget: item.budgetAmount,
      actual: item.actualAmount,
      variance: item.variance,
    })) || []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse">
            <div className="mb-8 h-8 w-1/4 rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">予実管理</h1>
            <nav className="flex space-x-4">
              <Link href="/reports/monthly" className="text-gray-500 hover:text-gray-700">
                月次レポート
              </Link>
              <Link href="/reports/cashflow" className="text-gray-500 hover:text-gray-700">
                資金繰り表
              </Link>
              <Link href="/reports/budget" className="text-primary-600 font-medium">
                予実管理
              </Link>
              <Link href="/reports/kpi" className="text-gray-500 hover:text-gray-700">
                経営指標
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center space-x-4">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            className="focus:border-primary-500 focus:ring-primary-500 rounded-md border-gray-300 shadow-sm"
          >
            {[2022, 2023, 2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}年度
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="focus:border-primary-500 focus:ring-primary-500 rounded-md border-gray-300 shadow-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
          <a
            href="/api/reports/budget?action=template"
            className="bg-primary-600 hover:bg-primary-700 ml-auto inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white"
          >
            CSVテンプレート
          </a>
        </div>

        {budgetVsActual && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-2 text-sm font-medium text-gray-500">売上高</h3>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(budgetVsActual.totals.revenue.actual)}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      予算 {formatCurrency(budgetVsActual.totals.revenue.budget)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <div
                    className={`text-sm font-medium ${budgetVsActual.totals.revenue.rate >= 100 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    達成率 {formatPercent(budgetVsActual.totals.revenue.rate)}
                  </div>
                  <div className="ml-4 text-sm text-gray-500">
                    差異 {formatCurrency(budgetVsActual.totals.revenue.variance)}
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${budgetVsActual.totals.revenue.rate >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(budgetVsActual.totals.revenue.rate, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-2 text-sm font-medium text-gray-500">経費</h3>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(budgetVsActual.totals.expenses.actual)}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      予算 {formatCurrency(budgetVsActual.totals.expenses.budget)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <div
                    className={`text-sm font-medium ${budgetVsActual.totals.expenses.rate <= 100 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    使用率 {formatPercent(budgetVsActual.totals.expenses.rate)}
                  </div>
                  <div className="ml-4 text-sm text-gray-500">
                    差異 {formatCurrency(budgetVsActual.totals.expenses.variance)}
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${budgetVsActual.totals.expenses.rate <= 100 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(budgetVsActual.totals.expenses.rate, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-2 text-sm font-medium text-gray-500">営業利益</h3>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(budgetVsActual.totals.operatingIncome.actual)}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      予算 {formatCurrency(budgetVsActual.totals.operatingIncome.budget)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <div
                    className={`text-sm font-medium ${budgetVsActual.totals.operatingIncome.rate >= 100 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    達成率 {formatPercent(budgetVsActual.totals.operatingIncome.rate)}
                  </div>
                  <div className="ml-4 text-sm text-gray-500">
                    差異 {formatCurrency(budgetVsActual.totals.operatingIncome.variance)}
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${budgetVsActual.totals.operatingIncome.rate >= 100 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{
                      width: `${Math.min(Math.max(budgetVsActual.totals.operatingIncome.rate, 0), 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">予実対比グラフ</h3>
                <BudgetVsActualHorizontalChart data={chartData} height={300} />
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">重要差異分析</h3>
                {variance && variance.significantVariances.length > 0 ? (
                  <div className="space-y-3">
                    {variance.significantVariances.slice(0, 5).map((v, i) => (
                      <div
                        key={i}
                        className={`rounded-lg p-3 ${v.type === 'over' ? 'bg-green-50' : 'bg-red-50'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{v.accountName}</span>
                          <span
                            className={`text-sm font-bold ${v.type === 'over' ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {v.variancePercent > 0 ? '+' : ''}
                            {formatPercent(v.variancePercent)}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          予算: {formatCurrency(v.budget)} → 実績: {formatCurrency(v.actual)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">大きな差異はありません</div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-medium text-gray-900">予実管理表（詳細）</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        勘定科目
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        予算
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        実績
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        差異
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        達成率
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                        状態
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {budgetVsActual.items.map((item, index) => (
                      <tr key={index} className={index === 0 ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.accountName}</td>
                        <td className="px-6 py-4 text-right text-sm text-gray-600">
                          {formatCurrency(item.budgetAmount)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(item.actualAmount)}
                        </td>
                        <td
                          className={`px-6 py-4 text-right text-sm font-medium ${
                            item.variance >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {item.variance >= 0 ? '+' : ''}
                          {formatCurrency(item.variance)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          {formatPercent(item.achievementRate)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              item.achievementRate >= 100
                                ? 'bg-green-100 text-green-800'
                                : item.achievementRate >= 80
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.achievementRate >= 60
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.achievementRate >= 100
                              ? '達成'
                              : item.achievementRate >= 80
                                ? '良好'
                                : item.achievementRate >= 60
                                  ? '注意'
                                  : '要改善'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

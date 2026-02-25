'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart'
import { KPICard } from '@/components/charts/KPIGauge'
import type { MonthlyReport, MonthlyTrend } from '@/types'
import { formatCurrency, formatPercent, formatFiscalYear } from '@/lib/utils'

export default function MonthlyReportPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [trend, setTrend] = useState<MonthlyTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/monthly?fiscalYear=${fiscalYear}&month=${month}`)
      const data = await res.json()
      setReport(data.report)
      setTrend(data.trend || [])
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse">
            <div className="mb-8 h-8 w-1/4 rounded bg-gray-200"></div>
            <div className="mb-8 grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 rounded bg-gray-200"></div>
              ))}
            </div>
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
            <h1 className="text-2xl font-bold text-gray-900">月次決算資料</h1>
            <nav className="flex space-x-4">
              <Link href="/reports/monthly" className="text-primary-600 font-medium">
                月次レポート
              </Link>
              <Link href="/reports/cashflow" className="text-gray-500 hover:text-gray-700">
                資金繰り表
              </Link>
              <Link href="/reports/budget" className="text-gray-500 hover:text-gray-700">
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
        </div>

        {report && (
          <>
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {formatFiscalYear(fiscalYear, month)} - {report.companyName}
              </h2>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
              <KPICard
                title="売上高"
                value={report.profitLoss.revenue.reduce((s, r) => s + r.amount, 0)}
                unit="円"
                trend="up"
              />
              <KPICard
                title="営業利益"
                value={report.profitLoss.operatingIncome}
                unit="円"
                trend={report.profitLoss.operatingIncome > 0 ? 'up' : 'down'}
              />
              <KPICard
                title="当期純利益"
                value={report.profitLoss.netIncome}
                unit="円"
                trend={report.profitLoss.netIncome > 0 ? 'up' : 'down'}
              />
              <KPICard
                title="現金預金"
                value={report.balanceSheet.assets.current[0]?.amount || 0}
                unit="円"
              />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">貸借対照表（BS）</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 font-medium text-gray-700">資産の部</h4>
                    <table className="min-w-full">
                      <tbody>
                        {report.balanceSheet.assets.current.map((item) => (
                          <tr key={item.code} className="border-b">
                            <td className="py-2 text-sm text-gray-600">{item.name}</td>
                            <td className="py-2 text-right text-sm font-medium">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b bg-gray-50">
                          <td className="py-2 text-sm font-medium">流動資産合計</td>
                          <td className="py-2 text-right text-sm font-bold">
                            {formatCurrency(
                              report.balanceSheet.assets.current.reduce((s, a) => s + a.amount, 0)
                            )}
                          </td>
                        </tr>
                        {report.balanceSheet.assets.fixed.map((item) => (
                          <tr key={item.code} className="border-b">
                            <td className="py-2 text-sm text-gray-600">{item.name}</td>
                            <td className="py-2 text-right text-sm font-medium">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-primary-50">
                          <td className="text-primary-900 py-2 text-sm font-bold">資産合計</td>
                          <td className="text-primary-900 py-2 text-right text-sm font-bold">
                            {formatCurrency(report.balanceSheet.totalAssets)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="mb-2 font-medium text-gray-700">負債・純資産の部</h4>
                    <table className="min-w-full">
                      <tbody>
                        {report.balanceSheet.liabilities.current.map((item) => (
                          <tr key={item.code} className="border-b">
                            <td className="py-2 text-sm text-gray-600">{item.name}</td>
                            <td className="py-2 text-right text-sm font-medium">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b bg-gray-50">
                          <td className="py-2 text-sm font-medium">負債合計</td>
                          <td className="py-2 text-right text-sm font-bold">
                            {formatCurrency(report.balanceSheet.totalLiabilities)}
                          </td>
                        </tr>
                        {report.balanceSheet.equity.items.map((item) => (
                          <tr key={item.code} className="border-b">
                            <td className="py-2 text-sm text-gray-600">{item.name}</td>
                            <td className="py-2 text-right text-sm font-medium">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-primary-50">
                          <td className="text-primary-900 py-2 text-sm font-bold">純資産合計</td>
                          <td className="text-primary-900 py-2 text-right text-sm font-bold">
                            {formatCurrency(report.balanceSheet.totalEquity)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">損益計算書（PL）</h3>
                <table className="min-w-full">
                  <tbody>
                    {report.profitLoss.revenue.map((item) => (
                      <tr key={item.code} className="border-b">
                        <td className="py-2 text-sm text-gray-600">{item.name}</td>
                        <td className="py-2 text-right text-sm font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                    {report.profitLoss.costOfSales.map((item) => (
                      <tr key={item.code} className="border-b">
                        <td className="py-2 text-sm text-gray-600">△ {item.name}</td>
                        <td className="py-2 text-right text-sm font-medium text-red-600">
                          {formatCurrency(-item.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b bg-blue-50">
                      <td className="py-2 text-sm font-bold text-blue-900">売上総利益</td>
                      <td className="py-2 text-right text-sm font-bold text-blue-900">
                        {formatCurrency(report.profitLoss.grossProfit)}
                        <span className="ml-2 text-xs font-normal">
                          ({formatPercent(report.profitLoss.grossProfitMargin)})
                        </span>
                      </td>
                    </tr>
                    {report.profitLoss.sgaExpenses.slice(0, 5).map((item) => (
                      <tr key={item.code} className="border-b">
                        <td className="py-2 pl-4 text-sm text-gray-600">△ {item.name}</td>
                        <td className="py-2 text-right text-sm font-medium text-red-600">
                          {formatCurrency(-item.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b bg-green-50">
                      <td className="py-2 text-sm font-bold text-green-900">営業利益</td>
                      <td className="py-2 text-right text-sm font-bold text-green-900">
                        {formatCurrency(report.profitLoss.operatingIncome)}
                        <span className="ml-2 text-xs font-normal">
                          ({formatPercent(report.profitLoss.operatingMargin)})
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-purple-50">
                      <td className="py-2 text-sm font-bold text-purple-900">当期純利益</td>
                      <td className="py-2 text-right text-sm font-bold text-purple-900">
                        {formatCurrency(report.profitLoss.netIncome)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-8 rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-medium text-gray-900">月次推移</h3>
              <MonthlyTrendChart data={trend} height={350} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">キャッシュフロー計算書</h3>
                <table className="min-w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-sm font-medium">当期純利益</td>
                      <td className="py-2 text-right text-sm">
                        {formatCurrency(report.cashFlow.operatingActivities?.netIncome ?? 0)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4 text-sm text-gray-600">減価償却費</td>
                      <td className="py-2 text-right text-sm">
                        {formatCurrency(report.cashFlow.operatingActivities?.depreciation ?? 0)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4 text-sm text-gray-600">売掛金増減</td>
                      <td className="py-2 text-right text-sm">
                        {formatCurrency(
                          report.cashFlow.operatingActivities?.increaseInReceivables ?? 0
                        )}
                      </td>
                    </tr>
                    <tr className="border-b bg-blue-50">
                      <td className="py-2 text-sm font-bold text-blue-900">営業CF</td>
                      <td className="py-2 text-right text-sm font-bold text-blue-900">
                        {formatCurrency(
                          report.cashFlow.operatingActivities?.netCashFromOperating ??
                            report.cashFlow.operating?.netCashFromOperating ??
                            0
                        )}
                      </td>
                    </tr>
                    <tr className="border-b bg-orange-50">
                      <td className="py-2 text-sm font-bold text-orange-900">投資CF</td>
                      <td className="py-2 text-right text-sm font-bold text-orange-900">
                        {formatCurrency(
                          report.cashFlow.investingActivities?.netCashFromInvesting ??
                            report.cashFlow.investing?.netCashFromInvesting ??
                            0
                        )}
                      </td>
                    </tr>
                    <tr className="border-b bg-purple-50">
                      <td className="py-2 text-sm font-bold text-purple-900">財務CF</td>
                      <td className="py-2 text-right text-sm font-bold text-purple-900">
                        {formatCurrency(
                          report.cashFlow.financingActivities?.netCashFromFinancing ??
                            report.cashFlow.financing?.netCashFromFinancing ??
                            0
                        )}
                      </td>
                    </tr>
                    <tr className="bg-gray-100">
                      <td className="py-2 text-sm font-bold">現金増減</td>
                      <td className="py-2 text-right text-sm font-bold">
                        {formatCurrency(report.cashFlow.netChangeInCash)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">Runway分析</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div>
                      <div className="text-sm text-gray-500">月次Burn Rate</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(report.runway.monthlyBurnRate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Runway</div>
                      <div className="text-primary-600 text-2xl font-bold">
                        {report.runway.runwayMonths}ヶ月
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded bg-green-50 p-3 text-center">
                      <div className="text-xs text-green-600">楽観</div>
                      <div className="text-lg font-bold text-green-700">
                        {report.runway.scenarios.optimistic.runwayMonths}ヶ月
                      </div>
                    </div>
                    <div className="rounded bg-blue-50 p-3 text-center">
                      <div className="text-xs text-blue-600">現実</div>
                      <div className="text-lg font-bold text-blue-700">
                        {report.runway.scenarios.realistic.runwayMonths}ヶ月
                      </div>
                    </div>
                    <div className="rounded bg-red-50 p-3 text-center">
                      <div className="text-xs text-red-600">悲観</div>
                      <div className="text-lg font-bold text-red-700">
                        {report.runway.scenarios.pessimistic.runwayMonths}ヶ月
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

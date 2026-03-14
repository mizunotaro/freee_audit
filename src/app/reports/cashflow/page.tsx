'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CashFlowChart } from '@/components/charts/CashFlowChart'
import { formatCurrency } from '@/lib/utils'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type {
  CashFlowChartData as CashFlowData,
  CashFlowPosition,
  RunwayData,
  RunwayAlert,
  CashFlowStatementItem,
  CashOutForecast,
  MonthlyCashOutSummary,
} from '@/types/reports'

export default function CashflowPage() {
  const [cashFlows, setCashFlows] = useState<CashFlowStatementItem[]>([])
  const [cashPosition, setCashPosition] = useState<CashFlowPosition | null>(null)
  const [runway, setRunway] = useState<RunwayData | null>(null)
  const [alert, setAlert] = useState<RunwayAlert | null>(null)
  const [cashOutForecasts, setCashOutForecasts] = useState<CashOutForecast[]>([])
  const [monthlyCashOut, setMonthlyCashOut] = useState<MonthlyCashOutSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())

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

  const chartData: CashFlowData[] = cashFlows.map((cf, index) => {
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
            <h1 className="text-2xl font-bold text-gray-900">資金繰り表</h1>
            <nav className="flex space-x-4">
              <Link href="/reports/monthly" className="text-gray-500 hover:text-gray-700">
                月次レポート
              </Link>
              <Link href="/reports/cashflow" className="text-primary-600 font-medium">
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
        <div className="mb-6">
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
        </div>

        {runway && alert && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              alert.level === 'safe'
                ? 'border border-green-200 bg-green-50'
                : alert.level === 'warning'
                  ? 'border border-yellow-200 bg-yellow-50'
                  : 'border border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className={`font-medium ${
                    alert.level === 'safe'
                      ? 'text-green-800'
                      : alert.level === 'warning'
                        ? 'text-yellow-800'
                        : 'text-red-800'
                  }`}
                >
                  {alert.message}
                </h3>
                <p
                  className={`text-sm ${
                    alert.level === 'safe'
                      ? 'text-green-600'
                      : alert.level === 'warning'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {alert.recommendation}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Runway</div>
                <div className="text-3xl font-bold text-gray-900">{runway.runwayMonths}ヶ月</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-medium text-gray-900">キャッシュフロー推移</h3>
            <CashFlowChart data={chartData} height={300} />
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Runwayシナリオ分析</h3>
            {runway && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="mb-1 text-sm text-green-600">楽観シナリオ</div>
                    <div className="text-xl font-bold text-green-700">
                      {runway.scenarios.optimistic.runwayMonths}ヶ月
                    </div>
                    <div className="mt-1 text-xs text-green-500">
                      Burn: {formatCurrency(runway.scenarios.optimistic.burnRate)}/月
                    </div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4">
                    <div className="mb-1 text-sm text-blue-600">現実シナリオ</div>
                    <div className="text-xl font-bold text-blue-700">
                      {runway.scenarios.realistic.runwayMonths}ヶ月
                    </div>
                    <div className="mt-1 text-xs text-blue-500">
                      Burn: {formatCurrency(runway.scenarios.realistic.burnRate)}/月
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-4">
                    <div className="mb-1 text-sm text-red-600">悲観シナリオ</div>
                    <div className="text-xl font-bold text-red-700">
                      {runway.scenarios.pessimistic.runwayMonths}ヶ月
                    </div>
                    <div className="mt-1 text-xs text-red-500">
                      Burn: {formatCurrency(runway.scenarios.pessimistic.burnRate)}/月
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">現在のBurn Rate</span>
                    <span className="text-lg font-medium">
                      {formatCurrency(runway.monthlyBurnRate)}/月
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {cashPosition && (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900">月次資金繰り表</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      項目
                    </th>
                    {cashPosition.months.map((m) => (
                      <th
                        key={m.month}
                        className="px-4 py-3 text-right text-xs font-medium text-gray-500"
                      >
                        {m.month}月
                      </th>
                    ))}
                    <th className="bg-gray-100 px-4 py-3 text-right text-xs font-medium text-gray-500">
                      年間計
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  <tr className="bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">期首残高</td>
                    {cashPosition.months.map((m) => (
                      <td key={m.month} className="px-4 py-3 text-right text-sm">
                        {formatCurrency(m.beginningCash)}
                      </td>
                    ))}
                    <td className="bg-gray-100 px-4 py-3 text-right text-sm">-</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 text-sm font-medium text-blue-600">営業CF</td>
                    {cashPosition.months.map((m) => (
                      <td
                        key={m.month}
                        className={`px-4 py-3 text-right text-sm ${m.operatingNet >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatCurrency(m.operatingNet)}
                      </td>
                    ))}
                    <td
                      className={`bg-gray-100 px-4 py-3 text-right text-sm ${cashPosition.annualTotal.operatingNet >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(cashPosition.annualTotal.operatingNet)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 text-sm font-medium text-orange-600">投資CF</td>
                    {cashPosition.months.map((m) => (
                      <td
                        key={m.month}
                        className={`px-4 py-3 text-right text-sm ${m.investingNet >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatCurrency(m.investingNet)}
                      </td>
                    ))}
                    <td
                      className={`bg-gray-100 px-4 py-3 text-right text-sm ${cashPosition.annualTotal.investingNet >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(cashPosition.annualTotal.investingNet)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 text-sm font-medium text-purple-600">財務CF</td>
                    {cashPosition.months.map((m) => (
                      <td
                        key={m.month}
                        className={`px-4 py-3 text-right text-sm ${m.financingNet >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatCurrency(m.financingNet)}
                      </td>
                    ))}
                    <td
                      className={`bg-gray-100 px-4 py-3 text-right text-sm ${cashPosition.annualTotal.financingNet >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(cashPosition.annualTotal.financingNet)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-6 py-3 text-sm font-bold text-blue-900">収支差引残高</td>
                    {cashPosition.months.map((m) => (
                      <td
                        key={m.month}
                        className="px-4 py-3 text-right text-sm font-bold text-blue-900"
                      >
                        {formatCurrency(m.netChange)}
                      </td>
                    ))}
                    <td className="bg-blue-100 px-4 py-3 text-right text-sm font-bold text-blue-900">
                      {formatCurrency(cashPosition.annualTotal.netChange)}
                    </td>
                  </tr>
                  <tr className="bg-green-50">
                    <td className="px-6 py-3 text-sm font-bold text-green-900">期末残高</td>
                    {cashPosition.months.map((m) => (
                      <td
                        key={m.month}
                        className="px-4 py-3 text-right text-sm font-bold text-green-900"
                      >
                        {formatCurrency(m.endingCash)}
                      </td>
                    ))}
                    <td className="bg-green-100 px-4 py-3 text-right text-sm font-bold text-green-900">
                      {formatCurrency(
                        cashPosition.months[cashPosition.months.length - 1]?.endingCash || 0
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {monthlyCashOut.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900">
                将来キャッシュアウト予測（月次）
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                freeeから取得した未払債務に基づく支払予定
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      月
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      買掛金等
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      借入金
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      その他
                    </th>
                    <th className="bg-red-50 px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      合計
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {monthlyCashOut.map((m) => (
                    <tr key={m.month}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.month}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {formatCurrency(m.categories.payable)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {formatCurrency(m.categories.loan)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {formatCurrency(m.categories.other)}
                      </td>
                      <td className="bg-red-50/50 px-6 py-4 text-right text-sm font-semibold text-red-700">
                        {formatCurrency(m.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {cashOutForecasts.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900">今後の支払予定一覧</h3>
              <p className="mt-1 text-sm text-gray-500">直近の支払期限順に表示</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      支払期限
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      取引先
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      内容
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      金額
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      緊急度
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {cashOutForecasts.slice(0, 10).map((forecast, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(forecast.date).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {forecast.partnerName || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{forecast.description}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(forecast.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            forecast.urgency === 'high'
                              ? 'bg-red-100 text-red-800'
                              : forecast.urgency === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {forecast.urgency === 'high'
                            ? '要対応'
                            : forecast.urgency === 'medium'
                              ? '要注意'
                              : '通常'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

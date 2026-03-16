'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { KPIGauge, KPIBar, KPICard } from '@/components/charts/KPIGauge'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { KPIReportData } from '@/types/reports'

type KPIData = KPIReportData

export default function KPIPage() {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithTimeout(
        `/api/reports/kpi?fiscalYear=${fiscalYear}&month=${month}`,
        { timeout: 30000 }
      )
      const kpiData = await res.json()
      setData(kpiData)
    } catch (error) {
      console.error('Failed to fetch KPIs:', error)
      if (error instanceof FetchTimeoutError) {
        console.error('Request timed out')
      }
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
            <div className="grid grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 rounded bg-gray-200"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const kpis = data?.kpis
  const benchmarks = data?.benchmarks || []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">経営指標ダッシュボード</h1>
            <nav className="flex space-x-4">
              <Link href="/reports/monthly" className="text-gray-500 hover:text-gray-700">
                月次レポート
              </Link>
              <Link href="/reports/cashflow" className="text-gray-500 hover:text-gray-700">
                資金繰り表
              </Link>
              <Link href="/reports/budget" className="text-gray-500 hover:text-gray-700">
                予実管理
              </Link>
              <Link href="/reports/kpi" className="text-primary-600 font-medium">
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

        {kpis && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
              <KPICard
                title="ROE（自己資本利益率）"
                value={kpis.profitability.roe.toFixed(1)}
                unit="%"
                trend={
                  kpis.profitability.roe >= 10
                    ? 'up'
                    : kpis.profitability.roe >= 5
                      ? 'neutral'
                      : 'down'
                }
                description="目標: 10%以上"
              />
              <KPICard
                title="ROA（総資産利益率）"
                value={kpis.profitability.roa.toFixed(1)}
                unit="%"
                trend={
                  kpis.profitability.roa >= 5
                    ? 'up'
                    : kpis.profitability.roa >= 2
                      ? 'neutral'
                      : 'down'
                }
                description="目標: 5%以上"
              />
              <KPICard
                title="流動比率"
                value={kpis.safety.currentRatio.toFixed(0)}
                unit="%"
                trend={
                  kpis.safety.currentRatio >= 150
                    ? 'up'
                    : kpis.safety.currentRatio >= 100
                      ? 'neutral'
                      : 'down'
                }
                description="目標: 150%以上"
              />
              <KPICard
                title="自己資本比率"
                value={kpis.safety.equityRatio.toFixed(0)}
                unit="%"
                trend={
                  kpis.safety.equityRatio >= 30
                    ? 'up'
                    : kpis.safety.equityRatio >= 20
                      ? 'neutral'
                      : 'down'
                }
                description="目標: 30%以上"
              />
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-6 text-lg font-medium text-gray-900">収益性指標</h3>
                <div className="mb-6 grid grid-cols-3 gap-4">
                  <KPIGauge
                    value={kpis.profitability.roe}
                    target={10}
                    label="ROE"
                    unit="%"
                    size={140}
                  />
                  <KPIGauge
                    value={kpis.profitability.roa}
                    target={5}
                    label="ROA"
                    unit="%"
                    size={140}
                  />
                  <KPIGauge
                    value={kpis.profitability.ebitdaMargin}
                    target={15}
                    label="EBITDA"
                    unit="%"
                    size={140}
                  />
                </div>
                <div className="space-y-4">
                  <KPIBar
                    label="売上総利益率"
                    value={kpis.profitability.grossProfitMargin}
                    target={30}
                  />
                  <KPIBar
                    label="営業利益率"
                    value={kpis.profitability.operatingMargin}
                    target={10}
                  />
                  <KPIBar label="ROS" value={kpis.profitability.ros} target={10} />
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-6 text-lg font-medium text-gray-900">安全性指標</h3>
                <div className="mb-6 grid grid-cols-3 gap-4">
                  <KPIGauge
                    value={kpis.safety.currentRatio}
                    target={150}
                    label="流動比率"
                    unit="%"
                    size={140}
                  />
                  <KPIGauge
                    value={kpis.safety.quickRatio}
                    target={100}
                    label="当座比率"
                    unit="%"
                    size={140}
                  />
                  <KPIGauge
                    value={kpis.safety.equityRatio}
                    target={30}
                    label="自己資本比率"
                    unit="%"
                    size={140}
                  />
                </div>
                <div className="space-y-4">
                  <KPIBar
                    label="D/E比率（低いほど良い）"
                    value={kpis.safety.debtToEquity}
                    target={1}
                    unit=""
                  />
                </div>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">効率性指標</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">総資産回転率</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {kpis.efficiency.assetTurnover.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">回/年</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">棚卸資産回転率</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {kpis.efficiency.inventoryTurnover.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">回/年</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">売掛金回転率</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {kpis.efficiency.receivablesTurnover.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">回/年</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">買掛金回転率</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {kpis.efficiency.payablesTurnover.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">回/年</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">成長性・CF指標</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div>
                      <div className="text-sm text-gray-500">売上成長率</div>
                      <div
                        className={`text-xl font-bold ${kpis.growth.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {kpis.growth.revenueGrowth >= 0 ? '+' : ''}
                        {kpis.growth.revenueGrowth.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">利益成長率</div>
                      <div
                        className={`text-xl font-bold ${kpis.growth.profitGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {kpis.growth.profitGrowth >= 0 ? '+' : ''}
                        {kpis.growth.profitGrowth.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                    <div>
                      <div className="text-sm text-blue-600">FCF（自由キャッシュフロー）</div>
                      <div
                        className={`text-xl font-bold ${kpis.cashFlow.fcf >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        ¥{kpis.cashFlow.fcf.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-blue-600">FCFマージン</div>
                      <div
                        className={`text-xl font-bold ${kpis.cashFlow.fcfMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {kpis.cashFlow.fcfMargin.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-medium text-gray-900">KPIベンチマーク</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        KPI
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        実績値
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        目標値
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                        状態
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        説明
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {benchmarks.map((b, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{b.kpi}</td>
                        <td className="px-6 py-4 text-right text-sm">
                          {typeof b.value === 'number' ? b.value.toFixed(1) : b.value}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500">
                          {b.benchmark}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              b.status === 'good'
                                ? 'bg-green-100 text-green-800'
                                : b.status === 'warning'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {b.status === 'good'
                              ? '良好'
                              : b.status === 'warning'
                                ? '注意'
                                : '要改善'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{b.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {kpis.startup && (
              <div className="mt-8 rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">
                  スタートアップ企業向け指標
                </h3>
                <div className="mb-4 text-sm text-gray-500">
                  投資家や創業期企業が重視する成長・効率指標
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-lg bg-purple-50 p-4">
                    <div className="text-sm text-purple-600">Burn Rate</div>
                    <div className="text-2xl font-bold text-purple-700">
                      ¥{kpis.startup.burnRate.toLocaleString()}/月
                    </div>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4">
                    <div className="text-sm text-purple-600">Runway</div>
                    <div
                      className={`text-2xl font-bold ${kpis.startup.runwayMonths >= 12 ? 'text-green-600' : kpis.startup.runwayMonths >= 6 ? 'text-yellow-600' : 'text-red-600'}`}
                    >
                      {kpis.startup.runwayMonths}ヶ月
                    </div>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4">
                    <div className="text-sm text-purple-600">MRR</div>
                    <div className="text-2xl font-bold text-purple-700">
                      ¥{kpis.startup.mrr.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4">
                    <div className="text-sm text-purple-600">ARR</div>
                    <div className="text-2xl font-bold text-purple-700">
                      ¥{kpis.startup.arr.toLocaleString()}
                    </div>
                  </div>
                </div>
                {kpis.startup.cac !== null && (
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="text-sm text-gray-600">CAC（顧客獲得単価）</div>
                      <div className="text-xl font-bold text-gray-900">
                        ¥{kpis.startup.cac.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="text-sm text-gray-600">LTV（顧客生涯価値）</div>
                      <div className="text-xl font-bold text-gray-900">
                        {kpis.startup.ltv ? `¥${kpis.startup.ltv.toLocaleString()}` : '-'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="text-sm text-gray-600">LTV/CAC比率</div>
                      <div
                        className={`text-xl font-bold ${kpis.startup.ltvCacRatio && kpis.startup.ltvCacRatio >= 3 ? 'text-green-600' : 'text-yellow-600'}`}
                      >
                        {kpis.startup.ltvCacRatio ? kpis.startup.ltvCacRatio.toFixed(1) : '-'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {kpis.vc && (
              <div className="mt-8 rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">VC/CVC投資家視点指標</h3>
                <div className="mb-4 text-sm text-gray-500">
                  ベンチャーキャピタル・CVCが評価する成長性指標
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <div className="text-sm text-blue-600">成長率（YoY）</div>
                    <div
                      className={`text-2xl font-bold ${kpis.vc.growthRate >= 20 ? 'text-green-600' : 'text-gray-900'}`}
                    >
                      {kpis.vc.growthRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4">
                    <div className="text-sm text-blue-600">粗利益率</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {kpis.vc.grossMargin.toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4">
                    <div className="text-sm text-blue-600">Rule of 40</div>
                    <div
                      className={`text-2xl font-bold ${kpis.vc.ruleOf40 >= 40 ? 'text-green-600' : 'text-yellow-600'}`}
                    >
                      {kpis.vc.ruleOf40.toFixed(1)}
                    </div>
                  </div>
                  {kpis.vc.revenueMultiple !== null && (
                    <div className="rounded-lg bg-blue-50 p-4">
                      <div className="text-sm text-blue-600">Revenue Multiple</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {kpis.vc.revenueMultiple.toFixed(1)}x
                      </div>
                    </div>
                  )}
                </div>
                {kpis.vc.magicNumber !== null && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-600">Magic Number（SaaS効率性指標）</div>
                    <div className="flex items-baseline">
                      <span
                        className={`text-xl font-bold ${kpis.vc.magicNumber >= 0.75 ? 'text-green-600' : 'text-yellow-600'}`}
                      >
                        {kpis.vc.magicNumber.toFixed(2)}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        {kpis.vc.magicNumber >= 0.75
                          ? '（効率的: 拡大投資可能）'
                          : kpis.vc.magicNumber >= 0.5
                            ? '（改善余地あり）'
                            : '（非効率: モデル見直し必要）'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {kpis.bank && (
              <div className="mt-8 rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">銀行融資視点指標</h3>
                <div className="mb-4 text-sm text-gray-500">
                  金融機関が融資審査で重視する信用評価指標
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="text-sm text-green-600">DSCR（債務償還カバー比率）</div>
                    <div
                      className={`text-2xl font-bold ${kpis.bank.dscr >= 1.2 ? 'text-green-700' : 'text-red-600'}`}
                    >
                      {kpis.bank.dscr.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">目標: 1.2以上</div>
                  </div>
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="text-sm text-green-600">利息カバレッジ比率</div>
                    <div
                      className={`text-2xl font-bold ${kpis.bank.interestCoverageRatio >= 3 ? 'text-green-700' : 'text-yellow-600'}`}
                    >
                      {kpis.bank.interestCoverageRatio.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">目標: 3以上</div>
                  </div>
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="text-sm text-green-600">D/E比率</div>
                    <div
                      className={`text-2xl font-bold ${kpis.bank.debtToEquityRatio <= 1 ? 'text-green-700' : 'text-yellow-600'}`}
                    >
                      {kpis.bank.debtToEquityRatio.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">目標: 1以下</div>
                  </div>
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="text-sm text-green-600">借入金依存度</div>
                    <div
                      className={`text-2xl font-bold ${kpis.bank.debtServiceRatio <= 50 ? 'text-green-700' : 'text-yellow-600'}`}
                    >
                      {kpis.bank.debtServiceRatio.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">目標: 50%以下</div>
                  </div>
                </div>
              </div>
            )}

            {data?.advice && data.advice.length > 0 && (
              <div className="mt-8 rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">コントロールアドバイス</h3>
                <div className="mb-4 text-sm text-gray-500">
                  現在のKPIに基づく改善提案とアクションプラン
                </div>
                <div className="space-y-4">
                  {data.advice.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-4 ${
                        item.status === 'critical'
                          ? 'border-red-200 bg-red-50'
                          : item.status === 'warning'
                            ? 'border-yellow-200 bg-yellow-50'
                            : 'border-green-200 bg-green-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                item.category === 'startup'
                                  ? 'bg-purple-100 text-purple-800'
                                  : item.category === 'vc'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.category === 'bank'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.category === 'startup'
                                ? 'スタートアップ'
                                : item.category === 'vc'
                                  ? 'VC視点'
                                  : item.category === 'bank'
                                    ? '銀行視点'
                                    : '一般'}
                            </span>
                            <span className="font-medium text-gray-900">{item.kpiName}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{item.advice}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">現在値</div>
                          <div className="font-bold text-gray-900">
                            {typeof item.currentValue === 'number'
                              ? item.currentValue.toFixed(1)
                              : item.currentValue}
                          </div>
                          <div className="text-xs text-gray-500">目標: {item.targetValue}</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-500">推奨アクション:</div>
                        <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
                          {item.actionItems.map((action, actionIdx) => (
                            <li key={actionIdx}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

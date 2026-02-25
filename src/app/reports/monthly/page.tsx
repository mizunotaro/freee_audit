'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart'
import { KPICard } from '@/components/charts/KPIGauge'
import { MultiMonthReportTable } from '@/components/reports/templates/monthly-report-template'
import type { MultiMonthReport, MonthlyTrend } from '@/types'
import { formatFiscalYear } from '@/lib/utils'

export default function MonthlyReportPage() {
  const [report, setReport] = useState<MultiMonthReport | null>(null)
  const [trend, setTrend] = useState<MonthlyTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1)
  const [monthCount, setMonthCount] = useState<3 | 6 | 12>(3)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/reports/monthly?fiscalYear=${fiscalYear}&endMonth=${endMonth}&monthCount=${monthCount}`
      )
      const data = await res.json()
      setReport(data.report)
      setTrend(data.trend || [])
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, endMonth, monthCount])

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

  const currentPL = report?.sections.find((s) => s.type === 'pl')
  const netIncomeRow = currentPL?.rows.find((r) => r.name === '当期純利益')
  const operatingIncomeRow = currentPL?.rows.find((r) => r.name === '営業利益')
  const revenueRow = currentPL?.rows.find((r) => r.name === '売上高計')

  const bsSection = report?.sections.find((s) => s.type === 'bs')
  const cashRow = bsSection?.rows.find((r) => r.name === '現金及び預金')

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
        <div className="mb-6 flex flex-wrap items-center gap-4">
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
            value={endMonth}
            onChange={(e) => setEndMonth(parseInt(e.target.value))}
            className="focus:border-primary-500 focus:ring-primary-500 rounded-md border-gray-300 shadow-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {m}月まで
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-300 bg-white p-1">
            {([3, 6, 12] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMonthCount(m)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  monthCount === m ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {m}ヶ月
              </button>
            ))}
          </div>
        </div>

        {report && (
          <>
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {formatFiscalYear(fiscalYear, endMonth)} ({monthCount}ヶ月) - {report.companyName}
              </h2>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
              <KPICard title="売上高" value={revenueRow?.total ?? 0} unit="円" trend="up" />
              <KPICard
                title="営業利益"
                value={operatingIncomeRow?.total ?? 0}
                unit="円"
                trend={(operatingIncomeRow?.total ?? 0) > 0 ? 'up' : 'down'}
              />
              <KPICard
                title="当期純利益"
                value={netIncomeRow?.total ?? 0}
                unit="円"
                trend={(netIncomeRow?.total ?? 0) > 0 ? 'up' : 'down'}
              />
              <KPICard
                title="現金預金"
                value={cashRow?.values[cashRow.values.length - 1] ?? 0}
                unit="円"
              />
            </div>

            <div className="mb-8">
              <MultiMonthReportTable report={report} />
            </div>

            <div className="mb-8 rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-medium text-gray-900">月次推移</h3>
              <MonthlyTrendChart data={trend} height={350} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

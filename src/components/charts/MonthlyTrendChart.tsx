'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyTrend } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { ChartState } from '@/components/charts/chart-state'
import { resolveChartStatus } from '@/components/charts/resolve-chart-status'

interface MonthlyTrendChartProps {
  data: MonthlyTrend[]
  height?: number
  loading?: boolean
  error?: string | null
}

export function MonthlyTrendChart({
  data,
  height = 400,
  loading = false,
  error = null,
}: MonthlyTrendChartProps) {
  const resolution = resolveChartStatus({
    loading,
    error: error ?? null,
    dataLength: data.length,
  })
  if (resolution.success && resolution.data !== 'ready') {
    return <ChartState status={resolution.data} error={error ?? undefined} />
  }
  if (!resolution.success) {
    return <ChartState status="error" error={error ?? undefined} />
  }

  const formattedData = data.map((item) => ({
    ...item,
    revenueFormatted: formatCurrency(item.revenue),
    grossProfitFormatted: formatCurrency(item.grossProfit),
    operatingIncomeFormatted: formatCurrency(item.operatingIncome),
    netIncomeFormatted: formatCurrency(item.netIncome),
  }))

  const summary = formattedData
    .slice(0, 6)
    .map((item) => `${item.month}: 売上 ${formatCurrency(item.revenue)}`)
    .join(' / ')

  return (
    <div role="img" aria-label={`月次トレンドチャート: ${summary}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
          <YAxis
            tickFormatter={(value) => `¥${(value / 1000000).toFixed(0)}M`}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            name="売上高"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="grossProfit"
            name="売上総利益"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="operatingIncome"
            name="営業利益"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="netIncome"
            name="当期純利益"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { ChartState } from '@/components/charts/chart-state'
import { resolveChartStatus } from '@/components/charts/resolve-chart-status'

interface BudgetVsActualData {
  name: string
  budget: number
  actual: number
  variance: number
}

interface BudgetVsActualChartProps {
  data: BudgetVsActualData[]
  height?: number
  showVariance?: boolean
  loading?: boolean
  error?: string | null
}

export function BudgetVsActualChart({
  data,
  height = 400,
  showVariance = true,
  loading = false,
  error = null,
}: BudgetVsActualChartProps) {
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
    budgetFormatted: formatCurrency(item.budget),
    actualFormatted: formatCurrency(item.actual),
    varianceFormatted: formatCurrency(item.variance),
    achievementRate: item.budget > 0 ? (item.actual / item.budget) * 100 : 0,
  }))

  const summary = formattedData
    .slice(0, 5)
    .map(
      (item) =>
        `${item.name}: 予算 ${formatCurrency(item.budget)}, 実績 ${formatCurrency(item.actual)}`
    )
    .join(' / ')

  return (
    <div role="img" aria-label={`予算対実績チャート: ${summary}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={formattedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          layout="vertical"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            type="number"
            tickFormatter={(value) => `¥${(value / 1000000).toFixed(0)}M`}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            stroke="#6b7280"
            width={100}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === '達成率') return formatPercent(value)
              return formatCurrency(value)
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <ReferenceLine x={0} stroke="#374151" />
          <Bar dataKey="budget" name="予算" fill="#93c5fd" radius={[0, 4, 4, 0]} />
          <Bar dataKey="actual" name="実績" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          {showVariance && (
            <Bar dataKey="variance" name="差異" fill="#6366f1" radius={[0, 4, 4, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface BudgetVsActualHorizontalChartProps {
  data: BudgetVsActualData[]
  height?: number
  loading?: boolean
  error?: string | null
}

export function BudgetVsActualHorizontalChart({
  data,
  height = 400,
  loading = false,
  error = null,
}: BudgetVsActualHorizontalChartProps) {
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
    budgetFormatted: formatCurrency(item.budget),
    actualFormatted: formatCurrency(item.actual),
    varianceFormatted: formatCurrency(item.variance),
    achievementRate: item.budget > 0 ? (item.actual / item.budget) * 100 : 0,
  }))

  const summary = formattedData
    .slice(0, 5)
    .map(
      (item) =>
        `${item.name}: 予算 ${formatCurrency(item.budget)}, 実績 ${formatCurrency(item.actual)}`
    )
    .join(' / ')

  return (
    <div role="img" aria-label={`予算対実績チャート: ${summary}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            stroke="#6b7280"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tickFormatter={(value) => `¥${(value / 1000000).toFixed(0)}M`}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === '達成率') return formatPercent(value)
              return formatCurrency(value)
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#374151" />
          <Bar dataKey="budget" name="予算" fill="#93c5fd" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="実績" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

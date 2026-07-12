'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { ChartState } from '@/components/charts/chart-state'
import { resolveChartStatus } from '@/components/charts/resolve-chart-status'

interface CashFlowData {
  month: string
  operating: number
  investing: number
  financing: number
  netCash: number
  cumulative: number
}

interface CashFlowChartProps {
  data: CashFlowData[]
  height?: number
  showCumulative?: boolean
  loading?: boolean
  error?: string | null
}

export function CashFlowChart({
  data,
  height = 400,
  showCumulative = true,
  loading = false,
  error = null,
}: CashFlowChartProps) {
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
    operatingFormatted: formatCurrency(item.operating),
    investingFormatted: formatCurrency(item.investing),
    financingFormatted: formatCurrency(item.financing),
    netCashFormatted: formatCurrency(item.netCash),
    cumulativeFormatted: formatCurrency(item.cumulative),
  }))

  const summary = formattedData
    .slice(0, 6)
    .map((item) => `${item.month}: 純CF ${formatCurrency(item.netCash)}`)
    .join(' / ')

  return (
    <div role="img" aria-label={`キャッシュフローチャート: ${summary}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
          <YAxis
            yAxisId="left"
            tickFormatter={(value) => `¥${(value / 1000000).toFixed(0)}M`}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          {showCumulative && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(value) => `¥${(value / 1000000).toFixed(0)}M`}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
          )}
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <ReferenceLine yAxisId="left" y={0} stroke="#374151" />
          <Bar
            yAxisId="left"
            dataKey="operating"
            name="営業CF"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            stackId="cf"
          />
          <Bar
            yAxisId="left"
            dataKey="investing"
            name="投資CF"
            fill="#f59e0b"
            radius={[4, 4, 0, 0]}
            stackId="cf"
          />
          <Bar
            yAxisId="left"
            dataKey="financing"
            name="財務CF"
            fill="#8b5cf6"
            radius={[4, 4, 0, 0]}
            stackId="cf"
          />
          {showCumulative && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative"
              name="累積現金"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', strokeWidth: 2 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

interface CashFlowWaterfallChartProps {
  data: {
    name: string
    value: number
    type: 'positive' | 'negative' | 'total'
  }[]
  height?: number
  loading?: boolean
  error?: string | null
}

export function CashFlowWaterfallChart({
  data,
  height = 400,
  loading = false,
  error = null,
}: CashFlowWaterfallChartProps) {
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

  let cumulative = 0
  const processedData = data.map((item) => {
    const start = cumulative
    const end = cumulative + item.value
    cumulative = end

    return {
      ...item,
      start,
      end,
      color: item.type === 'total' ? '#374151' : item.value >= 0 ? '#10b981' : '#ef4444',
    }
  })

  const summary = processedData
    .slice(0, 6)
    .map((item) => `${item.name}: ${formatCurrency(item.value)}`)
    .join(' / ')

  return (
    <div role="img" aria-label={`キャッシュフローの増減（ウォーターフォール）: ${summary}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            tickFormatter={(value) => `¥${(value / 1000000).toFixed(0)}M`}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            width={100}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Bar
            dataKey="value"
            fill="#6366f1"
            radius={[0, 4, 4, 0]}
            background={{ fill: '#f3f4f6' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

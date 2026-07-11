'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { ChartState } from '@/components/charts/chart-state'
import { resolveChartStatus } from '@/components/charts/resolve-chart-status'
import type { VarianceBridge } from '@/types/reports/managerial'

interface VarianceBridgeChartProps {
  bridge: VarianceBridge | null
  height?: number
  loading?: boolean
  error?: string | null
}

interface BridgeRow {
  name: string
  base: number
  value: number
  signed: number
  kind: 'total' | 'up' | 'down'
}

const COLOR_TOTAL = '#3b82f6'
const COLOR_UP = '#10b981'
const COLOR_DOWN = '#ef4444'

function buildRows(bridge: VarianceBridge): BridgeRow[] {
  const rows: BridgeRow[] = []

  const pushTotal = (name: string, total: number) => {
    if (total >= 0) {
      rows.push({ name, base: 0, value: total, signed: total, kind: 'total' })
    } else {
      rows.push({ name, base: total, value: -total, signed: total, kind: 'total' })
    }
  }

  pushTotal(bridge.startLabel, bridge.start)

  let cumulative = bridge.start
  for (const driver of bridge.drivers) {
    const base = driver.amount >= 0 ? cumulative : cumulative + driver.amount
    rows.push({
      name: driver.label,
      base,
      value: Math.abs(driver.amount),
      signed: driver.amount,
      kind: driver.amount >= 0 ? 'up' : 'down',
    })
    cumulative += driver.amount
  }

  pushTotal(bridge.endLabel, bridge.end)
  return rows
}

function colorFor(kind: BridgeRow['kind']): string {
  if (kind === 'total') return COLOR_TOTAL
  if (kind === 'up') return COLOR_UP
  return COLOR_DOWN
}

interface BridgeTooltipProps {
  active?: boolean
  payload?: Array<{ payload?: BridgeRow }>
}

function BridgeTooltip({ active, payload }: BridgeTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-sm">
      <div className="font-medium text-gray-900">{row.name}</div>
      <div className={row.signed >= 0 ? 'text-green-600' : 'text-red-600'}>
        {row.signed >= 0 ? '+' : ''}
        {formatCurrency(row.signed)}
      </div>
    </div>
  )
}

export function VarianceBridgeChart({
  bridge,
  height = 400,
  loading = false,
  error = null,
}: VarianceBridgeChartProps) {
  const resolution = resolveChartStatus({
    loading,
    error: error ?? null,
    dataLength: bridge ? Math.max(bridge.drivers.length, 1) : 0,
  })
  if (resolution.success && resolution.data !== 'ready') {
    return <ChartState status={resolution.data} error={error ?? undefined} />
  }
  if (!resolution.success) {
    return <ChartState status="error" error={error ?? undefined} />
  }

  const rows = buildRows(bridge as VarianceBridge)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} vertical={true} />
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
          width={110}
        />
        <Tooltip content={<BridgeTooltip />} />
        <Bar dataKey="base" stackId="bridge" fill="transparent" />
        <Bar dataKey="value" stackId="bridge" radius={[0, 4, 4, 0]}>
          {rows.map((row, index) => (
            <Cell key={`cell-${index}`} fill={colorFor(row.kind)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

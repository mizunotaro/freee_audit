'use client'

import {
  ComposedChart,
  Area,
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
import type { RunwayData } from '@/types/reports'

interface RunwayScenarioChartProps {
  runway: RunwayData | null
  /** 開始月の現金残高（シナリオ投影の出発点） */
  currentCash: number
  height?: number
  loading?: boolean
  error?: string | null
}

interface ScenarioPoint {
  month: string
  band: [number, number]
  realistic: number
  optimistic: number
  pessimistic: number
}

const HORIZON_CAP = 36

/**
 * 3シナリオの Runway を月次の現金残高バンドとして可視化する。
 *
 * 各月の残高 = currentCash − burnRate × 月数（0未満は切捨て）。
 * バンド = [悲観, 楽観] の範囲塗り、現実シナリオを基準線として描画。
 * burnRate・runwayMonths は API（/api/reports/cashflow）から取得済みで、
 * 本コンポーネントは表示用の線形投影（チャート力学）のみを行い、財務計算式は保持しない。
 */
function buildPoints(runway: RunwayData, currentCash: number): ScenarioPoint[] {
  const { optimistic, realistic, pessimistic } = runway.scenarios
  const horizon = Math.min(
    Math.max(optimistic.runwayMonths, realistic.runwayMonths, pessimistic.runwayMonths, 1),
    HORIZON_CAP
  )

  return Array.from({ length: horizon + 1 }, (_, m): ScenarioPoint => {
    const opt = Math.max(0, currentCash - optimistic.burnRate * m)
    const real = Math.max(0, currentCash - realistic.burnRate * m)
    const pess = Math.max(0, currentCash - pessimistic.burnRate * m)
    return {
      month: `${m}ヶ月目`,
      band: [Math.min(opt, pess), Math.max(opt, pess)],
      realistic: real,
      optimistic: opt,
      pessimistic: pess,
    }
  })
}

export function RunwayScenarioChart({
  runway,
  currentCash,
  height = 400,
  loading = false,
  error = null,
}: RunwayScenarioChartProps) {
  const resolution = resolveChartStatus({
    loading,
    error: error ?? null,
    dataLength: runway ? 1 : 0,
  })
  if (resolution.success && resolution.data !== 'ready') {
    return <ChartState status={resolution.data} error={error ?? undefined} />
  }
  if (!resolution.success) {
    return <ChartState status="error" error={error ?? undefined} />
  }

  const points = buildPoints(runway as RunwayData, currentCash)
  const scenarios = (runway as RunwayData).scenarios
  const summary = `楽観 ${scenarios.optimistic.runwayMonths}ヶ月, 現実 ${scenarios.realistic.runwayMonths}ヶ月, 悲観 ${scenarios.pessimistic.runwayMonths}ヶ月`

  return (
    <div role="img" aria-label={`ランウェイシナリオ予測: ${summary}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#6b7280" />
          <YAxis
            tickFormatter={(value) => `¥${(value / 1000000).toFixed(0)}M`}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <Tooltip
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                return [
                  `${formatCurrency(Number(value[0]))} – ${formatCurrency(Number(value[1]))}`,
                  name,
                ]
              }
              return [formatCurrency(Number(value)), name]
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
          <Area dataKey="band" name="予測レンジ" stroke="#93c5fd" fill="#dbeafe" strokeWidth={0} />
          <Line
            dataKey="realistic"
            name="現実シナリオ"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

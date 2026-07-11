'use client'

import { KPICard } from '@/components/charts/KPIGauge'
import { ChartState } from '@/components/charts/chart-state'
import { resolveChartStatus } from '@/components/charts/resolve-chart-status'
import type { ManagerialMetrics } from '@/types/reports/managerial'

interface ManagerialAccountingCardsProps {
  metrics: ManagerialMetrics | null
  loading?: boolean
  error?: string | null
}

const NOT_AVAILABLE = '算出不可'

export function ManagerialAccountingCards({
  metrics,
  loading = false,
  error = null,
}: ManagerialAccountingCardsProps) {
  const resolution = resolveChartStatus({
    loading,
    error: error ?? null,
    dataLength: metrics ? 1 : 0,
  })
  if (resolution.success && resolution.data !== 'ready') {
    return <ChartState status={resolution.data} error={error ?? undefined} />
  }
  if (!resolution.success) {
    return <ChartState status="error" error={error ?? undefined} />
  }

  const m = metrics as ManagerialMetrics

  const breakEvenValue: number | string =
    m.breakEvenSales === null ? NOT_AVAILABLE : m.breakEvenSales
  const breakEvenUnit = m.breakEvenSales === null ? '' : '円'
  const safetyRatioValue: number | string =
    m.marginOfSafetyRatio === null ? NOT_AVAILABLE : m.marginOfSafetyRatio
  const safetyRatioUnit = m.marginOfSafetyRatio === null ? '' : '%'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KPICard title="売上高" value={m.revenue} unit="円" />
      <KPICard
        title="変動費"
        value={m.variableCosts}
        unit="円"
        description="売上原価を変動費とみなす"
      />
      <KPICard
        title="固定費"
        value={m.fixedCosts}
        unit="円"
        description="販売管理費を固定費とみなす"
      />
      <KPICard
        title="限界利益"
        value={m.contributionMargin}
        unit="円"
        description="売上高 − 変動費"
      />
      <KPICard title="限界利益率" value={m.contributionMarginRatio} unit="%" />
      <KPICard
        title="損益分岐点売上高"
        value={breakEvenValue}
        unit={breakEvenUnit}
        description="固定費 ÷ 限界利益率"
      />
      <KPICard title="安全余裕率" value={safetyRatioValue} unit={safetyRatioUnit} />
      <KPICard
        title="営業利益"
        value={m.operatingIncome}
        unit="円"
        description="限界利益 − 固定費"
      />
    </div>
  )
}

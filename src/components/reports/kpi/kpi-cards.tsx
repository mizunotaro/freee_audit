'use client'

import { KPICard } from '@/components/charts/KPIGauge'
import type { KPIProfitability, KPISafety } from '@/types/reports/kpi'

interface KPICardsProps {
  profitability: KPIProfitability
  safety: KPISafety
}

export function KPICards({ profitability, safety }: KPICardsProps) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
      <KPICard
        title="ROE（自己資本利益率）"
        value={profitability.roe.toFixed(1)}
        unit="%"
        trend={profitability.roe >= 10 ? 'up' : profitability.roe >= 5 ? 'neutral' : 'down'}
        description="目標: 10%以上"
      />
      <KPICard
        title="ROA（総資産利益率）"
        value={profitability.roa.toFixed(1)}
        unit="%"
        trend={profitability.roa >= 5 ? 'up' : profitability.roa >= 2 ? 'neutral' : 'down'}
        description="目標: 5%以上"
      />
      <KPICard
        title="流動比率"
        value={safety.currentRatio.toFixed(0)}
        unit="%"
        trend={safety.currentRatio >= 150 ? 'up' : safety.currentRatio >= 100 ? 'neutral' : 'down'}
        description="目標: 150%以上"
      />
      <KPICard
        title="自己資本比率"
        value={safety.equityRatio.toFixed(0)}
        unit="%"
        trend={safety.equityRatio >= 30 ? 'up' : safety.equityRatio >= 20 ? 'neutral' : 'down'}
        description="目標: 30%以上"
      />
    </div>
  )
}

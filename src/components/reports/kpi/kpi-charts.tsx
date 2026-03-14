'use client'

import { KPIGauge, KPIBar } from '@/components/charts/KPIGauge'
import type {
  KPIProfitability,
  KPIEfficiency,
  KPISafety,
  KPIGrowth,
  KPICashFlow,
} from '@/types/reports/kpi'

interface KPIChartsProps {
  profitability: KPIProfitability
  efficiency: KPIEfficiency
  safety: KPISafety
  growth: KPIGrowth
  cashFlow: KPICashFlow
}

export function KPICharts({ profitability, efficiency, safety, growth, cashFlow }: KPIChartsProps) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-6 text-lg font-medium text-gray-900">収益性指標</h3>
        <div className="mb-6 grid grid-cols-3 gap-4">
          <KPIGauge value={profitability.roe} target={10} label="ROE" unit="%" size={140} />
          <KPIGauge value={profitability.roa} target={5} label="ROA" unit="%" size={140} />
          <KPIGauge
            value={profitability.ebitdaMargin}
            target={15}
            label="EBITDA"
            unit="%"
            size={140}
          />
        </div>
        <div className="space-y-4">
          <KPIBar label="売上総利益率" value={profitability.grossProfitMargin} target={30} />
          <KPIBar label="営業利益率" value={profitability.operatingMargin} target={10} />
          <KPIBar label="ROS" value={profitability.ros} target={10} />
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-6 text-lg font-medium text-gray-900">安全性指標</h3>
        <div className="mb-6 grid grid-cols-3 gap-4">
          <KPIGauge value={safety.currentRatio} target={150} label="流動比率" unit="%" size={140} />
          <KPIGauge value={safety.quickRatio} target={100} label="当座比率" unit="%" size={140} />
          <KPIGauge
            value={safety.equityRatio}
            target={30}
            label="自己資本比率"
            unit="%"
            size={140}
          />
        </div>
        <div className="space-y-4">
          <KPIBar label="D/E比率（低いほど良い）" value={safety.debtToEquity} target={1} unit="" />
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-medium text-gray-900">効率性指標</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-500">総資産回転率</div>
            <div className="text-2xl font-bold text-gray-900">
              {efficiency.assetTurnover.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">回/年</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-500">棚卸資産回転率</div>
            <div className="text-2xl font-bold text-gray-900">
              {efficiency.inventoryTurnover.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">回/年</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-500">売掛金回転率</div>
            <div className="text-2xl font-bold text-gray-900">
              {efficiency.receivablesTurnover.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">回/年</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-500">買掛金回転率</div>
            <div className="text-2xl font-bold text-gray-900">
              {efficiency.payablesTurnover.toFixed(2)}
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
                className={`text-xl font-bold ${growth.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {growth.revenueGrowth >= 0 ? '+' : ''}
                {growth.revenueGrowth.toFixed(1)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">利益成長率</div>
              <div
                className={`text-xl font-bold ${growth.profitGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {growth.profitGrowth >= 0 ? '+' : ''}
                {growth.profitGrowth.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
            <div>
              <div className="text-sm text-blue-600">FCF（自由キャッシュフロー）</div>
              <div
                className={`text-xl font-bold ${cashFlow.fcf >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                ¥{cashFlow.fcf.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-600">FCFマージン</div>
              <div
                className={`text-xl font-bold ${cashFlow.fcfMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {cashFlow.fcfMargin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { TrendData } from '@/types/reports'

interface TrendChartsProps {
  readonly data: { categoryAnalyses: readonly TrendData[] } | undefined
  readonly isLoading?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  liquidity: '#3b82f6',
  safety: '#8b5cf6',
  profitability: '#10b981',
  efficiency: '#f59e0b',
  growth: '#ef4444',
}

const CATEGORY_NAMES: Record<string, string> = {
  liquidity: '流動性',
  safety: '安全性',
  profitability: '収益性',
  efficiency: '効率性',
  growth: '成長性',
}

export const TrendCharts = memo(function TrendCharts({
  data,
  isLoading = false,
}: TrendChartsProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-32 rounded bg-muted" />
        <div className="h-64 rounded bg-muted" />
      </div>
    )
  }

  const analyses = data?.categoryAnalyses ?? []

  const maxScore = 100

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">カテゴリ別スコア分布</h3>

      <div className="flex h-64 items-end justify-around gap-4 px-4">
        {analyses.map((analysis) => {
          const height = (analysis.score / maxScore) * 100
          const color = CATEGORY_COLORS[analysis.category] ?? '#6b7280'
          const name = CATEGORY_NAMES[analysis.category] ?? analysis.category

          return (
            <div key={analysis.category} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-48 w-full items-end justify-center">
                <div
                  className="w-full max-w-16 rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${height}%`,
                    backgroundColor: color,
                    opacity: 0.8,
                  }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 transform">
                    <span className="text-sm font-bold">{analysis.score}</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium">{name}</p>
                <p
                  className={cn(
                    'text-xs',
                    analysis.status === 'excellent' && 'text-green-600',
                    analysis.status === 'good' && 'text-blue-600',
                    analysis.status === 'fair' && 'text-yellow-600',
                    analysis.status === 'poor' && 'text-orange-600',
                    analysis.status === 'critical' && 'text-red-600'
                  )}
                >
                  {analysis.status}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-4">
        {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: CATEGORY_COLORS[key] }} />
            <span className="text-xs text-muted-foreground">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

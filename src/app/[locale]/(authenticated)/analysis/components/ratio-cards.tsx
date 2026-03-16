'use client'

import { memo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { RatioAnalysisOutput } from '@/app/api/analysis/types/output'

interface RatioCardsProps {
  readonly data: RatioAnalysisOutput | undefined
  readonly benchmarkData: unknown
  readonly isLoading?: boolean
}

const CATEGORY_ICONS: Record<string, string> = {
  liquidity: '💧',
  safety: '🛡️',
  profitability: '📈',
  efficiency: '⚡',
  growth: '🌱',
}

const STATUS_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 border-green-500 text-green-700',
  good: 'bg-blue-100 border-blue-500 text-blue-700',
  fair: 'bg-yellow-100 border-yellow-500 text-yellow-700',
  poor: 'bg-orange-100 border-orange-500 text-orange-700',
  critical: 'bg-red-100 border-red-500 text-red-700',
}

export const RatioCards = memo(function RatioCards({
  data,
  benchmarkData: _benchmarkData,
  isLoading = false,
}: RatioCardsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-32 rounded bg-muted" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const groups = data?.groups ?? []
  const displayGroups = selectedCategory
    ? groups.filter((g) => g.category === selectedCategory)
    : groups

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">財務比率分析</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'rounded-full px-3 py-1 text-xs transition-colors',
              !selectedCategory
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            )}
          >
            すべて
          </button>
          {groups.map((group) => (
            <button
              key={group.category}
              onClick={() => setSelectedCategory(group.category)}
              className={cn(
                'rounded-full px-3 py-1 text-xs transition-colors',
                selectedCategory === group.category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {CATEGORY_ICONS[group.category]} {group.categoryName}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {displayGroups.map((group) => (
          <div key={group.category} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-medium">
                <span>{CATEGORY_ICONS[group.category]}</span>
                {group.categoryName}
              </h4>
              <span
                className={cn(
                  'rounded-full border px-2 py-1 text-xs',
                  STATUS_COLORS[group.overallStatus]
                )}
              >
                スコア: {group.averageScore}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {group.ratios.map((ratio) => (
                <div
                  key={ratio.definition.id}
                  className={cn('rounded border-l-4 p-3', STATUS_COLORS[ratio.status])}
                >
                  <p className="truncate text-xs opacity-80">{ratio.definition.name}</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-bold">{ratio.formattedValue}</span>
                    {ratio.trend && (
                      <span
                        className={cn(
                          'text-xs',
                          ratio.trend.direction === 'improving' && 'text-green-600',
                          ratio.trend.direction === 'declining' && 'text-red-600'
                        )}
                      >
                        {ratio.trend.direction === 'improving' && '↑'}
                        {ratio.trend.direction === 'declining' && '↓'}
                        {ratio.trend.direction === 'stable' && '→'}
                        {ratio.trend.changePercent !== undefined && (
                          <span>{Math.abs(ratio.trend.changePercent).toFixed(1)}%</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

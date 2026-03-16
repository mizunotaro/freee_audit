'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { BenchmarkComparisonOutput } from '@/app/api/analysis/types/output'

interface BenchmarkComparisonProps {
  readonly comparisons: readonly BenchmarkComparisonOutput[]
  readonly isLoading?: boolean
}

export const BenchmarkComparison = memo(function BenchmarkComparison({
  comparisons,
  isLoading = false,
}: BenchmarkComparisonProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-32 rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">ベンチマーク比較</h3>
        <p className="text-sm text-muted-foreground">ベンチマークデータがありません</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">ベンチマーク比較</h3>

      <div className="space-y-4">
        {comparisons.map((comparison) => {
          const percentile = comparison.percentile
          const statusColor =
            comparison.status === 'above_median'
              ? 'text-green-600'
              : comparison.status === 'at_median'
                ? 'text-blue-600'
                : 'text-red-600'

          return (
            <div key={comparison.metricId} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium">{comparison.metricName}</h4>
                <span className={cn('text-sm font-bold', statusColor)}>
                  {percentile.toFixed(0)}パーセンタイル
                </span>
              </div>

              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute h-full rounded-full bg-primary"
                  style={{ width: `${percentile}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>業界最低: {comparison.benchmark.min.toFixed(2)}</span>
                <span>中央値: {comparison.benchmark.median.toFixed(2)}</span>
                <span>業界最高: {comparison.benchmark.max.toFixed(2)}</span>
              </div>

              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">貴社: </span>
                <span className="font-medium">{comparison.companyValue.toFixed(2)}</span>
                {comparison.deviation !== 0 && (
                  <span
                    className={cn(
                      'ml-2',
                      comparison.deviation > 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    ({comparison.deviation > 0 ? '+' : ''}
                    {comparison.deviation.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

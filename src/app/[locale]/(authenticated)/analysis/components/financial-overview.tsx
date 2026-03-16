'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { FinancialAnalysisOutput } from '@/app/api/analysis/types/output'

interface FinancialOverviewProps {
  readonly data: FinancialAnalysisOutput | undefined
  readonly isLoading?: boolean
}

export const FinancialOverview = memo(function FinancialOverview({
  data,
  isLoading = false,
}: FinancialOverviewProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-32 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const keyMetrics = data?.keyMetrics ?? []

  const formatValue = (value: number, format: string, unit: string): string => {
    switch (format) {
      case 'currency':
        return `¥${(value / 1000000).toFixed(0)}M`
      case 'percentage':
        return `${value.toFixed(1)}%`
      case 'ratio':
        return `${value.toFixed(2)}${unit}`
      case 'days':
        return `${Math.round(value)}日`
      default:
        return value.toLocaleString()
    }
  }

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      excellent: 'border-green-500 bg-green-50',
      good: 'border-blue-500 bg-blue-50',
      fair: 'border-yellow-500 bg-yellow-50',
      poor: 'border-orange-500 bg-orange-50',
      critical: 'border-red-500 bg-red-50',
    }
    return colors[status] ?? colors.fair
  }

  const getTrendIcon = (trend?: string): string => {
    if (!trend) return ''
    switch (trend) {
      case 'improving':
        return '↑'
      case 'declining':
        return '↓'
      default:
        return '→'
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">主要財務指標</h3>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {keyMetrics.map((metric, index) => (
          <div
            key={index}
            className={cn('rounded-lg border-l-4 p-4', getStatusColor(metric.status))}
          >
            <p className="truncate text-xs text-muted-foreground">{metric.name}</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold">
                {formatValue(metric.value, metric.format, metric.unit)}
              </span>
              {metric.trend && (
                <span
                  className={cn(
                    'text-sm',
                    metric.trend === 'improving' && 'text-green-500',
                    metric.trend === 'declining' && 'text-red-500'
                  )}
                >
                  {getTrendIcon(metric.trend)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {data?.executiveSummary && (
        <div className="mt-6 rounded-lg bg-muted/50 p-4">
          <h4 className="mb-2 text-sm font-medium">エグゼクティブサマリー</h4>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {data.executiveSummary}
          </p>
        </div>
      )}
    </div>
  )
})

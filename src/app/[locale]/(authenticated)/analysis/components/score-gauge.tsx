'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  readonly score: number
  readonly status: string
  readonly isLoading?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  excellent: 'text-green-500',
  good: 'text-blue-500',
  fair: 'text-yellow-500',
  poor: 'text-orange-500',
  critical: 'text-red-500',
}

const STATUS_BG_COLORS: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  fair: 'bg-yellow-500',
  poor: 'bg-orange-500',
  critical: 'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  excellent: '非常に良好',
  good: '良好',
  fair: '普通',
  poor: '要注意',
  critical: '危険',
}

export const ScoreGauge = memo(function ScoreGauge({
  score,
  status,
  isLoading = false,
}: ScoreGaugeProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-8 w-24 rounded bg-muted" />
        <div className="mx-auto h-32 w-32 rounded-full bg-muted" />
        <div className="mx-auto mt-4 h-4 w-20 rounded bg-muted" />
      </div>
    )
  }

  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference - (score / 100) * circumference
  const colorClass = STATUS_COLORS[status] ?? STATUS_COLORS.fair
  const bgClass = STATUS_BG_COLORS[status] ?? STATUS_BG_COLORS.fair

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">総合評価スコア</h3>

      <div className="relative mx-auto h-36 w-36">
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="currentColor"
            strokeWidth="10"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="currentColor"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            className={colorClass}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold', colorClass)}>{Math.round(score)}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className="mt-4 text-center">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white',
            bgClass
          )}
        >
          {STATUS_LABELS[status] ?? '普通'}
        </span>
      </div>
    </div>
  )
})

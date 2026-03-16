'use client'

import { memo, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'
import type { RecommendationOutput } from '@/app/api/analysis/types/output'

interface RecommendationsPanelProps {
  readonly recommendations: readonly RecommendationOutput[]
  readonly isLoading?: boolean
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: 'text-red-600', bg: 'bg-red-50', label: '高' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: '中' },
  low: { color: 'text-blue-600', bg: 'bg-blue-50', label: '低' },
}

const TIMEFRAME_CONFIG: Record<string, { icon: typeof Clock; label: string }> = {
  immediate: { icon: AlertCircle, label: '即時対応' },
  short_term: { icon: Clock, label: '短期（1-3ヶ月）' },
  medium_term: { icon: Clock, label: '中期（3-12ヶ月）' },
  long_term: { icon: Clock, label: '長期（1年以上）' },
}

export const RecommendationsPanel = memo(function RecommendationsPanel({
  recommendations,
  isLoading = false,
}: RecommendationsPanelProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-32 rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const filteredRecommendations =
    filter === 'all' ? recommendations : recommendations.filter((r) => r.priority === filter)

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">推奨アクション</h3>
        <div className="flex gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded px-2 py-1 text-xs transition-colors',
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              )}
            >
              {f === 'all' ? 'すべて' : PRIORITY_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {filteredRecommendations.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <p className="text-sm">推奨事項はありません</p>
        </div>
      ) : (
        <div className="max-h-[400px] space-y-3 overflow-y-auto">
          {filteredRecommendations.map((rec) => {
            const isCompleted = completedIds.has(rec.id)
            const priority = PRIORITY_CONFIG[rec.priority]
            const timeframe = TIMEFRAME_CONFIG[rec.timeframe]
            const TimeframeIcon = timeframe.icon

            return (
              <div
                key={rec.id}
                className={cn(
                  'rounded-lg border p-4 transition-opacity',
                  isCompleted && 'opacity-50',
                  priority.bg
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(rec.id)}
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      isCompleted
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 hover:border-green-500'
                    )}
                  >
                    {isCompleted && <CheckCircle className="h-4 w-4 text-white" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={cn('rounded px-2 py-0.5 text-xs', priority.color, 'bg-white')}
                      >
                        {priority.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TimeframeIcon className="h-3 w-3" />
                        {timeframe.label}
                      </span>
                    </div>

                    <h4 className={cn('text-sm font-medium', isCompleted && 'line-through')}>
                      {rec.title}
                    </h4>

                    <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>

                    <p className="mt-2 text-xs text-green-600">
                      期待される効果: {rec.expectedImpact}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

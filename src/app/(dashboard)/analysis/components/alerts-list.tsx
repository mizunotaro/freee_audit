'use client'

import { memo, useState } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import type { AlertOutput } from '@/app/api/analysis/types/output'

interface AlertsListProps {
  readonly alerts: readonly AlertOutput[]
  readonly isLoading?: boolean
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  critical: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: '🔴' },
  high: { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: '🟠' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: '🟡' },
  low: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: '🔵' },
  info: { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: 'ℹ️' },
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

export const AlertsList = memo(function AlertsList({ alerts, isLoading = false }: AlertsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-24 rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const filteredAlerts = severityFilter
    ? alerts.filter((a) => a.severity === severityFilter)
    : alerts

  const sortedAlerts = [...filteredAlerts].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )

  const severityCounts = alerts.reduce(
    (acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          アラート
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{alerts.length}件</span>
        </h3>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={severityFilter ?? ''}
            onChange={(e) => setSeverityFilter(e.target.value || null)}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="">すべて</option>
            <option value="critical">重大 ({severityCounts.critical ?? 0})</option>
            <option value="high">高 ({severityCounts.high ?? 0})</option>
            <option value="medium">中 ({severityCounts.medium ?? 0})</option>
            <option value="low">低 ({severityCounts.low ?? 0})</option>
          </select>
        </div>
      </div>

      {sortedAlerts.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <p className="text-sm">アラートはありません</p>
        </div>
      ) : (
        <div className="max-h-[400px] space-y-2 overflow-y-auto">
          {sortedAlerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity]
            const isExpanded = expandedId === alert.id

            return (
              <div key={alert.id} className={cn('overflow-hidden rounded-lg border', config.bg)}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <span className="text-lg">{config.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium', config.color)}>{alert.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-2 border-t px-3 pb-3 pt-0">
                    <div className="text-xs">
                      <span className="text-muted-foreground">現在値:</span>{' '}
                      <span className="font-medium">{alert.currentValue.toFixed(2)}</span>
                      {alert.threshold && (
                        <>
                          <span className="ml-2 text-muted-foreground">基準値:</span>{' '}
                          <span className="font-medium">{alert.threshold}</span>
                        </>
                      )}
                    </div>
                    <div className="rounded bg-background/50 p-2 text-xs">
                      <span className="text-muted-foreground">推奨対応:</span>
                      <p className="mt-1">{alert.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

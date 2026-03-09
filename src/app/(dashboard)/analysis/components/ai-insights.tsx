'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { FinancialAnalysisOutput } from '@/app/api/analysis/types/output'

interface AiInsightsProps {
  readonly data: FinancialAnalysisOutput | undefined
  readonly isLoading?: boolean
}

const CATEGORY_ICONS: Record<string, string> = {
  liquidity: '💧',
  safety: '🛡️',
  profitability: '📈',
  efficiency: '⚡',
  growth: '🌱',
}

const CATEGORY_NAMES: Record<string, string> = {
  liquidity: '流動性',
  safety: '安全性',
  profitability: '収益性',
  efficiency: '効率性',
  growth: '成長性',
}

export const AiInsights = memo(function AiInsights({ data, isLoading = false }: AiInsightsProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-6">
        <div className="mb-4 h-6 w-32 rounded bg-muted" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const analyses = data?.categoryAnalyses ?? []

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Brain className="h-4 w-4" />
        AI分析インサイト
      </h3>

      <div className="space-y-4">
        {analyses.map((analysis) => (
          <div key={analysis.category} className="rounded-lg bg-muted/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-medium">
                <span>{CATEGORY_ICONS[analysis.category] ?? '📊'}</span>
                {CATEGORY_NAMES[analysis.category] ?? analysis.category}
              </h4>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  analysis.score >= 70 && 'bg-green-100 text-green-700',
                  analysis.score >= 40 && analysis.score < 70 && 'bg-yellow-100 text-yellow-700',
                  analysis.score < 40 && 'bg-red-100 text-red-700'
                )}
              >
                {analysis.score}点
              </span>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">{analysis.summary}</p>

            {analysis.trends.length > 0 && (
              <div className="space-y-2">
                {analysis.trends.slice(0, 2).map((trend, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    {getTrendIcon(trend.direction)}
                    <div>
                      <span className="font-medium">{trend.metric}</span>
                      <p className="text-muted-foreground">{trend.insight}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

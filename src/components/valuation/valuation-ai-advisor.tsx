'use client'

import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  TrendingUp,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { WACCAdviceResponse, ValuationQAResult } from '@/services/valuation'
import { resolveDisplayState } from '@/components/valuation/resolve-display-state'

interface ValuationAIAdvisorProps {
  advice: WACCAdviceResponse | null
  qaResult: ValuationQAResult | null
  isLoading: boolean
  error?: string | null
  onRefresh?: () => void
  className?: string
}

export function ValuationAIAdvisor({
  advice,
  qaResult,
  isLoading,
  error = null,
  onRefresh,
  className,
}: ValuationAIAdvisorProps) {
  const state = resolveDisplayState({
    loading: isLoading,
    error,
    hasData: Boolean(advice || qaResult),
  })
  const status = state.success ? state.data : 'ready'

  if (status === 'loading') {
    return (
      <Card
        className={cn('w-full', className)}
        role="status"
        aria-busy="true"
        aria-label="Loading AI advisor"
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">AI Advisor</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">AI Advisor</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-6 text-center" role="alert">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">{error || 'Failed to load AI advisor'}</p>
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh}>
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'empty') {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">AI Advisor</CardTitle>
          </div>
          <CardDescription>Industry-specific recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center" role="status">
            <Lightbulb className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select an industry and enter parameters to receive AI-powered recommendations
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">AI Advisor</CardTitle>
          </div>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
        {advice && (
          <CardDescription>
            Industry: {advice.industry}
            <Badge variant="outline" className="ml-2">
              {advice.confidence} confidence
            </Badge>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4">
            {qaResult && <QASection qaResult={qaResult} />}
            {advice && <AdviceSection advice={advice} />}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function QASection({ qaResult }: { qaResult: ValuationQAResult }) {
  const severityColors = {
    error: 'text-red-500 bg-red-50 dark:bg-red-950/30',
    warning: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
    info: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <span className="text-sm font-medium">Quality Assurance</span>
        <Badge variant={qaResult.passed ? 'default' : 'destructive'}>
          {qaResult.passed ? 'Passed' : 'Issues Found'}
        </Badge>
      </div>

      <div className="rounded-lg bg-muted/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Quality Score</span>
          <span className="text-lg font-bold">{qaResult.score}/100</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={qaResult.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Quality score ${qaResult.score} of 100`}
        >
          <div
            className={cn(
              'h-full transition-all',
              qaResult.score >= 80
                ? 'bg-green-500'
                : qaResult.score >= 60
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            )}
            style={{ width: `${qaResult.score}%` }}
          />
        </div>
      </div>

      {qaResult.issues.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Issues ({qaResult.issues.length})</span>
          {qaResult.issues.slice(0, 5).map((issue) => (
            <div
              key={issue.id}
              className={cn(
                'flex items-start gap-2 rounded p-2 text-xs',
                severityColors[issue.severity]
              )}
            >
              {issue.severity === 'error' && (
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              )}
              {issue.severity === 'warning' && <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />}
              {issue.severity === 'info' && (
                <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
              )}
              <div>
                <div className="font-medium">{issue.message}</div>
                {issue.suggestion && (
                  <div className="mt-1 text-muted-foreground">{issue.suggestion}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {qaResult.recommendations.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Recommendations</span>
          {qaResult.recommendations.slice(0, 3).map((rec, index) => (
            <div key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
              <TrendingUp className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdviceSection({ advice }: { advice: WACCAdviceResponse }) {
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        <span className="text-sm font-medium">WACC Recommendations</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AdviceItem
          label="Risk-Free Rate"
          value={advice.riskFreeRate.suggested}
          range={advice.riskFreeRate.range}
          source={advice.riskFreeRate.dataSource}
        />
        <AdviceItem
          label="Market Risk Premium"
          value={advice.marketRiskPremium.suggested}
          range={advice.marketRiskPremium.range}
          source={advice.marketRiskPremium.dataSource}
        />
        <AdviceItem
          label="Beta"
          value={advice.beta.suggested}
          range={advice.beta.range}
          source={advice.beta.dataSource}
          extra={`Unlevered: ${advice.beta.unleveredBeta.toFixed(2)}`}
        />
        <AdviceItem
          label="Cost of Debt"
          value={advice.costOfDebt.suggested}
          range={advice.costOfDebt.range}
          source={advice.costOfDebt.dataSource}
          extra={`Spread: ${advice.costOfDebt.spreadOverRiskFree.toFixed(2)}%`}
        />
      </div>

      {advice.warnings.length > 0 && (
        <div className="space-y-1">
          {advice.warnings.map((warning, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-500"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded bg-muted/50 p-2 text-xs">
        <div className="mb-1 font-medium">Optimal Capital Structure</div>
        <div className="text-muted-foreground">
          D/E Ratio: {advice.optimalCapitalStructure.suggestedDERatio.toFixed(2)} (Industry Avg:{' '}
          {advice.optimalCapitalStructure.industryAverage.toFixed(2)})
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Last updated: {new Date(advice.lastUpdated).toLocaleDateString()}
      </div>
    </div>
  )
}

interface AdviceItemProps {
  label: string
  value: number
  range: { min: number; max: number }
  source: string
  extra?: string
}

function AdviceItem({ label, value, range, source, extra }: AdviceItemProps) {
  return (
    <div className="rounded border p-2">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{(value * 100).toFixed(2)}%</div>
      <div className="text-xs text-muted-foreground">
        Range: {(range.min * 100).toFixed(1)}% - {(range.max * 100).toFixed(1)}%
      </div>
      {extra && <div className="mt-1 text-xs text-blue-500">{extra}</div>}
      <div className="truncate text-xs text-muted-foreground" title={source}>
        Source: {source}
      </div>
    </div>
  )
}

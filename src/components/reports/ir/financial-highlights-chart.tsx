'use client'

import * as React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FinancialHighlight } from '@/types/reports/ir-report'

export interface FinancialHighlightsChartProps {
  highlights: FinancialHighlight[]
  title?: string
  showComparison?: boolean
  language?: 'ja' | 'en'
}

const COLORS = {
  revenue: '#3b82f6',
  operatingProfit: '#10b981',
  netIncome: '#8b5cf6',
  eps: '#f59e0b',
}

const formatCurrency = (value: number, unit: 'million' | 'thousand' = 'million') => {
  const divisor = unit === 'million' ? 1000000 : 1000
  const formatted = (value / divisor).toFixed(1)
  return `${formatted}${unit === 'million' ? 'M' : 'K'}`
}

const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(1)}%`
}

export function FinancialHighlightsChart({
  highlights,
  title = '財務ハイライト',
  showComparison = true,
  language = 'ja',
}: FinancialHighlightsChartProps) {
  const sortedHighlights = React.useMemo(() => {
    return [...highlights].sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))
  }, [highlights])

  const maxRevenue = Math.max(...sortedHighlights.map((h) => h.revenue))
  const chartHeight = 200

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  const getTrendIcon = (change: number) => {
    if (change > 5) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (change < -5) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  if (sortedHighlights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">
            {language === 'en' ? 'No data available' : 'データがありません'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-end justify-between gap-4" style={{ height: chartHeight }}>
            {sortedHighlights.map((highlight, index) => {
              const barHeight = (highlight.revenue / maxRevenue) * (chartHeight - 40)
              const previousHighlight = index > 0 ? sortedHighlights[index - 1] : null
              const revenueChange = previousHighlight
                ? calculateChange(highlight.revenue, previousHighlight.revenue)
                : 0

              return (
                <div key={highlight.fiscalYear} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full flex-col items-center">
                    <span className="mb-2 text-xs text-muted-foreground">
                      {formatCurrency(highlight.revenue)}
                    </span>
                    <div
                      className="w-full max-w-[60px] rounded-t-md transition-all duration-300"
                      style={{
                        height: barHeight,
                        backgroundColor: COLORS.revenue,
                      }}
                    />
                  </div>
                  <span className="mt-2 text-sm font-medium">{highlight.fiscalYear}</span>
                  {showComparison && previousHighlight && (
                    <div className="flex items-center gap-1 text-xs">
                      {getTrendIcon(revenueChange)}
                      <span className={revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {revenueChange >= 0 ? '+' : ''}
                        {revenueChange.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
            {sortedHighlights.length > 0 && (
              <>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {language === 'en' ? 'Operating Profit' : '営業利益'}
                  </p>
                  <p className="text-lg font-semibold" style={{ color: COLORS.operatingProfit }}>
                    {formatCurrency(sortedHighlights[sortedHighlights.length - 1].operatingProfit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {language === 'en' ? 'Net Income' : '当期純利益'}
                  </p>
                  <p className="text-lg font-semibold" style={{ color: COLORS.netIncome }}>
                    {formatCurrency(sortedHighlights[sortedHighlights.length - 1].netIncome)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">EPS</p>
                  <p className="text-lg font-semibold" style={{ color: COLORS.eps }}>
                    {sortedHighlights[sortedHighlights.length - 1].eps.toFixed(2)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">ROE</p>
                  <p className="text-lg font-semibold">
                    {formatPercent(sortedHighlights[sortedHighlights.length - 1].roe)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default FinancialHighlightsChart

'use client'

import { useState, useCallback } from 'react'
import { FinancialOverview } from './components/financial-overview'
import { RatioCards } from './components/ratio-cards'
import { TrendCharts } from './components/trend-charts'
import { AiInsights } from './components/ai-insights'
import { RecommendationsPanel } from './components/recommendations-panel'
import { AlertsList } from './components/alerts-list'
import { PeriodSelector } from './components/period-selector'
import { ExportButton } from './components/export-button'
import { ScoreGauge } from './components/score-gauge'
import { useAnalysis } from './hooks/use-analysis'
import type { FiscalPeriod } from './hooks/use-analysis'

export default function AnalysisPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<FiscalPeriod>({
    fiscalYear: new Date().getFullYear(),
    month: 12,
  })

  const { financialData, ratioData, benchmarkData, isLoading, error, refetch } =
    useAnalysis(selectedPeriod)

  const handlePeriodChange = useCallback((period: FiscalPeriod) => {
    setSelectedPeriod(period)
  }, [])

  const handleExport = useCallback(async (_format: 'pdf' | 'excel' | 'json') => {
    // エクスポート処理はuse-export.tsで実装
  }, [])

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-destructive">分析データの取得に失敗しました</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={refetch}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          再試行
        </button>
      </div>
    )
  }

  const overallScore = financialData?.data?.overallScore ?? 0
  const overallStatus = financialData?.data?.overallStatus ?? 'fair'

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">財務分析ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">包括的な財務分析とAIインサイト</p>
        </div>
        <div className="flex items-center gap-4">
          <PeriodSelector
            value={selectedPeriod}
            onChange={handlePeriodChange}
            disabled={isLoading}
          />
          <ExportButton onExport={handleExport} disabled={isLoading || !financialData} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <ScoreGauge score={overallScore} status={overallStatus} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-3">
          <FinancialOverview data={financialData?.data} isLoading={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RatioCards
            data={ratioData?.data}
            benchmarkData={benchmarkData?.data}
            isLoading={isLoading}
          />
        </div>
        <div className="xl:col-span-1">
          <AlertsList alerts={financialData?.data?.allAlerts ?? []} isLoading={isLoading} />
        </div>
      </div>

      <TrendCharts data={financialData?.data} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AiInsights data={financialData?.data} isLoading={isLoading} />
        <RecommendationsPanel
          recommendations={financialData?.data?.topRecommendations ?? []}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiInsights } from '@/app/[locale]/(authenticated)/analysis/components/ai-insights'
import { RatioCards } from '@/app/[locale]/(authenticated)/analysis/components/ratio-cards'
import { FinancialOverview } from '@/app/[locale]/(authenticated)/analysis/components/financial-overview'
import { TrendCharts } from '@/app/[locale]/(authenticated)/analysis/components/trend-charts'
import type { FinancialAnalysisOutput, RatioAnalysisOutput } from '@/app/api/analysis/types/output'

const financialData = {
  overallScore: 80,
  overallStatus: 'good' as const,
  executiveSummary: 'エグゼクティブサマリー',
  categoryAnalyses: [
    {
      category: 'liquidity',
      score: 75,
      status: 'good' as const,
      summary: '流動性は良好です',
      trends: [
        {
          metric: '流動比率',
          direction: 'improving' as const,
          changePercent: 5,
          insight: '前期比で向上しました',
        },
      ],
      alerts: [],
      recommendations: [],
    },
  ],
  allAlerts: [],
  topRecommendations: [],
  keyMetrics: [
    {
      name: '流動比率',
      value: 150,
      unit: '%',
      format: 'percentage' as const,
      status: 'good' as const,
      trend: 'improving' as const,
    },
  ],
  processingTimeMs: 100,
  analyzedAt: '2024-01-01T00:00:00.000Z',
} satisfies FinancialAnalysisOutput

const ratioData = {
  groups: [
    {
      category: 'liquidity',
      categoryName: '流動性',
      averageScore: 80,
      overallStatus: 'good' as const,
      ratios: [
        {
          definition: {
            id: 'cr',
            name: '流動比率',
            nameEn: 'Current Ratio',
            category: 'liquidity',
            formula: 'a / b',
            description: '流動比率',
            unit: 'ratio' as const,
          },
          value: 1.5,
          formattedValue: '1.50',
          status: 'good' as const,
          trend: { direction: 'improving' as const, changePercent: 5 },
        },
      ],
    },
  ],
  allRatios: [],
  summary: {
    totalRatios: 1,
    excellentCount: 0,
    goodCount: 1,
    fairCount: 0,
    poorCount: 0,
    criticalCount: 0,
    overallScore: 80,
  },
  calculatedAt: '2024-01-01T00:00:00.000Z',
} satisfies RatioAnalysisOutput

describe('AiInsights states', () => {
  it('exposes a status role with aria-busy while loading', () => {
    render(<AiInsights data={undefined} isLoading />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveAttribute('aria-label', 'AI分析インサイトを読み込み中')
  })

  it('shows an explicit empty state when there are no analyses', () => {
    render(<AiInsights data={undefined} />)
    expect(screen.getByText('AI分析インサイトはありません')).toBeInTheDocument()
  })

  it('marks the category emoji decorative and announces trend direction for SR', () => {
    const { container } = render(<AiInsights data={financialData} />)
    const emoji = container.querySelector('h4 > span[aria-hidden="true"]')
    expect(emoji).toBeInTheDocument()
    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText(/改善/)).toBeInTheDocument()
  })
})

describe('RatioCards states', () => {
  it('exposes a status role with aria-busy while loading', () => {
    render(<RatioCards data={undefined} benchmarkData={null} isLoading />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveAttribute('aria-label', '財務比率分析を読み込み中')
  })

  it('shows an explicit empty state when there are no groups', () => {
    render(<RatioCards data={undefined} benchmarkData={null} />)
    expect(screen.getByText('表示する財務比率はありません')).toBeInTheDocument()
  })

  it('announces trend direction for SR while hiding the arrow glyph', () => {
    const { container } = render(<RatioCards data={ratioData} benchmarkData={null} />)
    expect(screen.getByText('改善')).toBeInTheDocument()
    const hiddenArrow = container.querySelector('span[aria-hidden="true"]')
    expect(hiddenArrow).toBeInTheDocument()
  })
})

describe('FinancialOverview states', () => {
  it('exposes a status role with aria-busy while loading', () => {
    render(<FinancialOverview data={undefined} isLoading />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveAttribute('aria-label', '主要財務指標を読み込み中')
  })

  it('shows an explicit empty state when there are no metrics', () => {
    render(<FinancialOverview data={undefined} />)
    expect(screen.getByText('表示する主要財務指標はありません')).toBeInTheDocument()
  })

  it('announces trend direction for SR', () => {
    render(<FinancialOverview data={financialData} />)
    expect(screen.getByText(/改善/)).toBeInTheDocument()
  })
})

describe('TrendCharts states', () => {
  it('exposes a status role with aria-busy while loading', () => {
    render(<TrendCharts data={undefined} isLoading />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveAttribute('aria-label', 'カテゴリ別スコア分布を読み込み中')
  })

  it('shows an explicit empty state when there is no data', () => {
    render(<TrendCharts data={undefined} />)
    expect(screen.getByText('表示するスコア分布はありません')).toBeInTheDocument()
  })

  it('conveys each bar value to SR via role=img and hides the legend swatch', () => {
    const { container } = render(
      <TrendCharts
        data={{
          categoryAnalyses: [{ category: 'liquidity', score: 75, status: 'good', summary: '' }],
        }}
      />
    )
    expect(screen.getByRole('img', { name: '流動性 75点' })).toBeInTheDocument()
    const swatch = container.querySelector('.h-3.w-3')
    expect(swatch).toHaveAttribute('aria-hidden', 'true')
  })
})

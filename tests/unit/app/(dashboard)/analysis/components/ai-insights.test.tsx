import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiInsights } from '@/app/(dashboard)/analysis/components/ai-insights'

describe('AiInsights', () => {
  it('should render loading state', () => {
    const { container } = render(<AiInsights data={undefined} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should render section title with brain icon', () => {
    render(<AiInsights data={undefined} isLoading={false} />)
    expect(screen.getByText('AI分析インサイト')).toBeInTheDocument()
  })

  it('should render category analyses with scores', () => {
    const data = {
      overallScore: 75,
      overallStatus: 'good' as const,
      executiveSummary: '',
      categoryAnalyses: [
        {
          category: 'liquidity',
          score: 85,
          status: 'excellent' as const,
          summary: '流動性は良好です',
          trends: [],
          alerts: [],
          recommendations: [],
        },
        {
          category: 'safety',
          score: 40,
          status: 'poor' as const,
          summary: '安全性に注意が必要です',
          trends: [],
          alerts: [],
          recommendations: [],
        },
      ],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    }

    render(<AiInsights data={data} isLoading={false} />)

    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText('安全性')).toBeInTheDocument()
    expect(screen.getByText('85点')).toBeInTheDocument()
    expect(screen.getByText('40点')).toBeInTheDocument()
    expect(screen.getByText('流動性は良好です')).toBeInTheDocument()
    expect(screen.getByText('安全性に注意が必要です')).toBeInTheDocument()
  })

  it('should render trend insights', () => {
    const data = {
      overallScore: 75,
      overallStatus: 'good' as const,
      executiveSummary: '',
      categoryAnalyses: [
        {
          category: 'profitability',
          score: 70,
          status: 'good' as const,
          summary: '収益性分析',
          trends: [
            { metric: 'ROE', direction: 'improving' as const, insight: 'ROEは改善傾向です' },
            { metric: 'ROA', direction: 'declining' as const, insight: 'ROAは低下傾向です' },
          ],
          alerts: [],
          recommendations: [],
        },
      ],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    }

    render(<AiInsights data={data} isLoading={false} />)

    expect(screen.getByText('ROE')).toBeInTheDocument()
    expect(screen.getByText('ROA')).toBeInTheDocument()
    expect(screen.getByText('ROEは改善傾向です')).toBeInTheDocument()
    expect(screen.getByText('ROAは低下傾向です')).toBeInTheDocument()
  })

  it('should limit trends to 2 per analysis', () => {
    const data = {
      overallScore: 75,
      overallStatus: 'good' as const,
      executiveSummary: '',
      categoryAnalyses: [
        {
          category: 'profitability',
          score: 70,
          status: 'good' as const,
          summary: 'Test',
          trends: [
            { metric: 'Trend1', direction: 'improving' as const, insight: 'Insight1' },
            { metric: 'Trend2', direction: 'stable' as const, insight: 'Insight2' },
            { metric: 'Trend3', direction: 'declining' as const, insight: 'Insight3' },
          ],
          alerts: [],
          recommendations: [],
        },
      ],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    }

    render(<AiInsights data={data} isLoading={false} />)

    expect(screen.getByText('Trend1')).toBeInTheDocument()
    expect(screen.getByText('Trend2')).toBeInTheDocument()
    expect(screen.queryByText('Trend3')).not.toBeInTheDocument()
  })

  it('should handle empty data gracefully', () => {
    render(<AiInsights data={undefined} isLoading={false} />)
    expect(screen.getByText('AI分析インサイト')).toBeInTheDocument()
  })
})

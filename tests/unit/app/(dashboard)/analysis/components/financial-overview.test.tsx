import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinancialOverview } from '@/app/(dashboard)/analysis/components/financial-overview'

describe('FinancialOverview', () => {
  it('should render loading state', () => {
    const { container } = render(<FinancialOverview data={undefined} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should render section title', () => {
    render(<FinancialOverview data={undefined} isLoading={false} />)
    expect(screen.getByText('主要財務指標')).toBeInTheDocument()
  })

  it('should render key metrics', () => {
    const data = {
      overallScore: 75,
      overallStatus: 'good' as const,
      executiveSummary: 'Test summary',
      categoryAnalyses: [],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [
        { name: '売上高', value: 300000000, unit: '円', format: 'currency' as const, status: 'excellent' as const },
        { name: '営業利益率', value: 16.7, unit: '%', format: 'percentage' as const, status: 'good' as const },
        { name: '流動比率', value: 1.5, unit: '', format: 'ratio' as const, status: 'fair' as const },
        { name: '売上債権回転日数', value: 45, unit: '', format: 'days' as const, status: 'good' as const },
      ],
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    }
    render(<FinancialOverview data={data} isLoading={false} />)

    expect(screen.getByText('¥300M')).toBeInTheDocument()
    expect(screen.getByText('16.7%')).toBeInTheDocument()
    expect(screen.getByText('1.50')).toBeInTheDocument()
    expect(screen.getByText('45日')).toBeInTheDocument()
  })

  it('should render executive summary when present', () => {
    const data = {
      overallScore: 75,
      overallStatus: 'good' as const,
      executiveSummary: 'テストサマリー内容',
      categoryAnalyses: [],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    }
    render(<FinancialOverview data={data} isLoading={false} />)

    expect(screen.getByText('エグゼクティブサマリー')).toBeInTheDocument()
    expect(screen.getByText('テストサマリー内容')).toBeInTheDocument()
  })

  it('should not render executive summary when absent', () => {
    const data = {
      overallScore: 75,
      overallStatus: 'good' as const,
      executiveSummary: undefined as unknown as string,
      categoryAnalyses: [],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    }
    render(<FinancialOverview data={data} isLoading={false} />)

    expect(screen.queryByText('エグゼクティブサマリー')).not.toBeInTheDocument()
  })

  it('should render trend icons', () => {
    const data = {
      overallScore: 75,
      overallStatus: 'good' as const,
      executiveSummary: '',
      categoryAnalyses: [],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [
        { name: '売上高', value: 100, unit: '', format: 'number' as const, status: 'good' as const, trend: 'improving' as const },
        { name: '経費', value: 50, unit: '', format: 'number' as const, status: 'poor' as const, trend: 'declining' as const },
      ],
      processingTimeMs: 100,
      analyzedAt: '2024-01-01T00:00:00.000Z',
    }
    render(<FinancialOverview data={data} isLoading={false} />)

    expect(screen.getByText('↑')).toBeInTheDocument()
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('should handle empty keyMetrics gracefully', () => {
    render(<FinancialOverview data={undefined} isLoading={false} />)
    expect(screen.getByText('主要財務指標')).toBeInTheDocument()
  })
})

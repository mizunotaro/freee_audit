import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrendCharts } from '@/app/(dashboard)/analysis/components/trend-charts'

describe('TrendCharts', () => {
  it('should render loading state', () => {
    const { container } = render(<TrendCharts data={undefined} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should render section title', () => {
    render(<TrendCharts data={undefined} isLoading={false} />)
    expect(screen.getByText('カテゴリ別スコア分布')).toBeInTheDocument()
  })

  it('should render category analyses with bars', () => {
    const data = {
      categoryAnalyses: [
        { category: 'liquidity', score: 80, status: 'excellent', summary: 'Test' },
        { category: 'safety', score: 60, status: 'fair', summary: 'Test' },
        { category: 'profitability', score: 90, status: 'excellent', summary: 'Test' },
      ],
    }
    const { container } = render(<TrendCharts data={data} isLoading={false} />)

    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(container.querySelectorAll('[style]').length).toBeGreaterThan(0)
  })

  it('should render category legend', () => {
    render(<TrendCharts data={undefined} isLoading={false} />)

    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText('安全性')).toBeInTheDocument()
    expect(screen.getByText('収益性')).toBeInTheDocument()
    expect(screen.getByText('効率性')).toBeInTheDocument()
    expect(screen.getByText('成長性')).toBeInTheDocument()
  })

  it('should render category names in analysis', () => {
    const data = {
      categoryAnalyses: [{ category: 'liquidity', score: 75, status: 'good', summary: 'Test' }],
    }
    render(<TrendCharts data={data} isLoading={false} />)

    // 流動性 is rendered both in the category legend and in the analysis section.
    expect(screen.getAllByText('流動性').length).toBeGreaterThanOrEqual(2)
  })

  it('should render status text', () => {
    const data = {
      categoryAnalyses: [
        { category: 'profitability', score: 90, status: 'excellent', summary: 'Test' },
        { category: 'safety', score: 30, status: 'critical', summary: 'Test' },
      ],
    }
    render(<TrendCharts data={data} isLoading={false} />)

    expect(screen.getByText('excellent')).toBeInTheDocument()
    expect(screen.getByText('critical')).toBeInTheDocument()
  })

  it('should handle empty analyses gracefully', () => {
    const data = {
      categoryAnalyses: [],
    }
    render(<TrendCharts data={data} isLoading={false} />)
    expect(screen.getByText('カテゴリ別スコア分布')).toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BenchmarkComparison } from '@/app/(dashboard)/analysis/components/benchmark-comparison'
import type { BenchmarkComparisonOutput } from '@/app/api/analysis/types/output'

const mockComparisons: BenchmarkComparisonOutput[] = [
  {
    metricId: 'current-ratio',
    metricName: '流動比率',
    companyValue: 1.5,
    benchmark: { min: 0.8, q1: 1.0, median: 1.3, q3: 1.8, max: 2.5 },
    percentile: 65,
    status: 'above_median',
    deviation: 0.2,
  },
  {
    metricId: 'equity-ratio',
    metricName: '自己資本比率',
    companyValue: 25.0,
    benchmark: { min: 10.0, q1: 20.0, median: 30.0, q3: 40.0, max: 60.0 },
    percentile: 35,
    status: 'below_median',
    deviation: -5.0,
  },
  {
    metricId: 'roe',
    metricName: 'ROE',
    companyValue: 12.0,
    benchmark: { min: 5.0, q1: 8.0, median: 12.0, q3: 15.0, max: 20.0 },
    percentile: 50,
    status: 'at_median',
    deviation: 0,
  },
]

describe('BenchmarkComparison', () => {
  it('should render loading state', () => {
    const { container } = render(<BenchmarkComparison comparisons={[]} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should render section title', () => {
    render(<BenchmarkComparison comparisons={[]} isLoading={false} />)
    expect(screen.getByText('ベンチマーク比較')).toBeInTheDocument()
  })

  it('should render empty state message', () => {
    render(<BenchmarkComparison comparisons={[]} isLoading={false} />)
    expect(screen.getByText('ベンチマークデータがありません')).toBeInTheDocument()
  })

  it('should render metric names', () => {
    render(<BenchmarkComparison comparisons={mockComparisons} isLoading={false} />)
    expect(screen.getByText('流動比率')).toBeInTheDocument()
    expect(screen.getByText('自己資本比率')).toBeInTheDocument()
    expect(screen.getByText('ROE')).toBeInTheDocument()
  })

  it('should render percentile values', () => {
    render(<BenchmarkComparison comparisons={mockComparisons} isLoading={false} />)
    expect(screen.getByText('65パーセンタイル')).toBeInTheDocument()
    expect(screen.getByText('35パーセンタイル')).toBeInTheDocument()
    expect(screen.getByText('50パーセンタイル')).toBeInTheDocument()
  })

  it('should render benchmark min/median/max values', () => {
    render(<BenchmarkComparison comparisons={mockComparisons} isLoading={false} />)
    expect(screen.getByText(/業界最低: 0.80/)).toBeInTheDocument()
    expect(screen.getByText(/中央値: 1.30/)).toBeInTheDocument()
    expect(screen.getByText(/業界最高: 2.50/)).toBeInTheDocument()
  })

  it('should render company value', () => {
    render(<BenchmarkComparison comparisons={mockComparisons} isLoading={false} />)
    expect(screen.getAllByText(/貴社:/)).toHaveLength(mockComparisons.length)
  })

  it('should render deviation for non-zero deviations', () => {
    const { container } = render(
      <BenchmarkComparison comparisons={mockComparisons} isLoading={false} />
    )
    const text = container.textContent ?? ''
    expect(text).toMatch(/\(\+0\.20\)/)
    expect(text).toMatch(/\(-5\.00\)/)
  })

  it('should not render deviation for zero deviation', () => {
    render(<BenchmarkComparison comparisons={mockComparisons} isLoading={false} />)
    expect(screen.queryByText(/\(0\.00\)/)).not.toBeInTheDocument()
  })
})

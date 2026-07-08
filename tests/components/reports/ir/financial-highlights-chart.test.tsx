import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinancialHighlightsChart } from '@/components/reports/ir/financial-highlights-chart'
import type { FinancialHighlight } from '@/types/reports/ir-report'

const mockHighlights: FinancialHighlight[] = [
  {
    fiscalYear: '2024',
    revenue: 1000000000,
    operatingProfit: 100000000,
    ordinaryProfit: 80000000,
    netIncome: 60000000,
    eps: 50.5,
    bps: 500.25,
    roe: 10.5,
    roa: 5.2,
  },
]

describe('FinancialHighlightsChart', () => {
  it('should display default title', () => {
    render(<FinancialHighlightsChart highlights={mockHighlights} />)

    expect(screen.getByText('財務ハイライト')).toBeInTheDocument()
  })

  it('should show no data message when highlights is empty', () => {
    render(<FinancialHighlightsChart highlights={[]} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
  })

  it('shows the English empty message for language en', () => {
    render(<FinancialHighlightsChart highlights={[]} language="en" />)

    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<FinancialHighlightsChart highlights={mockHighlights} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders the error message when error is provided', () => {
    render(<FinancialHighlightsChart highlights={mockHighlights} error="取得に失敗しました" />)

    expect(screen.getByRole('alert')).toHaveTextContent('取得に失敗しました')
  })

  it('prefers loading over error when both are set', () => {
    render(<FinancialHighlightsChart highlights={mockHighlights} loading error="boom" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should display custom title when provided', () => {
    render(<FinancialHighlightsChart highlights={mockHighlights} title="Custom Title" />)

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('should render with showComparison false', () => {
    render(<FinancialHighlightsChart highlights={mockHighlights} showComparison={false} />)

    expect(screen.getByText('財務ハイライト')).toBeInTheDocument()
  })

  it('should render with language en', () => {
    render(
      <FinancialHighlightsChart
        highlights={mockHighlights}
        language="en"
        title="Financial Highlights"
      />
    )

    expect(screen.getByText('Financial Highlights')).toBeInTheDocument()
  })
})

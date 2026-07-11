import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ManagerialAccountingCards } from '@/components/reports/ManagerialAccountingCards'
import type { ManagerialMetrics } from '@/types/reports/managerial'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

const healthyMetrics: ManagerialMetrics = {
  revenue: 10000000,
  variableCosts: 6000000,
  fixedCosts: 2000000,
  contributionMargin: 4000000,
  contributionMarginRatio: 40,
  breakEvenSales: 5000000,
  marginOfSafetySales: 5000000,
  marginOfSafetyRatio: 50,
  operatingIncome: 2000000,
}

const unachievableMetrics: ManagerialMetrics = {
  revenue: 1000000,
  variableCosts: 1200000,
  fixedCosts: 500000,
  contributionMargin: -200000,
  contributionMarginRatio: -20,
  breakEvenSales: null,
  marginOfSafetySales: null,
  marginOfSafetyRatio: null,
  operatingIncome: -700000,
}

describe('ManagerialAccountingCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all managerial metric cards with formatted values', () => {
    render(<ManagerialAccountingCards metrics={healthyMetrics} />)

    for (const title of [
      '売上高',
      '変動費',
      '固定費',
      '限界利益',
      '限界利益率',
      '損益分岐点売上高',
      '安全余裕率',
      '営業利益',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }

    expect(screen.getByText('10,000,000円')).toBeInTheDocument()
    expect(screen.getByText('6,000,000円')).toBeInTheDocument()
    expect(screen.getByText('4,000,000円')).toBeInTheDocument()
    expect(screen.getByText('5,000,000円')).toBeInTheDocument()
    // 固定費 and 営業利益 are both 2,000,000円
    expect(screen.getAllByText('2,000,000円')).toHaveLength(2)
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders 算出不可 for break-even and margin of safety when contribution margin is non-positive', () => {
    render(<ManagerialAccountingCards metrics={unachievableMetrics} />)

    expect(screen.getAllByText('算出不可')).toHaveLength(2)
    expect(screen.getByText('-200,000円')).toBeInTheDocument() // 限界利益
  })

  it('renders the empty state when metrics is null', () => {
    render(<ManagerialAccountingCards metrics={null} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(screen.queryByText('売上高')).not.toBeInTheDocument()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<ManagerialAccountingCards metrics={healthyMetrics} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('売上高')).not.toBeInTheDocument()
  })

  it('renders the error message when error is provided', () => {
    render(<ManagerialAccountingCards metrics={healthyMetrics} error="取得エラー" />)

    expect(screen.getByRole('alert')).toHaveTextContent('取得エラー')
    expect(screen.queryByText('売上高')).not.toBeInTheDocument()
  })

  it('prefers loading over error when both are set', () => {
    render(<ManagerialAccountingCards metrics={healthyMetrics} loading error="boom" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

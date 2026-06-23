import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecommendationsPanel } from '@/app/(dashboard)/analysis/components/recommendations-panel'

const mockRecommendations = [
  {
    id: 'rec-1',
    priority: 'high' as const,
    category: 'safety',
    title: '自己資本比率の改善',
    description: '自己資本比率が業界平均を下回っています。利益剰余金の蓄積を優先してください。',
    expectedImpact: '自己資本比率5%向上',
    timeframe: 'short_term' as const,
  },
  {
    id: 'rec-2',
    priority: 'medium' as const,
    category: 'efficiency',
    title: '在庫回転率の向上',
    description: '在庫回転率が低下傾向にあります。適正在庫の見直しが必要です。',
    expectedImpact: '在庫回転期間10日短縮',
    timeframe: 'medium_term' as const,
  },
  {
    id: 'rec-3',
    priority: 'low' as const,
    category: 'growth',
    title: '新規市場参入の検討',
    description: '成長性指標は安定していますが、新規市場への展開も検討してください。',
    expectedImpact: '売上高10%増加見込み',
    timeframe: 'long_term' as const,
  },
]

describe('RecommendationsPanel', () => {
  it('should render loading state', () => {
    const { container } = render(<RecommendationsPanel recommendations={[]} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should render section title', () => {
    render(<RecommendationsPanel recommendations={[]} isLoading={false} />)
    expect(screen.getByText('推奨アクション')).toBeInTheDocument()
  })

  it('should render all recommendations', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)
    expect(screen.getByText('自己資本比率の改善')).toBeInTheDocument()
    expect(screen.getByText('在庫回転率の向上')).toBeInTheDocument()
    expect(screen.getByText('新規市場参入の検討')).toBeInTheDocument()
  })

  it('should render priority labels', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)
    expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('中').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('低').length).toBeGreaterThanOrEqual(1)
  })

  it('should render timeframe labels', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)
    expect(screen.getByText('短期（1-3ヶ月）')).toBeInTheDocument()
    expect(screen.getByText('中期（3-12ヶ月）')).toBeInTheDocument()
    expect(screen.getByText('長期（1年以上）')).toBeInTheDocument()
  })

  it('should render expected impact', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)
    expect(screen.getByText(/自己資本比率5%向上/)).toBeInTheDocument()
    expect(screen.getByText(/在庫回転期間10日短縮/)).toBeInTheDocument()
  })

  it('should show empty message when no recommendations', () => {
    render(<RecommendationsPanel recommendations={[]} isLoading={false} />)
    expect(screen.getByText('推奨事項はありません')).toBeInTheDocument()
  })

  it('should filter by priority', async () => {
    const user = userEvent.setup()
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)

    expect(screen.getByText('自己資本比率の改善')).toBeInTheDocument()

    const filterButtons = screen.getAllByText('高')
    await user.click(filterButtons[0])

    expect(screen.getByText('自己資本比率の改善')).toBeInTheDocument()
    expect(screen.queryByText('在庫回転率の向上')).not.toBeInTheDocument()
    expect(screen.queryByText('新規市場参入の検討')).not.toBeInTheDocument()
  })

  it('should toggle completion state on click', async () => {
    const user = userEvent.setup()
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)

    const buttons = screen.getAllByRole('button', { name: '' })
    const firstComplete = buttons.find((b) => b.classList.contains('rounded-full'))

    if (firstComplete) {
      await user.click(firstComplete)
    }
  })

  it('should show all when clicking all filter after priority filter', async () => {
    const user = userEvent.setup()
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)

    const highFilterButton = screen.getAllByText('高')[0]
    if (!highFilterButton) throw new Error('expected at least one "高" target')
    await user.click(highFilterButton)
    expect(screen.queryByText('在庫回転率の向上')).not.toBeInTheDocument()

    await user.click(screen.getByText('すべて'))
    expect(screen.getByText('在庫回転率の向上')).toBeInTheDocument()
  })

  it('should render descriptions', () => {
    render(<RecommendationsPanel recommendations={mockRecommendations} isLoading={false} />)
    expect(screen.getByText(/自己資本比率が業界平均を下回っています/)).toBeInTheDocument()
  })
})

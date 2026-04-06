import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertsList } from '@/app/(dashboard)/analysis/components/alerts-list'
import type { AlertOutput } from '@/app/api/analysis/types/output'

const mockAlerts: AlertOutput[] = [
  {
    id: 'alert-1',
    category: 'safety',
    severity: 'critical',
    title: '自己資本比率が基準値を下回っています',
    description: '自己資本比率が20%を下回りました',
    metric: 'equityRatio',
    currentValue: 18.5,
    threshold: 20,
    recommendation: '利益剰余金の蓄積を優先してください',
  },
  {
    id: 'alert-2',
    category: 'liquidity',
    severity: 'high',
    title: '流動比率が低下傾向',
    description: '流動比率が1.0を下回るリスクがあります',
    metric: 'currentRatio',
    currentValue: 1.05,
    threshold: 1.2,
    recommendation: '短期的な資金管理の強化が必要です',
  },
  {
    id: 'alert-3',
    category: 'efficiency',
    severity: 'medium',
    title: '在庫回転率の低下',
    description: '在庫回転率が前年比で低下しています',
    metric: 'inventoryTurnover',
    currentValue: 5.2,
    recommendation: '適正在庫の見直しを推奨します',
  },
]

describe('AlertsList', () => {
  it('should render loading state', () => {
    const { container } = render(<AlertsList alerts={[]} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should render section title with count', () => {
    render(<AlertsList alerts={mockAlerts} isLoading={false} />)
    expect(screen.getByText('アラート')).toBeInTheDocument()
    expect(screen.getByText('3件')).toBeInTheDocument()
  })

  it('should render alert titles', () => {
    render(<AlertsList alerts={mockAlerts} isLoading={false} />)
    expect(screen.getByText('自己資本比率が基準値を下回っています')).toBeInTheDocument()
    expect(screen.getByText('流動比率が低下傾向')).toBeInTheDocument()
    expect(screen.getByText('在庫回転率の低下')).toBeInTheDocument()
  })

  it('should sort alerts by severity', () => {
    const { container } = render(<AlertsList alerts={mockAlerts} isLoading={false} />)
    const alertElements = container.querySelectorAll('.overflow-hidden.rounded-lg.border')
    expect(alertElements.length).toBe(3)
  })

  it('should show empty state when no alerts', () => {
    render(<AlertsList alerts={[]} isLoading={false} />)
    expect(screen.getByText('アラートはありません')).toBeInTheDocument()
  })

  it('should expand alert on click to show details', async () => {
    const user = userEvent.setup()
    render(<AlertsList alerts={mockAlerts} isLoading={false} />)

    const criticalAlert = screen.getByText('自己資本比率が基準値を下回っています')
    await user.click(criticalAlert)

    expect(screen.getByText('現在値:')).toBeInTheDocument()
    expect(screen.getByText('基準値:')).toBeInTheDocument()
    expect(screen.getByText(/利益剰余金の蓄積を優先してください/)).toBeInTheDocument()
  })

  it('should collapse expanded alert on second click', async () => {
    const user = userEvent.setup()
    render(<AlertsList alerts={mockAlerts} isLoading={false} />)

    const criticalAlert = screen.getByText('自己資本比率が基準値を下回っています')
    await user.click(criticalAlert)
    expect(screen.getByText('推奨対応:')).toBeInTheDocument()

    await user.click(criticalAlert)
    expect(screen.queryByText('推奨対応:')).not.toBeInTheDocument()
  })

  it('should render severity filter dropdown', () => {
    render(<AlertsList alerts={mockAlerts} isLoading={false} />)
    expect(screen.getByText('すべて')).toBeInTheDocument()
  })

  it('should render severity icons', () => {
    render(<AlertsList alerts={mockAlerts} isLoading={false} />)
    expect(screen.getByText('🔴')).toBeInTheDocument()
    expect(screen.getByText('🟠')).toBeInTheDocument()
    expect(screen.getByText('🟡')).toBeInTheDocument()
  })

  it('should filter alerts by severity', async () => {
    const user = userEvent.setup()
    render(<AlertsList alerts={mockAlerts} isLoading={false} />)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'critical')

    expect(screen.getByText('自己資本比率が基準値を下回っています')).toBeInTheDocument()
    expect(screen.queryByText('流動比率が低下傾向')).not.toBeInTheDocument()
    expect(screen.queryByText('在庫回転率の低下')).not.toBeInTheDocument()
  })
})

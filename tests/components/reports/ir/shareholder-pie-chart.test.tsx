import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareholderPieChart } from '@/components/reports/ir/shareholder-pie-chart'
import type { ShareholderData } from '@/types/reports/ir-report'

const mockData: ShareholderData[] = [
  { category: '個人株主', percentage: 40, count: 1000 },
  { category: '金融機関', percentage: 35, count: 50 },
  { category: '外国人', percentage: 25, count: 200 },
]

describe('ShareholderPieChart', () => {
  it('renders the default title when data is present', () => {
    render(<ShareholderPieChart data={mockData} />)

    expect(screen.getByText('株主構成')).toBeInTheDocument()
  })

  it('renders each shareholder category label', () => {
    render(<ShareholderPieChart data={mockData} />)

    expect(screen.getByText('個人株主')).toBeInTheDocument()
    expect(screen.getByText('金融機関')).toBeInTheDocument()
    expect(screen.getByText('外国人')).toBeInTheDocument()
  })

  it('shows the Japanese empty message when data is empty', () => {
    render(<ShareholderPieChart data={[]} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
  })

  it('shows the English empty message for language en', () => {
    render(<ShareholderPieChart data={[]} language="en" />)

    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders the loading skeleton when loading is true', () => {
    const { container } = render(<ShareholderPieChart data={mockData} loading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('個人株主')).not.toBeInTheDocument()
  })

  it('renders the error message when error is provided', () => {
    render(<ShareholderPieChart data={mockData} error="取得に失敗しました" />)

    expect(screen.getByRole('alert')).toHaveTextContent('取得に失敗しました')
    expect(screen.queryByText('個人株主')).not.toBeInTheDocument()
  })

  it('prefers loading over error when both are set', () => {
    render(<ShareholderPieChart data={mockData} loading error="boom" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('exposes the pie svg as role=img with a text-alternative label', () => {
    render(<ShareholderPieChart data={mockData} />)

    expect(screen.getByRole('img', { name: /株主構成の円グラフ/ })).toBeInTheDocument()
  })
})

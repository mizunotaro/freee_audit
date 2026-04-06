import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatioCards } from '@/app/(dashboard)/analysis/components/ratio-cards'

const mockRatioData = {
  groups: [
    {
      category: 'liquidity',
      categoryName: '流動性',
      averageScore: 80,
      overallStatus: 'good' as const,
      ratios: [
        {
          definition: { id: 'current-ratio', name: '流動比率', nameEn: 'Current Ratio', category: 'liquidity', formula: 'CA/CL', description: 'Test', unit: 'ratio' as const },
          value: 1.5,
          formattedValue: '1.50',
          status: 'good' as const,
          trend: { direction: 'improving' as const, previousValue: 1.3, changePercent: 15.4 },
        },
        {
          definition: { id: 'quick-ratio', name: '当座比率', nameEn: 'Quick Ratio', category: 'liquidity', formula: 'QA/CL', description: 'Test', unit: 'ratio' as const },
          value: 1.2,
          formattedValue: '1.20',
          status: 'fair' as const,
        },
      ],
    },
    {
      category: 'safety',
      categoryName: '安全性',
      averageScore: 60,
      overallStatus: 'fair' as const,
      ratios: [
        {
          definition: { id: 'equity-ratio', name: '自己資本比率', nameEn: 'Equity Ratio', category: 'safety', formula: 'E/TA', description: 'Test', unit: 'percentage' as const },
          value: 35,
          formattedValue: '35.0%',
          status: 'fair' as const,
          trend: { direction: 'declining' as const, previousValue: 40, changePercent: -12.5 },
        },
      ],
    },
  ],
  allRatios: [],
  summary: {
    totalRatios: 3,
    excellentCount: 0,
    goodCount: 1,
    fairCount: 2,
    poorCount: 0,
    criticalCount: 0,
    overallScore: 70,
  },
  calculatedAt: '2024-01-01T00:00:00.000Z',
}

describe('RatioCards', () => {
  it('should render loading state', () => {
    const { container } = render(<RatioCards data={undefined} benchmarkData={null} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should render section title', () => {
    render(<RatioCards data={undefined} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText('財務比率分析')).toBeInTheDocument()
  })

  it('should render all groups by default', () => {
    render(<RatioCards data={mockRatioData} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText('安全性')).toBeInTheDocument()
  })

  it('should render ratio values', () => {
    render(<RatioCards data={mockRatioData} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText('1.50')).toBeInTheDocument()
    expect(screen.getByText('1.20')).toBeInTheDocument()
    expect(screen.getByText('35.0%')).toBeInTheDocument()
  })

  it('should render trend direction indicators', () => {
    render(<RatioCards data={mockRatioData} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText('↑')).toBeInTheDocument()
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('should render trend change percent', () => {
    render(<RatioCards data={mockRatioData} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText('15.4%')).toBeInTheDocument()
    expect(screen.getByText('12.5%')).toBeInTheDocument()
  })

  it('should render category filter buttons', () => {
    render(<RatioCards data={mockRatioData} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText('すべて')).toBeInTheDocument()
  })

  it('should filter by category when button clicked', async () => {
    const user = userEvent.setup()
    render(<RatioCards data={mockRatioData} benchmarkData={null} isLoading={false} />)

    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText('安全性')).toBeInTheDocument()

    const safetyButton = screen.getByText('安全性')
    await user.click(safetyButton)

    expect(screen.getByText('自己資本比率')).toBeInTheDocument()
  })

  it('should render score badges', () => {
    render(<RatioCards data={mockRatioData} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText(/スコア: 80/)).toBeInTheDocument()
    expect(screen.getByText(/スコア: 60/)).toBeInTheDocument()
  })

  it('should handle empty data gracefully', () => {
    render(<RatioCards data={undefined} benchmarkData={null} isLoading={false} />)
    expect(screen.getByText('財務比率分析')).toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RatioCards } from '@/app/(dashboard)/analysis/components/ratio-cards'
import { AlertsList } from '@/app/(dashboard)/analysis/components/alerts-list'
import type { RatioAnalysisOutput, AlertOutput } from '@/app/api/analysis/types/output'
import type { RatioGroup, CalculatedRatio } from '@/services/ai/analyzers/ratios/types'

const createMockRatioGroup = (overrides?: Partial<RatioGroup>): RatioGroup => ({
  category: 'liquidity',
  categoryName: '流動性',
  averageScore: 75,
  overallStatus: 'good',
  ratios: [
    {
      definition: {
        id: 'current_ratio',
        name: '流動比率',
        nameEn: 'Current Ratio',
        category: 'liquidity',
        description: '流動比率の説明',
        unit: 'percentage',
        formula: '流動資産 / 流動負債',
        thresholds: {
          excellent: 200,
          good: 150,
          fair: 100,
          poor: 50,
        },
        higherIsBetter: true,
      },
      value: 150,
      formattedValue: '150%',
      status: 'good',
      trend: {
        direction: 'improving',
        changePercent: 5,
      },
    },
  ],
  ...overrides,
})

const createMockRatioData = (groups?: RatioGroup[]): RatioAnalysisOutput => ({
  groups: groups ?? [createMockRatioGroup()],
  allRatios: [],
  summary: {
    totalRatios: 1,
    excellentCount: 0,
    goodCount: 1,
    fairCount: 0,
    poorCount: 0,
    criticalCount: 0,
    overallScore: 75,
  },
  calculatedAt: new Date().toISOString(),
})

const createMockAlert = (overrides?: Partial<AlertOutput>): AlertOutput => ({
  id: 'alert-1',
  category: 'liquidity',
  severity: 'high',
  title: 'Test Alert',
  description: 'Test alert description',
  metric: 'current_ratio',
  currentValue: 100,
  threshold: 80,
  recommendation: 'Test recommendation',
  ...overrides,
})

describe('RatioCards', () => {
  it('should render ratio groups', () => {
    const data = createMockRatioData()
    render(<RatioCards data={data} benchmarkData={null} />)

    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText('流動比率')).toBeInTheDocument()
    expect(screen.getByText('150%')).toBeInTheDocument()
  })

  it('should filter by category', () => {
    const data = createMockRatioData([
      createMockRatioGroup({ category: 'liquidity', categoryName: '流動性' }),
      createMockRatioGroup({ category: 'safety', categoryName: '安全性' }),
    ])
    render(<RatioCards data={data} benchmarkData={null} />)

    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText('安全性')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /流動性/ }))

    expect(screen.getByText('流動性')).toBeInTheDocument()
    expect(screen.getByText('すべて')).toBeInTheDocument()
  })

  it('should render trend indicators', () => {
    const data = createMockRatioData()
    render(<RatioCards data={data} benchmarkData={null} />)

    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('should render score badge', () => {
    const data = createMockRatioData()
    render(<RatioCards data={data} benchmarkData={null} />)

    expect(screen.getByText(/スコア: 75/)).toBeInTheDocument()
  })

  it('should render empty state when no data', () => {
    render(<RatioCards data={undefined} benchmarkData={null} />)

    expect(screen.getByText(/財務比率分析/i)).toBeInTheDocument()
  })
})

describe('AlertsList', () => {
  it('should render alerts list', () => {
    const alerts: AlertOutput[] = [createMockAlert()]
    render(<AlertsList alerts={alerts} />)

    expect(screen.getByText('Test Alert')).toBeInTheDocument()
    expect(screen.getByText('Test alert description')).toBeInTheDocument()
  })

  it('should expand alert details on click', () => {
    const alerts: AlertOutput[] = [createMockAlert()]
    render(<AlertsList alerts={alerts} />)

    const button = screen.getByRole('button', { name: /Test Alert/ })
    fireEvent.click(button)

    expect(screen.getByText('推奨対応:')).toBeInTheDocument()
    expect(screen.getByText('Test recommendation')).toBeInTheDocument()
  })

  it('should filter by severity', () => {
    const alerts: AlertOutput[] = [
      createMockAlert({ severity: 'high' }),
      createMockAlert({ severity: 'low', id: 'alert-2' }),
    ]
    render(<AlertsList alerts={alerts} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'high' } })

    expect(screen.getByText('Test Alert')).toBeInTheDocument()
  })

  it('should show empty state when no alerts', () => {
    render(<AlertsList alerts={[]} />)

    expect(screen.getByText('アラートはありません')).toBeInTheDocument()
  })

  it('should sort alerts by severity', () => {
    const alerts: AlertOutput[] = [
      createMockAlert({ severity: 'low', id: 'alert-low', title: 'Low Alert' }),
      createMockAlert({ severity: 'critical', id: 'alert-critical', title: 'Critical Alert' }),
    ]
    render(<AlertsList alerts={alerts} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent(/Critical Alert/)
  })

  it('should render severity icons', () => {
    const alerts: AlertOutput[] = [createMockAlert({ severity: 'critical' })]
    render(<AlertsList alerts={alerts} />)

    expect(screen.getByText('🔴')).toBeInTheDocument()
  })

  it('should show severity counts in filter', () => {
    const alerts: AlertOutput[] = [
      createMockAlert({ severity: 'high' }),
      createMockAlert({ severity: 'high', id: 'alert-2' }),
    ]
    render(<AlertsList alerts={alerts} />)

    expect(screen.getByText(/高 \(2\)/)).toBeInTheDocument()
  })
})

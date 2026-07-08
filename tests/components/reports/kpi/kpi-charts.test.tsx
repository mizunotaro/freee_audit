import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { KPICharts } from '@/components/reports/kpi/kpi-charts'
import type {
  KPIProfitability,
  KPIEfficiency,
  KPISafety,
  KPIGrowth,
  KPICashFlow,
} from '@/types/reports/kpi'

// KPIGauge/KPIBar are recharts-backed (ResponsiveContainer needs ResizeObserver
// in jsdom). They are not under test here, so we stub them and exercise only
// KPICharts' own derived markup (headers, formatting, sign logic).
vi.mock('@/components/charts/KPIGauge', () => ({
  KPIGauge: () => null,
  KPIBar: () => null,
}))

function makeProps(
  overrides: {
    profitability?: Partial<KPIProfitability>
    efficiency?: Partial<KPIEfficiency>
    safety?: Partial<KPISafety>
    growth?: Partial<KPIGrowth>
    cashFlow?: Partial<KPICashFlow>
  } = {}
) {
  return {
    profitability: {
      roe: 12,
      roa: 6,
      ros: 8,
      grossProfitMargin: 35,
      operatingMargin: 12,
      ebitdaMargin: 18,
      ...overrides.profitability,
    },
    efficiency: {
      assetTurnover: 1.234,
      inventoryTurnover: 6.5,
      receivablesTurnover: 8.1,
      payablesTurnover: 7.2,
      ...overrides.efficiency,
    },
    safety: {
      currentRatio: 160,
      quickRatio: 120,
      debtToEquity: 0.8,
      equityRatio: 35,
      ...overrides.safety,
    },
    growth: { revenueGrowth: 5.5, profitGrowth: -3.2, ...overrides.growth },
    cashFlow: { fcf: 1_234_567, fcfMargin: 4.5, ...overrides.cashFlow },
  }
}

describe('KPICharts', () => {
  it('renders the four section headers', () => {
    render(<KPICharts {...makeProps()} />)

    expect(screen.getByText('収益性指標')).toBeInTheDocument()
    expect(screen.getByText('安全性指標')).toBeInTheDocument()
    expect(screen.getByText('効率性指標')).toBeInTheDocument()
    expect(screen.getByText('成長性・CF指標')).toBeInTheDocument()
  })

  it('formats efficiency turnover values to two decimal places', () => {
    render(<KPICharts {...makeProps()} />)

    expect(screen.getByText('1.23')).toBeInTheDocument() // 1.234 -> 1.23
    expect(screen.getByText('6.50')).toBeInTheDocument() // 6.5 -> 6.50
    expect(screen.getByText('8.10')).toBeInTheDocument()
    expect(screen.getByText('7.20')).toBeInTheDocument()
  })

  it('prefixes positive growth with "+" and renders negatives with a minus sign', () => {
    render(<KPICharts {...makeProps({ growth: { revenueGrowth: 5.5, profitGrowth: -3.2 } })} />)

    expect(screen.getByText('+5.5%')).toBeInTheDocument()
    expect(screen.getByText('-3.2%')).toBeInTheDocument()
  })

  it('prefixes zero growth with "+" because the sign check is >= 0', () => {
    render(<KPICharts {...makeProps({ growth: { revenueGrowth: 0, profitGrowth: 0 } })} />)

    expect(screen.getAllByText('+0.0%')).toHaveLength(2)
  })

  it('renders the free cash flow with locale grouping', () => {
    render(<KPICharts {...makeProps({ cashFlow: { fcf: 1_234_567, fcfMargin: 4.5 } })} />)

    expect(screen.getByText('¥1,234,567')).toBeInTheDocument()
  })

  it('renders the FCF margin as a one-decimal percentage without a plus sign', () => {
    render(<KPICharts {...makeProps({ cashFlow: { fcf: 0, fcfMargin: 4.56 } })} />)

    expect(screen.getByText('4.6%')).toBeInTheDocument()
  })
})

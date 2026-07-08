import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KPITable } from '@/components/reports/kpi/kpi-table'
import type { KPIReportData } from '@/types/reports/kpi'

type Kpis = KPIReportData['kpis']

function makeKpis(overrides: Partial<Kpis> = {}): Kpis {
  return {
    profitability: {
      roe: 10,
      roa: 5,
      ros: 8,
      grossProfitMargin: 30,
      operatingMargin: 10,
      ebitdaMargin: 15,
    },
    efficiency: {
      assetTurnover: 1.2,
      inventoryTurnover: 6,
      receivablesTurnover: 8,
      payablesTurnover: 7,
    },
    safety: {
      currentRatio: 150,
      quickRatio: 100,
      debtToEquity: 1,
      equityRatio: 30,
    },
    growth: { revenueGrowth: 10, profitGrowth: 8 },
    cashFlow: { fcf: 50_000_000, fcfMargin: 10 },
    ...overrides,
  }
}

const benchmarks = [
  { kpi: 'ROE', value: 12.34, benchmark: 10, status: 'good' as const, description: '利益率' },
  { kpi: '流動比率', value: 90, benchmark: 150, status: 'bad' as const, description: '安全性' },
  { kpi: 'D/E', value: 1.5, benchmark: 1, status: 'warning' as const, description: '負債' },
]

describe('KPITable', () => {
  it('renders the benchmark header and rows', () => {
    render(<KPITable benchmarks={benchmarks} kpis={makeKpis()} />)

    expect(screen.getByText('KPIベンチマーク')).toBeInTheDocument()
    expect(screen.getByText('ROE')).toBeInTheDocument()
    expect(screen.getByText('流動比率')).toBeInTheDocument()
    expect(screen.getByText('D/E')).toBeInTheDocument()
  })

  it('maps benchmark status to the localized badge label', () => {
    render(<KPITable benchmarks={benchmarks} kpis={makeKpis()} />)

    expect(screen.getByText('良好')).toBeInTheDocument()
    expect(screen.getByText('注意')).toBeInTheDocument()
    expect(screen.getByText('要改善')).toBeInTheDocument()
  })

  it('formats numeric benchmark values to one decimal place', () => {
    render(<KPITable benchmarks={benchmarks} kpis={makeKpis()} />)

    expect(screen.getByText('12.3')).toBeInTheDocument() // 12.34 -> 12.3
    expect(screen.getByText('90.0')).toBeInTheDocument() // 90 -> 90.0
    expect(screen.getByText('1.5')).toBeInTheDocument() // 1.5 -> 1.5
  })

  it('renders the startup, VC and bank sections when those kpis are present', () => {
    render(
      <KPITable
        benchmarks={[]}
        kpis={makeKpis({
          startup: {
            burnRate: 5_000_000,
            runwayMonths: 18,
            cac: 10_000,
            ltv: 60_000,
            ltvCacRatio: 6,
            mrr: 8_000_000,
            arr: 96_000_000,
            churnRate: 2,
          },
          vc: {
            revenueMultiple: 5,
            growthRate: 30,
            grossMargin: 70,
            nrr: 110,
            magicNumber: 0.9,
            ruleOf40: 50,
          },
          bank: {
            dscr: 1.5,
            interestCoverageRatio: 5,
            fixedChargeCoverageRatio: 3,
            debtToEquityRatio: 0.8,
            debtServiceRatio: 40,
          },
        })}
      />
    )

    expect(screen.getByText('スタートアップ企業向け指標')).toBeInTheDocument()
    expect(screen.getByText('VC/CVC投資家視点指標')).toBeInTheDocument()
    expect(screen.getByText('銀行融資視点指標')).toBeInTheDocument()
  })

  it('omits startup, VC and bank sections when those kpis are absent', () => {
    render(<KPITable benchmarks={[]} kpis={makeKpis()} />)

    expect(screen.queryByText('スタートアップ企業向け指標')).not.toBeInTheDocument()
    expect(screen.queryByText('VC/CVC投資家視点指標')).not.toBeInTheDocument()
    expect(screen.queryByText('銀行融資視点指標')).not.toBeInTheDocument()
  })

  it('renders the advice section only when advice items are provided', () => {
    const { rerender } = render(<KPITable benchmarks={[]} kpis={makeKpis()} />)
    expect(screen.queryByText('コントロールアドバイス')).not.toBeInTheDocument()

    rerender(
      <KPITable
        benchmarks={[]}
        kpis={makeKpis()}
        advice={[
          {
            category: 'bank',
            kpiName: 'DSCR',
            currentValue: 1.0,
            targetValue: 1.2,
            status: 'critical',
            advice: 'DSCRを改善してください',
            actionItems: ['借入金の返済条件を見直す'],
          },
        ]}
      />
    )
    expect(screen.getByText('コントロールアドバイス')).toBeInTheDocument()
    expect(screen.getByText('DSCRを改善してください')).toBeInTheDocument()
    expect(screen.getByText('借入金の返済条件を見直す')).toBeInTheDocument()
  })

  it('maps the startup CAC/LTV row only when CAC is non-null', () => {
    const { rerender } = render(
      <KPITable
        benchmarks={[]}
        kpis={makeKpis({
          startup: {
            burnRate: 1_000_000,
            runwayMonths: 12,
            cac: null,
            ltv: null,
            ltvCacRatio: null,
            mrr: 1_000_000,
            arr: 12_000_000,
            churnRate: null,
          },
        })}
      />
    )
    expect(screen.queryByText('CAC（顧客獲得単価）')).not.toBeInTheDocument()

    rerender(
      <KPITable
        benchmarks={[]}
        kpis={makeKpis({
          startup: {
            burnRate: 1_000_000,
            runwayMonths: 12,
            cac: 5_000,
            ltv: 20_000,
            ltvCacRatio: 4,
            mrr: 1_000_000,
            arr: 12_000_000,
            churnRate: null,
          },
        })}
      />
    )
    expect(screen.getByText('CAC（顧客獲得単価）')).toBeInTheDocument()
  })

  it('labels the magic-number efficiency band across thresholds', () => {
    const renderWith = (magicNumber: number) =>
      render(
        <KPITable
          benchmarks={[]}
          kpis={makeKpis({
            vc: {
              revenueMultiple: null,
              growthRate: 30,
              grossMargin: 70,
              nrr: null,
              magicNumber,
              ruleOf40: 50,
            },
          })}
        />
      )

    const { rerender, unmount } = renderWith(0.9)
    expect(screen.getByText('（効率的: 拡大投資可能）')).toBeInTheDocument()

    rerender(
      <KPITable
        benchmarks={[]}
        kpis={makeKpis({
          vc: {
            revenueMultiple: null,
            growthRate: 30,
            grossMargin: 70,
            nrr: null,
            magicNumber: 0.6,
            ruleOf40: 50,
          },
        })}
      />
    )
    expect(screen.getByText('（改善余地あり）')).toBeInTheDocument()

    unmount()
    renderWith(0.3)
    expect(screen.getByText('（非効率: モデル見直し必要）')).toBeInTheDocument()
  })
})

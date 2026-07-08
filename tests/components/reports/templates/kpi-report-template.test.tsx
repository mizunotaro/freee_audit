import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KPIReportTemplate } from '@/components/reports/templates/kpi-report-template'
import type { KPIData, KPIItem } from '@/services/export'

const roe = (overrides: Partial<KPIItem> = {}): KPIItem => ({
  key: 'roe',
  name: 'ROE',
  nameEn: 'ROE',
  value: 12.34,
  unit: '%',
  target: 10,
  ...overrides,
})

const fullData: KPIData = {
  fiscalYear: 2024,
  month: 3,
  profitability: [roe()],
  efficiency: [
    {
      key: 'at',
      name: '総資産回転率',
      nameEn: 'Asset Turnover',
      value: 1.23,
      unit: '回',
      target: 1.5,
    },
  ],
  safety: [
    { key: 'cash', name: '現金', nameEn: 'Cash', value: 500_000, unit: '円', target: 1_000_000 },
  ],
  growth: [
    {
      key: 'rev',
      name: '売上',
      nameEn: 'Revenue',
      value: 1_500_000_000,
      unit: '円',
      target: 1_000_000_000,
    },
  ],
  cashFlow: [
    { key: 'fcf', name: 'FCF', nameEn: 'FCF', value: 1_500_000, unit: '円', target: 1_000_000 },
  ],
}

describe('KPIReportTemplate', () => {
  it('renders the Japanese title, fiscal year and month', () => {
    render(<KPIReportTemplate data={fullData} language="ja" />)

    expect(screen.getByText('経営指標レポート')).toBeInTheDocument()
    expect(screen.getByText(/2024 年度/)).toBeInTheDocument()
    expect(screen.getByText(/3 月/)).toBeInTheDocument()
  })

  it('renders the English title when language is en', () => {
    render(<KPIReportTemplate data={fullData} language="en" />)

    expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument()
  })

  it('falls back to Japanese copy when language is dual', () => {
    render(<KPIReportTemplate data={fullData} language="dual" />)

    expect(screen.getByText('経営指標レポート')).toBeInTheDocument()
  })

  it('renders a section title for every non-empty category', () => {
    render(<KPIReportTemplate data={fullData} language="ja" />)

    expect(screen.getByText('収益性指標')).toBeInTheDocument()
    expect(screen.getByText('効率性指標')).toBeInTheDocument()
    expect(screen.getByText('安全性指標')).toBeInTheDocument()
    expect(screen.getByText('成長性指標')).toBeInTheDocument()
    expect(screen.getByText('キャッシュフロー指標')).toBeInTheDocument()
  })

  it('omits the section for empty categories', () => {
    const data: KPIData = {
      ...fullData,
      safety: [],
      growth: [],
      cashFlow: [],
    }
    render(<KPIReportTemplate data={data} language="ja" />)

    expect(screen.getByText('収益性指標')).toBeInTheDocument()
    expect(screen.queryByText('安全性指標')).not.toBeInTheDocument()
    expect(screen.queryByText('成長性指標')).not.toBeInTheDocument()
    expect(screen.queryByText('キャッシュフロー指標')).not.toBeInTheDocument()
  })

  it('formats values per unit: %, 回, and 円 (K/M/B)', () => {
    render(<KPIReportTemplate data={fullData} language="ja" />)

    expect(screen.getByText('12.3')).toBeInTheDocument() // % -> toFixed(1)
    expect(screen.getByText('1.23')).toBeInTheDocument() // 回 -> toFixed(2)
    expect(screen.getByText('500K')).toBeInTheDocument() // 円 < 1M -> K
    expect(screen.getByText('1.5M')).toBeInTheDocument() // 円 >= 1M -> M
    expect(screen.getByText('1.5B')).toBeInTheDocument() // 円 >= 1B -> B
  })

  it('caps target achievement at 100%', () => {
    render(<KPIReportTemplate data={fullData} language="ja" />)

    // roe 12.34 vs target 10 would be 123% but is capped; the raw figure never
    // reaches the DOM.
    expect(screen.queryByText('123%')).not.toBeInTheDocument()
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1)
  })

  describe('trend vs previous period', () => {
    const baseData = (value: number): KPIData => ({
      fiscalYear: 2024,
      month: 3,
      profitability: [roe({ value, target: undefined })],
      efficiency: [],
      safety: [],
      growth: [],
      cashFlow: [],
    })
    const previous: KPIData = {
      fiscalYear: 2023,
      month: 3,
      profitability: [roe({ value: 10, target: undefined })],
      efficiency: [],
      safety: [],
      growth: [],
      cashFlow: [],
    }

    it('shows an up arrow when value rose beyond the 1% threshold', () => {
      render(<KPIReportTemplate data={baseData(12)} language="ja" previousData={previous} />)

      expect(screen.getByText('↑')).toBeInTheDocument()
      expect(screen.getByText(/前期: 10.0/)).toBeInTheDocument()
    })

    it('shows a stable arrow when value moved less than 1%', () => {
      render(<KPIReportTemplate data={baseData(10.05)} language="ja" previousData={previous} />)

      expect(screen.getByText('→')).toBeInTheDocument()
    })

    it('shows a down arrow when value fell beyond the 1% threshold', () => {
      render(<KPIReportTemplate data={baseData(8)} language="ja" previousData={previous} />)

      expect(screen.getByText('↓')).toBeInTheDocument()
    })

    it('renders no trend arrow when there is no previous period', () => {
      render(<KPIReportTemplate data={baseData(12)} language="ja" />)

      expect(screen.queryByText('↑')).not.toBeInTheDocument()
      expect(screen.queryByText('→')).not.toBeInTheDocument()
      expect(screen.queryByText('↓')).not.toBeInTheDocument()
    })
  })
})

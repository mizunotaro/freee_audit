import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MultiMonthReportTable } from '@/components/reports/templates/monthly-report-template'
import type { MultiMonthReport } from '@/types'

function makeReport(sections: MultiMonthReport['sections']): MultiMonthReport {
  return {
    fiscalYear: 2024,
    endMonth: 6,
    monthCount: 3,
    months: [4, 5, 6],
    companyName: 'テスト会社',
    sections,
  }
}

describe('MultiMonthReportTable', () => {
  it('renders the month headers', () => {
    render(<MultiMonthReportTable report={makeReport([])} />)

    expect(screen.getByText('4月')).toBeInTheDocument()
    expect(screen.getByText('5月')).toBeInTheDocument()
    expect(screen.getByText('6月')).toBeInTheDocument()
  })

  it('renders each section title bracketed', () => {
    render(
      <MultiMonthReportTable
        report={makeReport([
          {
            title: '貸借対照表',
            type: 'bs',
            rows: [{ name: '現金', rowType: 'item', indent: 0, values: [0, 0, 0] }],
          },
          {
            title: '損益計算書',
            type: 'pl',
            rows: [{ name: '売上', rowType: 'item', indent: 0, values: [0, 0, 0] }],
          },
        ])}
      />
    )

    expect(screen.getByText('【貸借対照表】')).toBeInTheDocument()
    expect(screen.getByText('【損益計算書】')).toBeInTheDocument()
  })

  it('shows total/average columns only when a pl or kpi section is present', () => {
    const { rerender } = render(
      <MultiMonthReportTable
        report={makeReport([
          {
            title: '貸借対照表',
            type: 'bs',
            rows: [{ name: '現金', rowType: 'item', indent: 0, values: [0, 0, 0] }],
          },
        ])}
      />
    )
    expect(screen.queryByText('合計')).not.toBeInTheDocument()
    expect(screen.queryByText('平均値')).not.toBeInTheDocument()

    rerender(
      <MultiMonthReportTable
        report={makeReport([
          {
            title: '損益計算書',
            type: 'pl',
            rows: [{ name: '売上', rowType: 'item', indent: 0, values: [0, 0, 0] }],
          },
        ])}
      />
    )
    expect(screen.getByText('合計')).toBeInTheDocument()
    expect(screen.getByText('平均値')).toBeInTheDocument()
  })

  it('formats pl/bs values as JPY currency', () => {
    render(
      <MultiMonthReportTable
        report={makeReport([
          {
            title: '貸借対照表',
            type: 'bs',
            rows: [{ name: '現金', rowType: 'item', indent: 0, values: [1000, 2000, 3000] }],
          },
          {
            title: '損益計算書',
            type: 'pl',
            rows: [
              {
                name: '売上',
                rowType: 'total',
                indent: 0,
                values: [10000, 11000, 12000],
                total: 33000,
                average: 11000,
              },
            ],
          },
        ])}
      />
    )

    // bs values use currency formatting
    expect(screen.getByText('¥1,000')).toBeInTheDocument()
    // pl row values and total are currency-formatted
    expect(screen.getByText('¥10,000')).toBeInTheDocument()
    expect(screen.getByText('¥33,000')).toBeInTheDocument()
  })

  it('formats kpi values to one decimal place regardless of currency', () => {
    render(
      <MultiMonthReportTable
        report={makeReport([
          {
            title: '経営指標',
            type: 'kpi',
            rows: [{ name: 'ROE', rowType: 'item', indent: 0, values: [10.56, 11, 12] }],
          },
        ])}
      />
    )

    expect(screen.getByText('10.6')).toBeInTheDocument() // 10.56 -> 10.6
    expect(screen.getByText('11.0')).toBeInTheDocument()
    expect(screen.getByText('12.0')).toBeInTheDocument()
  })

  it('formats values in English locale when language is en', () => {
    render(
      <MultiMonthReportTable
        report={makeReport([
          {
            title: 'Balance Sheet',
            type: 'bs',
            rows: [{ name: 'Cash', rowType: 'item', indent: 0, values: [1000] }],
          },
        ])}
        language="en"
        currency="USD"
      />
    )

    // en-US currency formatting for USD -> leading "$"
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })
})

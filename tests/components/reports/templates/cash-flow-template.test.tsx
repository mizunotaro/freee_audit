import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CashFlowTemplate } from '@/components/reports/templates/cash-flow-template'
import type { CashFlowStatementData } from '@/services/export'

function makeData(): CashFlowStatementData {
  return {
    fiscalYear: 2024,
    months: [
      {
        month: 1,
        openingBalance: 1_000_000,
        operatingReceipts: [
          { name: '売上', amount: 3_000_000 },
          { name: 'その他', amount: 500_000 },
        ],
        operatingPayments: [{ name: '経費', amount: 1_200_000 }],
        operatingCashFlow: 2_300_000,
        investingCashFlow: -1_500_000,
        financingCashFlow: 0,
        netChange: 800_000,
        closingBalance: 1_800_000,
      },
      {
        month: 2,
        openingBalance: 1_800_000,
        operatingReceipts: [
          { name: '売上', amount: 4_000_000 },
          { name: 'その他', amount: 600_000 },
        ],
        operatingPayments: [{ name: '経費', amount: 1_400_000 }],
        operatingCashFlow: 3_200_000,
        investingCashFlow: -700_000,
        financingCashFlow: 0,
        netChange: 2_500_000,
        closingBalance: 4_300_000,
      },
    ],
  }
}

describe('CashFlowTemplate', () => {
  it('renders the Japanese title and fiscal year', () => {
    render(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)

    expect(screen.getByText('資金繰り表')).toBeInTheDocument()
    expect(screen.getByText(/会計年度: 2024/)).toBeInTheDocument()
  })

  it('renders the English title when language is en', () => {
    render(<CashFlowTemplate data={makeData()} language="en" currency="JPY" />)

    expect(screen.getByText('Cash Flow Statement')).toBeInTheDocument()
  })

  it('shows the exchange rate only when provided', () => {
    const { rerender } = render(
      <CashFlowTemplate data={makeData()} language="ja" currency="JPY" exchangeRate={149.5} />
    )
    expect(screen.getByText('USD/JPY: 149.50')).toBeInTheDocument()

    rerender(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)
    expect(screen.queryByText('USD/JPY: 149.50')).not.toBeInTheDocument()
  })

  it('renders Japanese month headers', () => {
    render(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)

    expect(screen.getByText('1月')).toBeInTheDocument()
    expect(screen.getByText('2月')).toBeInTheDocument()
  })

  it('renders English abbreviated month headers', () => {
    render(<CashFlowTemplate data={makeData()} language="en" currency="JPY" />)

    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Feb')).toBeInTheDocument()
  })

  it('formats large values in millions (M) and sums across months for category totals', () => {
    render(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)

    // Operating CF row (operatingCashFlow is a scalar): per-month + total
    expect(screen.getByText('2.3M')).toBeInTheDocument() // month 1
    expect(screen.getByText('3.2M')).toBeInTheDocument() // month 2
    expect(screen.getByText('5.5M')).toBeInTheDocument() // total 2.3M + 3.2M
  })

  it('prefixes negative values with a minus sign', () => {
    render(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)

    // Investing CF month 1 = -1,500,000 -> "-1.5M"
    expect(screen.getByText('-1.5M')).toBeInTheDocument()
    // Investing CF total = -2,200,000 -> "-2.2M"
    expect(screen.getByText('-2.2M')).toBeInTheDocument()
  })

  it('formats thousands with the K suffix', () => {
    render(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)

    // Net change month 1 = 800,000 -> "800K"
    expect(screen.getByText('800K')).toBeInTheDocument()
    // Investing CF month 2 = -700,000 -> "-700K"
    expect(screen.getByText('-700K')).toBeInTheDocument()
  })

  it('sums item amounts into the operating receipts category total', () => {
    render(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)

    // Operating receipts total = (3M + 0.5M) + (4M + 0.6M) = 8.1M
    expect(screen.getByText('8.1M')).toBeInTheDocument()
  })

  it('renders the opening and closing balance rows', () => {
    render(<CashFlowTemplate data={makeData()} language="ja" currency="JPY" />)

    expect(screen.getByText('期首残高')).toBeInTheDocument()
    expect(screen.getByText('期末残高')).toBeInTheDocument()
  })
})

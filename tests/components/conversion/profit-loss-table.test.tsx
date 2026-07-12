import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ProfitLossTable } from '@/components/conversion/profit-loss-table'
import type { ConvertedProfitLoss } from '@/types/conversion'

type PLItem = ConvertedProfitLoss['revenue'][number]

function makeItem(overrides: Partial<PLItem> = {}): PLItem {
  return {
    code: '4110',
    name: '商品売上',
    nameEn: 'Product Sales',
    amount: 600_000,
    sourceAccountCode: '4000',
    ...overrides,
  }
}

function makeData(overrides: Partial<ConvertedProfitLoss> = {}): ConvertedProfitLoss {
  return {
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-12-31'),
    revenue: [
      makeItem({ code: '4110', name: '商品売上', amount: 600_000, sourceAccountCode: '4000' }),
      makeItem({ code: '4120', name: '役務売上', amount: 400_000, sourceAccountCode: '4090' }),
    ],
    costOfSales: [
      makeItem({ code: '5110', name: '商品仕入', amount: 511_000, sourceAccountCode: '5000' }),
    ],
    sgaExpenses: [
      makeItem({ code: '7110', name: '給与手当', amount: 200_000, sourceAccountCode: '7000' }),
    ],
    nonOperatingIncome: [
      makeItem({ code: '8110', name: '受取利息', amount: 10_000, sourceAccountCode: '8000' }),
    ],
    nonOperatingExpenses: [
      makeItem({ code: '9110', name: '支払利息', amount: 5_000, sourceAccountCode: '9000' }),
    ],
    grossProfit: 489_000,
    operatingIncome: 289_000,
    ordinaryIncome: 294_000,
    incomeBeforeTax: 290_000,
    netIncome: 150_000,
    ...overrides,
  }
}

// Anchors on a unique cell label/code, returns the last cell's text (the amount) in that row.
function lastCellText(anchorText: string): string {
  const anchor = screen.getByText(anchorText)
  const row = anchor.closest('tr') as HTMLTableRowElement | null
  if (!row) return ''
  const cells = within(row).getAllByRole('cell')
  return cells[cells.length - 1].textContent ?? ''
}

describe('conversion/profit-loss-table — structure & defaults', () => {
  it('renders a table inside the bordered container', () => {
    const { container } = render(<ProfitLossTable data={makeData()} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('rounded-lg', 'border')
  })

  it('merges a custom className onto the container', () => {
    const { container } = render(<ProfitLossTable data={makeData()} className="my-extra" />)

    expect(container.firstElementChild).toHaveClass('rounded-lg', 'border', 'my-extra')
  })

  it('shows the 3-column header by default and omits the source column', () => {
    render(<ProfitLossTable data={makeData()} />)

    expect(screen.getByText('コード')).toBeInTheDocument()
    expect(screen.getByText('科目名')).toBeInTheDocument()
    expect(screen.getByText('金額')).toBeInTheDocument()
    expect(screen.queryByText('ソース')).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    // sourceAccountCode values are not rendered when showSource is off
    expect(screen.queryByText('4000')).not.toBeInTheDocument()
  })
})

describe('conversion/profit-loss-table — sections & subtotals', () => {
  it('renders all five section titles', () => {
    render(<ProfitLossTable data={makeData()} />)

    expect(screen.getByText('売上高')).toBeInTheDocument()
    expect(screen.getByText('売上原価')).toBeInTheDocument()
    expect(screen.getByText('販売費及び一般管理費')).toBeInTheDocument()
    expect(screen.getByText('営業外収益')).toBeInTheDocument()
    expect(screen.getByText('営業外費用')).toBeInTheDocument()
  })

  it('renders all six subtotal labels', () => {
    render(<ProfitLossTable data={makeData()} />)

    expect(screen.getByText('売上高合計')).toBeInTheDocument()
    expect(screen.getByText('売上総利益')).toBeInTheDocument()
    expect(screen.getByText('営業利益')).toBeInTheDocument()
    expect(screen.getByText('経常利益')).toBeInTheDocument()
    expect(screen.getByText('税引前当期純利益')).toBeInTheDocument()
    expect(screen.getByText('当期純利益')).toBeInTheDocument()
  })

  it('spans the section title cell across the 3-column body', () => {
    render(<ProfitLossTable data={makeData()} />)

    const titleCell = screen.getByText('売上高').closest('td') as HTMLTableCellElement | null
    expect(titleCell).toHaveAttribute('colspan', '3')
  })

  it('renders the code and name of every line item', () => {
    render(<ProfitLossTable data={makeData()} />)

    for (const code of ['4110', '4120', '5110', '7110', '8110', '9110']) {
      expect(screen.getByText(code)).toBeInTheDocument()
    }
    for (const name of ['商品売上', '役務売上', '商品仕入', '給与手当', '受取利息', '支払利息']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })
})

describe('conversion/profit-loss-table — amount formatting (ja-JP)', () => {
  it('formats line-item amounts with ja-JP thousands grouping', () => {
    render(<ProfitLossTable data={makeData()} />)

    expect(lastCellText('4110')).toBe('600,000')
    expect(lastCellText('4120')).toBe('400,000')
    expect(lastCellText('5110')).toBe('511,000')
    expect(lastCellText('7110')).toBe('200,000')
    expect(lastCellText('8110')).toBe('10,000')
    expect(lastCellText('9110')).toBe('5,000')
  })

  it('renders subtotal amounts verbatim from the supplied data', () => {
    render(<ProfitLossTable data={makeData()} />)

    expect(lastCellText('売上高合計')).toBe('1,000,000')
    expect(lastCellText('売上総利益')).toBe('489,000')
    expect(lastCellText('営業利益')).toBe('289,000')
    expect(lastCellText('経常利益')).toBe('294,000')
    expect(lastCellText('税引前当期純利益')).toBe('290,000')
    expect(lastCellText('当期純利益')).toBe('150,000')
  })

  it('computes the revenue subtotal as the sum of revenue line items', () => {
    render(
      <ProfitLossTable
        data={makeData({
          revenue: [
            makeItem({ code: '4110', name: '商品売上', amount: 333_333 }),
            makeItem({ code: '4120', name: '役務売上', amount: 222_222 }),
          ],
        })}
      />
    )

    // 333,333 + 222,222 = 555,555 — a value not equal to any single item
    expect(lastCellText('売上高合計')).toBe('555,555')
  })

  it('formats a zero amount as "0"', () => {
    render(
      <ProfitLossTable
        data={makeData({
          revenue: [makeItem({ code: '4110', name: '商品売上', amount: 0 })],
          grossProfit: 0,
          operatingIncome: 0,
          ordinaryIncome: 0,
          incomeBeforeTax: 0,
          netIncome: 0,
        })}
      />
    )

    expect(lastCellText('4110')).toBe('0')
    expect(lastCellText('売上高合計')).toBe('0')
    expect(lastCellText('売上総利益')).toBe('0')
    expect(lastCellText('当期純利益')).toBe('0')
  })

  it('formats negative amounts (losses) with a leading minus sign', () => {
    render(
      <ProfitLossTable
        data={makeData({ grossProfit: -1_000, operatingIncome: -1_234_567, netIncome: -50_000 })}
      />
    )

    expect(lastCellText('売上総利益')).toBe('-1,000')
    expect(lastCellText('営業利益')).toBe('-1,234,567')
    expect(lastCellText('当期純利益')).toBe('-50,000')
  })

  it('formats large amounts without losing precision', () => {
    render(
      <ProfitLossTable
        data={makeData({
          revenue: [makeItem({ code: '4110', name: '商品売上', amount: 1_000_000_000_000 })],
          netIncome: 999_999_999_999,
        })}
      />
    )

    expect(lastCellText('4110')).toBe('1,000,000,000,000')
    expect(lastCellText('売上高合計')).toBe('1,000,000,000,000')
    expect(lastCellText('当期純利益')).toBe('999,999,999,999')
  })
})

describe('conversion/profit-loss-table — showSource column', () => {
  it('adds the source column header and a fourth header cell', () => {
    render(<ProfitLossTable data={makeData()} showSource />)

    expect(screen.getByText('ソース')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
  })

  it('widens the section title cells to span 4 columns', () => {
    render(<ProfitLossTable data={makeData()} showSource />)

    const titleCell = screen.getByText('売上高').closest('td') as HTMLTableCellElement | null
    expect(titleCell).toHaveAttribute('colspan', '4')
  })

  it('renders the sourceAccountCode for every line item', () => {
    render(<ProfitLossTable data={makeData()} showSource />)

    for (const source of ['4000', '4090', '5000', '7000', '8000', '9000']) {
      expect(screen.getByText(source)).toBeInTheDocument()
    }
  })

  it('falls back to a dash when sourceAccountCode is missing or empty', () => {
    render(
      <ProfitLossTable
        data={makeData({
          revenue: [
            makeItem({ code: '4110', name: '商品売上', amount: 100, sourceAccountCode: undefined }),
            makeItem({ code: '4120', name: '役務売上', amount: 100, sourceAccountCode: '' }),
          ],
        })}
        showSource
      />
    )

    expect(screen.getAllByText('-')).toHaveLength(2)
  })
})

describe('conversion/profit-loss-table — empty / fail-safe', () => {
  it('renders all sections and subtotals even when every section is empty', () => {
    render(
      <ProfitLossTable
        data={makeData({
          revenue: [],
          costOfSales: [],
          sgaExpenses: [],
          nonOperatingIncome: [],
          nonOperatingExpenses: [],
        })}
      />
    )

    expect(screen.getByText('売上高')).toBeInTheDocument()
    expect(screen.getByText('営業外費用')).toBeInTheDocument()
    expect(screen.getByText('売上高合計')).toBeInTheDocument()
    // no line-item codes are present
    expect(screen.queryByText('4110')).not.toBeInTheDocument()
    // revenue subtotal sums an empty list to 0
    expect(lastCellText('売上高合計')).toBe('0')
  })

  it('never emits the unreachable per-section total row', () => {
    // renderSection is never called with a `total`, so the "X 合計" rows are dead
    // code and must never appear regardless of input.
    render(<ProfitLossTable data={makeData()} showSource />)

    expect(screen.queryByText('売上高 合計')).not.toBeInTheDocument()
    expect(screen.queryByText('売上原価 合計')).not.toBeInTheDocument()
    expect(screen.queryByText('販売費及び一般管理費 合計')).not.toBeInTheDocument()
    expect(screen.queryByText('営業外収益 合計')).not.toBeInTheDocument()
    expect(screen.queryByText('営業外費用 合計')).not.toBeInTheDocument()
  })
})

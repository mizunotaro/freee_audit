import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { BalanceSheetTable } from '@/components/conversion/balance-sheet-table'
import type { ConvertedBalanceSheet } from '@/types/conversion'

const jaFormat = (n: number) => new Intl.NumberFormat('ja-JP').format(n)

type SectionItem = ConvertedBalanceSheet['assets'][number]

function makeItem(overrides: Partial<SectionItem> = {}): SectionItem {
  return {
    code: '1100',
    name: '現金',
    nameEn: 'Cash',
    amount: 1000000,
    ...overrides,
  }
}

function makeSheet(overrides: Partial<ConvertedBalanceSheet> = {}): ConvertedBalanceSheet {
  return {
    asOfDate: new Date('2024-12-31'),
    assets: [
      makeItem({ code: '1100', name: '現金', nameEn: 'Cash', amount: 1000000 }),
      makeItem({ code: '1120', name: '売掛金', nameEn: 'Accounts Receivable', amount: 500000 }),
    ],
    liabilities: [
      makeItem({ code: '2110', name: '買掛金', nameEn: 'Accounts Payable', amount: 300000 }),
    ],
    equity: [makeItem({ code: '3110', name: '資本金', nameEn: 'Capital Stock', amount: 1200000 })],
    totalAssets: 1500000,
    totalLiabilities: 450000,
    totalEquity: 2000000,
    ...overrides,
  }
}

function rowFor(text: string) {
  const cell = screen.getByText(text)
  return cell.closest('tr') as HTMLElement
}

describe('conversion/balance-sheet-table — default render (showSource off)', () => {
  it('renders the table with the three fixed header columns and no source column', () => {
    render(<BalanceSheetTable data={makeSheet()} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'コード' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '科目名' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '金額' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'ソース' })).not.toBeInTheDocument()
  })

  it('renders a section title row, the item rows, and a total row for each section', () => {
    render(<BalanceSheetTable data={makeSheet()} />)

    for (const title of ['資産', '負債', '株主資本']) {
      expect(screen.getByText(title)).toBeInTheDocument()
      expect(screen.getByText(new RegExp(`${title}\\s*合計`))).toBeInTheDocument()
    }

    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(10)
  })

  it('renders each item code, name and ja-JP formatted amount', () => {
    render(<BalanceSheetTable data={makeSheet()} />)

    const cashRow = rowFor('1100')
    expect(within(cashRow).getByText('現金')).toBeInTheDocument()
    expect(within(cashRow).getByText(jaFormat(1000000))).toBeInTheDocument()

    const arRow = rowFor('1120')
    expect(within(arRow).getByText('売掛金')).toBeInTheDocument()
    expect(within(arRow).getByText(jaFormat(500000))).toBeInTheDocument()

    const apRow = rowFor('2110')
    expect(within(apRow).getByText('買掛金')).toBeInTheDocument()
    expect(within(apRow).getByText(jaFormat(300000))).toBeInTheDocument()

    const capitalRow = rowFor('3110')
    expect(within(capitalRow).getByText('資本金')).toBeInTheDocument()
    expect(within(capitalRow).getByText(jaFormat(1200000))).toBeInTheDocument()
  })

  it('renders the three section totals as formatted amounts', () => {
    render(<BalanceSheetTable data={makeSheet()} />)

    expect(screen.getByText(jaFormat(1500000))).toBeInTheDocument()
    expect(screen.getByText(jaFormat(450000))).toBeInTheDocument()
    expect(screen.getByText(jaFormat(2000000))).toBeInTheDocument()
  })

  it('uses a 3-column span for the section title and total rows when source is hidden', () => {
    render(<BalanceSheetTable data={makeSheet()} />)

    const titleCell = screen.getByText('資産')
    expect(titleCell).toHaveAttribute('colspan', '3')

    const totalCell = screen.getByText(new RegExp('資産\\s*合計'))
    expect(totalCell).toHaveAttribute('colspan', '2')
  })
})

describe('conversion/balance-sheet-table — showSource on', () => {
  it('adds the ソース column header and widens the section spans to 4 columns', () => {
    render(<BalanceSheetTable data={makeSheet()} showSource />)

    expect(screen.getByRole('columnheader', { name: 'ソース' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)

    const titleCell = screen.getByText('資産')
    expect(titleCell).toHaveAttribute('colspan', '4')

    const totalCell = screen.getByText(new RegExp('資産\\s*合計'))
    expect(totalCell).toHaveAttribute('colspan', '3')
  })

  it('renders the source account code cell for every item', () => {
    render(
      <BalanceSheetTable
        data={makeSheet({
          assets: [
            makeItem({
              code: '1100',
              name: '現金',
              nameEn: 'Cash',
              amount: 1000000,
              sourceAccountCode: 'SRC-1000',
            }),
          ],
          liabilities: [
            makeItem({
              code: '2110',
              name: '買掛金',
              nameEn: 'Accounts Payable',
              amount: 300000,
              sourceAccountCode: 'SRC-2000',
            }),
          ],
          equity: [],
          totalAssets: 1000000,
          totalLiabilities: 300000,
          totalEquity: 0,
        })}
        showSource
      />
    )

    const cashRow = rowFor('1100')
    expect(within(cashRow).getByText('SRC-1000')).toBeInTheDocument()

    const apRow = rowFor('2110')
    expect(within(apRow).getByText('SRC-2000')).toBeInTheDocument()
  })

  it('falls back to a dash when an item has no sourceAccountCode', () => {
    render(
      <BalanceSheetTable
        data={makeSheet({
          assets: [makeItem({ code: '1100', name: '現金', nameEn: 'Cash', amount: 1000000 })],
          liabilities: [],
          equity: [],
          totalAssets: 1000000,
          totalLiabilities: 0,
          totalEquity: 0,
        })}
        showSource
      />
    )

    const cashRow = rowFor('1100')
    expect(within(cashRow).getByText('-')).toBeInTheDocument()
  })
})

describe('conversion/balance-sheet-table — amount formatting (ja-JP)', () => {
  const formatSheet = (assetsAmount: number, total: number): ConvertedBalanceSheet =>
    makeSheet({
      assets: [makeItem({ code: '1100', name: '現金', nameEn: 'Cash', amount: assetsAmount })],
      liabilities: [],
      equity: [],
      totalAssets: total,
      totalLiabilities: 0,
      totalEquity: 0,
    })

  it('groups large amounts with thousands separators', () => {
    render(<BalanceSheetTable data={formatSheet(1234567890, 1234567890)} />)

    expect(screen.getAllByText('1,234,567,890').length).toBeGreaterThanOrEqual(1)
  })

  it('renders zero as "0"', () => {
    render(<BalanceSheetTable data={formatSheet(0, 0)} />)

    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1)
  })

  it('renders negative amounts with a leading minus and grouping', () => {
    render(<BalanceSheetTable data={formatSheet(-1000000, -1000000)} />)

    expect(screen.getAllByText('-1,000,000').length).toBeGreaterThanOrEqual(1)
  })

  it('keeps amounts right-aligned via the text-right utility class', () => {
    const { container } = render(<BalanceSheetTable data={formatSheet(1000, 1000)} />)

    const amountCells = container.querySelectorAll('td.text-right')
    expect(amountCells.length).toBeGreaterThan(0)
  })
})

describe('conversion/balance-sheet-table — fail-safe / edge cases', () => {
  it('renders only the title and total rows for an empty section (no item rows)', () => {
    render(<BalanceSheetTable data={makeSheet({ assets: [], liabilities: [], equity: [] })} />)

    expect(screen.getByText('資産')).toBeInTheDocument()
    expect(screen.getByText('負債')).toBeInTheDocument()
    expect(screen.getByText('株主資本')).toBeInTheDocument()

    for (const total of ['資産', '負債', '株主資本']) {
      expect(screen.getByText(new RegExp(`${total}\\s*合計`))).toBeInTheDocument()
    }

    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(6)
  })

  it('still formats a zero total as "0" for an empty section', () => {
    render(
      <BalanceSheetTable
        data={makeSheet({
          assets: [],
          liabilities: [],
          equity: [],
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
        })}
      />
    )

    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3)
  })

  it('merges the custom className onto the root alongside the base border classes', () => {
    const { container } = render(
      <BalanceSheetTable data={makeSheet()} className="my-custom-class" />
    )

    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('rounded-lg')).toBe(true)
    expect(root.classList.contains('border')).toBe(true)
    expect(root.classList.contains('my-custom-class')).toBe(true)
  })
})

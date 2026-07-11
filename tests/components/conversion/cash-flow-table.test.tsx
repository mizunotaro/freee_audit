import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CashFlowTable } from '@/components/conversion/cash-flow-table'
import type { ConvertedCashFlow } from '@/types/conversion'

type CashFlowItem = {
  code: string
  name: string
  nameEn: string
  amount: number
  sourceAccountCode?: string
}

function makeItem(overrides: Partial<CashFlowItem> = {}): CashFlowItem {
  return {
    code: '100',
    name: '税引前純利益',
    nameEn: 'Net Income Before Tax',
    amount: 1000,
    sourceAccountCode: '4110',
    ...overrides,
  }
}

function makeData(overrides: Partial<ConvertedCashFlow> = {}): ConvertedCashFlow {
  return {
    periodStart: new Date('2024-01-01T00:00:00.000Z'),
    periodEnd: new Date('2024-12-31T00:00:00.000Z'),
    operatingActivities: [makeItem({ code: '100', name: '営業項目A', amount: 1234567 })],
    investingActivities: [makeItem({ code: '200', name: '投資項目A', amount: -500000 })],
    financingActivities: [makeItem({ code: '300', name: '財務項目A', amount: 250000 })],
    netCashFromOperating: 900000,
    netCashFromInvesting: -300000,
    netCashFromFinancing: 600000,
    netChangeInCash: 1200000,
    ...overrides,
  }
}

describe('conversion/cash-flow-table — structure (default showSource=false)', () => {
  it('renders a single table', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })

  it('renders the three section headers and the net-change subtotal label', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.getByText('営業活動によるキャッシュフロー')).toBeInTheDocument()
    expect(screen.getByText('投資活動によるキャッシュフロー')).toBeInTheDocument()
    expect(screen.getByText('財務活動によるキャッシュフロー')).toBeInTheDocument()
    expect(screen.getByText('現金及び現金同等物の純増減')).toBeInTheDocument()
  })

  it('renders the column headers without the source column by default', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.getByText('コード')).toBeInTheDocument()
    expect(screen.getByText('科目名')).toBeInTheDocument()
    expect(screen.getByText('金額')).toBeInTheDocument()
    expect(screen.queryByText('ソース')).not.toBeInTheDocument()
  })

  it('renders each line item code and name', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.getByText('営業項目A')).toBeInTheDocument()
    expect(screen.getByText('投資項目A')).toBeInTheDocument()
    expect(screen.getByText('財務項目A')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('renders the Japanese (name) label, not the English (nameEn) label', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.queryByText('Net Income Before Tax')).not.toBeInTheDocument()
  })

  it('renders a subtotal row labelled "<section> 合計" for each section', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.getByText('営業活動によるキャッシュフロー 合計')).toBeInTheDocument()
    expect(screen.getByText('投資活動によるキャッシュフロー 合計')).toBeInTheDocument()
    expect(screen.getByText('財務活動によるキャッシュフロー 合計')).toBeInTheDocument()
  })

  it('does not render the source column in line-item rows by default', () => {
    const { container } = render(<CashFlowTable data={makeData()} />)
    const rows = container.querySelectorAll('tbody tr')
    const itemRow = Array.from(rows).find((tr) => tr.textContent?.includes('営業項目A'))
    expect(itemRow).toBeDefined()
    expect(itemRow!.querySelectorAll('td')).toHaveLength(3)
  })
})

describe('conversion/cash-flow-table — amount formatting (ja-JP)', () => {
  it('formats amounts with the ja-JP thousands grouping', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getByText('900,000')).toBeInTheDocument()
    expect(screen.getByText('1,200,000')).toBeInTheDocument()
  })

  it('formats negative outflow amounts with a leading minus', () => {
    render(<CashFlowTable data={makeData()} />)
    expect(screen.getByText('-500,000')).toBeInTheDocument()
    expect(screen.getByText('-300,000')).toBeInTheDocument()
  })

  it('renders the passed-through totals verbatim (does not recompute from line items)', () => {
    const data = makeData({
      operatingActivities: [makeItem({ code: '110', name: 'X', amount: 100 })],
      netCashFromOperating: 999,
    })
    render(<CashFlowTable data={data} />)
    const subtotalRow = screen.getByText('営業活動によるキャッシュフロー 合計').closest('tr')
    expect(subtotalRow).toHaveTextContent('999')
  })

  it('formats zero amounts as "0"', () => {
    render(
      <CashFlowTable
        data={makeData({
          operatingActivities: [],
          investingActivities: [],
          financingActivities: [],
          netCashFromOperating: 0,
          netCashFromInvesting: 0,
          netCashFromFinancing: 0,
          netChangeInCash: 0,
        })}
      />
    )
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4)
  })

  it('formats a large (max-ish) amount without losing precision', () => {
    render(
      <CashFlowTable
        data={makeData({
          operatingActivities: [makeItem({ code: '100', name: '巨大', amount: 1234567890 })],
          netCashFromOperating: 1234567890,
        })}
      />
    )
    expect(screen.getAllByText('1,234,567,890').length).toBeGreaterThanOrEqual(1)
  })
})

describe('conversion/cash-flow-table — showSource column', () => {
  it('adds the ソース column header when showSource is true', () => {
    render(<CashFlowTable data={makeData()} showSource />)
    expect(screen.getByText('ソース')).toBeInTheDocument()
  })

  it('renders the sourceAccountCode in each line-item row when showSource is true', () => {
    const data = makeData({
      operatingActivities: [
        makeItem({ code: '100', name: '営業項目A', amount: 1, sourceAccountCode: '4110' }),
      ],
      investingActivities: [
        makeItem({ code: '200', name: '投資項目A', amount: -1, sourceAccountCode: '1700' }),
      ],
      financingActivities: [
        makeItem({ code: '300', name: '財務項目A', amount: 1, sourceAccountCode: '2100' }),
      ],
    })
    render(<CashFlowTable data={data} showSource />)
    expect(screen.getByText('4110')).toBeInTheDocument()
    expect(screen.getByText('1700')).toBeInTheDocument()
    expect(screen.getByText('2100')).toBeInTheDocument()
  })

  it('line-item rows have 4 cells (code, name, source, amount) when showSource is true', () => {
    const { container } = render(<CashFlowTable data={makeData()} showSource />)
    const rows = container.querySelectorAll('tbody tr')
    const itemRow = Array.from(rows).find((tr) => tr.textContent?.includes('営業項目A'))
    expect(itemRow).toBeDefined()
    expect(itemRow!.querySelectorAll('td')).toHaveLength(4)
  })

  it('falls back to "-" for line items whose sourceAccountCode is missing', () => {
    const data = makeData({
      operatingActivities: [
        makeItem({ code: '100', name: '営業項目A', amount: 1, sourceAccountCode: undefined }),
      ],
      investingActivities: [],
      financingActivities: [],
    })
    render(<CashFlowTable data={data} showSource />)
    const itemRow = screen.getByText('営業項目A').closest('tr')
    expect(itemRow).not.toBeNull()
    expect(within(itemRow!).getByText('-')).toBeInTheDocument()
  })
})

describe('conversion/cash-flow-table — colSpan logic', () => {
  it('uses colSpan 3 for section headers and 2 for subtotals when showSource is false', () => {
    const { container } = render(<CashFlowTable data={makeData()} />)
    const sectionHeaderCells = container.querySelectorAll('td[colspan="3"]')
    expect(sectionHeaderCells).toHaveLength(3)
    const subtotalCells = container.querySelectorAll('td[colspan="2"]')
    expect(subtotalCells).toHaveLength(4)
  })

  it('uses colSpan 4 for section headers and 3 for subtotals when showSource is true', () => {
    const { container } = render(<CashFlowTable data={makeData()} showSource />)
    const sectionHeaderCells = container.querySelectorAll('td[colspan="4"]')
    expect(sectionHeaderCells).toHaveLength(3)
    const subtotalCells = container.querySelectorAll('td[colspan="3"]')
    expect(subtotalCells).toHaveLength(4)
  })

  it('places the section title in the colSpan header cell', () => {
    render(<CashFlowTable data={makeData()} />)
    const cell = screen.getByText('投資活動によるキャッシュフロー')
    expect(cell).toHaveAttribute('colspan', '3')
  })
})

describe('conversion/cash-flow-table — edge cases', () => {
  it('renders section headers and subtotal rows even when every line-item array is empty', () => {
    const { container } = render(
      <CashFlowTable
        data={makeData({
          operatingActivities: [],
          investingActivities: [],
          financingActivities: [],
        })}
      />
    )
    expect(screen.getByText('営業活動によるキャッシュフロー')).toBeInTheDocument()
    expect(screen.getByText('営業活動によるキャッシュフロー 合計')).toBeInTheDocument()
    expect(screen.getByText('投資活動によるキャッシュフロー 合計')).toBeInTheDocument()
    expect(screen.getByText('財務活動によるキャッシュフロー 合計')).toBeInTheDocument()
    expect(screen.getByText('現金及び現金同等物の純増減')).toBeInTheDocument()
    expect(container.querySelectorAll('tbody tr').length).toBe(7)
  })

  it('renders multiple line items within a section', () => {
    const data = makeData({
      operatingActivities: [
        makeItem({ code: '110', name: '営業A', amount: 100 }),
        makeItem({ code: '120', name: '営業B', amount: 200 }),
        makeItem({ code: '130', name: '営業C', amount: 300 }),
      ],
      investingActivities: [],
      financingActivities: [],
    })
    render(<CashFlowTable data={data} />)
    expect(screen.getByText('営業A')).toBeInTheDocument()
    expect(screen.getByText('営業B')).toBeInTheDocument()
    expect(screen.getByText('営業C')).toBeInTheDocument()
  })

  it('applies a merged custom className to the root wrapper', () => {
    const { container } = render(<CashFlowTable data={makeData()} className="my-extra-class" />)
    const root = container.firstElementChild
    expect(root).not.toBeNull()
    expect(root!.classList.contains('rounded-lg')).toBe(true)
    expect(root!.classList.contains('border')).toBe(true)
    expect(root!.classList.contains('my-extra-class')).toBe(true)
  })

  it('renders without showSource and without className (all-optional defaults)', () => {
    expect(() => render(<CashFlowTable data={makeData()} />)).not.toThrow()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

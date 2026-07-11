import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccountSearchDialog } from '@/components/conversion/account-search-dialog'
import type { ChartOfAccountItem } from '@/types/conversion'

// Radix ScrollArea reads ResizeObserver at mount; jsdom does not provide it.
vi.stubGlobal(
  'ResizeObserver',
  vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
)

function makeItem(overrides: Partial<ChartOfAccountItem> = {}): ChartOfAccountItem {
  return {
    id: 'a1',
    code: '1000',
    name: '現金',
    nameEn: 'Cash',
    standard: 'JGAAP',
    category: 'current_asset',
    normalBalance: 'debit',
    level: 0,
    isConvertible: true,
    ...overrides,
  }
}

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  onSelect: vi.fn(),
}

function itemButtonByName(name: string): HTMLElement {
  const text = screen.getByText(name)
  const button = text.closest('button')
  if (!button) throw new Error(`button containing "${name}" not found`)
  return button
}

describe('conversion/account-search-dialog — rendering & defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog with default title and description when open', () => {
    render(<AccountSearchDialog items={[makeItem()]} {...baseProps} />)

    expect(screen.getByText('勘定科目検索')).toBeInTheDocument()
    expect(screen.getByText('勘定科目を検索して選択してください')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('コードまたは名称で検索...')).toBeInTheDocument()
  })

  it('honours custom title and description overrides', () => {
    render(
      <AccountSearchDialog
        items={[makeItem()]}
        {...baseProps}
        title="対象科目の選択"
        description="マッピング先を選んでください"
      />
    )

    expect(screen.getByText('対象科目の選択')).toBeInTheDocument()
    expect(screen.getByText('マッピング先を選んでください')).toBeInTheDocument()
    expect(screen.queryByText('勘定科目検索')).not.toBeInTheDocument()
  })

  it('does not render dialog content when closed', () => {
    render(<AccountSearchDialog items={[makeItem()]} {...baseProps} open={false} />)

    expect(screen.queryByText('勘定科目検索')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('コードまたは名称で検索...')).not.toBeInTheDocument()
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
  })
})

describe('conversion/account-search-dialog — search filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows every item when the query is empty', () => {
    const items = [
      makeItem({ id: 'a1', code: '1000', name: '現金', nameEn: 'Cash' }),
      makeItem({ id: 'a2', code: '2000', name: '売掛金', nameEn: 'Accounts Receivable' }),
      makeItem({ id: 'a3', code: '4000', name: '売上高', nameEn: 'Revenue', category: 'revenue' }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('売掛金')).toBeInTheDocument()
    expect(screen.getByText('売上高')).toBeInTheDocument()
  })

  it('filters case-insensitively by account code', () => {
    const items = [
      makeItem({ id: 'a1', code: '1000', name: '現金', nameEn: 'Cash' }),
      makeItem({ id: 'a2', code: '2000', name: '売掛金', nameEn: 'Accounts Receivable' }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: '10' },
    })

    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.queryByText('売掛金')).not.toBeInTheDocument()
  })

  it('filters by Japanese name', () => {
    const items = [
      makeItem({ id: 'a1', name: '現金', nameEn: 'Cash' }),
      makeItem({ id: 'a2', name: '売掛金', nameEn: 'Accounts Receivable' }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: '売掛金' },
    })

    expect(screen.getByText('売掛金')).toBeInTheDocument()
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
  })

  it('filters case-insensitively by English name', () => {
    const items = [
      makeItem({ id: 'a1', name: '現金', nameEn: 'Cash' }),
      makeItem({ id: 'a2', name: '売掛金', nameEn: 'Accounts Receivable' }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: 'receivable' },
    })

    expect(screen.getByText('売掛金')).toBeInTheDocument()
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
  })

  it('shows the empty-state copy when the query matches nothing', () => {
    render(<AccountSearchDialog items={[makeItem()]} {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: 'zzzz-not-a-match' },
    })

    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
  })

  it('collapses back to the full list when the query is cleared', () => {
    const items = [
      makeItem({ id: 'a1', name: '現金', nameEn: 'Cash' }),
      makeItem({ id: 'a2', name: '売掛金', nameEn: 'Accounts Receivable' }),
    ]
    const input = () => screen.getByPlaceholderText('コードまたは名称で検索...')

    render(<AccountSearchDialog items={items} {...baseProps} />)

    fireEvent.change(input(), { target: { value: 'zzzz' } })
    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()

    fireEvent.change(input(), { target: { value: '' } })
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('売掛金')).toBeInTheDocument()
  })
})

describe('conversion/account-search-dialog — grouping & labels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('groups items by category and renders the Japanese label for each group', () => {
    const items = [
      makeItem({ id: 'a1', name: '現金', category: 'current_asset' }),
      makeItem({ id: 'a2', name: '売上高', category: 'revenue' }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    expect(screen.getByText('流動資産')).toBeInTheDocument()
    expect(screen.getByText('売上')).toBeInTheDocument()
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('売上高')).toBeInTheDocument()
  })

  it('collects multiple items under the same category group', () => {
    const items = [
      makeItem({ id: 'a1', code: '1000', name: '現金' }),
      makeItem({ id: 'a2', code: '1100', name: '当座預金' }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    // two current_asset items collapse into a single group label
    expect(screen.getAllByText('流動資産')).toHaveLength(1)
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('当座預金')).toBeInTheDocument()
  })

  it('routes a missing category into the "other" / その他 fail-safe group', () => {
    const items = [
      makeItem({
        id: 'a1',
        name: '現金',
        category: undefined as unknown as ChartOfAccountItem['category'],
      }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    expect(screen.getByText('その他')).toBeInTheDocument()
    expect(screen.getByText('現金')).toBeInTheDocument()
  })

  it('falls back to the raw category string for an unmapped label', () => {
    const items = [
      makeItem({
        id: 'a1',
        name: '特殊科目',
        category: 'mystery_bucket' as ChartOfAccountItem['category'],
      }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} />)

    expect(screen.getByText('mystery_bucket')).toBeInTheDocument()
    expect(screen.getByText('特殊科目')).toBeInTheDocument()
  })
})

describe('conversion/account-search-dialog — selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invokes onSelect with the chosen item, closes the dialog, and resets the query', () => {
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    const item = makeItem({ id: 'a1', name: '現金', nameEn: 'Cash' })

    render(
      <AccountSearchDialog items={[item]} open onSelect={onSelect} onOpenChange={onOpenChange} />
    )

    const input = screen.getByPlaceholderText('コードまたは名称で検索...')
    fireEvent.change(input, { target: { value: 'cash' } })
    // query is currently filtering — selection should hand back the full item and clear it
    fireEvent.click(itemButtonByName('現金'))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith(item)
    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    // internal query state reset
    expect(input).toHaveValue('')
  })

  it('highlights the selected item with a check marker and selected styling', () => {
    const items = [
      makeItem({ id: 'a1', code: '1000', name: '現金', nameEn: 'Cash' }),
      makeItem({ id: 'a2', code: '2000', name: '売掛金', nameEn: 'Accounts Receivable' }),
    ]

    render(<AccountSearchDialog items={items} {...baseProps} selectedId="a1" />)

    const selected = itemButtonByName('現金')
    const other = itemButtonByName('売掛金')

    expect(selected).toHaveClass('border-primary')
    expect(selected.querySelector('svg')).not.toBeNull()
    expect(other).not.toHaveClass('border-primary')
    expect(other.querySelector('svg')).toBeNull()
  })
})

describe('conversion/account-search-dialog — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders only the empty state for an empty item list', () => {
    render(<AccountSearchDialog items={[]} {...baseProps} />)

    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()
    // no item rows: each row renders a <code> chip, none should exist
    expect(document.body.querySelectorAll('code')).toHaveLength(0)
  })

  it('renders item code and English name alongside the Japanese name', () => {
    render(<AccountSearchDialog items={[makeItem()]} {...baseProps} />)

    expect(screen.getByText('1000')).toBeInTheDocument()
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })
})

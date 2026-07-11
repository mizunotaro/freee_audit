import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AccountCodeSelector } from '@/components/conversion/account-code-selector'
import type { ChartOfAccountItem, AccountCategory } from '@/types/conversion'

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}))

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: ({
    value,
    onValueChange,
    placeholder,
  }: {
    value: string
    onValueChange: (v: string) => void
    placeholder?: string
  }) => (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function makeItem(overrides: Partial<ChartOfAccountItem> = {}): ChartOfAccountItem {
  return {
    id: 'item-1',
    code: '1110',
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

const onChange = vi.fn()

function renderSelector(props: Partial<Parameters<typeof AccountCodeSelector>[0]> = {}) {
  const { items: itemsProp, ...rest } = props
  const items = itemsProp ?? [makeItem()]
  return render(<AccountCodeSelector {...rest} items={items} onChange={onChange} />)
}

function rowFor(text: string): HTMLElement {
  const el = screen.getByText(text)
  const row = el.closest('[class*="cursor-pointer"]')
  if (!row) throw new Error(`row for "${text}" not found`)
  return row as HTMLElement
}

describe('conversion/account-code-selector — trigger / display', () => {
  beforeEach(() => onChange.mockReset())

  it('renders the default placeholder when no value is selected', () => {
    renderSelector({ items: [] })
    expect(screen.getByRole('combobox')).toHaveTextContent('勘定科目を選択')
  })

  it('renders a custom placeholder when provided', () => {
    renderSelector({ items: [], placeholder: '科目を選んでください' })
    expect(screen.getByRole('combobox')).toHaveTextContent('科目を選んでください')
  })

  it('shows the selected item code and name in the trigger when value matches', () => {
    const item = makeItem({ id: 'item-1', code: '1110', name: '現金' })
    renderSelector({ items: [item], value: 'item-1' })
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('1110')
    expect(trigger).toHaveTextContent('現金')
  })

  it('degrades to the placeholder when the value does not match any item', () => {
    const item = makeItem({ id: 'item-1', code: '1110', name: '現金' })
    renderSelector({ items: [item], value: 'does-not-exist' })
    expect(screen.getByRole('combobox')).toHaveTextContent('勘定科目を選択')
  })

  it('disables the trigger button when disabled is true', () => {
    renderSelector({ items: [], disabled: true })
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})

describe('conversion/account-code-selector — search filtering', () => {
  beforeEach(() => onChange.mockReset())

  const items: ChartOfAccountItem[] = [
    makeItem({ id: 'a', code: '1110', name: '現金', nameEn: 'Cash', category: 'current_asset' }),
    makeItem({
      id: 'b',
      code: '1120',
      name: '当座預金',
      nameEn: 'Checking',
      category: 'current_asset',
    }),
    makeItem({ id: 'c', code: '4110', name: '売上', nameEn: 'Revenue', category: 'revenue' }),
  ]

  it('renders every item when the search box is empty', () => {
    renderSelector({ items })
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('当座預金')).toBeInTheDocument()
    expect(screen.getByText('売上')).toBeInTheDocument()
  })

  it('filters by code (case-insensitive substring)', () => {
    renderSelector({ items })
    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: '112' },
    })
    expect(screen.getByText('当座預金')).toBeInTheDocument()
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
    expect(screen.queryByText('売上')).not.toBeInTheDocument()
  })

  it('filters by Japanese name', () => {
    renderSelector({ items })
    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: '当座' },
    })
    expect(screen.getByText('当座預金')).toBeInTheDocument()
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
  })

  it('filters by English name (case-insensitive)', () => {
    renderSelector({ items })
    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: 'cash' },
    })
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.queryByText('当座預金')).not.toBeInTheDocument()
  })

  it('shows no item rows when the search matches nothing', () => {
    const { container } = renderSelector({ items })
    fireEvent.change(screen.getByPlaceholderText('コードまたは名称で検索...'), {
      target: { value: 'zzzzz' },
    })
    expect(container.querySelectorAll('.w-16')).toHaveLength(0)
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
  })
})

describe('conversion/account-code-selector — category filter', () => {
  beforeEach(() => onChange.mockReset())

  it('keeps only items whose category is in categoryFilter', () => {
    const items: ChartOfAccountItem[] = [
      makeItem({ id: 'a', code: '1110', name: '現金', category: 'current_asset' }),
      makeItem({ id: 'b', code: '4110', name: '売上', category: 'revenue' }),
      makeItem({ id: 'c', code: '5110', name: '仕入', category: 'cogs' }),
    ]
    const filter: AccountCategory[] = ['current_asset', 'revenue']
    renderSelector({ items, categoryFilter: filter })
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('売上')).toBeInTheDocument()
    expect(screen.queryByText('仕入')).not.toBeInTheDocument()
  })
})

describe('conversion/account-code-selector — hierarchy', () => {
  beforeEach(() => onChange.mockReset())

  it('renders root items and their children, each sorted numerically by code', () => {
    const items: ChartOfAccountItem[] = [
      makeItem({ id: 'root2', code: '2000', name: '固定資産', parentId: undefined }),
      makeItem({ id: 'root1', code: '1000', name: '流動資産親', parentId: undefined }),
      makeItem({ id: 'c3', code: '1190', name: 'その他', parentId: 'root1' }),
      makeItem({ id: 'c1', code: '1110', name: '現金', parentId: 'root1' }),
      makeItem({ id: 'c2', code: '1120', name: '当座預金', parentId: 'root1' }),
    ]
    const { container } = renderSelector({ items })
    const codes = Array.from(container.querySelectorAll('.w-16')).map((el) => el.textContent)
    expect(codes).toEqual(['1000', '1110', '1120', '1190', '2000'])
  })

  it('treats an item whose parent is missing as a root (fail-safe)', () => {
    const items: ChartOfAccountItem[] = [
      makeItem({ id: 'orphan', code: '1500', name: '孤立科目', parentId: 'ghost' }),
      makeItem({ id: 'root1', code: '1000', name: '流動資産親', parentId: undefined }),
    ]
    const { container } = renderSelector({ items })
    expect(screen.getByText('孤立科目')).toBeInTheDocument()
    const codes = Array.from(container.querySelectorAll('.w-16')).map((el) => el.textContent)
    expect(codes).toEqual(['1000', '1500'])
  })

  it('collapses nested levels deeper than the root by default', () => {
    const items: ChartOfAccountItem[] = [
      makeItem({ id: 'p', code: '1000', name: '親科目P', parentId: undefined }),
      makeItem({ id: 'c', code: '1100', name: '中科目C', parentId: 'p' }),
      makeItem({ id: 'g', code: '1110', name: '孫科目G', parentId: 'c' }),
    ]
    renderSelector({ items })
    expect(screen.getByText('中科目C')).toBeInTheDocument()
    expect(screen.queryByText('孫科目G')).not.toBeInTheDocument()
  })

  it('reveals nested children after toggling the parent expand button', () => {
    const items: ChartOfAccountItem[] = [
      makeItem({ id: 'p', code: '1000', name: '親科目P', parentId: undefined }),
      makeItem({ id: 'c', code: '1100', name: '中科目C', parentId: 'p' }),
      makeItem({ id: 'g', code: '1110', name: '孫科目G', parentId: 'c' }),
    ]
    renderSelector({ items })
    const toggle = within(rowFor('中科目C')).getByRole('button')
    fireEvent.click(toggle)
    expect(screen.getByText('孫科目G')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('conversion/account-code-selector — selection', () => {
  beforeEach(() => onChange.mockReset())

  it('emits onChange with the id and full item when a leaf row is clicked', () => {
    const leaf = makeItem({ id: 'leaf', code: '1110', name: '現金', nameEn: 'Cash' })
    renderSelector({ items: [leaf] })
    fireEvent.click(screen.getByText('現金'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      'leaf',
      expect.objectContaining({ id: 'leaf', code: '1110', name: '現金', nameEn: 'Cash' })
    )
  })

  it('does not emit onChange when a parent row (with children) is clicked', () => {
    const items: ChartOfAccountItem[] = [
      makeItem({ id: 'p', code: '1000', name: '親科目P', parentId: undefined }),
      makeItem({ id: 'c', code: '1110', name: '現金', parentId: 'p' }),
    ]
    renderSelector({ items })
    fireEvent.click(screen.getByText('親科目P'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('conversion/account-code-selector — display options', () => {
  beforeEach(() => onChange.mockReset())

  it('renders the category badge by default and hides it when showCategoryBadge is false', () => {
    const item = makeItem({ id: 'a', code: '1110', name: '現金', category: 'current_asset' })
    const { rerender } = renderSelector({ items: [item] })
    expect(screen.getByText('流動資産')).toBeInTheDocument()

    rerender(<AccountCodeSelector items={[item]} onChange={onChange} showCategoryBadge={false} />)
    expect(screen.queryByText('流動資産')).not.toBeInTheDocument()
  })

  it('hides the English name by default and shows it when showEnglishName is true', () => {
    const item = makeItem({ id: 'a', code: '1110', name: '現金', nameEn: 'Cash' })
    const { rerender } = renderSelector({ items: [item] })
    expect(screen.queryByText('Cash')).not.toBeInTheDocument()

    rerender(<AccountCodeSelector items={[item]} onChange={onChange} showEnglishName />)
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })
})

describe('conversion/account-code-selector — edge cases', () => {
  beforeEach(() => onChange.mockReset())

  it('renders only the trigger and renders no item rows when items is empty', () => {
    const { container } = renderSelector({ items: [] })
    expect(screen.getByRole('combobox')).toHaveTextContent('勘定科目を選択')
    expect(container.querySelectorAll('.w-16')).toHaveLength(0)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MappingFilters, type MappingFilterValues } from '@/components/conversion/mapping-filters'

// The component is built on Radix-based shadcn primitives (Sheet = Radix Dialog,
// Select = Radix Select, Slider = Radix Slider) whose portals / pointer-capture
// behaviour does not work in jsdom. These primitives are a UI boundary, not the
// logic under test. We follow the established repo pattern (see
// tests/unit/.../FallbackInput.test.tsx, ProposalList.test.tsx, sidebar.test.tsx)
// and replace them with native equivalents that keep the component's own
// value -> onValueChange / onChange wiring live and drivable, instead of a blind
// pass-through that would hide the filter logic.
vi.mock('@/components/ui/sheet', () => {
  const Pass = ({ children }: { children?: ReactNode }) => children ?? null
  return {
    Sheet: ({ children }: { children?: ReactNode }) => <>{children}</>,
    SheetTrigger: Pass,
    SheetContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    SheetDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  }
})

vi.mock('@/components/ui/select', () => {
  const React: typeof import('react') = require('react')
  const SelectItem = () => null

  type Item = { value: string; label: string }

  function collectItems(node: React.ReactNode): Item[] {
    const items: Item[] = []
    const walk = (n: React.ReactNode) => {
      React.Children.forEach(n, (child) => {
        if (!React.isValidElement(child)) return
        if (child.type === SelectItem) {
          const raw = (child.props as { children?: ReactNode }).children
          const label = typeof raw === 'string' ? raw : String(raw ?? '')
          items.push({ value: (child.props as { value: string }).value, label })
          return
        }
        if (child.props && child.props.children) walk(child.props.children)
      })
    }
    walk(node)
    return items
  }

  // The five selects are told apart by their own SelectItem label signature.
  // isApproved / isManualReview share identical *values* (''/'true'/'false') so
  // values alone are ambiguous — labels (承認済み vs 要レビュー) are unique.
  function testidFor(items: Item[]): string {
    const labels = items.map((i) => i.label).join('|')
    if (labels.includes('1対1')) return 'mapping-type-select'
    if (labels.includes('承認済み')) return 'is-approved-select'
    if (labels.includes('要レビュー')) return 'is-manual-review-select'
    return 'coa-select'
  }

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    children?: ReactNode
  }) => {
    const items = collectItems(children)
    return React.createElement(
      'select',
      {
        'data-testid': testidFor(items),
        value: value ?? '',
        onChange: (e: { target: { value: string } }) => onValueChange?.(e.target.value),
      },
      items.map((i) =>
        React.createElement('option', { key: `${i.value}|${i.label}`, value: i.value }, i.label)
      )
    )
  }
  const Pass = ({ children }: { children?: ReactNode }) => children ?? null
  return {
    Select,
    SelectContent: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue: Pass,
  }
})

vi.mock('@/components/ui/slider', () => {
  const React: typeof import('react') = require('react')
  const Slider = ({
    value,
    onValueChange,
    max,
    step,
  }: {
    value?: number[]
    onValueChange?: (v: number[]) => void
    max?: number
    step?: number
  }) =>
    React.createElement('input', {
      type: 'range',
      'data-testid': 'min-confidence-slider',
      value: Array.isArray(value) ? value[0] : value,
      max,
      step,
      onChange: (e: { target: { value: string } }) => onValueChange?.([Number(e.target.value)]),
    })
  return { Slider }
})

const SOURCE_COAS = [
  { id: 'src-cash', name: '現金' },
  { id: 'src-bank', name: '銀行預金' },
]
const TARGET_COAS = [
  { id: 'tgt-cash', name: 'Cash' },
  { id: 'tgt-ar', name: 'Accounts Receivable' },
]

function renderFilters(
  filters: MappingFilterValues = {},
  overrides: {
    sourceCoas?: Array<{ id: string; name: string }>
    targetCoas?: Array<{ id: string; name: string }>
  } = {}
) {
  const onFiltersChange = vi.fn()
  const utils = render(
    <MappingFilters
      filters={filters}
      onFiltersChange={onFiltersChange}
      sourceCoas={overrides.sourceCoas ?? SOURCE_COAS}
      targetCoas={overrides.targetCoas ?? TARGET_COAS}
    />
  )
  return { ...utils, onFiltersChange }
}

const trigger = () => screen.getByRole('button', { name: /フィルター/ })
const applyBtn = () => screen.getByRole('button', { name: '適用' })
const clearBtn = () => screen.getByRole('button', { name: 'クリア' })
const searchInput = () => screen.getByPlaceholderText('勘定科目名またはコード') as HTMLInputElement
const mappingTypeSelect = () => screen.getByTestId('mapping-type-select') as HTMLSelectElement
const isApprovedSelect = () => screen.getByTestId('is-approved-select') as HTMLSelectElement
const isManualReviewSelect = () =>
  screen.getByTestId('is-manual-review-select') as HTMLSelectElement
const slider = () => screen.getByTestId('min-confidence-slider') as HTMLInputElement

// The two COA selects share testid 'coa-select'; locate the one that owns the
// given option value (source holds src-* ids, target holds tgt-* ids).
const coaSelectByOption = (optionValue: string) =>
  screen
    .getAllByTestId('coa-select')
    .find((s) =>
      [...(s as HTMLSelectElement).options].some((o) => o.value === optionValue)
    ) as HTMLSelectElement

// The active-filter badge renders as a digit appended to the trigger's text.
const badgeCount = () => {
  const match = trigger().textContent?.match(/フィルター\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

describe('MappingFilters — structure & initial render', () => {
  it('renders the trigger button, sheet title and description', () => {
    renderFilters()
    expect(trigger()).toBeInTheDocument()
    expect(screen.getByText('マッピングの絞り込み条件を設定')).toBeInTheDocument()
  })

  it('renders every filter control and the apply / clear actions', () => {
    renderFilters()
    expect(searchInput()).toBeInTheDocument()
    expect(screen.getAllByTestId('coa-select')).toHaveLength(2)
    expect(mappingTypeSelect()).toBeInTheDocument()
    expect(isApprovedSelect()).toBeInTheDocument()
    expect(isManualReviewSelect()).toBeInTheDocument()
    expect(slider()).toBeInTheDocument()
    expect(applyBtn()).toBeInTheDocument()
    expect(clearBtn()).toBeInTheDocument()
  })

  it('initialises every control from the filters prop (local state mirrors prop)', () => {
    renderFilters({
      search: 'abc',
      sourceCoaId: 'src-cash',
      targetCoaId: 'tgt-ar',
      mappingType: '1toN',
      isApproved: 'false',
      isManualReview: 'true',
      minConfidence: 60,
    })

    expect(searchInput()).toHaveValue('abc')
    expect(coaSelectByOption('src-cash')).toHaveValue('src-cash')
    expect(coaSelectByOption('tgt-ar')).toHaveValue('tgt-ar')
    expect(mappingTypeSelect()).toHaveValue('1toN')
    expect(isApprovedSelect()).toHaveValue('false')
    expect(isManualReviewSelect()).toHaveValue('true')
    expect(slider()).toHaveValue('60')
  })

  it('defaults every select to the すべて option when a value is absent', () => {
    renderFilters()
    expect(mappingTypeSelect()).toHaveValue('')
    expect(isApprovedSelect()).toHaveValue('')
    expect(isManualReviewSelect()).toHaveValue('')
    const coaSelects = screen.getAllByTestId('coa-select')
    expect(coaSelects.every((s) => (s as HTMLSelectElement).value === '')).toBe(true)
  })

  it('exposes the configured slider bounds (max 100, step 5)', () => {
    renderFilters()
    expect(slider()).toHaveAttribute('max', '100')
    expect(slider()).toHaveAttribute('step', '5')
  })
})

describe('MappingFilters — active-filter badge count', () => {
  it('shows no badge when there are no filters', () => {
    renderFilters()
    expect(badgeCount()).toBe(0)
  })

  it('counts a single set filter', () => {
    renderFilters({ search: 'x' })
    expect(badgeCount()).toBe(1)
  })

  it('counts several set filters together', () => {
    renderFilters({ search: 'x', mappingType: '1to1', minConfidence: 50 })
    expect(badgeCount()).toBe(3)
  })

  it('ignores empty-string values (treated as inactive)', () => {
    renderFilters({ search: '', mappingType: '' })
    expect(badgeCount()).toBe(0)
  })

  it('ignores undefined values (treated as inactive)', () => {
    renderFilters({ search: undefined, targetCoaId: undefined })
    expect(badgeCount()).toBe(0)
  })

  it('counts minConfidence: 0 as an active filter (documented current behaviour)', () => {
    // hasActiveFilters uses `v !== undefined && v !== ''`; the number 0 passes
    // both checks, so an explicit minConfidence of 0 is reported as active.
    renderFilters({ minConfidence: 0 })
    expect(badgeCount()).toBe(1)
  })

  it('reports the count of every simultaneously active filter', () => {
    renderFilters({
      search: 'cash',
      sourceCoaId: 'src-cash',
      isApproved: 'true',
      isManualReview: 'false',
      minConfidence: 25,
    })
    expect(badgeCount()).toBe(5)
  })
})

describe('MappingFilters — local edits → apply contract', () => {
  it('does not call onFiltersChange while editing (deferred until apply)', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(searchInput(), { target: { value: 'xyz' } })
    fireEvent.change(mappingTypeSelect(), { target: { value: '1to1' } })
    expect(onFiltersChange).not.toHaveBeenCalled()
  })

  it('commits the typed search value on apply', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(searchInput(), { target: { value: '現金' } })
    fireEvent.click(applyBtn())

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ search: '現金' }))
  })

  it('commits a mappingType selection on apply', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(mappingTypeSelect(), { target: { value: '1toN' } })
    fireEvent.click(applyBtn())

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ mappingType: '1toN' }))
  })

  it('commits isApproved and isManualReview selections independently on apply', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(isApprovedSelect(), { target: { value: 'true' } })
    fireEvent.change(isManualReviewSelect(), { target: { value: 'false' } })
    fireEvent.click(applyBtn())

    const applied = onFiltersChange.mock.calls[0][0]
    expect(applied.isApproved).toBe('true')
    expect(applied.isManualReview).toBe('false')
  })

  it('commits source / target COA selections on apply', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(coaSelectByOption('src-cash'), { target: { value: 'src-cash' } })
    fireEvent.change(coaSelectByOption('tgt-ar'), { target: { value: 'tgt-ar' } })
    fireEvent.click(applyBtn())

    const applied = onFiltersChange.mock.calls[0][0]
    expect(applied.sourceCoaId).toBe('src-cash')
    expect(applied.targetCoaId).toBe('tgt-ar')
  })

  it('converts an empty-string selection to undefined (clearing a filter)', () => {
    const { onFiltersChange } = renderFilters({ mappingType: '1to1' })

    fireEvent.change(mappingTypeSelect(), { target: { value: '' } })
    fireEvent.click(applyBtn())

    expect(onFiltersChange.mock.calls[0][0].mappingType).toBeUndefined()
  })

  it('batches every local edit into a single onFiltersChange call on apply', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(searchInput(), { target: { value: 'a' } })
    fireEvent.change(mappingTypeSelect(), { target: { value: 'complex' } })
    fireEvent.change(isApprovedSelect(), { target: { value: 'false' } })
    fireEvent.change(slider(), { target: { value: '40' } })
    fireEvent.click(applyBtn())

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'a',
        mappingType: 'complex',
        isApproved: 'false',
        minConfidence: 40,
      })
    )
  })

  it('echoes the prop filters when apply is clicked without any edits', () => {
    const { onFiltersChange } = renderFilters({ search: 'abc', mappingType: '1to1' })
    fireEvent.click(applyBtn())

    expect(onFiltersChange).toHaveBeenCalledWith({ search: 'abc', mappingType: '1to1' })
  })
})

describe('MappingFilters — clear', () => {
  it('emits an empty object and fires exactly once', () => {
    const { onFiltersChange } = renderFilters({ search: 'abc', mappingType: '1to1' })
    fireEvent.click(clearBtn())

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({})
    expect(Object.keys(onFiltersChange.mock.calls[0][0])).toHaveLength(0)
  })

  it('resets the local controls so a subsequent apply is empty', () => {
    renderFilters()
    fireEvent.change(searchInput(), { target: { value: 'xyz' } })
    fireEvent.change(mappingTypeSelect(), { target: { value: '1to1' } })
    fireEvent.change(slider(), { target: { value: '70' } })
    fireEvent.click(clearBtn())

    expect(searchInput()).toHaveValue('')
    expect(mappingTypeSelect()).toHaveValue('')
    expect(slider()).toHaveValue('0')
  })

  it('discards uncommitted edits rather than committing them', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(searchInput(), { target: { value: 'uncommitted' } })
    fireEvent.click(clearBtn())

    const applied = onFiltersChange.mock.calls[0][0]
    expect(applied).toEqual({})
  })
})

describe('MappingFilters — minConfidence slider', () => {
  it('commits a mid-range value on apply', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(slider(), { target: { value: '80' } })
    fireEvent.click(applyBtn())

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ minConfidence: 80 }))
  })

  it('supports the maximum boundary (100)', () => {
    const { onFiltersChange } = renderFilters()
    fireEvent.change(slider(), { target: { value: '100' } })
    fireEvent.click(applyBtn())

    expect(onFiltersChange.mock.calls[0][0].minConfidence).toBe(100)
  })

  it('supports the minimum boundary (0)', () => {
    const { onFiltersChange } = renderFilters({ minConfidence: 50 })
    fireEvent.change(slider(), { target: { value: '0' } })
    fireEvent.click(applyBtn())

    expect(onFiltersChange.mock.calls[0][0].minConfidence).toBe(0)
  })
})

describe('MappingFilters — COA option rendering', () => {
  it('renders the source COA options (plus the すべて choice)', () => {
    renderFilters()
    const source = coaSelectByOption('src-cash')
    expect([...source.options].map((o) => o.value)).toEqual(['', 'src-cash', 'src-bank'])
    expect([...source.options].map((o) => o.textContent)).toEqual(['すべて', '現金', '銀行預金'])
  })

  it('renders the target COA options (plus the すべて choice)', () => {
    renderFilters()
    const target = coaSelectByOption('tgt-cash')
    expect([...target.options].map((o) => o.value)).toEqual(['', 'tgt-cash', 'tgt-ar'])
  })

  it('falls back to only the すべて option when the COA lists are empty', () => {
    renderFilters({}, { sourceCoas: [], targetCoas: [] })
    const coaSelects = screen.getAllByTestId('coa-select')
    expect(coaSelects).toHaveLength(2)
    coaSelects.forEach((s) => expect((s as HTMLSelectElement).options).toHaveLength(1))
    coaSelects.forEach((s) => expect((s as HTMLSelectElement).options[0].value).toBe(''))
  })
})

describe('MappingFilters — fail-safe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without throwing for minimal empty props', () => {
    const view = renderFilters()
    expect(view.container).toBeInTheDocument()
  })

  it('never emits a spurious onFiltersChange on plain re-render of the controls', () => {
    const { onFiltersChange, rerender } = renderFilters({ search: 'a' })
    rerender(
      <MappingFilters
        filters={{ search: 'a' }}
        onFiltersChange={onFiltersChange}
        sourceCoas={SOURCE_COAS}
        targetCoas={TARGET_COAS}
      />
    )
    expect(onFiltersChange).not.toHaveBeenCalled()
  })
})

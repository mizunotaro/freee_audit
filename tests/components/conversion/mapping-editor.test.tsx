import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MappingEditor } from '@/components/conversion/mapping-editor'
import type { ChartOfAccountItem, AccountMapping } from '@/types/conversion'

// Radix Select is hostile to jsdom (focus/portals) and rejects option values,
// so swap the primitives for a native <select>/<option> wired to onValueChange.
vi.mock('@/components/ui/select', () => {
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children?: ReactNode
  }) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  )
  const SelectContent = ({ children }: { children?: ReactNode }) => <>{children}</>
  const SelectItem = ({ value }: { value: string; children?: ReactNode }) => (
    <option value={value}>{value}</option>
  )
  const SelectTrigger = ({ children }: { children?: ReactNode }) => <>{children}</>
  const SelectValue = () => null
  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

// Radix AlertDialog only shows content while open; mirror that and wire the
// action button's onClick so the delete flow is exercised faithfully.
vi.mock('@/components/ui/alert-dialog', () => {
  const AlertDialog = ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <>{children}</> : null
  const AlertDialogContent = ({ children }: { children?: ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  )
  const AlertDialogHeader = ({ children }: { children?: ReactNode }) => <>{children}</>
  const AlertDialogFooter = ({ children }: { children?: ReactNode }) => <>{children}</>
  const AlertDialogTitle = ({ children }: { children?: ReactNode }) => <h2>{children}</h2>
  const AlertDialogDescription = ({ children }: { children?: ReactNode }) => <p>{children}</p>
  const AlertDialogAction = ({
    children,
    onClick,
  }: {
    children?: ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  )
  const AlertDialogCancel = ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  )
  return {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
  }
})

// AccountCodeSelector is a deeply interactive Radix Popover/Command tree with
// its own dedicated test file. Replace it with a thin surface that exposes the
// selected value and lets the test drive onChange by clicking an item button.
vi.mock('@/components/conversion/account-code-selector', () => {
  const AccountCodeSelector = ({
    items,
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    items: ChartOfAccountItem[]
    value?: string
    onChange: (value: string, item: ChartOfAccountItem) => void
    placeholder?: string
    disabled?: boolean
  }) => (
    <div
      data-testid="account-code-selector"
      data-selected={value ?? ''}
      data-placeholder={placeholder ?? ''}
      data-disabled={disabled ? 'true' : 'false'}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          data-item-id={it.id}
          disabled={disabled}
          onClick={() => onChange(it.id, it)}
        >
          {it.name}
        </button>
      ))}
    </div>
  )
  return { AccountCodeSelector }
})

function makeSourceItem(overrides: Partial<ChartOfAccountItem> = {}): ChartOfAccountItem {
  return {
    id: 'src-1',
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

function makeTargetItem(overrides: Partial<ChartOfAccountItem> = {}): ChartOfAccountItem {
  return {
    id: 'tgt-1',
    code: '1010',
    name: 'Cash',
    nameEn: 'Cash',
    standard: 'USGAAP',
    category: 'current_asset',
    normalBalance: 'debit',
    level: 0,
    isConvertible: true,
    ...overrides,
  }
}

const sourceItems: ChartOfAccountItem[] = [
  makeSourceItem({ id: 'src-1', code: '1110', name: '現金', nameEn: 'Cash' }),
  makeSourceItem({ id: 'src-2', code: '1120', name: '当座預金', nameEn: 'Checking' }),
]

const targetItems: ChartOfAccountItem[] = [
  makeTargetItem({ id: 'tgt-1', code: '1010', name: 'Cash', nameEn: 'Cash' }),
  makeTargetItem({ id: 'tgt-2', code: '1020', name: 'Accounts Receivable', nameEn: 'AR' }),
]

function makeMapping(overrides: Partial<AccountMapping> = {}): AccountMapping {
  return {
    id: 'map-1',
    sourceAccountId: 'src-1',
    sourceAccountCode: '1110',
    sourceAccountName: '現金',
    targetAccountId: 'tgt-1',
    targetAccountCode: '1010',
    targetAccountName: 'Cash',
    mappingType: '1to1',
    confidence: 0.9,
    isManualReview: false,
    ...overrides,
  }
}

type EditorProps = Parameters<typeof MappingEditor>[0]

function renderEditor(overrides: Partial<EditorProps> = {}) {
  const props: EditorProps = {
    sourceItems,
    targetItems,
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<MappingEditor {...props} />) }
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve))
}

function selectorByPlaceholder(container: HTMLElement, placeholder: string) {
  const els = container.querySelectorAll('[data-testid="account-code-selector"]')
  return Array.from(els).find((el) => el.getAttribute('data-placeholder') === placeholder) ?? null
}

function saveButton() {
  return screen.getByRole('button', { name: '保存' })
}

describe('conversion/mapping-editor — create vs edit mode', () => {
  it('renders the create-mode title and leaves the source selector enabled', () => {
    const { container } = renderEditor()
    expect(screen.getByText('新規マッピング')).toBeInTheDocument()
    const source = selectorByPlaceholder(container, 'JGAAP勘定科目を選択')
    expect(source?.getAttribute('data-disabled')).toBe('false')
    expect(source?.getAttribute('data-selected')).toBe('')
  })

  it('renders the edit-mode title, disables the source selector, and defaults mappingType to 1to1', () => {
    const { container } = renderEditor({ mapping: makeMapping() })
    expect(screen.getByText('マッピング編集')).toBeInTheDocument()
    expect(
      selectorByPlaceholder(container, 'JGAAP勘定科目を選択')?.getAttribute('data-disabled')
    ).toBe('true')
    expect((container.querySelector('select') as HTMLSelectElement)?.value).toBe('1to1')
  })
})

describe('conversion/mapping-editor — initialization from the mapping prop', () => {
  it('pre-selects source and target items that match the mapping account ids', () => {
    const { container } = renderEditor({ mapping: makeMapping() })
    expect(
      selectorByPlaceholder(container, 'JGAAP勘定科目を選択')?.getAttribute('data-selected')
    ).toBe('src-1')
    expect(
      selectorByPlaceholder(container, 'USGAAP/IFRS勘定科目を選択')?.getAttribute('data-selected')
    ).toBe('tgt-1')
  })

  it('falls back to sourceItemId when sourceAccountId does not match (alias branch)', () => {
    const { container } = renderEditor({
      mapping: makeMapping({
        sourceAccountId: 'does-not-exist',
        sourceItemId: 'src-2',
      }),
    })
    expect(
      selectorByPlaceholder(container, 'JGAAP勘定科目を選択')?.getAttribute('data-selected')
    ).toBe('src-2')
  })

  it('falls back to targetItemId when targetAccountId does not match (alias branch)', () => {
    const { container } = renderEditor({
      mapping: makeMapping({
        targetAccountId: 'does-not-exist',
        targetItemId: 'tgt-2',
      }),
    })
    expect(
      selectorByPlaceholder(container, 'USGAAP/IFRS勘定科目を選択')?.getAttribute('data-selected')
    ).toBe('tgt-2')
  })

  it('leaves source/target unset when the mapping references unknown ids (fail-safe)', () => {
    const { container } = renderEditor({
      mapping: makeMapping({
        sourceAccountId: 'ghost',
        sourceItemId: 'ghost2',
        targetAccountId: 'ghost',
        targetItemId: 'ghost2',
      }),
    })
    expect(
      selectorByPlaceholder(container, 'JGAAP勘定科目を選択')?.getAttribute('data-selected')
    ).toBe('')
    // No matching target keeps the editor invalid even in edit mode.
    expect(saveButton()).toBeDisabled()
  })

  it('reflects the mapping mappingType in the type selector (1toN)', () => {
    const { container } = renderEditor({
      mapping: makeMapping({ mappingType: '1toN', percentage: 100 }),
    })
    expect((container.querySelector('select') as HTMLSelectElement)?.value).toBe('1toN')
  })
})

describe('conversion/mapping-editor — validation (save button enable/disable)', () => {
  it('keeps save disabled until both source and target are chosen (1to1)', () => {
    renderEditor()
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '現金' }))
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Cash' }))
    expect(saveButton()).toBeEnabled()
  })
})

describe('conversion/mapping-editor — save (1to1 create)', () => {
  it('emits the mapping value with undefined percentage/notes and no conversion rule', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderEditor({ onSave })
    fireEvent.click(screen.getByRole('button', { name: '現金' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }))
    fireEvent.click(saveButton())

    await flushMicrotasks()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceItemId: 'src-1',
        targetItemId: 'tgt-1',
        mappingType: '1to1',
        percentage: undefined,
        notes: undefined,
      })
    )
    expect(onSave.mock.calls[0][0].conversionRule).toBeUndefined()
  })

  it('includes notes when the memo field is filled', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderEditor({ onSave })
    fireEvent.click(screen.getByRole('button', { name: '現金' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }))
    fireEvent.change(screen.getByPlaceholderText('マッピングに関する補足情報'), {
      target: { value: '要確認：期末評価' },
    })
    fireEvent.click(saveButton())

    await flushMicrotasks()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ notes: '要確認：期末評価' }))
  })

  it('invokes onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    renderEditor({ onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('conversion/mapping-editor — loading + failure resilience', () => {
  it('shows the saving state while onSave is pending and restores it after', async () => {
    let resolveSave: () => void = () => {}
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        })
    )
    renderEditor({ onSave })
    fireEvent.click(screen.getByRole('button', { name: '現金' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }))
    fireEvent.click(saveButton())

    const saving = await screen.findByRole('button', { name: '保存中...' })
    expect(saving).toBeDisabled()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()

    resolveSave()
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())
  })

  it('resets the loading flag even when onSave rejects', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('boom')))
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    try {
      renderEditor({ onSave })
      fireEvent.click(screen.getByRole('button', { name: '現金' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cash' }))
      fireEvent.click(saveButton())

      await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())
      expect(onSave).toHaveBeenCalledTimes(1)
      await flushMicrotasks()
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })
})

describe('conversion/mapping-editor — 1toN split mapping', () => {
  beforeEach(() => {
    // Default mapping seeds a single valid split row (100%) with source set.
  })

  it('builds a percentage conversion rule and empty targetItemId on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderEditor({
      onSave,
      mapping: makeMapping({ mappingType: '1toN', percentage: 100 }),
    })
    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())

    await flushMicrotasks()
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceItemId: 'src-1',
        targetItemId: '',
        mappingType: '1toN',
        percentage: 100,
        conversionRule: { type: 'percentage', percentage: 100 },
      })
    )
  })

  it('adds a split row, then removes it, tracking the percentage input count', () => {
    const { container } = renderEditor({
      mapping: makeMapping({ mappingType: '1toN', percentage: 100 }),
    })
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2)

    const trash = container.querySelector('.lucide-trash-2')?.closest('button') as HTMLElement
    fireEvent.click(trash)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
  })

  it('toggles the 100% warning and disables save when the split sum is wrong', () => {
    renderEditor({
      mapping: makeMapping({ mappingType: '1toN', percentage: 100 }),
    })
    expect(screen.queryByText('配分の合計が100%になりません')).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50' } })
    expect(screen.getByText('配分の合計が100%になりません')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } })
    expect(screen.queryByText('配分の合計が100%になりません')).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('disables save when any split row has no target item even if the sum is 100', () => {
    renderEditor({
      mapping: makeMapping({ mappingType: '1toN', percentage: 100 }),
    })
    expect(saveButton()).toBeEnabled()

    // Adding a row seeds an empty itemId at 0%; existing row stays at 100%,
    // so the sum is still 100 but the new row is missing its target.
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(saveButton()).toBeDisabled()
  })
})

describe('conversion/mapping-editor — complex conditional mapping', () => {
  // The mapping supplies source + target so handleSave can read targetItem.id;
  // conditions state always starts empty and must be added through the UI.
  function renderComplex(overrides: Partial<EditorProps> = {}) {
    return renderEditor({
      ...overrides,
      mapping: makeMapping({ mappingType: 'complex' }),
    })
  }

  it('keeps save disabled until a condition with a target is added', () => {
    renderComplex()
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '条件追加' }))
    // Condition exists but its targetItemId is empty.
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Cash' }))
    expect(saveButton()).toBeEnabled()
  })

  it('builds a formula conversion rule from the conditions on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderComplex({ onSave })
    fireEvent.click(screen.getByRole('button', { name: '条件追加' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }))
    fireEvent.click(saveButton())

    await flushMicrotasks()
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceItemId: 'src-1',
        targetItemId: 'tgt-1',
        mappingType: 'complex',
        percentage: 100,
        conversionRule: {
          type: 'formula',
          conditions: [
            {
              field: 'description',
              operator: 'contains',
              value: '',
              targetAccountId: 'tgt-1',
            },
          ],
        },
      })
    )
  })
})

describe('conversion/mapping-editor — Nto1 consolidation mapping', () => {
  it('accepts the mapping with source only and saves targetItemId from the seeded target', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderEditor({
      onSave,
      mapping: makeMapping({ mappingType: 'Nto1' }),
    })
    // Nto1's isValid falls through to `return true` once sourceItem is set.
    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())

    await flushMicrotasks()
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceItemId: 'src-1',
        targetItemId: 'tgt-1',
        mappingType: 'Nto1',
        percentage: 100,
        notes: undefined,
      })
    )
    expect(onSave.mock.calls[0][0].conversionRule).toBeUndefined()
  })
})

describe('conversion/mapping-editor — AI suggestion', () => {
  const suggestion = {
    targetCode: '1010',
    confidence: 0.85,
    reasoning: '現金は直接 Cash へ変換できます',
  }

  it('renders the suggestion panel with confidence, reasoning, and apply button only in create mode', () => {
    const { rerender } = renderEditor({ aiSuggestion: suggestion })
    expect(screen.getByText('AI推奨')).toBeInTheDocument()
    expect(screen.getByText('信頼度: 85%')).toBeInTheDocument()
    expect(screen.getByText(suggestion.reasoning)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '推奨を適用' })).toBeInTheDocument()

    rerender(
      <MappingEditor
        sourceItems={sourceItems}
        targetItems={targetItems}
        mapping={makeMapping()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
        aiSuggestion={suggestion}
      />
    )
    expect(screen.queryByText('AI推奨')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '推奨を適用' })).not.toBeInTheDocument()
  })

  it('rounds the confidence display at the boundary (100%)', () => {
    renderEditor({ aiSuggestion: { ...suggestion, confidence: 1 } })
    expect(screen.getByText('信頼度: 100%')).toBeInTheDocument()
  })

  it('applies a matching suggestion by selecting the target and switches to 1to1', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderEditor({ onSave, aiSuggestion: suggestion })
    fireEvent.click(screen.getByRole('button', { name: '推奨を適用' }))
    // Source still needs to be picked before save becomes valid.
    fireEvent.click(screen.getByRole('button', { name: '現金' }))
    fireEvent.click(saveButton())

    await flushMicrotasks()
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ targetItemId: 'tgt-1', mappingType: '1to1' })
    )
  })

  it('is a safe no-op when the suggested target code matches no item', () => {
    renderEditor({ aiSuggestion: { ...suggestion, targetCode: '9999' } })
    fireEvent.click(screen.getByRole('button', { name: '推奨を適用' }))
    fireEvent.click(screen.getByRole('button', { name: '現金' }))
    // Target never got set, so 1to1 stays invalid.
    expect(saveButton()).toBeDisabled()
  })
})

describe('conversion/mapping-editor — delete flow', () => {
  it('hides the delete button in create mode and when onDelete is omitted', () => {
    renderEditor()
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()

    renderEditor({ mapping: makeMapping() })
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
  })

  it('confirms via dialog, calls onDelete, and closes the dialog on success', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderEditor({ mapping: makeMapping(), onDelete })

    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    const dialog = await screen.findByTestId('alert-dialog-content')
    expect(dialog).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '削除' }))
    expect(onDelete).toHaveBeenCalledTimes(1)

    await waitFor(() =>
      expect(screen.queryByTestId('alert-dialog-content')).not.toBeInTheDocument()
    )
  })
})

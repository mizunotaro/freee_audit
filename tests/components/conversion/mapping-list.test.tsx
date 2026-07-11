import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MappingList } from '@/components/conversion/mapping-list'
import type { AccountMapping, MappingType } from '@/types/conversion'

function makeMapping(overrides: Partial<AccountMapping> = {}): AccountMapping {
  return {
    id: 'm1',
    sourceAccountId: 's1',
    sourceAccountCode: '1000',
    sourceAccountName: '現金',
    targetAccountId: 't1',
    targetAccountCode: '1010',
    targetAccountName: 'Cash',
    mappingType: '1to1',
    confidence: 0.92,
    isManualReview: false,
    ...overrides,
  }
}

const handlers = {
  onSelectionChange: vi.fn(),
  onApprove: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
}

type MappingListHandlers = {
  onSelectionChange: (ids: string[]) => void
  onApprove: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function makeHandlers(overrides: Partial<MappingListHandlers> = {}): MappingListHandlers {
  return {
    onSelectionChange: vi.fn(),
    onApprove: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve))
}

// Radix DropdownMenu / Checkbox route pointer events through pointer-capture
// APIs that jsdom does not implement. Stub them so userEvent can drive menus.
beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {}
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {}
  }
})

describe('conversion/mapping-list — loading / error / empty states', () => {
  it('renders an accessible skeleton while loading', () => {
    const { container } = render(
      <MappingList mappings={[]} selectedIds={[]} isLoading {...handlers} />
    )

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBe(4)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the error message inside an alert', () => {
    render(
      <MappingList
        mappings={[]}
        selectedIds={[]}
        error="マッピングの取得に失敗しました"
        {...handlers}
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('マッピングの取得に失敗しました')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the empty state with the preserved copy when there is no data', () => {
    render(<MappingList mappings={[]} selectedIds={[]} {...handlers} />)

    expect(screen.getByText('マッピングがありません')).toBeInTheDocument()
    expect(
      screen.getByText('AI推論を実行するか、手動でマッピングを作成してください')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('conversion/mapping-list — ready state', () => {
  it('renders the table and an aria-labelled actions trigger per row', () => {
    render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現金の操作' })).toBeInTheDocument()
  })

  it('prefers loading over a populated list', () => {
    const { container } = render(
      <MappingList mappings={[makeMapping()]} selectedIds={[]} isLoading {...handlers} />
    )

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('table')).toBeNull()
  })
})

describe('conversion/mapping-list — select-all header checkbox', () => {
  const mappings = [makeMapping({ id: 'm1' }), makeMapping({ id: 'm2', sourceAccountName: '預金' })]

  it('is unchecked when nothing is selected', () => {
    render(<MappingList mappings={mappings} selectedIds={[]} {...makeHandlers()} />)
    expect(screen.getByRole('checkbox', { name: 'すべて選択' })).not.toBeChecked()
  })

  it('is checked only when every mapping is selected', () => {
    render(<MappingList mappings={mappings} selectedIds={['m1', 'm2']} {...makeHandlers()} />)
    expect(screen.getByRole('checkbox', { name: 'すべて選択' })).toBeChecked()
  })

  it('selects every mapping id when toggled on from an empty selection', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers()
    render(<MappingList mappings={mappings} selectedIds={[]} {...handlers} />)

    await user.click(screen.getByRole('checkbox', { name: 'すべて選択' }))

    expect(handlers.onSelectionChange).toHaveBeenCalledWith(['m1', 'm2'])
  })

  it('clears the selection when toggled off from a fully-selected list', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers()
    render(<MappingList mappings={mappings} selectedIds={['m1', 'm2']} {...handlers} />)

    await user.click(screen.getByRole('checkbox', { name: 'すべて選択' }))

    expect(handlers.onSelectionChange).toHaveBeenCalledWith([])
  })

  it('renders the indeterminate affordance (opacity-50) when only some rows are selected', () => {
    render(<MappingList mappings={mappings} selectedIds={['m1']} {...makeHandlers()} />)
    expect(screen.getByRole('checkbox', { name: 'すべて選択' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'すべて選択' })).toHaveClass('opacity-50')
  })

  it('omits the indeterminate affordance when all rows are selected', () => {
    render(<MappingList mappings={mappings} selectedIds={['m1', 'm2']} {...makeHandlers()} />)
    expect(screen.getByRole('checkbox', { name: 'すべて選択' })).not.toHaveClass('opacity-50')
  })
})

describe('conversion/mapping-list — per-row selection', () => {
  it('adds the row id when an unchecked row checkbox is clicked', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers()
    render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

    await user.click(screen.getByRole('checkbox', { name: '選択' }))

    expect(handlers.onSelectionChange).toHaveBeenCalledWith(['m1'])
  })

  it('removes the row id when a checked row checkbox is clicked', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers()
    render(<MappingList mappings={[makeMapping()]} selectedIds={['m1']} {...handlers} />)

    await user.click(screen.getByRole('checkbox', { name: '選択' }))

    expect(handlers.onSelectionChange).toHaveBeenCalledWith([])
  })

  it('reflects membership in each row checkbox and highlights selected rows', () => {
    const mappings = [
      makeMapping({ id: 'm1', sourceAccountName: '現金' }),
      makeMapping({ id: 'm2', sourceAccountName: '預金' }),
    ]
    render(<MappingList mappings={mappings} selectedIds={['m1']} {...makeHandlers()} />)

    const checkboxes = screen.getAllByRole('checkbox', { name: '選択' })
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()

    const cashRow = screen.getByText('現金').closest('tr')
    const bankRow = screen.getByText('預金').closest('tr')
    expect(cashRow).toHaveClass('bg-muted/50')
    expect(bankRow).not.toHaveClass('bg-muted/50')
  })
})

describe('conversion/mapping-list — mapping-type badge', () => {
  const cases: Array<{ type: MappingType; label: string }> = [
    { type: '1to1', label: '1:1' },
    { type: '1toN', label: '1:N' },
    { type: 'Nto1', label: 'N:1' },
    { type: 'complex', label: '複合' },
  ]

  it.each(cases)('renders the $label badge for the $type mapping type', ({ type, label }) => {
    render(
      <MappingList
        mappings={[makeMapping({ mappingType: type })]}
        selectedIds={[]}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('falls back to the raw type string for an unmapped type', () => {
    render(
      <MappingList
        mappings={[makeMapping({ mappingType: 'custom-x' as MappingType })]}
        selectedIds={[]}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText('custom-x')).toBeInTheDocument()
  })
})

describe('conversion/mapping-list — status badge', () => {
  it('renders 未承認 by default for an unreviewed, unapproved mapping', () => {
    render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...makeHandlers()} />)
    expect(screen.getByText('未承認')).toBeInTheDocument()
  })

  it('renders 要確認 when the mapping is flagged for manual review', () => {
    render(
      <MappingList
        mappings={[makeMapping({ isManualReview: true })]}
        selectedIds={[]}
        {...makeHandlers()}
      />
    )
    expect(screen.getByText('要確認')).toBeInTheDocument()
  })

  it('renders 承認済 when the mapping is approved at runtime', () => {
    const approved = { ...makeMapping(), isApproved: true } as unknown as AccountMapping
    render(<MappingList mappings={[approved]} selectedIds={[]} {...makeHandlers()} />)
    expect(screen.getByText('承認済')).toBeInTheDocument()
  })

  it('prefers 承認済 over 要確認 when both flags are set', () => {
    const approved = {
      ...makeMapping({ isManualReview: true }),
      isApproved: true,
    } as unknown as AccountMapping
    render(<MappingList mappings={[approved]} selectedIds={[]} {...makeHandlers()} />)
    expect(screen.getByText('承認済')).toBeInTheDocument()
    expect(screen.queryByText('要確認')).not.toBeInTheDocument()
  })
})

describe('conversion/mapping-list — confidence indicator passthrough', () => {
  it('forwards the mapping confidence to the indicator as a rounded percentage', () => {
    render(
      <MappingList
        mappings={[makeMapping({ confidence: 0.923 })]}
        selectedIds={[]}
        {...makeHandlers()}
      />
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '92')
  })
})

describe('conversion/mapping-list — row action menu', () => {
  it('exposes edit and detail links pointing at the mapping-specific routes', async () => {
    const user = userEvent.setup()
    render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...makeHandlers()} />)

    await user.click(screen.getByRole('button', { name: '現金の操作' }))

    expect(screen.getByRole('menuitem', { name: '編集' })).toHaveAttribute(
      'href',
      '/conversion/mappings/m1/edit'
    )
    expect(screen.getByRole('menuitem', { name: '詳細' })).toHaveAttribute(
      'href',
      '/conversion/mappings/m1'
    )
  })

  it('disables the trigger button while an approve is in flight and re-enables on resolve', async () => {
    const user = userEvent.setup()
    const { promise, resolve } = deferred()
    const handlers = makeHandlers({ onApprove: vi.fn(() => promise) })
    render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

    await user.click(screen.getByRole('button', { name: '現金の操作' }))
    await user.click(screen.getByRole('menuitem', { name: '承認' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '現金の操作' })).toBeDisabled()
    })
    expect(handlers.onApprove).toHaveBeenCalledWith('m1')

    resolve()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '現金の操作' })).toBeEnabled()
    })
  })

  it('re-enables the trigger even when the approve handler rejects (fail-safe)', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers({
      onApprove: vi.fn().mockRejectedValue(new Error('approve failed')),
    })

    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    try {
      render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

      await user.click(screen.getByRole('button', { name: '現金の操作' }))
      await user.click(screen.getByRole('menuitem', { name: '承認' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '現金の操作' })).toBeEnabled()
      })
      expect(handlers.onApprove).toHaveBeenCalledWith('m1')
      await flushMicrotasks()
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })
})

describe('conversion/mapping-list — delete flow', () => {
  it('aborts the delete when the confirm dialog is dismissed', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

      await user.click(screen.getByRole('button', { name: '現金の操作' }))
      await user.click(screen.getByRole('menuitem', { name: '削除' }))

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(handlers.onDelete).not.toHaveBeenCalled()
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('deletes the mapping when the confirm dialog is accepted', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

      await user.click(screen.getByRole('button', { name: '現金の操作' }))
      await user.click(screen.getByRole('menuitem', { name: '削除' }))

      await waitFor(() => {
        expect(handlers.onDelete).toHaveBeenCalledWith('m1')
      })
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('locks the trigger while the delete is in flight and releases it on resolve', async () => {
    const user = userEvent.setup()
    const { promise, resolve } = deferred()
    const handlers = makeHandlers({ onDelete: vi.fn(() => promise) })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

      await user.click(screen.getByRole('button', { name: '現金の操作' }))
      await user.click(screen.getByRole('menuitem', { name: '削除' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '現金の操作' })).toBeDisabled()
      })
      expect(handlers.onDelete).toHaveBeenCalledWith('m1')

      resolve()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '現金の操作' })).toBeEnabled()
      })
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('re-enables the trigger even when the delete handler rejects (fail-safe)', async () => {
    const user = userEvent.setup()
    const handlers = makeHandlers({
      onDelete: vi.fn().mockRejectedValue(new Error('delete failed')),
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    try {
      render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

      await user.click(screen.getByRole('button', { name: '現金の操作' }))
      await user.click(screen.getByRole('menuitem', { name: '削除' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '現金の操作' })).toBeEnabled()
      })
      expect(handlers.onDelete).toHaveBeenCalledWith('m1')
      await flushMicrotasks()
    } finally {
      confirmSpy.mockRestore()
      process.off('unhandledRejection', swallow)
    }
  })
})

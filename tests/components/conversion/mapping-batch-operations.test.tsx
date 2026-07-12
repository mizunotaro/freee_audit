import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ComponentProps } from 'react'
import { MappingBatchOperations } from '@/components/conversion/mapping-batch-operations'

type Props = ComponentProps<typeof MappingBatchOperations>

function defaultProps(overrides: Partial<Props> = {}): Props {
  return {
    selectedCount: 1,
    onApprove: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClear: vi.fn(),
    ...overrides,
  }
}

describe('MappingBatchOperations — fail-safe / rendering', () => {
  it('renders nothing when selectedCount is 0 (fail-safe hidden state)', () => {
    const { container } = render(<MappingBatchOperations {...defaultProps({ selectedCount: 0 })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the action bar with the selected-count copy when selectedCount > 0', () => {
    render(<MappingBatchOperations {...defaultProps({ selectedCount: 3 })} />)
    expect(screen.getByText('3件選択中')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /一括承認/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /一括削除/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeInTheDocument()
  })

  it('reflects a different selectedCount in the visible copy', () => {
    render(<MappingBatchOperations {...defaultProps({ selectedCount: 12 })} />)
    expect(screen.getByText('12件選択中')).toBeInTheDocument()
    expect(screen.queryByText('1件選択中')).not.toBeInTheDocument()
  })

  it('exposes the destructive variant only on the delete trigger', () => {
    render(<MappingBatchOperations {...defaultProps({ selectedCount: 1 })} />)
    expect(screen.getByRole('button', { name: /一括削除/ })).toHaveClass('bg-destructive')
    expect(screen.getByRole('button', { name: /一括承認/ })).not.toHaveClass('bg-destructive')
  })
})

describe('MappingBatchOperations — clear (synchronous handler)', () => {
  it('calls onClear immediately when 選択解除 is clicked', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ onClear })} />)

    await user.click(screen.getByRole('button', { name: /選択解除/ }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('MappingBatchOperations — approve flow', () => {
  it('opens the confirm dialog with count-interpolated copy and calls onApprove on confirm', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ selectedCount: 4, onApprove })} />)

    await user.click(screen.getByRole('button', { name: /一括承認/ }))
    expect(screen.getByText('一括承認の確認')).toBeInTheDocument()
    expect(screen.getByText('選択した4件のマッピングを承認しますか？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '承認' }))

    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('does not call onApprove when the dialog is cancelled', async () => {
    const onApprove = vi.fn()
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ onApprove })} />)

    await user.click(screen.getByRole('button', { name: /一括承認/ }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onApprove).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText('一括承認の確認')).not.toBeInTheDocument()
    })
  })

  it('disables the action bar while onApprove is pending and re-enables after it resolves', async () => {
    let resolveApprove!: () => void
    const onApprove = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveApprove = resolve
        })
    )
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ selectedCount: 2, onApprove })} />)

    await user.click(screen.getByRole('button', { name: /一括承認/ }))
    await user.click(screen.getByRole('button', { name: '承認' }))

    expect(onApprove).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /一括削除/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeDisabled()

    resolveApprove()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括削除/ })).toBeEnabled()
    })
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeEnabled()
  })
})

describe('MappingBatchOperations — delete flow', () => {
  it('opens the confirm dialog with the irreversibility copy and calls onDelete on confirm', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ selectedCount: 5, onDelete })} />)

    await user.click(screen.getByRole('button', { name: /一括削除/ }))
    expect(screen.getByText('一括削除の確認')).toBeInTheDocument()
    expect(
      screen.getByText('選択した5件のマッピングを削除しますか？この操作は取り消せません。')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('does not call onDelete when the dialog is cancelled', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ onDelete })} />)

    await user.click(screen.getByRole('button', { name: /一括削除/ }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onDelete).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText('一括削除の確認')).not.toBeInTheDocument()
    })
  })

  it('disables the action bar while onDelete is pending and re-enables after it resolves', async () => {
    let resolveDelete!: () => void
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        })
    )
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ selectedCount: 2, onDelete })} />)

    await user.click(screen.getByRole('button', { name: /一括削除/ }))
    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /一括承認/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeDisabled()

    resolveDelete()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括承認/ })).toBeEnabled()
    })
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeEnabled()
  })
})

describe('MappingBatchOperations — fail-safe on dependency errors', () => {
  // handleApprove/handleDelete have try/finally but no catch, so a rejecting
  // dependency surfaces as an unhandled rejection on the async event handler.
  // Swallow only the expected rejection so the worker stays alive.
  let swallow: ((reason: unknown) => void) | undefined

  afterEach(() => {
    if (swallow) {
      process.off('unhandledRejection', swallow)
      swallow = undefined
    }
  })

  function ignoreNextUnhandledRejection() {
    swallow = () => {}
    process.on('unhandledRejection', swallow)
  }

  it('resets loading when onApprove rejects (UI stays usable)', async () => {
    ignoreNextUnhandledRejection()
    const onApprove = vi.fn().mockRejectedValue(new Error('approve failed'))
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ onApprove })} />)

    await user.click(screen.getByRole('button', { name: /一括承認/ }))
    await user.click(screen.getByRole('button', { name: '承認' }))

    expect(onApprove).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括削除/ })).toBeEnabled()
    })
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeEnabled()
  })

  it('resets loading when onDelete rejects (UI stays usable)', async () => {
    ignoreNextUnhandledRejection()
    const onDelete = vi.fn().mockRejectedValue(new Error('delete failed'))
    const user = userEvent.setup()
    render(<MappingBatchOperations {...defaultProps({ onDelete })} />)

    await user.click(screen.getByRole('button', { name: /一括削除/ }))
    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括承認/ })).toBeEnabled()
    })
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeEnabled()
  })
})

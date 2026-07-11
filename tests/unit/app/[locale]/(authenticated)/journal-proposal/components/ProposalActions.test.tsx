import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProposalActions } from '@/app/[locale]/(authenticated)/journal-proposal/components/ProposalActions'
import type { JournalProposalOutput } from '@/types/journal-proposal'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

type Handlers = {
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onRegenerate: () => Promise<void>
  onExportToFreee: () => Promise<void>
}

function makeHandlers(overrides: Partial<Handlers> = {}): Handlers {
  return {
    onApprove: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
    onRegenerate: vi.fn().mockResolvedValue(undefined),
    onExportToFreee: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeProposal(): JournalProposalOutput {
  return { documentId: 'doc-1' } as unknown as JournalProposalOutput
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

describe('ProposalActions — environment polyfills', () => {
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

  describe('rendering', () => {
    it('renders nothing when there is no proposal', () => {
      const { container } = render(<ProposalActions proposal={null} {...makeHandlers()} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('renders the approve, reject and More actions when a proposal is present', () => {
      render(<ProposalActions proposal={makeProposal()} {...makeHandlers()} />)

      expect(screen.getByRole('button', { name: 'approve' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'reject' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
    })

    it('applies the supplied className to the action container', () => {
      render(
        <ProposalActions proposal={makeProposal()} {...makeHandlers()} className="my-actions" />
      )

      const approveButton = screen.getByRole('button', { name: 'approve' })
      expect(approveButton.parentElement).toHaveClass('my-actions')
    })
  })

  describe('processing state', () => {
    it('disables every action while isProcessing is true', () => {
      render(<ProposalActions proposal={makeProposal()} {...makeHandlers()} isProcessing />)

      expect(screen.getByRole('button', { name: 'approve' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'reject' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'More' })).toBeDisabled()
    })

    it('leaves every action enabled by default', () => {
      render(<ProposalActions proposal={makeProposal()} {...makeHandlers()} />)

      expect(screen.getByRole('button', { name: 'approve' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'reject' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'More' })).toBeEnabled()
    })
  })

  describe('approve flow', () => {
    it('opens the confirmation dialog when the approve button is clicked', async () => {
      const user = userEvent.setup()
      render(<ProposalActions proposal={makeProposal()} {...makeHandlers()} />)

      await user.click(screen.getByRole('button', { name: 'approve' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('confirmApprove')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'approve' })).toBeInTheDocument()
    })

    it('closes the dialog without approving when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers()
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'approve' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(handlers.onApprove).not.toHaveBeenCalled()
    })

    it('approves and closes the dialog when the confirm button is clicked', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers()
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'approve' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'approve' }))

      await waitFor(() => {
        expect(handlers.onApprove).toHaveBeenCalledTimes(1)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('reject flow', () => {
    it('opens the confirmation dialog when the reject button is clicked', async () => {
      const user = userEvent.setup()
      render(<ProposalActions proposal={makeProposal()} {...makeHandlers()} />)

      await user.click(screen.getByRole('button', { name: 'reject' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('confirmReject')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'reject' })).toBeInTheDocument()
    })

    it('closes the dialog without rejecting when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers()
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'reject' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(handlers.onReject).not.toHaveBeenCalled()
    })

    it('rejects and closes the dialog when the confirm button is clicked', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers()
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'reject' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'reject' }))

      await waitFor(() => {
        expect(handlers.onReject).toHaveBeenCalledTimes(1)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('More menu actions', () => {
    it('reveals the regenerate and export actions inside the More menu', async () => {
      const user = userEvent.setup()
      render(<ProposalActions proposal={makeProposal()} {...makeHandlers()} />)

      await user.click(screen.getByRole('button', { name: 'More' }))

      expect(screen.getByRole('menuitem', { name: 'regenerate' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'exportToFreee' })).toBeInTheDocument()
    })

    it('invokes onRegenerate when the regenerate item is selected', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers()
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'More' }))
      await user.click(screen.getByRole('menuitem', { name: 'regenerate' }))

      await waitFor(() => {
        expect(handlers.onRegenerate).toHaveBeenCalledTimes(1)
      })
      expect(handlers.onApprove).not.toHaveBeenCalled()
      expect(handlers.onExportToFreee).not.toHaveBeenCalled()
    })

    it('invokes onExportToFreee when the export item is selected', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers()
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'More' }))
      await user.click(screen.getByRole('menuitem', { name: 'exportToFreee' }))

      await waitFor(() => {
        expect(handlers.onExportToFreee).toHaveBeenCalledTimes(1)
      })
      expect(handlers.onApprove).not.toHaveBeenCalled()
      expect(handlers.onRegenerate).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('shows the loading indicator on approve and locks the actions until onApprove resolves', async () => {
      const user = userEvent.setup()
      const { promise, resolve } = deferred()
      const handlers = makeHandlers({ onApprove: vi.fn(() => promise) })
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'approve' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'approve' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '...' })).toBeDisabled()
      })
      expect(screen.queryByRole('button', { name: 'approve' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'reject' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'More' })).toBeDisabled()

      resolve()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'approve' })).toBeEnabled()
      })
      expect(screen.queryByRole('button', { name: '...' })).not.toBeInTheDocument()
    })

    it('locks the actions while a regenerate is in flight and releases them on completion', async () => {
      const user = userEvent.setup()
      const { promise, resolve } = deferred()
      const handlers = makeHandlers({ onRegenerate: vi.fn(() => promise) })
      render(<ProposalActions proposal={makeProposal()} {...handlers} />)

      await user.click(screen.getByRole('button', { name: 'More' }))
      await user.click(screen.getByRole('menuitem', { name: 'regenerate' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'More' })).toBeDisabled()
      })
      expect(screen.getByRole('button', { name: 'approve' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'reject' })).toBeDisabled()

      resolve()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'More' })).toBeEnabled()
      })
      expect(handlers.onRegenerate).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling — fail-safe', () => {
    beforeEach(() => {
      vi.useRealTimers()
    })

    it('clears the loading state and re-enables the actions when onApprove rejects', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers({
        onApprove: vi.fn().mockRejectedValue(new Error('approve failed')),
      })

      const swallow = vi.fn()
      process.on('unhandledRejection', swallow)
      try {
        render(<ProposalActions proposal={makeProposal()} {...handlers} />)

        await user.click(screen.getByRole('button', { name: 'approve' }))
        await user.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'approve' })
        )

        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'approve' })).toBeEnabled()
        })
        expect(screen.queryByRole('button', { name: '...' })).not.toBeInTheDocument()
        expect(handlers.onApprove).toHaveBeenCalledTimes(1)

        await flushMicrotasks()
      } finally {
        process.off('unhandledRejection', swallow)
      }
    })

    it('clears the loading state when an export action rejects', async () => {
      const user = userEvent.setup()
      const handlers = makeHandlers({
        onExportToFreee: vi.fn().mockRejectedValue(new Error('export failed')),
      })

      const swallow = vi.fn()
      process.on('unhandledRejection', swallow)
      try {
        render(<ProposalActions proposal={makeProposal()} {...handlers} />)

        await user.click(screen.getByRole('button', { name: 'More' }))
        await user.click(screen.getByRole('menuitem', { name: 'exportToFreee' }))

        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'More' })).toBeEnabled()
        })
        expect(screen.getByRole('button', { name: 'approve' })).toBeEnabled()
        expect(handlers.onExportToFreee).toHaveBeenCalledTimes(1)

        await flushMicrotasks()
      } finally {
        process.off('unhandledRejection', swallow)
      }
    })
  })
})

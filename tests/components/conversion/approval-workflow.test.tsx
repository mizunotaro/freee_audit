import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ApprovalWorkflowComponent,
  type ApprovalWorkflow,
  type ApprovalAssignee,
  type ApprovalHistoryEntry,
} from '@/components/conversion/approval-workflow'
import type { ApprovalStage, ApprovalStatus } from '@/types/conversion'

const CURRENT_USER_ID = 'user-current'

const STAGE_LABELS: Record<ApprovalStage, string> = {
  mapping_review: 'マッピング確認',
  rationale_review: '根拠確認',
  adjustment_review: '調整仕訳確認',
  fs_review: '財務諸表確認',
  final_approval: '最終承認',
}

const STAGE_DESCRIPTIONS: Record<ApprovalStage, string> = {
  mapping_review: '勘定科目マッピングの妥当性を確認',
  rationale_review: '変換根拠の完全性を確認',
  adjustment_review: '調整仕訳の妥当性を確認',
  fs_review: '変換後財務諸表を確認',
  final_approval: 'プロジェクト全体の最終承認',
}

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: '保留中',
  in_review: 'レビュー中',
  approved: '承認済み',
  rejected: '却下',
  escalated: 'エスカレーション',
}

function makeAssignee(overrides: Partial<ApprovalAssignee> = {}): ApprovalAssignee {
  return {
    id: 'assignee-1',
    userId: CURRENT_USER_ID,
    userName: '山田太郎',
    userRole: 'accountant',
    assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    isRequired: true,
    ...overrides,
  }
}

function makeHistoryEntry(overrides: Partial<ApprovalHistoryEntry> = {}): ApprovalHistoryEntry {
  return {
    id: 'history-1',
    stage: 'mapping_review',
    action: 'approve',
    userId: 'user-2',
    userName: '佐藤花子',
    userRole: 'cfo',
    comment: '問題ありません',
    createdAt: new Date('2026-01-04T00:00:00.000Z'),
    ...overrides,
  }
}

function makeWorkflow(overrides: Partial<ApprovalWorkflow> = {}): ApprovalWorkflow {
  return {
    id: 'workflow-1',
    projectId: 'proj-1',
    stage: 'mapping_review',
    status: 'in_review',
    assignees: [makeAssignee()],
    history: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  }
}

function makeHandlers() {
  return {
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onEscalate: vi.fn(),
    onAdvanceStage: vi.fn(),
  }
}

function renderComponent(
  opts: {
    workflow?: Partial<ApprovalWorkflow>
    currentUserId?: string
    isLoading?: boolean
    omitOnAdvanceStage?: boolean
  } = {}
) {
  const handlers = makeHandlers()
  render(
    <ApprovalWorkflowComponent
      workflow={makeWorkflow(opts.workflow)}
      currentUserId={opts.currentUserId ?? CURRENT_USER_ID}
      onApprove={handlers.onApprove}
      onReject={handlers.onReject}
      onEscalate={handlers.onEscalate}
      onAdvanceStage={opts.omitOnAdvanceStage ? undefined : handlers.onAdvanceStage}
      isLoading={opts.isLoading}
    />
  )
  return handlers
}

// radix ScrollArea consults ResizeObserver, which jsdom does not provide.
beforeAll(() => {
  class MockResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  })
})

describe('conversion/approval-workflow — stage stepper', () => {
  it('renders all five stage labels in order', () => {
    renderComponent()
    const expected = [
      STAGE_LABELS.mapping_review,
      STAGE_LABELS.rationale_review,
      STAGE_LABELS.adjustment_review,
      STAGE_LABELS.fs_review,
      STAGE_LABELS.final_approval,
    ]
    expected.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  })

  it('renders the current stage description from STAGE_CONFIG', () => {
    renderComponent({ workflow: { stage: 'mapping_review' } })
    expect(screen.getByText(STAGE_DESCRIPTIONS.mapping_review)).toBeInTheDocument()
  })

  it('updates the current stage description when the stage advances', () => {
    renderComponent({ workflow: { stage: 'final_approval' } })
    expect(screen.getByText(STAGE_DESCRIPTIONS.final_approval)).toBeInTheDocument()
  })
})

describe('conversion/approval-workflow — status badge', () => {
  const cases: ApprovalStatus[] = ['pending', 'in_review', 'approved', 'rejected', 'escalated']
  cases.forEach((status) => {
    it(`renders the ${status} label`, () => {
      // current user is not an assignee here, so no action panel or approved
      // notice can shadow the badge text.
      renderComponent({
        workflow: {
          status,
          assignees: [makeAssignee({ userId: 'someone-else' })],
        },
        currentUserId: CURRENT_USER_ID,
      })
      expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument()
    })
  })
})

describe('conversion/approval-workflow — assignee chips', () => {
  it('renders every assignee name and marks required ones', () => {
    renderComponent({
      workflow: {
        status: 'in_review',
        assignees: [
          makeAssignee({ userId: 'u-a', userName: '山田太郎', isRequired: true }),
          makeAssignee({ userId: 'u-b', userName: '鈴木一郎', isRequired: false }),
        ],
      },
      currentUserId: 'u-a',
    })
    expect(screen.getByText('山田太郎')).toBeInTheDocument()
    expect(screen.getByText('鈴木一郎')).toBeInTheDocument()
    expect(screen.getByText('(必須)')).toBeInTheDocument()
  })
})

describe('conversion/approval-workflow — action panel visibility', () => {
  it('shows approve / reject / escalate for an in-review assignee who has not approved', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: '承認' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '却下' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'エスカレーション' })).toBeInTheDocument()
  })

  it('hides the action panel when the current user is not an assignee', () => {
    renderComponent({
      workflow: {
        status: 'in_review',
        assignees: [makeAssignee({ userId: 'someone-else' })],
      },
    })
    expect(screen.queryByRole('button', { name: '承認' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '却下' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'エスカレーション' })).not.toBeInTheDocument()
  })

  it('shows the approved notice and hides the panel once the current user has approved', () => {
    renderComponent({
      workflow: {
        status: 'in_review',
        assignees: [
          makeAssignee({
            userId: CURRENT_USER_ID,
            approvedAt: new Date('2026-01-03T00:00:00.000Z'),
          }),
        ],
      },
    })
    expect(screen.queryByRole('button', { name: '承認' })).not.toBeInTheDocument()
    expect(screen.getByText('承認済み')).toBeInTheDocument()
  })

  it('hides the action panel when the workflow is not in review', () => {
    renderComponent({ workflow: { status: 'pending' } })
    expect(screen.queryByRole('button', { name: '承認' })).not.toBeInTheDocument()
  })
})

describe('conversion/approval-workflow — approve flow', () => {
  it('approves with an undefined comment when the field is left empty', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: '承認' }))

    expect(handlers.onApprove).toHaveBeenCalledTimes(1)
    expect(handlers.onApprove).toHaveBeenCalledWith('mapping_review', undefined)
  })

  it('passes the typed comment to onApprove and clears the field', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    const textarea = screen.getByPlaceholderText('承認コメント（任意）')
    await user.type(textarea, 'LGTM')
    await user.click(screen.getByRole('button', { name: '承認' }))

    expect(handlers.onApprove).toHaveBeenCalledWith('mapping_review', 'LGTM')
    expect(textarea).toHaveValue('')
  })

  it('disables every action button while loading', () => {
    renderComponent({ isLoading: true })
    expect(screen.getByRole('button', { name: '承認' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '却下' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'エスカレーション' })).toBeDisabled()
  })
})

describe('conversion/approval-workflow — reject flow', () => {
  it('opens the reject dialog when the reject button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: '却下' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('却下理由')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '却下' })).toBeInTheDocument()
  })

  it('rejects with the stage and reason, then closes the dialog', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: '却下' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('却下理由'), '不適切なマッピングです')
    await user.click(within(dialog).getByRole('button', { name: '却下' }))

    expect(handlers.onReject).toHaveBeenCalledTimes(1)
    expect(handlers.onReject).toHaveBeenCalledWith('mapping_review', '不適切なマッピングです')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('does not call onReject and keeps the dialog open when the reason is blank', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: '却下' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '却下' }))

    expect(handlers.onReject).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('treats a whitespace-only reason as blank', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: '却下' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('却下理由'), '   ')
    await user.click(within(dialog).getByRole('button', { name: '却下' }))

    expect(handlers.onReject).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the dialog without rejecting when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: '却下' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(handlers.onReject).not.toHaveBeenCalled()
  })
})

describe('conversion/approval-workflow — escalate flow', () => {
  it('opens the escalate dialog when the escalate button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'エスカレーション' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('エスカレーション理由')).toBeInTheDocument()
  })

  it('escalates with the stage and reason, then closes the dialog', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: 'エスカレーション' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('エスカレーション理由'), '上級決裁者へ')
    await user.click(within(dialog).getByRole('button', { name: 'エスカレーション' }))

    expect(handlers.onEscalate).toHaveBeenCalledTimes(1)
    expect(handlers.onEscalate).toHaveBeenCalledWith('mapping_review', '上級決裁者へ')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('does not call onEscalate when the reason is blank', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: 'エスカレーション' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'エスカレーション' }))

    expect(handlers.onEscalate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the dialog without escalating when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent()

    await user.click(screen.getByRole('button', { name: 'エスカレーション' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(handlers.onEscalate).not.toHaveBeenCalled()
  })
})

describe('conversion/approval-workflow — advance to next stage', () => {
  it('calls onAdvanceStage with the projectId once every required assignee has approved', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent({
      workflow: {
        status: 'approved',
        assignees: [
          makeAssignee({
            approvedAt: new Date('2026-01-03T00:00:00.000Z'),
          }),
        ],
      },
    })

    const advance = screen.getByRole('button', { name: '次のステージへ進む' })
    await user.click(advance)

    expect(handlers.onAdvanceStage).toHaveBeenCalledTimes(1)
    expect(handlers.onAdvanceStage).toHaveBeenCalledWith('proj-1')
  })

  it('hides the advance button when onAdvanceStage is not provided', () => {
    renderComponent({
      workflow: {
        status: 'approved',
        assignees: [makeAssignee({ approvedAt: new Date('2026-01-03T00:00:00.000Z') })],
      },
      omitOnAdvanceStage: true,
    })
    expect(screen.queryByRole('button', { name: '次のステージへ進む' })).not.toBeInTheDocument()
  })

  it('hides the advance button while a required assignee is still pending', () => {
    renderComponent({
      workflow: {
        status: 'approved',
        assignees: [makeAssignee({ approvedAt: undefined })],
      },
    })
    expect(screen.queryByRole('button', { name: '次のステージへ進む' })).not.toBeInTheDocument()
  })

  it('hides the advance button when the workflow is not approved', () => {
    renderComponent({
      workflow: {
        status: 'in_review',
        assignees: [makeAssignee({ approvedAt: new Date('2026-01-03T00:00:00.000Z') })],
      },
    })
    expect(screen.queryByRole('button', { name: '次のステージへ進む' })).not.toBeInTheDocument()
  })

  it('still allows advancing when no assignee is required (vacuous every)', async () => {
    const user = userEvent.setup()
    const handlers = renderComponent({
      workflow: {
        status: 'approved',
        assignees: [makeAssignee({ isRequired: false })],
      },
    })

    await user.click(screen.getByRole('button', { name: '次のステージへ進む' }))

    expect(handlers.onAdvanceStage).toHaveBeenCalledWith('proj-1')
  })

  it('disables the advance button while loading', () => {
    renderComponent({
      workflow: {
        status: 'approved',
        assignees: [makeAssignee({ approvedAt: new Date('2026-01-03T00:00:00.000Z') })],
      },
      isLoading: true,
    })
    expect(screen.getByRole('button', { name: '次のステージへ進む' })).toBeDisabled()
  })
})

describe('conversion/approval-workflow — history', () => {
  it('shows the empty message when there is no history', () => {
    renderComponent({ workflow: { history: [] } })
    expect(screen.getByText('履歴はありません')).toBeInTheDocument()
  })

  it('renders each history entry with user, action and comment', () => {
    renderComponent({
      workflow: {
        stage: 'final_approval',
        history: [
          makeHistoryEntry({
            id: 'h1',
            stage: 'mapping_review',
            action: 'approve',
            userName: '佐藤花子',
            comment: '問題ありません',
          }),
          makeHistoryEntry({
            id: 'h2',
            stage: 'rationale_review',
            action: 'comment',
            userName: '田中次郎',
            comment: '根拠を再確認してください',
          }),
        ],
      },
    })
    expect(screen.getByText('佐藤花子')).toBeInTheDocument()
    expect(screen.getByText('田中次郎')).toBeInTheDocument()
    expect(screen.getByText('問題ありません')).toBeInTheDocument()
    expect(screen.getByText('根拠を再確認してください')).toBeInTheDocument()
    expect(screen.getAllByText('approve').length).toBeGreaterThan(0)
  })

  it('omits the comment line when an entry has no comment', () => {
    renderComponent({
      workflow: {
        stage: 'final_approval',
        history: [
          makeHistoryEntry({
            id: 'h1',
            stage: 'mapping_review',
            action: 'submit',
            userName: '佐藤花子',
            comment: undefined,
          }),
        ],
      },
    })
    expect(screen.getByText('佐藤花子')).toBeInTheDocument()
    expect(screen.queryByText('問題ありません')).not.toBeInTheDocument()
  })
})

describe('conversion/approval-workflow — dialog accessibility', () => {
  it('exposes a dialog labelled by its title when rejecting', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: '却下' }))
    const dialog = await screen.findByRole('dialog')

    // radix Dialog.Content does not emit aria-modal in this version; the
    // meaningful contract is that the title labels the dialog.
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toBe('却下理由')
    expect(dialog).toHaveAttribute('data-state', 'open')
  })
})

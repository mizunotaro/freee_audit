import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type {
  JournalProposal,
  JournalEntryProposal,
  RiskAssessment,
} from '@/types/journal-proposal'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// ConfidenceIndicator / TaxTypeSelector each have their own unit tests, and
// TaxTypeSelector is backed by @radix-ui/react-select which refuses to render
// in jsdom. Treat the journal-proposal shared components as a UI boundary and
// stub them, keeping TaxTypeSelector interactive through a native <select> so
// ProposalCard's own logic (entry filtering, edit state, callbacks) is the
// only thing under test here.
vi.mock('@/components/journal-proposal', () => ({
  ConfidenceIndicator: ({ confidence, size }: { confidence: number; size?: string }) => (
    <div data-testid="confidence-indicator" data-confidence={String(confidence)} data-size={size} />
  ),
  TaxTypeSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="tax-type-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="taxable_10">taxable_10</option>
      <option value="taxable_8">taxable_8</option>
      <option value="tax_exempt">tax_exempt</option>
      <option value="non_taxable">non_taxable</option>
    </select>
  ),
  getTaxTypeLabel: (taxType: string) => `tax:${taxType}`,
}))

import { ProposalCard } from '@/app/[locale]/(authenticated)/journal-proposal/components/ProposalCard'

function makeEntry(overrides: Partial<JournalEntryProposal> = {}): JournalEntryProposal {
  return {
    id: 'e-default',
    lineType: 'debit',
    accountCode: '111',
    accountName: 'Default Account',
    amount: 0,
    taxType: 'taxable_10',
    taxRate: 0.1,
    taxAmount: 0,
    description: '',
    entryDate: '2024-01-15',
    ...overrides,
  }
}

function makeProposal(overrides: Partial<JournalProposal> = {}): JournalProposal {
  const riskAssessment: RiskAssessment = {
    overallRisk: 'low',
    auditRisk: { level: 'low', score: 10, factors: [] },
    taxRisk: { level: 'low', score: 10, factors: [] },
    recommendations: [],
  }
  return {
    id: 'p1',
    rank: 1,
    confidence: 0.85,
    entries: [
      makeEntry({
        id: 'd1',
        lineType: 'debit',
        accountCode: '111',
        accountName: '現金',
        amount: 1234,
        taxType: 'taxable_10',
        description: 'DR-MEMO',
      }),
      makeEntry({
        id: 'c1',
        lineType: 'credit',
        accountCode: '400',
        accountName: '売掛金',
        amount: 5678,
        taxType: 'non_taxable',
        description: 'CR-MEMO',
      }),
    ],
    reasoning: {
      accountSelection: '現金勘定を選定した理由',
      taxClassification: '課税仕入れに該当',
      standardCompliance: 'JGAAPに準拠',
      keyAssumptions: ['前提その1', '前提その2'],
    },
    riskAssessment,
    ...overrides,
  }
}

const cardRoot = (container: HTMLElement) => container.firstChild as HTMLElement
const debitColumn = () => screen.getByText('proposal.debit').parentElement!
const creditColumn = () => screen.getByText('proposal.credit').parentElement!
const showReasoningButton = () =>
  screen.getByRole('button', { name: /Show\s+proposal\.reasoning\.title/ })
const hideReasoningButton = () =>
  screen.getByRole('button', { name: /Hide\s+proposal\.reasoning\.title/ })

describe('ProposalCard — view-mode rendering', () => {
  it('renders the rank in the badge and the translated title', () => {
    const proposal = makeProposal()
    render(<ProposalCard proposal={proposal} />)

    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText(/proposal\.selectProposal/)).toBeInTheDocument()
  })

  it.each([1, 2, 3] as const)('renders rank #%i when provided', (rank) => {
    const proposal = makeProposal({ rank })
    render(<ProposalCard proposal={proposal} />)

    expect(screen.getByText(`#${rank}`)).toBeInTheDocument()
  })

  it('forwards confidence and the compact size to ConfidenceIndicator', () => {
    const proposal = makeProposal()
    render(<ProposalCard proposal={proposal} />)

    const indicator = screen.getByTestId('confidence-indicator')
    expect(indicator).toHaveAttribute('data-confidence', String(proposal.confidence))
    expect(indicator).toHaveAttribute('data-size', 'sm')
  })

  it.each([[0], [0.5], [1]])('forwards the boundary confidence %s unchanged', (confidence) => {
    const proposal = makeProposal({ confidence })
    render(<ProposalCard proposal={proposal} />)

    expect(screen.getByTestId('confidence-indicator')).toHaveAttribute(
      'data-confidence',
      String(confidence)
    )
  })

  it('places debit entries under the debit column and credit entries under the credit column', () => {
    const proposal = makeProposal()
    render(<ProposalCard proposal={proposal} />)

    expect(within(debitColumn()).getByText('現金')).toBeInTheDocument()
    expect(within(creditColumn()).getByText('売掛金')).toBeInTheDocument()
    expect(within(debitColumn()).queryByText('売掛金')).toBeNull()
    expect(within(creditColumn()).queryByText('現金')).toBeNull()
  })

  it('renders every debit and every credit entry when multiple are present', () => {
    const proposal = makeProposal({
      entries: [
        makeEntry({ id: 'd1', lineType: 'debit', accountName: '現金', amount: 100 }),
        makeEntry({ id: 'd2', lineType: 'debit', accountName: '当座預金', amount: 200 }),
        makeEntry({ id: 'c1', lineType: 'credit', accountName: '売掛金', amount: 150 }),
        makeEntry({ id: 'c2', lineType: 'credit', accountName: '売上', amount: 150 }),
      ],
    })
    render(<ProposalCard proposal={proposal} />)

    expect(within(debitColumn()).getByText('現金')).toBeInTheDocument()
    expect(within(debitColumn()).getByText('当座預金')).toBeInTheDocument()
    expect(within(creditColumn()).getByText('売掛金')).toBeInTheDocument()
    expect(within(creditColumn()).getByText('売上')).toBeInTheDocument()
  })

  it('formats the entry amount with locale thousands separators', () => {
    const proposal = makeProposal()
    render(<ProposalCard proposal={proposal} />)

    expect(screen.getByText('¥1,234')).toBeInTheDocument()
    expect(screen.getByText('¥5,678')).toBeInTheDocument()
  })

  it('renders the tax type label for each entry', () => {
    const proposal = makeProposal()
    render(<ProposalCard proposal={proposal} />)

    expect(screen.getByText('tax:taxable_10')).toBeInTheDocument()
    expect(screen.getByText('tax:non_taxable')).toBeInTheDocument()
  })

  it('renders the description node when an entry has one', () => {
    const proposal = makeProposal({
      entries: [
        makeEntry({ id: 'd1', lineType: 'debit', description: 'DR-MEMO' }),
        makeEntry({ id: 'c1', lineType: 'credit', description: 'CR-MEMO' }),
      ],
    })
    const { container } = render(<ProposalCard proposal={proposal} />)

    expect(container.querySelectorAll('.truncate')).toHaveLength(2)
    expect(screen.getByText('DR-MEMO')).toBeInTheDocument()
    expect(screen.getByText('CR-MEMO')).toBeInTheDocument()
  })

  it('omits the description node when the description is empty', () => {
    const proposal = makeProposal({
      entries: [
        makeEntry({ id: 'd1', lineType: 'debit', description: '' }),
        makeEntry({ id: 'c1', lineType: 'credit', description: '' }),
      ],
    })
    const { container } = render(<ProposalCard proposal={proposal} />)

    expect(container.querySelectorAll('.truncate')).toHaveLength(0)
  })

  it('renders no entry rows when entries is empty (degenerate but must not crash)', () => {
    const proposal = makeProposal({ entries: [] })
    const { container } = render(<ProposalCard proposal={proposal} />)

    expect(container.querySelectorAll('.truncate')).toHaveLength(0)
    expect(screen.getByText('proposal.debit')).toBeInTheDocument()
    expect(screen.getByText('proposal.credit')).toBeInTheDocument()
  })
})

describe('ProposalCard — risk assessment', () => {
  const base = (): RiskAssessment => ({
    overallRisk: 'low',
    auditRisk: { level: 'low', score: 10, factors: [] },
    taxRisk: { level: 'low', score: 10, factors: [] },
    recommendations: [],
  })

  it.each([
    ['low', 'bg-green-100'],
    ['medium', 'bg-yellow-100'],
    ['high', 'bg-red-100'],
  ] as const)('applies the %s risk colour class to the overall-risk badge', (level, cls) => {
    const proposal = makeProposal({
      riskAssessment: { ...base(), overallRisk: level },
    })
    const { container } = render(<ProposalCard proposal={proposal} />)

    expect(container.querySelector(`.${cls}`)).not.toBeNull()
  })

  it('shows the recommendation count when recommendations are present', () => {
    const proposal = makeProposal({
      riskAssessment: { ...base(), recommendations: ['A', 'B'] },
    })
    render(<ProposalCard proposal={proposal} />)

    expect(screen.getByText('2 recommendations')).toBeInTheDocument()
  })

  it('omits the recommendation count when there are none', () => {
    const proposal = makeProposal({ riskAssessment: base() })
    render(<ProposalCard proposal={proposal} />)

    expect(screen.queryByText(/recommendations/)).toBeNull()
  })
})

describe('ProposalCard — selection', () => {
  it('applies the selection ring when isSelected is true', () => {
    const { container } = render(<ProposalCard proposal={makeProposal()} isSelected />)

    expect(cardRoot(container)).toHaveClass('ring-2')
    expect(cardRoot(container)).toHaveClass('ring-primary')
  })

  it('does not apply the selection ring by default', () => {
    const { container } = render(<ProposalCard proposal={makeProposal()} />)

    expect(cardRoot(container)).not.toHaveClass('ring-2')
  })

  it('forwards an extra className to the card root', () => {
    const { container } = render(
      <ProposalCard proposal={makeProposal()} className="custom-class" />
    )

    expect(cardRoot(container)).toHaveClass('custom-class')
  })

  it('invokes onSelect when the card body is clicked', () => {
    const onSelect = vi.fn()
    render(<ProposalCard proposal={makeProposal()} onSelect={onSelect} />)

    fireEvent.click(screen.getByText('#1'))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe('ProposalCard — reasoning toggle', () => {
  it('reveals reasoning details on the first click and hides them on the second', () => {
    const proposal = makeProposal()
    render(<ProposalCard proposal={proposal} />)

    expect(screen.queryByText(proposal.reasoning.accountSelection)).toBeNull()
    expect(screen.queryByText('proposal.reasoning.keyAssumptions')).toBeNull()

    fireEvent.click(showReasoningButton())

    expect(screen.getByText(proposal.reasoning.accountSelection)).toBeInTheDocument()
    expect(screen.getByText(proposal.reasoning.taxClassification)).toBeInTheDocument()
    expect(screen.getByText('proposal.reasoning.accountSelection')).toBeInTheDocument()
    expect(screen.getByText('proposal.reasoning.taxClassification')).toBeInTheDocument()
    expect(screen.getByText('前提その1')).toBeInTheDocument()
    expect(screen.getByText('前提その2')).toBeInTheDocument()

    fireEvent.click(hideReasoningButton())

    expect(screen.queryByText(proposal.reasoning.accountSelection)).toBeNull()
  })

  it('does not propagate the toggle click to onSelect', () => {
    const onSelect = vi.fn()
    render(<ProposalCard proposal={makeProposal()} onSelect={onSelect} />)

    fireEvent.click(showReasoningButton())

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('omits the assumptions list when there are no key assumptions', () => {
    const proposal = makeProposal({
      reasoning: { ...makeProposal().reasoning, keyAssumptions: [] },
    })
    render(<ProposalCard proposal={proposal} />)

    fireEvent.click(showReasoningButton())

    expect(screen.getByText('proposal.reasoning.accountSelection')).toBeInTheDocument()
    expect(screen.queryByText('proposal.reasoning.keyAssumptions')).toBeNull()
  })
})

describe('ProposalCard — view-mode action buttons', () => {
  it('shows edit/approve/reject actions and not the editing actions', () => {
    render(<ProposalCard proposal={makeProposal()} />)

    expect(screen.getByRole('button', { name: 'actions.edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'actions.approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'actions.reject' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'actions.cancel' })).toBeNull()
  })

  it('Edit calls onEdit with the original proposal and does not propagate', () => {
    const proposal = makeProposal()
    const onEdit = vi.fn()
    const onSelect = vi.fn()
    render(<ProposalCard proposal={proposal} onEdit={onEdit} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'actions.edit' }))

    expect(onEdit).toHaveBeenCalledWith(proposal)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Approve calls onApprove and does not propagate', () => {
    const onApprove = vi.fn()
    const onSelect = vi.fn()
    render(<ProposalCard proposal={makeProposal()} onApprove={onApprove} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'actions.approve' }))

    expect(onApprove).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Reject calls onReject and does not propagate', () => {
    const onReject = vi.fn()
    const onSelect = vi.fn()
    render(<ProposalCard proposal={makeProposal()} onReject={onReject} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'actions.reject' }))

    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('ProposalCard — edit mode', () => {
  it('shows save/cancel actions instead of edit/approve/reject', () => {
    render(<ProposalCard proposal={makeProposal()} isEditing />)

    expect(screen.getByRole('button', { name: 'actions.save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'actions.cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'actions.edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'actions.approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'actions.reject' })).toBeNull()
  })

  it('persists an edited account name via onEdit when Save is clicked', () => {
    const onEdit = vi.fn()
    render(<ProposalCard proposal={makeProposal()} isEditing onEdit={onEdit} />)

    fireEvent.change(screen.getByDisplayValue('現金'), { target: { value: '現金等価物' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    const saved = onEdit.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')?.accountName).toBe('現金等価物')
    expect(saved.entries.find((e) => e.id === 'c1')?.accountName).toBe('売掛金')
  })

  it('coerces the edited amount to a number and persists it', () => {
    const onEdit = vi.fn()
    render(<ProposalCard proposal={makeProposal()} isEditing onEdit={onEdit} />)

    fireEvent.change(screen.getByDisplayValue('1234'), { target: { value: '9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    const saved = onEdit.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')?.amount).toBe(9999)
    expect(saved.entries.find((e) => e.id === 'c1')?.amount).toBe(5678)
  })

  it('updates taxType through the TaxTypeSelector and persists it', () => {
    const onEdit = vi.fn()
    render(<ProposalCard proposal={makeProposal()} isEditing onEdit={onEdit} />)

    const selectors = screen.getAllByTestId('tax-type-selector')
    fireEvent.change(selectors[0], { target: { value: 'tax_exempt' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    const saved = onEdit.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')?.taxType).toBe('tax_exempt')
    expect(saved.entries.find((e) => e.id === 'c1')?.taxType).toBe('non_taxable')
  })

  it('updates description through the textarea and persists it', () => {
    const onEdit = vi.fn()
    render(<ProposalCard proposal={makeProposal()} isEditing onEdit={onEdit} />)

    fireEvent.change(screen.getByDisplayValue('DR-MEMO'), { target: { value: '更新メモ' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    const saved = onEdit.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')?.description).toBe('更新メモ')
    expect(saved.entries.find((e) => e.id === 'c1')?.description).toBe('CR-MEMO')
  })

  it('Cancel discards edits and calls onEdit with the original proposal', () => {
    const proposal = makeProposal()
    const onEdit = vi.fn()
    render(<ProposalCard proposal={proposal} isEditing onEdit={onEdit} />)

    fireEvent.change(screen.getByDisplayValue('現金'), { target: { value: '破棄される値' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }))

    expect(onEdit).toHaveBeenCalledWith(proposal)
  })

  it('Save does not propagate to onSelect', () => {
    const onSelect = vi.fn()
    render(<ProposalCard proposal={makeProposal()} isEditing onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('ProposalCard — fail-safe', () => {
  it('does not crash when all action callbacks are omitted', () => {
    expect(() => render(<ProposalCard proposal={makeProposal()} />)).not.toThrow()
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'actions.approve' }))
    ).not.toThrow()
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'actions.reject' }))
    ).not.toThrow()
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'actions.edit' }))
    ).not.toThrow()
  })

  it('card click is a no-op when onSelect is not provided', () => {
    render(<ProposalCard proposal={makeProposal()} />)

    expect(() => fireEvent.click(screen.getByText('#1'))).not.toThrow()
  })

  it('does not crash in edit mode when onEdit is not provided', () => {
    render(<ProposalCard proposal={makeProposal()} isEditing />)

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    ).not.toThrow()
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }))
    ).not.toThrow()
  })
})

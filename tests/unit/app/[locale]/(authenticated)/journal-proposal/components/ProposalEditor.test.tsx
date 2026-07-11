import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { TaxType, JournalProposal, JournalEntryProposal } from '@/types/journal-proposal'
import { ProposalEditor } from '@/app/[locale]/(authenticated)/journal-proposal/components/ProposalEditor'

// --- mocks -----------------------------------------------------------------

const toastMock = vi.hoisted(() => ({
  warning: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: toastMock }))

// Realistic next-intl stand-in: resolves `namespace.key` against a message
// table and interpolates {var} placeholders (mirrors next-intl). Falls back to
// the full key path when a message is absent — the same behaviour next-intl
// exhibits for a missing key.
const { MESSAGES } = vi.hoisted(() => ({
  MESSAGES: {
    'journalProposal.actions.edit': '編集',
    'journalProposal.actions.cancel': 'キャンセル',
    'journalProposal.actions.save': '保存',
    'journalProposal.proposal.debit': '借方',
    'journalProposal.proposal.credit': '貸方',
    'journalProposal.proposal.account': '勘定科目',
    'journalProposal.proposal.amount': '金額',
    'journalProposal.proposal.taxType': '税区分',
    'journalProposal.proposal.taxAmount': '税額',
    'journalProposal.proposal.description': '摘要',
    // NOTE: this key is ABSENT from messages/ja.json in the real app (likely a
    // defect — see summary). Defined in the fixture only so the editor's
    // debit/credit value-passing logic is observable through the toast text.
    'journalProposal.proposal.balanceMismatch': '貸借不一致: 借方{debit} / 貸方{credit}',
  } as Record<string, string>,
}))
vi.mock('next-intl', () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string | number>) => {
      let msg = MESSAGES[`${namespace}.${key}`] ?? `${namespace}.${key}`
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          msg = msg.split(`{${k}}`).join(String(v))
        }
      }
      return msg
    },
}))

// TaxTypeSelector is a separately-tested collaborator built on Radix Select,
// which is brittle in jsdom. Replace it with a native <select> that wires
// value/onChange faithfully so the editor's tax-type editing path is exercised.
vi.mock('@/components/journal-proposal', () => {
  const opts: TaxType[] = [
    'taxable_10',
    'taxable_8',
    'taxable_reduced_8',
    'tax_exempt',
    'non_taxable',
    'zero_tax',
  ]
  return {
    TaxTypeSelector: ({
      value,
      onChange,
    }: {
      value: TaxType
      onChange: (value: TaxType) => void
      disabled?: boolean
      className?: string
    }) => (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TaxType)}
        aria-label="税区分"
      >
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    ),
  }
})

// --- fixtures --------------------------------------------------------------

function makeEntry(overrides: Partial<JournalEntryProposal>): JournalEntryProposal {
  return {
    id: 'e-default',
    lineType: 'debit',
    accountCode: '111',
    accountName: '現金',
    amount: 1000,
    taxType: 'taxable_10',
    taxRate: 0.1,
    taxAmount: 100,
    description: '売上計上',
    entryDate: '2024-01-15',
    ...overrides,
  }
}

function makeProposal(
  entries: JournalEntryProposal[],
  overrides: Partial<JournalProposal> = {}
): JournalProposal {
  return {
    id: 'p1',
    rank: 1,
    confidence: 0.9,
    entries,
    reasoning: {
      accountSelection: '',
      taxClassification: '',
      standardCompliance: '',
      keyAssumptions: [],
    },
    riskAssessment: {
      overallRisk: 'low',
      auditRisk: { level: 'low', score: 0, factors: [] },
      taxRisk: { level: 'low', score: 0, factors: [] },
      recommendations: [],
    },
    ...overrides,
  }
}

// 1 debit + 1 credit, both 800. Amounts < 1000 keep toLocaleString() output
// locale-independent ("800"), so total-text assertions are deterministic.
function balancedProposal(): JournalProposal {
  return makeProposal([
    makeEntry({ id: 'd1', lineType: 'debit', accountName: '現金', amount: 800, taxAmount: 80 }),
    makeEntry({ id: 'c1', lineType: 'credit', accountName: '売上', amount: 800, taxAmount: 80 }),
  ])
}

// --- query helpers ---------------------------------------------------------

// Scope queries to a single EntryEditor row by its (unique) accountName.
function entryFields(accountName: string) {
  const input = screen.getByDisplayValue(accountName) as HTMLInputElement
  const box = input.closest('div[class*="bg-muted"]') as HTMLElement
  const q = within(box)
  const spinbuttons = q.getAllByRole('spinbutton')
  return {
    box,
    account: input,
    amount: spinbuttons[0] as HTMLInputElement,
    taxAmount: spinbuttons[1] as HTMLInputElement,
    taxType: q.getByRole('combobox') as HTMLSelectElement,
    description: box.querySelector('textarea') as HTMLTextAreaElement,
  }
}

// The running-total value lives in the span immediately after its label.
function totalText(label: string): string {
  const el = screen.getByText(label)
  return (el.nextElementSibling as HTMLElement | null)?.textContent ?? ''
}

const saveButton = () => screen.getByRole('button', { name: '保存' })
const cancelButton = () => screen.getByRole('button', { name: 'キャンセル' })

// --- tests -----------------------------------------------------------------

describe('ProposalEditor — rendering', () => {
  beforeEach(() => {
    toastMock.warning.mockClear()
    toastMock.success.mockClear()
    toastMock.error.mockClear()
  })

  it('renders the edit title and save/cancel actions', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('編集')).toBeInTheDocument()
    expect(saveButton()).toBeInTheDocument()
    expect(cancelButton()).toBeInTheDocument()
  })

  it('renders debit and credit section headers', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '借方' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '貸方' })).toBeInTheDocument()
  })

  it('renders every entry, split by line type', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByDisplayValue('現金')).toBeInTheDocument()
    expect(screen.getByDisplayValue('売上')).toBeInTheDocument()
  })

  it('renders running totals formatted with the yen symbol', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    expect(totalText('借方合計')).toBe('¥800')
    expect(totalText('貸方合計')).toBe('¥800')
  })

  it('pre-fills each entry field from the proposal', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    const debit = entryFields('現金')
    expect(debit.account.value).toBe('現金')
    expect(debit.amount.value).toBe('800')
    expect(debit.taxType.value).toBe('taxable_10')
    expect(debit.taxAmount.value).toBe('80')
    expect(debit.description.value).toBe('売上計上')
  })

  it('applies the className prop to the root card', () => {
    render(
      <ProposalEditor
        proposal={balancedProposal()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        className="editor-test-class"
      />
    )

    expect(document.querySelector('.editor-test-class')).not.toBeNull()
  })
})

describe('ProposalEditor — save (balanced, happy path)', () => {
  beforeEach(() => {
    toastMock.warning.mockClear()
  })

  it('calls onSave once with the full proposal when debit === credit', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as JournalProposal
    expect(saved.id).toBe('p1')
    expect(saved.entries).toHaveLength(2)
    expect(saved.entries.map((e) => e.lineType).sort()).toEqual(['credit', 'debit'])
  })

  it('does not toast a warning on a balanced save', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.click(saveButton())

    expect(toastMock.warning).not.toHaveBeenCalled()
  })

  it('preserves entry values when saving without edits', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.click(saveButton())

    const saved = onSave.mock.calls[0][0] as JournalProposal
    const debit = saved.entries.find((e) => e.lineType === 'debit')!
    expect(debit.amount).toBe(800)
    expect(debit.accountName).toBe('現金')
    expect(debit.taxType).toBe('taxable_10')
  })
})

describe('ProposalEditor — save (balance mismatch, fail-safe)', () => {
  beforeEach(() => {
    toastMock.warning.mockClear()
  })

  it('blocks save and toasts a warning when debit !== credit (debit-side edit)', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').amount, { target: { value: '900' } })
    fireEvent.click(saveButton())

    expect(onSave).not.toHaveBeenCalled()
    expect(toastMock.warning).toHaveBeenCalledTimes(1)
  })

  it('passes the formatted debit/credit totals into the warning message', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').amount, { target: { value: '100' } })
    fireEvent.click(saveButton())

    const msg = toastMock.warning.mock.calls[0][0] as string
    expect(msg).toContain('¥100')
    expect(msg).toContain('¥800')
  })

  it('blocks save when the mismatch is on the credit side', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('売上').amount, { target: { value: '700' } })
    fireEvent.click(saveButton())

    expect(onSave).not.toHaveBeenCalled()
    expect(toastMock.warning).toHaveBeenCalledTimes(1)
  })

  it('recovers: re-balancing after a blocked save lets onSave through', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').amount, { target: { value: '900' } })
    fireEvent.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.change(entryFields('現金').amount, { target: { value: '800' } })
    fireEvent.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')!.amount).toBe(800)
  })
})

describe('ProposalEditor — entry editing (updateEntry state updates)', () => {
  beforeEach(() => {
    toastMock.warning.mockClear()
  })

  it('updates accountName and reflects it in the saved payload', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').account, { target: { value: '現金預金' } })
    fireEvent.click(saveButton())

    const saved = onSave.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')!.accountName).toBe('現金預金')
  })

  it('updates amount and recomputes the debit total live', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').amount, { target: { value: '500' } })

    expect(totalText('借方合計')).toBe('¥500')
    expect(totalText('貸方合計')).toBe('¥800')
  })

  it('updates taxType via the TaxTypeSelector and reflects it in the saved payload', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').taxType, { target: { value: 'tax_exempt' } })
    fireEvent.click(saveButton())

    const saved = onSave.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')!.taxType).toBe('tax_exempt')
  })

  it('updates taxAmount and reflects it in the saved payload', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').taxAmount, { target: { value: '40' } })
    fireEvent.click(saveButton())

    const saved = onSave.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'd1')!.taxAmount).toBe(40)
  })

  it('updates description and reflects it in the saved payload', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('売上').description, { target: { value: '雑収入' } })
    fireEvent.click(saveButton())

    const saved = onSave.mock.calls[0][0] as JournalProposal
    expect(saved.entries.find((e) => e.id === 'c1')!.description).toBe('雑収入')
  })

  it('patches only the targeted entry, leaving other entries intact (partial merge)', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').account, { target: { value: '当座預金' } })
    fireEvent.click(saveButton())

    const saved = onSave.mock.calls[0][0] as JournalProposal
    const debit = saved.entries.find((e) => e.id === 'd1')!
    const credit = saved.entries.find((e) => e.id === 'c1')!
    expect(debit.accountName).toBe('当座預金')
    expect(credit.accountName).toBe('売上')
    expect(credit.amount).toBe(800)
    expect(credit.description).toBe('売上計上')
  })
})

describe('ProposalEditor — cancel', () => {
  it('calls onCancel and does not save when the cancel button is clicked', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<ProposalEditor proposal={balancedProposal()} onSave={onSave} onCancel={onCancel} />)

    fireEvent.click(cancelButton())

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('ProposalEditor — edge cases & fail-safe', () => {
  beforeEach(() => {
    toastMock.warning.mockClear()
  })

  it('treats an empty entries array as balanced (0 === 0) and saves', () => {
    const onSave = vi.fn()
    render(<ProposalEditor proposal={makeProposal([])} onSave={onSave} onCancel={vi.fn()} />)

    expect(totalText('借方合計')).toBe('¥0')
    expect(totalText('貸方合計')).toBe('¥0')

    fireEvent.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    expect((onSave.mock.calls[0][0] as JournalProposal).entries).toEqual([])
    expect(toastMock.warning).not.toHaveBeenCalled()
  })

  it('aggregates totals across multiple debit/credit entries and saves when balanced', () => {
    const onSave = vi.fn()
    const proposal = makeProposal([
      makeEntry({ id: 'd1', lineType: 'debit', accountName: '現金', amount: 300 }),
      makeEntry({ id: 'd2', lineType: 'debit', accountName: '売掛金', amount: 200 }),
      makeEntry({ id: 'c1', lineType: 'credit', accountName: '売上', amount: 400 }),
      makeEntry({ id: 'c2', lineType: 'credit', accountName: '預り消費税', amount: 100 }),
    ])
    render(<ProposalEditor proposal={proposal} onSave={onSave} onCancel={vi.fn()} />)

    expect(totalText('借方合計')).toBe('¥500')
    expect(totalText('貸方合計')).toBe('¥500')

    fireEvent.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(toastMock.warning).not.toHaveBeenCalled()
  })

  it('saves large balanced amounts (balance check uses raw numbers, not formatted)', () => {
    const onSave = vi.fn()
    const proposal = makeProposal([
      makeEntry({ id: 'd1', lineType: 'debit', accountName: '現金', amount: 1234567 }),
      makeEntry({ id: 'c1', lineType: 'credit', accountName: '売上', amount: 1234567 }),
    ])
    render(<ProposalEditor proposal={proposal} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(toastMock.warning).not.toHaveBeenCalled()
  })

  it('coerces a cleared amount to 0 (Number(""))', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').amount, { target: { value: '' } })

    expect(totalText('借方合計')).toBe('¥0')
    expect(totalText('貸方合計')).toBe('¥800')
  })

  it('parses decimal amounts as floats (Number("100.5"))', () => {
    render(<ProposalEditor proposal={balancedProposal()} onSave={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(entryFields('現金').amount, { target: { value: '100.5' } })

    expect(totalText('借方合計')).toBe('¥100.5')
  })

  it('saves at the zero/zero boundary (0 === 0)', () => {
    const onSave = vi.fn()
    const proposal = makeProposal([
      makeEntry({ id: 'd1', lineType: 'debit', accountName: '現金', amount: 0, taxAmount: 0 }),
      makeEntry({ id: 'c1', lineType: 'credit', accountName: '売上', amount: 0, taxAmount: 0 }),
    ])
    render(<ProposalEditor proposal={proposal} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(toastMock.warning).not.toHaveBeenCalled()
  })
})

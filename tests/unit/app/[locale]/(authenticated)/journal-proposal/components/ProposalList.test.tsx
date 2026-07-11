import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProposalList } from '@/app/[locale]/(authenticated)/journal-proposal/components/ProposalList'
import type { JournalProposalOutput, ExtractedReceiptInfo } from '@/types/journal-proposal'
import type { ProposalStatus } from '@/components/journal-proposal'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Radix <Select> portals don't behave in jsdom (pointer-capture). ProposalList
// drives TWO selects — the status filter and the sort control — so we swap the
// primitives for real native <select>s built from each Select's own
// <SelectItem> values. We tag the two selects apart by inspecting the collected
// option values: sort values always embed a "-" (e.g. "date-desc"), status
// values never do. That keeps value -> onValueChange wiring live and drivable
// instead of a blind pass-through that would hide the filter/sort logic.
vi.mock('@/components/ui/select', () => {
  const React: typeof import('react') = require('react')
  const SelectItem = () => null

  function collectItems(node: React.ReactNode): string[] {
    const items: string[] = []
    const walk = (n: React.ReactNode) => {
      React.Children.forEach(n, (child) => {
        if (!React.isValidElement(child)) return
        if (child.type === SelectItem) {
          items.push(child.props.value)
          return
        }
        if (child.props && child.props.children) walk(child.props.children)
      })
    }
    walk(node)
    return items
  }

  const Select = ({ value, onValueChange, children }: any) => {
    const values = collectItems(children)
    const testid = values.some((v: string) => typeof v === 'string' && v.includes('-'))
      ? 'sort-select'
      : 'status-select'
    return React.createElement(
      'select',
      {
        'data-testid': testid,
        value,
        onChange: (e: { target: { value: string } }) => onValueChange(e.target.value),
      },
      values.map((v: string) => React.createElement('option', { key: v, value: v }, v))
    )
  }
  const Pass = ({ children }: any) => children ?? null
  return {
    Select,
    SelectContent: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue: Pass,
  }
})

type ProposalListItem = JournalProposalOutput & { status: ProposalStatus }

interface MakeOpts {
  documentId?: string
  vendorName?: string
  omitVendor?: boolean
  totalAmount?: number
  omitTotalAmount?: boolean
  confidence?: number
  emptyProposals?: boolean
  generatedAt?: Date
  aiModel?: string
  status?: ProposalStatus
}

function makeProposal(opts: MakeOpts = {}): ProposalListItem {
  const extractedInfo: ExtractedReceiptInfo = {}
  if (!opts.omitVendor) extractedInfo.vendorName = opts.vendorName ?? 'Acme Corp'
  if (!opts.omitTotalAmount) extractedInfo.totalAmount = opts.totalAmount ?? 1000
  return {
    documentId: opts.documentId ?? 'doc-1',
    ocrResult: {
      rawText: '',
      extractedInfo,
      confidence: 0.9,
      warnings: [],
    },
    proposals: opts.emptyProposals
      ? []
      : [
          {
            id: 'p1',
            rank: 1,
            confidence: opts.confidence ?? 0.9,
            entries: [],
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
          },
        ],
    generatedAt: opts.generatedAt ?? new Date('2024-01-15T00:00:00.000Z'),
    aiProvider: 'openai',
    aiModel: opts.aiModel ?? 'gpt-test',
    status: opts.status ?? 'draft',
  }
}

function expectedDate(d: Date): string {
  return new Date(d).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function firstMatch(text: string, re: RegExp): string {
  return (text.match(re) || [''])[0]
}

function renderList(
  proposals: ProposalListItem[],
  overrides: { onSelectProposal?: ReturnType<typeof vi.fn>; className?: string } = {}
) {
  const onSelectProposal = overrides.onSelectProposal ?? vi.fn()
  const utils = render(
    <ProposalList
      proposals={proposals}
      onSelectProposal={onSelectProposal as (p: JournalProposalOutput) => void}
      className={overrides.className}
    />
  )
  return {
    ...utils,
    onSelectProposal,
    statusSelect: () => screen.getByTestId('status-select') as HTMLSelectElement,
    sortSelect: () => screen.getByTestId('sort-select') as HTMLSelectElement,
    rows: () => Array.from(utils.container.querySelectorAll('tbody tr')),
    rowTexts: () =>
      Array.from(utils.container.querySelectorAll('tbody tr')).map((r) => r.textContent || ''),
    cellsOf: (row: Element) => Array.from(row.querySelectorAll('td')),
    prevButton: () => screen.queryByRole('button', { name: 'pagination.previous' }),
    nextButton: () => screen.queryByRole('button', { name: 'pagination.next' }),
  }
}

describe('ProposalList — initial render & static structure', () => {
  it('renders the title copy', () => {
    const { container } = renderList([makeProposal()])
    expect(container).toHaveTextContent('title')
  })

  it('forwards className onto the Card root', () => {
    const { container } = renderList([makeProposal()], { className: 'list-class-x' })
    expect(container.querySelector('.list-class-x')).not.toBeNull()
  })

  it('renders the six column headers', () => {
    const { container } = renderList([makeProposal()])
    const headers = Array.from(container.querySelectorAll('thead th')).map((h) => h.textContent)
    expect(headers).toEqual(['status', 'Date', 'Vendor', 'Amount', 'Confidence', 'AI Model'])
  })

  it('defaults the status filter to "all"', () => {
    expect(renderList([makeProposal()]).statusSelect().value).toBe('all')
  })

  it('defaults the sort to "date-desc"', () => {
    expect(renderList([makeProposal()]).sortSelect().value).toBe('date-desc')
  })

  it('exposes all six status filter options', () => {
    const values = Array.from(renderList([makeProposal()]).statusSelect().options).map(
      (o) => o.value
    )
    expect(values).toEqual(['all', 'draft', 'pending', 'approved', 'rejected', 'exported'])
  })

  it('exposes all six sort options', () => {
    const values = Array.from(renderList([makeProposal()]).sortSelect().options).map((o) => o.value)
    expect(values).toEqual([
      'date-desc',
      'date-asc',
      'amount-desc',
      'amount-asc',
      'confidence-desc',
      'confidence-asc',
    ])
  })
})

describe('ProposalList — empty state (fail-safe)', () => {
  it('renders noResults and no rows when given no proposals', () => {
    const { container, rows, prevButton, nextButton } = renderList([])
    expect(container).toHaveTextContent('noResults')
    expect(rows()).toHaveLength(0)
    expect(container.querySelector('table')).toBeNull()
    expect(prevButton()).toBeNull()
    expect(nextButton()).toBeNull()
  })

  it('falls back to noResults when the active status filter matches nothing', () => {
    const { container, statusSelect, rows } = renderList([makeProposal({ status: 'draft' })])
    fireEvent.change(statusSelect(), { target: { value: 'approved' } })
    expect(container).toHaveTextContent('noResults')
    expect(rows()).toHaveLength(0)
  })
})

describe('ProposalList — row rendering & formatting', () => {
  it('renders one row per proposal', () => {
    const proposals = [
      makeProposal({ documentId: 'd1' }),
      makeProposal({ documentId: 'd2' }),
      makeProposal({ documentId: 'd3' }),
    ]
    expect(renderList(proposals).rows()).toHaveLength(3)
  })

  it('formats the amount with a yen sign and thousands separators', () => {
    const { rows, cellsOf } = renderList([makeProposal({ totalAmount: 1234567 })])
    expect(cellsOf(rows()[0])[3].textContent).toBe('¥1,234,567')
  })

  it('formats 0 as ¥0', () => {
    const { rows, cellsOf } = renderList([makeProposal({ totalAmount: 0 })])
    expect(cellsOf(rows()[0])[3].textContent).toBe('¥0')
  })

  it('shows "-" when totalAmount is undefined', () => {
    const { rows, cellsOf } = renderList([makeProposal({ omitTotalAmount: true })])
    expect(cellsOf(rows()[0])[3].textContent).toBe('-')
  })

  it('shows "-" when vendorName is undefined', () => {
    const { rows, cellsOf } = renderList([makeProposal({ omitVendor: true })])
    expect(cellsOf(rows()[0])[2].textContent).toBe('-')
  })

  it('formats generatedAt using the ja-JP locale', () => {
    const date = new Date('2024-03-09T00:00:00.000Z')
    const { rows, cellsOf } = renderList([makeProposal({ generatedAt: date })])
    expect(cellsOf(rows()[0])[1].textContent).toBe(expectedDate(date))
  })

  it('renders the aiModel in its own cell', () => {
    const { rows, cellsOf } = renderList([makeProposal({ aiModel: 'claude-opus' })])
    expect(cellsOf(rows()[0])[5].textContent).toBe('claude-opus')
  })

  it('passes proposals[0].confidence to the ConfidenceIndicator', () => {
    const { rows } = renderList([makeProposal({ confidence: 0.9 })])
    const bar = rows()[0].querySelector('[role="progressbar"]') as HTMLElement
    expect(bar).toHaveAttribute('aria-valuenow', '90')
  })

  it('falls back to 0% confidence when the proposal has no entries', () => {
    const { rows } = renderList([makeProposal({ emptyProposals: true })])
    const bar = rows()[0].querySelector('[role="progressbar"]') as HTMLElement
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('calls onSelectProposal with the full proposal when a row is clicked', () => {
    const proposal = makeProposal({ documentId: 'click-me', status: 'approved' })
    const { onSelectProposal, rows } = renderList([proposal])
    fireEvent.click(rows()[0])
    expect(onSelectProposal).toHaveBeenCalledTimes(1)
    expect(onSelectProposal.mock.calls[0][0]).toBe(proposal)
  })
})

describe('ProposalList — status filter', () => {
  it('shows only proposals matching the chosen status', () => {
    const proposals = [
      makeProposal({ documentId: 'a1', vendorName: 'Alpha', status: 'approved' }),
      makeProposal({ documentId: 'd1', vendorName: 'Delta', status: 'draft' }),
      makeProposal({ documentId: 'a2', vendorName: 'Beta', status: 'approved' }),
    ]
    const { statusSelect, rowTexts } = renderList(proposals)
    fireEvent.change(statusSelect(), { target: { value: 'approved' } })
    const texts = rowTexts()
    expect(texts).toHaveLength(2)
    expect(texts.some((t) => t.includes('Alpha'))).toBe(true)
    expect(texts.some((t) => t.includes('Beta'))).toBe(true)
    expect(texts.some((t) => t.includes('Delta'))).toBe(false)
  })
})

describe('ProposalList — sorting', () => {
  it('sorts by date descending by default (newest first)', () => {
    const proposals = [
      makeProposal({
        documentId: 'jan',
        vendorName: 'Jan',
        generatedAt: new Date('2024-01-15T00:00:00.000Z'),
      }),
      makeProposal({
        documentId: 'feb',
        vendorName: 'Feb',
        generatedAt: new Date('2024-02-15T00:00:00.000Z'),
      }),
      makeProposal({
        documentId: 'mar',
        vendorName: 'Mar',
        generatedAt: new Date('2024-03-15T00:00:00.000Z'),
      }),
    ]
    expect(
      renderList(proposals)
        .rowTexts()
        .map((t) => firstMatch(t, /Jan|Feb|Mar/))
    ).toEqual(['Mar', 'Feb', 'Jan'])
  })

  it('sorts by date ascending when selected', () => {
    const proposals = [
      makeProposal({
        documentId: 'jan',
        vendorName: 'Jan',
        generatedAt: new Date('2024-01-15T00:00:00.000Z'),
      }),
      makeProposal({
        documentId: 'feb',
        vendorName: 'Feb',
        generatedAt: new Date('2024-02-15T00:00:00.000Z'),
      }),
      makeProposal({
        documentId: 'mar',
        vendorName: 'Mar',
        generatedAt: new Date('2024-03-15T00:00:00.000Z'),
      }),
    ]
    const { sortSelect, rowTexts } = renderList(proposals)
    fireEvent.change(sortSelect(), { target: { value: 'date-asc' } })
    expect(rowTexts().map((t) => firstMatch(t, /Jan|Feb|Mar/))).toEqual(['Jan', 'Feb', 'Mar'])
  })

  it('sorts by amount descending/ascending', () => {
    const proposals = [
      makeProposal({ documentId: 'p100', vendorName: 'V100', totalAmount: 100 }),
      makeProposal({ documentId: 'p200', vendorName: 'V200', totalAmount: 200 }),
      makeProposal({ documentId: 'p300', vendorName: 'V300', totalAmount: 300 }),
    ]
    const { sortSelect, rowTexts } = renderList(proposals)

    fireEvent.change(sortSelect(), { target: { value: 'amount-desc' } })
    expect(rowTexts().map((t) => firstMatch(t, /V100|V200|V300/))).toEqual(['V300', 'V200', 'V100'])

    fireEvent.change(sortSelect(), { target: { value: 'amount-asc' } })
    expect(rowTexts().map((t) => firstMatch(t, /V100|V200|V300/))).toEqual(['V100', 'V200', 'V300'])
  })

  it('treats an undefined amount as 0 during sort', () => {
    const proposals = [
      makeProposal({ documentId: 'p0', vendorName: 'Zero', omitTotalAmount: true }),
      makeProposal({ documentId: 'p5', vendorName: 'Five', totalAmount: 5 }),
    ]
    const { sortSelect, rowTexts } = renderList(proposals)
    fireEvent.change(sortSelect(), { target: { value: 'amount-asc' } })
    expect(rowTexts().map((t) => firstMatch(t, /Zero|Five/))).toEqual(['Zero', 'Five'])
  })

  it('sorts by confidence descending/ascending', () => {
    const proposals = [
      makeProposal({ documentId: 'c50', vendorName: 'C50', confidence: 0.5 }),
      makeProposal({ documentId: 'c70', vendorName: 'C70', confidence: 0.7 }),
      makeProposal({ documentId: 'c90', vendorName: 'C90', confidence: 0.9 }),
    ]
    const { sortSelect, rowTexts } = renderList(proposals)

    fireEvent.change(sortSelect(), { target: { value: 'confidence-desc' } })
    expect(rowTexts().map((t) => firstMatch(t, /C50|C70|C90/))).toEqual(['C90', 'C70', 'C50'])

    fireEvent.change(sortSelect(), { target: { value: 'confidence-asc' } })
    expect(rowTexts().map((t) => firstMatch(t, /C50|C70|C90/))).toEqual(['C50', 'C70', 'C90'])
  })
})

describe('ProposalList — pagination', () => {
  function makePage(count: number): ProposalListItem[] {
    return Array.from({ length: count }, (_, i) =>
      makeProposal({ documentId: `d${i + 1}`, vendorName: `V${i + 1}` })
    )
  }

  it('paginates at 10 per page and reports the showing/of range', () => {
    const { rows, prevButton, nextButton, container } = renderList(makePage(12))
    expect(rows()).toHaveLength(10)
    expect(prevButton()).toBeDisabled()
    expect(nextButton()).toBeEnabled()
    expect(container).toHaveTextContent(/pagination\.showing\s+1-10\s+pagination\.of\s+12/)
  })

  it('advances to page 2 via the next button', () => {
    const { nextButton, rows, prevButton, container } = renderList(makePage(12))
    fireEvent.click(nextButton()!)
    expect(rows()).toHaveLength(2)
    expect(prevButton()).toBeEnabled()
    expect(nextButton()).toBeDisabled()
    expect(container).toHaveTextContent(/pagination\.showing\s+11-12\s+pagination\.of\s+12/)
  })

  it('returns to page 1 via the previous button', () => {
    const { nextButton, prevButton, rows } = renderList(makePage(12))
    fireEvent.click(nextButton()!)
    fireEvent.click(prevButton()!)
    expect(rows()).toHaveLength(10)
    expect(prevButton()).toBeDisabled()
  })

  it('disables next on a single full page (exactly pageSize items)', () => {
    const { prevButton, nextButton, container } = renderList(makePage(10))
    expect(prevButton()).toBeDisabled()
    expect(nextButton()).toBeDisabled()
    expect(container).toHaveTextContent(/pagination\.showing\s+1-10\s+pagination\.of\s+10/)
  })
})

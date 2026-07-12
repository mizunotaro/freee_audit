import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ConversionResultViewer } from '@/components/conversion/conversion-result-viewer'
import { BalanceSheetTable } from '@/components/conversion/balance-sheet-table'
import { ProfitLossTable } from '@/components/conversion/profit-loss-table'
import { CashFlowTable } from '@/components/conversion/cash-flow-table'
import type {
  ConversionResult,
  JournalConversion,
  AdjustingEntry,
  ConvertedBalanceSheet,
  ConvertedProfitLoss,
  ConvertedCashFlow,
} from '@/types/conversion'

vi.mock('@/components/conversion/balance-sheet-table', () => ({
  BalanceSheetTable: vi.fn(() => null),
}))
vi.mock('@/components/conversion/profit-loss-table', () => ({
  ProfitLossTable: vi.fn(() => null),
}))
vi.mock('@/components/conversion/cash-flow-table', () => ({
  CashFlowTable: vi.fn(() => null),
}))

function makeJournalConversion(overrides: Partial<JournalConversion> = {}): JournalConversion {
  return {
    sourceJournalId: 'j1',
    sourceDate: new Date('2024-02-01T00:00:00Z'),
    sourceDescription: '売上計上',
    lines: [
      {
        sourceAccountCode: '4000',
        sourceAccountName: '売上',
        targetAccountCode: '4100',
        targetAccountName: 'Revenue',
        debitAmount: 0,
        creditAmount: 500,
        mappingId: 'm1',
      },
    ],
    mappingConfidence: 0.95,
    requiresReview: false,
    ...overrides,
  }
}

function makeAdjustingEntry(overrides: Partial<AdjustingEntry> = {}): AdjustingEntry {
  return {
    id: 'a1',
    projectId: 'p1',
    type: 'lease_classification',
    description: 'リースの認識',
    lines: [
      { accountCode: '1600', accountName: 'リース資産', debit: 500, credit: 0 },
      { accountCode: '2100', accountName: 'リース負債', debit: 0, credit: 500 },
    ],
    aiSuggested: true,
    isApproved: false,
    ...overrides,
  }
}

function makeBalanceSheet(overrides: Partial<ConvertedBalanceSheet> = {}): ConvertedBalanceSheet {
  return {
    asOfDate: new Date('2024-03-31T00:00:00Z'),
    assets: [
      { code: '1000', name: '現金', nameEn: 'Cash', amount: 1000, sourceAccountCode: '1000' },
    ],
    liabilities: [
      { code: '2000', name: '買掛金', nameEn: 'AP', amount: 600, sourceAccountCode: '2000' },
    ],
    equity: [
      { code: '3000', name: '資本金', nameEn: 'Capital', amount: 400, sourceAccountCode: '3000' },
    ],
    totalAssets: 1000,
    totalLiabilities: 600,
    totalEquity: 400,
    ...overrides,
  }
}

function makeProfitLoss(overrides: Partial<ConvertedProfitLoss> = {}): ConvertedProfitLoss {
  return {
    periodStart: new Date('2024-01-01T00:00:00Z'),
    periodEnd: new Date('2024-03-31T00:00:00Z'),
    revenue: [{ code: '4100', name: '売上', nameEn: 'Revenue', amount: 500 }],
    costOfSales: [],
    sgaExpenses: [],
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    grossProfit: 500,
    operatingIncome: 500,
    ordinaryIncome: 500,
    incomeBeforeTax: 500,
    netIncome: 500,
    ...overrides,
  }
}

function makeCashFlow(overrides: Partial<ConvertedCashFlow> = {}): ConvertedCashFlow {
  return {
    periodStart: new Date('2024-01-01T00:00:00Z'),
    periodEnd: new Date('2024-03-31T00:00:00Z'),
    operatingActivities: [],
    investingActivities: [],
    financingActivities: [],
    netCashFromOperating: 500,
    netCashFromInvesting: 0,
    netCashFromFinancing: 0,
    netChangeInCash: 500,
    ...overrides,
  }
}

function makeResult(overrides: Partial<ConversionResult> = {}): ConversionResult {
  return {
    id: 'r1',
    projectId: 'p1',
    conversionDate: new Date('2024-04-01T00:00:00Z'),
    conversionDurationMs: 45000,
    warnings: [],
    errors: [],
    ...overrides,
  }
}

const PROJECT_ID = 'proj-123'

function selectTab(name: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name }))
}

function statValue(label: string): string {
  const labelEl = screen.getByText(label)
  return labelEl.nextElementSibling?.textContent ?? ''
}

function journalDataRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('tbody tr'))
}

beforeEach(() => {
  vi.mocked(BalanceSheetTable).mockClear()
  vi.mocked(ProfitLossTable).mockClear()
  vi.mocked(CashFlowTable).mockClear()
})

describe('conversion-result-viewer — summary header', () => {
  it('renders the result title and conversion-completion label', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    expect(screen.getByText('変換結果')).toBeInTheDocument()
    expect(screen.getByText(/変換完了/)).toBeInTheDocument()
  })

  it('shows the Excel / PDF / CSV export buttons', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
  })
})

describe('conversion-result-viewer — formatDuration stat', () => {
  it.each([
    [0, '0秒'],
    [45000, '45秒'],
    [59999, '59秒'],
    [60000, '1分0秒'],
    [125000, '2分5秒'],
    [3600000, '60分0秒'],
  ])('formats %ims as "%s"', (ms, expected) => {
    render(
      <ConversionResultViewer
        result={makeResult({ conversionDurationMs: ms })}
        projectId={PROJECT_ID}
      />
    )

    expect(statValue('変換所要時間')).toBe(expected)
  })
})

describe('conversion-result-viewer — summary stat counters', () => {
  it('counts journals, warnings and errors from the result', () => {
    const result = makeResult({
      journalConversions: [makeJournalConversion(), makeJournalConversion()],
      warnings: [
        { code: 'W1', message: 'warn1' },
        { code: 'W2', message: 'warn2' },
      ],
      errors: [],
    })
    render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    expect(statValue('変換仕訳数')).toBe('2')
    expect(statValue('警告')).toBe('2')
    expect(statValue('エラー')).toBe('0')
  })

  it('reports zero journals when journalConversions is undefined', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    expect(statValue('変換仕訳数')).toBe('0')
  })

  it('shows the green check icon only when there are no errors', () => {
    const { container } = render(
      <ConversionResultViewer result={makeResult({ errors: [] })} projectId={PROJECT_ID} />
    )

    expect(container.querySelector('svg.text-green-500')).not.toBeNull()
    expect(container.querySelector('svg.text-destructive')).toBeNull()
  })

  it('swaps to the destructive alert icon when errors exist', () => {
    const { container } = render(
      <ConversionResultViewer
        result={makeResult({ errors: [{ code: 'E1', message: 'boom' }] })}
        projectId={PROJECT_ID}
      />
    )

    expect(container.querySelector('svg.text-green-500')).toBeNull()
    expect(container.querySelector('svg.text-destructive')).not.toBeNull()
  })

  it('shows the yellow warning icon only when warnings exist', () => {
    const { container: empty } = render(
      <ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />
    )
    expect(empty.querySelector('svg.text-yellow-500')).toBeNull()

    const { container: withWarn } = render(
      <ConversionResultViewer
        result={makeResult({ warnings: [{ code: 'W1', message: 'w' }] })}
        projectId={PROJECT_ID}
      />
    )
    expect(withWarn.querySelector('svg.text-yellow-500')).not.toBeNull()
  })
})

describe('conversion-result-viewer — warning & error cards', () => {
  it('hides the warnings card when there are no warnings', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    expect(screen.queryByText(/警告 \(/)).not.toBeInTheDocument()
  })

  it('lists each warning code and message when warnings exist', () => {
    render(
      <ConversionResultViewer
        result={makeResult({
          warnings: [
            { code: 'W_LOW_CONF', message: '信頼度が低い科目があります' },
            { code: 'W_UNMAPPED', message: '未マッピング科目があります' },
          ],
        })}
        projectId={PROJECT_ID}
      />
    )

    expect(screen.getByText('警告 (2件)')).toBeInTheDocument()
    expect(screen.getByText('W_LOW_CONF')).toBeInTheDocument()
    expect(screen.getByText('信頼度が低い科目があります')).toBeInTheDocument()
    expect(screen.getByText('W_UNMAPPED')).toBeInTheDocument()
    expect(screen.getByText('未マッピング科目があります')).toBeInTheDocument()
  })

  it('hides the errors card when there are no errors', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    expect(screen.queryByText(/エラー \(/)).not.toBeInTheDocument()
  })

  it('lists each error code, message and affected item when errors exist', () => {
    render(
      <ConversionResultViewer
        result={makeResult({
          errors: [
            { code: 'E_BALANCE', message: '貸借不一致', affectedItem: '仕訳#12' },
            { code: 'E_MISSING', message: 'マッピング不在' },
          ],
        })}
        projectId={PROJECT_ID}
      />
    )

    expect(screen.getByText('エラー (2件)')).toBeInTheDocument()
    expect(screen.getByText('E_BALANCE')).toBeInTheDocument()
    expect(screen.getByText('貸借不一致')).toBeInTheDocument()
    expect(screen.getByText(/仕訳#12/)).toBeInTheDocument()
    expect(screen.getByText('E_MISSING')).toBeInTheDocument()
  })
})

describe('conversion-result-viewer — statement tabs', () => {
  it('delegates the active balance-sheet tab to BalanceSheetTable with showSource', () => {
    const bs = makeBalanceSheet()
    render(
      <ConversionResultViewer result={makeResult({ balanceSheet: bs })} projectId={PROJECT_ID} />
    )

    expect(vi.mocked(BalanceSheetTable)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(BalanceSheetTable).mock.calls[0][0]).toEqual({
      data: bs,
      showSource: true,
    })
  })

  it('shows the empty-state message when the balance sheet is absent', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    expect(screen.getByText('貸借対照表データがありません')).toBeInTheDocument()
  })

  it('delegates the profit-loss tab to ProfitLossTable after switching', () => {
    const pl = makeProfitLoss()
    render(
      <ConversionResultViewer result={makeResult({ profitLoss: pl })} projectId={PROJECT_ID} />
    )

    expect(vi.mocked(ProfitLossTable)).not.toHaveBeenCalled()
    selectTab('損益計算書')

    expect(vi.mocked(ProfitLossTable)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(ProfitLossTable).mock.calls[0][0]).toEqual({
      data: pl,
      showSource: true,
    })
  })

  it('shows the empty-state message when profit-loss is absent', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    selectTab('損益計算書')
    expect(screen.getByText('損益計算書データがありません')).toBeInTheDocument()
  })

  it('delegates the cash-flow tab to CashFlowTable after switching', () => {
    const cf = makeCashFlow()
    render(<ConversionResultViewer result={makeResult({ cashFlow: cf })} projectId={PROJECT_ID} />)

    selectTab('キャッシュフロー')
    expect(vi.mocked(CashFlowTable)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(CashFlowTable).mock.calls[0][0]).toEqual({
      data: cf,
      showSource: true,
    })
  })

  it('shows the empty-state message when cash-flow is absent', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    selectTab('キャッシュフロー')
    expect(screen.getByText('キャッシュフロー計算書データがありません')).toBeInTheDocument()
  })

  it('only renders the adjustments tab trigger when adjusting entries exist', () => {
    const { rerender } = render(
      <ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />
    )
    expect(screen.queryByRole('tab', { name: '調整仕訳' })).not.toBeInTheDocument()

    rerender(
      <ConversionResultViewer
        result={makeResult({ adjustingEntries: [makeAdjustingEntry()] })}
        projectId={PROJECT_ID}
      />
    )
    expect(screen.getByRole('tab', { name: '調整仕訳' })).toBeInTheDocument()
  })
})

describe('conversion-result-viewer — journals tab', () => {
  it('shows the empty state when there are no journal conversions', () => {
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    expect(screen.getByText('仕訳データがありません')).toBeInTheDocument()
    expect(screen.getByText('0件の仕訳が変換されました')).toBeInTheDocument()
  })

  it('renders the journal count description and a row per journal', () => {
    const result = makeResult({
      journalConversions: [
        makeJournalConversion({ sourceJournalId: 'j1', sourceDescription: '売上A' }),
        makeJournalConversion({ sourceJournalId: 'j2', sourceDescription: '売上B' }),
      ],
    })
    const { container } = render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    expect(screen.getByText('2件の仕訳が変換されました')).toBeInTheDocument()
    expect(screen.getByText('売上A')).toBeInTheDocument()
    expect(screen.getByText('売上B')).toBeInTheDocument()
    expect(journalDataRows(container)).toHaveLength(2)
  })

  it('renders source and target account codes per journal line', () => {
    const result = makeResult({
      journalConversions: [
        makeJournalConversion({
          lines: [
            {
              sourceAccountCode: '4111',
              sourceAccountName: '売上',
              targetAccountCode: '4222',
              targetAccountName: 'Revenue',
              debitAmount: 0,
              creditAmount: 500,
              mappingId: 'm1',
            },
          ],
        }),
      ],
    })
    render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    expect(screen.getByText('4111')).toBeInTheDocument()
    expect(screen.getByText('4222')).toBeInTheDocument()
  })

  it('shows the credit amount but leaves the debit cell empty when only credit > 0', () => {
    const result = makeResult({
      journalConversions: [
        makeJournalConversion({
          lines: [
            {
              sourceAccountCode: '4111',
              sourceAccountName: '売上',
              targetAccountCode: '4222',
              targetAccountName: 'Revenue',
              debitAmount: 0,
              creditAmount: 500,
              mappingId: 'm1',
            },
          ],
        }),
      ],
    })
    const { container } = render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    const rows = journalDataRows(container)
    const cells = within(rows[0]).getAllByRole('cell')
    const debitCell = cells[4]
    const creditCell = cells[5]

    expect(debitCell.textContent).toBe('')
    expect(creditCell.textContent).toBe('500')
  })

  it('shows the debit amount but leaves the credit cell empty when only debit > 0', () => {
    const result = makeResult({
      journalConversions: [
        makeJournalConversion({
          lines: [
            {
              sourceAccountCode: '1111',
              sourceAccountName: '現金',
              targetAccountCode: '1222',
              targetAccountName: 'Cash',
              debitAmount: 800,
              creditAmount: 0,
              mappingId: 'm2',
            },
          ],
        }),
      ],
    })
    const { container } = render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    const cells = within(journalDataRows(container)[0]).getAllByRole('cell')

    expect(cells[4].textContent).toBe('800')
    expect(cells[5].textContent).toBe('')
  })

  it('rounds mapping confidence to a whole percent', () => {
    const result = makeResult({
      journalConversions: [
        makeJournalConversion({ mappingConfidence: 0.951 }),
        makeJournalConversion({ sourceJournalId: 'j2', mappingConfidence: 0.8 }),
        makeJournalConversion({ sourceJournalId: 'j3', mappingConfidence: 0.5 }),
      ],
    })
    render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('maps confidence to the default badge variant at >= 0.9', () => {
    const result = makeResult({
      journalConversions: [makeJournalConversion({ mappingConfidence: 0.95 })],
    })
    render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    expect(screen.getByText('95%')).toHaveClass('bg-primary')
  })

  it('maps confidence to the secondary badge variant between 0.7 and 0.9', () => {
    const result = makeResult({
      journalConversions: [makeJournalConversion({ mappingConfidence: 0.8 })],
    })
    render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    expect(screen.getByText('80%')).toHaveClass('bg-secondary')
  })

  it('maps confidence to the destructive badge variant below 0.7', () => {
    const result = makeResult({
      journalConversions: [makeJournalConversion({ mappingConfidence: 0.5 })],
    })
    render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('仕訳一覧')
    expect(screen.getByText('50%')).toHaveClass('bg-destructive')
  })

  it('caps the rendered journal rows at 100 and shows the truncation note', () => {
    const conversions = Array.from({ length: 150 }, (_, i) =>
      makeJournalConversion({
        sourceJournalId: `j${i}`,
        sourceDescription: `仕訳${i}`,
        mappingConfidence: 0.9,
      })
    )
    const { container } = render(
      <ConversionResultViewer
        result={makeResult({ journalConversions: conversions })}
        projectId={PROJECT_ID}
      />
    )

    selectTab('仕訳一覧')
    expect(journalDataRows(container)).toHaveLength(100)
    expect(screen.getByText('上位100件を表示中（全150件）')).toBeInTheDocument()
  })
})

describe('conversion-result-viewer — adjusting entries tab', () => {
  it('renders each adjustment type, description and approved badge', () => {
    const result = makeResult({
      adjustingEntries: [
        makeAdjustingEntry({ id: 'a1', description: 'リース認識A', isApproved: true }),
        makeAdjustingEntry({
          id: 'a2',
          type: 'deferred_tax',
          description: '繰延税金',
          isApproved: false,
        }),
      ],
    })
    render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('調整仕訳')
    expect(screen.getByText('2件の調整仕訳が生成されました')).toBeInTheDocument()
    expect(screen.getByText('lease_classification')).toBeInTheDocument()
    expect(screen.getByText('リース認識A')).toBeInTheDocument()
    expect(screen.getByText('deferred_tax')).toBeInTheDocument()
    expect(screen.getByText('繰延税金')).toBeInTheDocument()
    expect(screen.getByText('承認済み')).toBeInTheDocument()
  })

  it('renders each adjustment line with code/name and debit/credit amounts', () => {
    const result = makeResult({
      adjustingEntries: [makeAdjustingEntry()],
    })
    const { container } = render(<ConversionResultViewer result={result} projectId={PROJECT_ID} />)

    selectTab('調整仕訳')
    const rows = container.querySelectorAll<HTMLElement>('tbody tr')
    expect(rows).toHaveLength(2)

    const debitRow = within(rows[0]).getAllByRole('cell')
    expect(debitRow[0]).toHaveTextContent('1600')
    expect(debitRow[0]).toHaveTextContent('リース資産')
    expect(debitRow[1].textContent).toBe('500')
    expect(debitRow[2].textContent).toBe('')

    const creditRow = within(rows[1]).getAllByRole('cell')
    expect(creditRow[0]).toHaveTextContent('2100')
    expect(creditRow[0]).toHaveTextContent('リース負債')
    expect(creditRow[1].textContent).toBe('')
    expect(creditRow[2].textContent).toBe('500')
  })
})

describe('conversion-result-viewer — export handlers', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    openSpy.mockRestore()
  })

  it.each(['excel', 'pdf', 'csv'] as const)(
    'requests the %s export and opens the returned file url',
    async (format) => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { fileUrl: `http://example.com/result.${format}` } }),
      })
      const buttonLabel = format === 'excel' ? 'Excel' : format.toUpperCase()
      render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

      fireEvent.click(screen.getByRole('button', { name: buttonLabel }))

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
      expect(fetchSpy).toHaveBeenCalledWith(`/api/conversion/export/${PROJECT_ID}?format=${format}`)
      await waitFor(() =>
        expect(openSpy).toHaveBeenCalledWith(`http://example.com/result.${format}`, '_blank')
      )
    }
  )

  it('does not open a window when the export response is not ok (fail-safe)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, json: async () => ({}) })
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('logs and swallows export failures without crashing (fail-safe)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchSpy.mockRejectedValue(new Error('network down'))
    render(<ConversionResultViewer result={makeResult()} projectId={PROJECT_ID} />)

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Export failed:', expect.any(Error)))
    expect(openSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

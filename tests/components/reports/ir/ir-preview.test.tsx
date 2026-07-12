import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IRPreview } from '@/components/reports/ir/ir-preview'
import type { IRReport, IRReportSection, FinancialHighlight } from '@/types/reports/ir-report'

function makeSection(overrides: Partial<IRReportSection> = {}): IRReportSection {
  return {
    id: 'section-1',
    type: 'company_overview',
    title: { ja: '会社概要', en: 'Company Overview' },
    content: { ja: 'これは会社概要です。', en: 'This is the company overview.' },
    order: 1,
    ...overrides,
  }
}

function makeHighlight(overrides: Partial<FinancialHighlight> = {}): FinancialHighlight {
  return {
    fiscalYear: '2024',
    revenue: 1000000,
    operatingProfit: 200000,
    ordinaryProfit: 250000,
    netIncome: 150000,
    eps: 100.5,
    bps: 500.25,
    roe: 0.15,
    roa: 0.08,
    ...overrides,
  }
}

function makeReport(overrides: Partial<IRReport> = {}): IRReport {
  return {
    id: 'report-1',
    companyId: 'company-1',
    title: { ja: 'IRレポート 2024', en: 'IR Report 2024' },
    fiscalYear: '2024',
    status: 'published',
    language: 'ja',
    sections: [makeSection()],
    financialHighlights: [],
    shareholderComposition: [],
    events: [],
    faqs: [],
    metadata: {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      publishedAt: '2024-03-15T00:00:00Z',
      createdBy: 'user-1',
      lastModifiedBy: 'user-1',
      version: 3,
    },
    ...overrides,
  }
}

describe('IRPreview', () => {
  let printSpy: ReturnType<typeof vi.spyOn>
  let dateSpy: ReturnType<typeof vi.spyOn>
  let numSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    dateSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('FORMATTED_DATE')
    numSpy = vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (
      this: number
    ) {
      return 'FMT:' + String(this)
    })
  })

  afterEach(() => {
    printSpy.mockRestore()
    dateSpy.mockRestore()
    numSpy.mockRestore()
  })

  describe('toolbar actions', () => {
    it('renders the preview header and both action buttons', () => {
      render(<IRPreview report={makeReport()} language="ja" />)

      expect(screen.getByText('プレビュー')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /印刷/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /PDF出力/ })).toBeInTheDocument()
    })

    it('calls window.print() when no onPrint handler is provided', () => {
      render(<IRPreview report={makeReport()} language="ja" />)

      fireEvent.click(screen.getByRole('button', { name: /印刷/ }))

      expect(printSpy).toHaveBeenCalledTimes(1)
    })

    it('calls the provided onPrint handler instead of window.print()', () => {
      const onPrint = vi.fn()
      render(<IRPreview report={makeReport()} language="ja" onPrint={onPrint} />)

      fireEvent.click(screen.getByRole('button', { name: /印刷/ }))

      expect(onPrint).toHaveBeenCalledTimes(1)
      expect(printSpy).not.toHaveBeenCalled()
    })

    it('calls the provided onExport handler when PDF export is clicked', () => {
      const onExport = vi.fn()
      render(<IRPreview report={makeReport()} language="ja" onExport={onExport} />)

      fireEvent.click(screen.getByRole('button', { name: /PDF出力/ }))

      expect(onExport).toHaveBeenCalledTimes(1)
    })

    it('degrades safely (no-op, no throw) when PDF export clicked without onExport', () => {
      render(<IRPreview report={makeReport()} language="ja" />)

      expect(() => fireEvent.click(screen.getByRole('button', { name: /PDF出力/ }))).not.toThrow()
      expect(screen.getByRole('button', { name: /PDF出力/ })).toBeInTheDocument()
    })
  })

  describe('localized title (getLocalizedTitle)', () => {
    it('shows the Japanese report title for language ja', () => {
      render(<IRPreview report={makeReport()} language="ja" />)

      expect(screen.getByRole('heading', { level: 1, name: 'IRレポート 2024' })).toBeInTheDocument()
    })

    it('shows the English report title for language en', () => {
      render(<IRPreview report={makeReport()} language="en" />)

      expect(screen.getByRole('heading', { level: 1, name: 'IR Report 2024' })).toBeInTheDocument()
    })

    it('shows a combined title for language bilingual', () => {
      render(<IRPreview report={makeReport()} language="bilingual" />)

      expect(
        screen.getByRole('heading', { level: 1, name: 'IRレポート 2024 / IR Report 2024' })
      ).toBeInTheDocument()
    })
  })

  describe('fiscal year suffix', () => {
    it('appends Japanese suffix for ja', () => {
      render(<IRPreview report={makeReport()} language="ja" />)
      // Suffix shares a <p> with the fiscal-year value ("2024 年度"); match as substring.
      expect(screen.getByText(/年度/)).toBeInTheDocument()
    })

    it('appends English suffix for en', () => {
      render(<IRPreview report={makeReport()} language="en" />)
      expect(screen.getByText(/Fiscal Year/)).toBeInTheDocument()
    })

    it('appends combined suffix for bilingual', () => {
      render(<IRPreview report={makeReport()} language="bilingual" />)
      expect(screen.getByText(/年度 \/ Fiscal Year/)).toBeInTheDocument()
    })
  })

  describe('sections', () => {
    it('renders sections sorted by order ascending', () => {
      const report = makeReport({
        sections: [
          makeSection({ id: 's1', title: { ja: 'First', en: 'First' }, order: 3 }),
          makeSection({ id: 's2', title: { ja: 'Second', en: 'Second' }, order: 1 }),
          makeSection({ id: 's3', title: { ja: 'Third', en: 'Third' }, order: 2 }),
        ],
      })

      render(<IRPreview report={report} language="ja" />)

      const second = screen.getByText('Second')
      const third = screen.getByText('Third')
      const first = screen.getByText('First')

      expect(second.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(third.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('renders the localized section title', () => {
      render(<IRPreview report={makeReport()} language="en" />)

      expect(screen.getByText('Company Overview')).toBeInTheDocument()
    })

    it('renders the bilingual section title as ja / en', () => {
      render(<IRPreview report={makeReport()} language="bilingual" />)

      expect(screen.getByText('会社概要 / Company Overview')).toBeInTheDocument()
    })

    it('skips a section whose content for the active language is empty', () => {
      const report = makeReport({
        sections: [
          makeSection({
            id: 'empty',
            title: { ja: '空セクション', en: 'Empty Section' },
            content: { ja: '内容あり', en: '' },
            order: 1,
          }),
          makeSection({
            id: 'full',
            title: { ja: '充実セクション', en: 'Populated Section' },
            content: { ja: '他の内容', en: 'Populated content.' },
            order: 2,
          }),
        ],
      })

      render(<IRPreview report={report} language="en" />)

      expect(screen.queryByText('Empty Section')).not.toBeInTheDocument()
      expect(screen.getByText('Populated Section')).toBeInTheDocument()
    })

    it('falls back to Japanese content for bilingual language', () => {
      const report = makeReport({
        sections: [
          makeSection({
            id: 's1',
            title: { ja: 'JAタイトル', en: 'EN Title' },
            content: { ja: '日本語本文', en: '' },
            order: 1,
          }),
        ],
      })

      render(<IRPreview report={report} language="bilingual" />)

      expect(screen.getByText('日本語本文')).toBeInTheDocument()
    })

    it('renders nothing in the section area when sections is empty', () => {
      const report = makeReport({ sections: [] })
      const { container } = render(<IRPreview report={report} language="ja" />)

      expect(container.querySelectorAll('section')).toHaveLength(0)
      expect(screen.queryByText('会社概要')).not.toBeInTheDocument()
    })
  })

  describe('markdown rendering (renderMarkdown)', () => {
    const markdown = [
      '## 大見出し',
      '### 小見出し',
      '- 箇条書き',
      '1. 順序付き',
      '',
      '**太字文**',
      '通常テキスト',
    ].join('\n')

    it('renders a level-2 heading for "## "', () => {
      render(
        <IRPreview
          report={makeReport({ sections: [makeSection({ content: { ja: markdown, en: '' } })] })}
          language="ja"
        />
      )

      expect(screen.getByRole('heading', { level: 2, name: '大見出し' })).toBeInTheDocument()
    })

    it('renders a level-3 heading for "### "', () => {
      render(
        <IRPreview
          report={makeReport({ sections: [makeSection({ content: { ja: markdown, en: '' } })] })}
          language="ja"
        />
      )

      expect(screen.getByRole('heading', { level: 3, name: '小見出し' })).toBeInTheDocument()
    })

    it('renders bullet and ordered lines as list items', () => {
      render(
        <IRPreview
          report={makeReport({ sections: [makeSection({ content: { ja: markdown, en: '' } })] })}
          language="ja"
        />
      )

      const items = screen.getAllByRole('listitem')
      expect(items).toHaveLength(2)
      expect(screen.getByText('箇条書き')).toBeInTheDocument()
      expect(screen.getByText('順序付き')).toBeInTheDocument()
    })

    it('renders a <br> for blank lines', () => {
      const { container } = render(
        <IRPreview
          report={makeReport({ sections: [makeSection({ content: { ja: markdown, en: '' } })] })}
          language="ja"
        />
      )

      expect(container.querySelectorAll('br').length).toBeGreaterThan(0)
    })

    it('strips ** markers and renders bold line as a paragraph', () => {
      render(
        <IRPreview
          report={makeReport({ sections: [makeSection({ content: { ja: markdown, en: '' } })] })}
          language="ja"
        />
      )

      expect(screen.queryByText('**太字文**')).not.toBeInTheDocument()
      expect(screen.getByText('太字文')).toBeInTheDocument()
    })

    it('renders an unmarked line as a plain paragraph', () => {
      render(
        <IRPreview
          report={makeReport({ sections: [makeSection({ content: { ja: markdown, en: '' } })] })}
          language="ja"
        />
      )

      expect(screen.getByText('通常テキスト')).toBeInTheDocument()
    })
  })

  describe('financial highlights table', () => {
    it('does not render the highlights card when financialHighlights is empty', () => {
      render(<IRPreview report={makeReport({ financialHighlights: [] })} language="ja" />)

      expect(screen.queryByText('財務ハイライト')).not.toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('renders the card, headers and toLocaleString-formatted values (ja)', () => {
      const report = makeReport({
        financialHighlights: [
          makeHighlight({
            fiscalYear: '2024',
            revenue: 1000000,
            operatingProfit: 200000,
            netIncome: 150000,
          }),
          makeHighlight({
            fiscalYear: '2023',
            revenue: 900000,
            operatingProfit: 180000,
            netIncome: 140000,
          }),
        ],
      })

      render(<IRPreview report={report} language="ja" />)

      expect(screen.getByText('財務ハイライト')).toBeInTheDocument()

      const table = screen.getByRole('table')
      // Japanese row/column labels
      expect(within(table).getByText('項目')).toBeInTheDocument()
      expect(within(table).getByText('売上高')).toBeInTheDocument()
      expect(within(table).getByText('営業利益')).toBeInTheDocument()
      expect(within(table).getByText('当期純利益')).toBeInTheDocument()
      // Fiscal year headers
      expect(within(table).getByText('2024')).toBeInTheDocument()
      expect(within(table).getByText('2023')).toBeInTheDocument()
      // Values passed through toLocaleString (proves call + field binding)
      expect(within(table).getByText('FMT:1000000')).toBeInTheDocument()
      expect(within(table).getByText('FMT:900000')).toBeInTheDocument()
      expect(within(table).getByText('FMT:200000')).toBeInTheDocument()
      expect(within(table).getByText('FMT:180000')).toBeInTheDocument()
      expect(within(table).getByText('FMT:150000')).toBeInTheDocument()
      expect(within(table).getByText('FMT:140000')).toBeInTheDocument()
    })

    it('uses English labels for language en', () => {
      const report = makeReport({
        financialHighlights: [makeHighlight()],
      })

      render(<IRPreview report={report} language="en" />)

      expect(screen.getByText('Financial Highlights')).toBeInTheDocument()
      const table = screen.getByRole('table')
      expect(within(table).getByText('Item')).toBeInTheDocument()
      expect(within(table).getByText('Revenue')).toBeInTheDocument()
      expect(within(table).getByText('Operating Profit')).toBeInTheDocument()
      expect(within(table).getByText('Net Income')).toBeInTheDocument()
    })

    it('renders a single highlight column without error', () => {
      const report = makeReport({
        financialHighlights: [makeHighlight({ fiscalYear: '2024' })],
      })

      render(<IRPreview report={report} language="ja" />)

      const table = screen.getByRole('table')
      const headers = within(table).getAllByText('2024')
      expect(headers).toHaveLength(1)
    })
  })

  describe('footer metadata', () => {
    it('renders Japanese published date label and version', () => {
      render(<IRPreview report={makeReport()} language="ja" />)

      expect(screen.getByText('公開日: FORMATTED_DATE')).toBeInTheDocument()
      expect(screen.getByText('Version 3')).toBeInTheDocument()
    })

    it('renders English published date label for en', () => {
      render(<IRPreview report={makeReport()} language="en" />)

      expect(screen.getByText('Published: FORMATTED_DATE')).toBeInTheDocument()
    })

    it('renders a dash when publishedAt is missing (ja)', () => {
      const report = makeReport({
        metadata: {
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          createdBy: 'user-1',
          lastModifiedBy: 'user-1',
          version: 1,
        },
      })

      render(<IRPreview report={report} language="ja" />)

      expect(screen.getByText('公開日: -')).toBeInTheDocument()
      expect(screen.getByText('Version 1')).toBeInTheDocument()
    })

    it('renders a dash when publishedAt is missing (en)', () => {
      const report = makeReport({
        metadata: {
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          createdBy: 'user-1',
          lastModifiedBy: 'user-1',
          version: 1,
        },
      })

      render(<IRPreview report={report} language="en" />)

      expect(screen.getByText('Published: -')).toBeInTheDocument()
    })
  })
})

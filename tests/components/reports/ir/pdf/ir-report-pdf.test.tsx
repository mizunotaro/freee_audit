import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// @react-pdf/renderer primitives target the react-pdf reconciler and do not
// produce queryable DOM under react-dom/jsdom. Stub them as plain host elements
// so we can exercise the components' own logic (text, conditionals, formatting,
// language switching, fail-safe guards) deterministically.
vi.mock('@react-pdf/renderer', async () => {
  const React = await import('react')
  const createElement = React.createElement
  const resolveStyle = (style: unknown): React.CSSProperties | undefined => {
    if (!style) return undefined
    if (Array.isArray(style)) return Object.assign({}, ...(style as object[]))
    return style as React.CSSProperties
  }
  return {
    StyleSheet: { create: <T,>(s: T): T => s },
    Document: ({ children }: { children?: React.ReactNode }) =>
      createElement('div', { 'data-testid': 'pdf-document' }, children),
    Page: ({ children }: { children?: React.ReactNode }) =>
      createElement('div', { 'data-testid': 'pdf-page' }, children),
    View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) =>
      createElement('div', { style: resolveStyle(style) }, children),
    Text: ({
      children,
      style,
      render,
    }: {
      children?: React.ReactNode
      style?: unknown
      render?: (ctx: { pageNumber: number; totalPages: number }) => React.ReactNode
    }) => {
      const content =
        typeof render === 'function' ? render({ pageNumber: 1, totalPages: 1 }) : children
      return createElement('span', { style: resolveStyle(style) }, content)
    },
  }
})

import {
  irReportStyles,
  CoverPage,
  TOCPage,
  SectionPage,
  IRReportDocument,
  FinancialHighlightsSection,
  TableSection,
} from '@/components/reports/ir/pdf/ir-report-pdf'
import type {
  FinancialHighlightData,
  TableRowData,
} from '@/components/reports/ir/pdf/ir-report-pdf'
import type { IRReport, IRReportSection } from '@/types/ir-report'

function makeSection(overrides: Partial<IRReportSection> = {}): IRReportSection {
  return {
    id: 'section-1',
    reportId: 'report-1',
    sectionType: 'overview',
    title: '事業概要',
    content: '当社の事業概要です。',
    sortOrder: 0,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  }
}

function makeReport(overrides: Partial<IRReport> = {}): IRReport {
  return {
    id: 'report-1',
    companyId: 'company-1',
    reportType: 'annual',
    fiscalYear: 2024,
    title: '2024年度 IRレポート',
    sections: [makeSection()],
    status: 'DRAFT',
    language: 'ja',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  }
}

function expectInlineColor(el: HTMLElement, hex: string, rgb: string): void {
  const style = (el.getAttribute('style') ?? '').toLowerCase()
  expect(
    style.includes(hex) || style.includes(rgb),
    `expected color ${hex}/${rgb}, got "${style}"`
  ).toBe(true)
}

describe('irReportStyles', () => {
  it('exposes the stylesheet with the Japanese font family and key styles', () => {
    expect(irReportStyles.page.fontFamily).toBe('Noto Sans JP')
    expect(irReportStyles.page.backgroundColor).toBe('#FFFFFF')
    expect(irReportStyles.coverTitle.fontSize).toBe(32)
    expect(irReportStyles.highlightValue.color).toBe('#1A73E8')
    expect(irReportStyles.metricCard.width).toBe('45%')
  })
})

describe('CoverPage', () => {
  const FIXED_DATE = new Date('2024-06-15T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_DATE })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders Japanese cover content with the localized generated date', () => {
    render(<CoverPage title="2024 IR" fiscalYear={2024} companyName="Acme" language="ja" />)

    expect(screen.getByText('2024 IR')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('2024年度')).toBeInTheDocument()
    expect(screen.getByText('投資家向け資料')).toBeInTheDocument()
    const expectedDate = FIXED_DATE.toLocaleDateString('ja-JP')
    expect(screen.getByText(`作成日: ${expectedDate}`)).toBeInTheDocument()
  })

  it('renders English cover content with the en-US generated date', () => {
    render(<CoverPage title="2024 IR" fiscalYear={2024} companyName="Acme" language="en" />)

    expect(screen.getByText('Fiscal Year 2024')).toBeInTheDocument()
    expect(screen.getByText('Investor Relations')).toBeInTheDocument()
    const expectedDate = FIXED_DATE.toLocaleDateString('en-US')
    expect(screen.getByText(`Generated: ${expectedDate}`)).toBeInTheDocument()
  })

  it('renders one page', () => {
    render(<CoverPage title="T" fiscalYear={2024} companyName="Acme" language="ja" />)
    expect(screen.getAllByTestId('pdf-page')).toHaveLength(1)
  })

  it('degrades safely for empty title/company and a zero fiscalYear (boundary)', () => {
    const { container } = render(<CoverPage title="" fiscalYear={0} companyName="" language="ja" />)
    expect(container).toBeTruthy()
    expect(screen.getByText('0年度')).toBeInTheDocument()
  })

  it('handles a large fiscalYear (max boundary)', () => {
    render(<CoverPage title="T" fiscalYear={9999} companyName="Acme" language="ja" />)
    expect(screen.getByText('9999年度')).toBeInTheDocument()
  })
})

describe('TOCPage', () => {
  it('renders the Japanese title, header company name and IR Report label', () => {
    render(<TOCPage sections={[makeSection()]} companyName="Acme" language="ja" />)

    expect(screen.getByText('目次')).toBeInTheDocument()
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0)
    expect(screen.getByText('IR Report')).toBeInTheDocument()
  })

  it('renders the English title', () => {
    render(<TOCPage sections={[]} companyName="Acme" language="en" />)
    expect(screen.getByText('Table of Contents')).toBeInTheDocument()
  })

  it('numbers sections starting at 1 and page numbers starting at 2', () => {
    const sections = [
      makeSection({ id: 's1', title: 'Overview', sortOrder: 0 }),
      makeSection({ id: 's2', title: 'Risks', sortOrder: 1 }),
      makeSection({ id: 's3', title: 'Outlook', sortOrder: 2 }),
    ]
    render(<TOCPage sections={sections} companyName="Acme" language="en" />)

    expect(screen.getByText('1. Overview')).toBeInTheDocument()
    expect(screen.getByText('2. Risks')).toBeInTheDocument()
    expect(screen.getByText('3. Outlook')).toBeInTheDocument()
    // page number = index + 2
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders only the title when sections is empty (fail-safe)', () => {
    render(<TOCPage sections={[]} companyName="Acme" language="ja" />)
    expect(screen.getByText('目次')).toBeInTheDocument()
    expect(screen.queryByText(/^[0-9]+\./)).not.toBeInTheDocument()
  })
})

describe('SectionPage', () => {
  it('renders the section title, content and header branding', () => {
    const section = makeSection({ title: 'Risk Factors', content: '主要なリスク...' })
    render(<SectionPage section={section} language="ja" companyName="Acme" />)

    expect(screen.getByText('Risk Factors')).toBeInTheDocument()
    expect(screen.getByText('主要なリスク...')).toBeInTheDocument()
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0)
    expect(screen.getByText('IR Report')).toBeInTheDocument()
  })

  it('renders identically regardless of the language prop (unused parameter)', () => {
    const section = makeSection({ title: 'Outlook', content: 'future' })
    const { rerender } = render(<SectionPage section={section} language="ja" companyName="Acme" />)
    expect(screen.getByText('Outlook')).toBeInTheDocument()
    rerender(<SectionPage section={section} language="en" companyName="Acme" />)
    expect(screen.getByText('Outlook')).toBeInTheDocument()
  })

  it('renders the title even when content is empty (fail-safe)', () => {
    const section = makeSection({ title: 'Empty', content: '' })
    const { container } = render(<SectionPage section={section} language="ja" companyName="Acme" />)
    expect(container).toBeTruthy()
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })
})

describe('IRReportDocument', () => {
  it('renders cover + section pages by default and omits the TOC', () => {
    render(<IRReportDocument report={makeReport()} options={{ language: 'ja' }} />)

    expect(screen.getByText('投資家向け資料')).toBeInTheDocument()
    expect(screen.getByText('事業概要')).toBeInTheDocument()
    expect(screen.queryByText('目次')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('pdf-page')).toHaveLength(2)
  })

  it('omits the cover page when includeCoverPage is false', () => {
    render(
      <IRReportDocument
        report={makeReport()}
        options={{ language: 'ja', includeCoverPage: false }}
      />
    )
    expect(screen.queryByText('投資家向け資料')).not.toBeInTheDocument()
    expect(screen.getByText('事業概要')).toBeInTheDocument()
    expect(screen.getAllByTestId('pdf-page')).toHaveLength(1)
  })

  it('includes a TOC page when includeTOC is true and sections exist', () => {
    render(
      <IRReportDocument
        report={makeReport({ sections: [makeSection({ id: 's1', title: 'Overview' })] })}
        options={{ language: 'ja', includeTOC: true }}
      />
    )
    expect(screen.getByText('目次')).toBeInTheDocument()
    expect(screen.getByText('1. Overview')).toBeInTheDocument()
    expect(screen.getAllByTestId('pdf-page')).toHaveLength(3)
  })

  it('omits the TOC when includeTOC is true but sections is empty (fail-safe guard)', () => {
    render(
      <IRReportDocument
        report={makeReport({ sections: [] })}
        options={{ language: 'ja', includeTOC: true }}
      />
    )
    expect(screen.queryByText('目次')).not.toBeInTheDocument()
  })

  it('falls back to the default company name "Company" when none is provided', () => {
    render(<IRReportDocument report={makeReport()} options={{ language: 'ja' }} />)
    expect(screen.getAllByText('Company').length).toBeGreaterThan(0)
  })

  it('respects a custom company name and language', () => {
    render(
      <IRReportDocument report={makeReport()} options={{ language: 'en', companyName: 'Globex' }} />
    )
    expect(screen.getAllByText('Globex').length).toBeGreaterThan(0)
    expect(screen.getByText('Investor Relations')).toBeInTheDocument()
  })

  it('renders one section page per section', () => {
    render(
      <IRReportDocument
        report={makeReport({
          sections: [
            makeSection({ id: 'a', title: 'Alpha', content: 'a-content' }),
            makeSection({ id: 'b', title: 'Beta', content: 'b-content' }),
          ],
        })}
        options={{ language: 'ja', includeCoverPage: false }}
      />
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('a-content')).toBeInTheDocument()
    expect(screen.getByText('b-content')).toBeInTheDocument()
  })

  it('does not crash when report.sections is undefined (nullish-coalescing guard)', () => {
    const report = makeReport()
    delete (report as Partial<IRReport>).sections
    const { container } = render(
      <IRReportDocument report={report} options={{ language: 'ja', includeCoverPage: false }} />
    )
    expect(container).toBeTruthy()
    expect(screen.queryByText('目次')).not.toBeInTheDocument()
  })
})

describe('FinancialHighlightsSection', () => {
  const highlights: FinancialHighlightData[] = [
    { label: 'Revenue', value: 1234567890, unit: '円', change: 5.3, changeDirection: 'up' },
    { label: 'Profit', value: 50000000, unit: '円', change: -2.7, changeDirection: 'down' },
    { label: 'EPS', value: 50, unit: '円' },
  ]

  it('renders the Japanese title', () => {
    render(<FinancialHighlightsSection highlights={highlights} language="ja" companyName="Acme" />)
    expect(screen.getByText('財務ハイライト')).toBeInTheDocument()
  })

  it('renders the English title', () => {
    render(<FinancialHighlightsSection highlights={[]} language="en" companyName="Acme" />)
    expect(screen.getByText('Financial Highlights')).toBeInTheDocument()
  })

  it('renders each label, locale-formatted value and unit', () => {
    render(<FinancialHighlightsSection highlights={highlights} language="ja" companyName="Acme" />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Profit')).toBeInTheDocument()
    expect(screen.getByText('EPS')).toBeInTheDocument()
    expect(screen.getByText('1,234,567,890円')).toBeInTheDocument()
    expect(screen.getByText('50,000,000円')).toBeInTheDocument()
    expect(screen.getByText('50円')).toBeInTheDocument()
  })

  it('formats values with en-US grouping', () => {
    render(
      <FinancialHighlightsSection
        highlights={[{ label: 'Revenue', value: 1000000, unit: '$' }]}
        language="en"
        companyName="Acme"
      />
    )
    expect(screen.getByText('1,000,000$')).toBeInTheDocument()
  })

  it('prefixes positive change with + and renders negative with a minus sign', () => {
    render(<FinancialHighlightsSection highlights={highlights} language="ja" companyName="Acme" />)
    expect(screen.getByText('+5.3%')).toBeInTheDocument()
    expect(screen.getByText('-2.7%')).toBeInTheDocument()
  })

  it('omits the change line when change is undefined (fail-safe)', () => {
    render(
      <FinancialHighlightsSection
        highlights={[{ label: 'EPS', value: 50, unit: '円' }]}
        language="ja"
        companyName="Acme"
      />
    )
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('renders zero change without a plus prefix (boundary: change > 0 is false)', () => {
    render(
      <FinancialHighlightsSection
        highlights={[
          { label: 'Flat', value: 10, unit: '円', change: 0, changeDirection: 'neutral' },
        ]}
        language="ja"
        companyName="Acme"
      />
    )
    expect(screen.getByText('0.0%')).toBeInTheDocument()
    expect(screen.queryByText('+0.0%')).not.toBeInTheDocument()
  })

  it('colors the change by changeDirection: green up, red down, grey neutral/undefined', () => {
    render(
      <FinancialHighlightsSection
        highlights={[
          { label: 'A', value: 1, unit: '', change: 1.1, changeDirection: 'up' },
          { label: 'B', value: 1, unit: '', change: 2.2, changeDirection: 'down' },
          { label: 'C', value: 1, unit: '', change: 3.3, changeDirection: 'neutral' },
          { label: 'D', value: 1, unit: '', change: 4.4 },
        ]}
        language="ja"
        companyName="Acme"
      />
    )
    expectInlineColor(screen.getByText('+1.1%'), '#34a853', 'rgb(52, 168, 83)')
    expectInlineColor(screen.getByText('+2.2%'), '#ea4335', 'rgb(234, 67, 53)')
    expectInlineColor(screen.getByText('+3.3%'), '#666666', 'rgb(102, 102, 102)')
    expectInlineColor(screen.getByText('+4.4%'), '#666666', 'rgb(102, 102, 102)')
  })
})

describe('TableSection', () => {
  const headers = ['項目', '金額', '比率']
  const rows: TableRowData[] = [
    { 項目: '売上', 金額: 1000, 比率: '50%' },
    { 項目: '費用', 金額: 500, 比率: 25 },
  ]

  it('renders the title and header cells', () => {
    render(
      <TableSection
        title="サマリー"
        headers={headers}
        rows={rows}
        language="ja"
        companyName="Acme"
      />
    )
    expect(screen.getByText('サマリー')).toBeInTheDocument()
    expect(screen.getByText('項目')).toBeInTheDocument()
    expect(screen.getByText('金額')).toBeInTheDocument()
    expect(screen.getByText('比率')).toBeInTheDocument()
  })

  it('stringifies cell values including numeric ones', () => {
    render(
      <TableSection title="T" headers={headers} rows={rows} language="ja" companyName="Acme" />
    )
    expect(screen.getByText('売上')).toBeInTheDocument()
    expect(screen.getByText('1000')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('renders headers only when rows is empty (fail-safe)', () => {
    render(<TableSection title="T" headers={headers} rows={[]} language="ja" companyName="Acme" />)
    expect(screen.getByText('項目')).toBeInTheDocument()
    expect(screen.queryByText('売上')).not.toBeInTheDocument()
  })

  it('renders no cells when headers is empty, even with rows present', () => {
    const { container } = render(
      <TableSection title="T" headers={[]} rows={rows} language="ja" companyName="Acme" />
    )
    expect(container).toBeTruthy()
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.queryByText('売上')).not.toBeInTheDocument()
  })

  it('renders the header branding with the provided company name', () => {
    render(
      <TableSection title="T" headers={headers} rows={[]} language="ja" companyName="Globex" />
    )
    expect(screen.getAllByText('Globex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('IR Report').length).toBeGreaterThan(0)
  })
})

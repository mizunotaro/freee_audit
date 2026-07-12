import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IRReportList } from '@/components/reports/ir/ir-report-list'
import { IRSectionEditor } from '@/components/reports/ir/ir-section-editor'
import type { IRReport, IRReportSection } from '@/types/reports/ir-report'

const mockOnView = vi.fn()
const mockOnEdit = vi.fn()
const mockOnDuplicate = vi.fn()
const mockOnPublish = vi.fn()
const mockOnDelete = vi.fn()

const mockReport: IRReport = {
  id: 'report-1',
  companyId: 'company-123',
  title: { ja: '2024年度 IRレポート', en: '2024 IR Report' },
  fiscalYear: '2024',
  status: 'draft',
  language: 'ja',
  sections: [],
  financialHighlights: [],
  shareholderComposition: [],
  events: [],
  faqs: [],
  metadata: {
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    createdBy: 'user-1',
    lastModifiedBy: 'user-1',
    version: 1,
  },
}

const defaultProps = {
  reports: [mockReport],
  isLoading: false,
  onView: mockOnView,
  onEdit: mockOnEdit,
  onDuplicate: mockOnDuplicate,
  onPublish: mockOnPublish,
  onDelete: mockOnDelete,
}

describe('IRReportList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render report list with reports', () => {
    render(<IRReportList {...defaultProps} />)

    expect(screen.getByText('2024年度 IRレポート')).toBeInTheDocument()
  })

  it('should show empty state when no reports', () => {
    render(<IRReportList {...defaultProps} reports={[]} />)

    expect(screen.getByText('レポートがありません')).toBeInTheDocument()
  })

  it('should display report count', () => {
    render(<IRReportList {...defaultProps} />)

    expect(screen.getByText(/1件のレポート/)).toBeInTheDocument()
  })

  it('should show loading state when isLoading is true', () => {
    render(<IRReportList {...defaultProps} isLoading={true} />)

    expect(screen.getByText(/読み込み中/)).toBeInTheDocument()
  })
})

describe('IRSectionEditor — accessibility', () => {
  function makeSection(overrides: Partial<IRReportSection> = {}): IRReportSection {
    return {
      id: 'sec-1',
      type: 'risk_factors',
      order: 0,
      title: { ja: 'セクションタイトル', en: 'Section Title' },
      content: { ja: '初期内容', en: 'initial' },
      ...overrides,
    }
  }

  it('renders the section title and the localized type label', () => {
    render(
      <IRSectionEditor section={makeSection()} language="ja" onUpdate={vi.fn()} reportId="r1" />
    )

    expect(screen.getByText('セクションタイトル')).toBeInTheDocument()
    expect(screen.getByText('リスク要因')).toBeInTheDocument()
  })

  it('surfaces AI generation errors in a role=alert region', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    render(
      <IRSectionEditor section={makeSection()} language="ja" onUpdate={vi.fn()} reportId="r1" />
    )

    fireEvent.click(screen.getByRole('button', { name: /AI生成/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('AI generation failed')
    })

    fetchMock.mockRestore()
  })

  it('announces AI generation progress via role=status while pending', async () => {
    let resolveFetch!: (value: Response) => void
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((res) => {
        resolveFetch = res
      })
    )

    render(
      <IRSectionEditor section={makeSection()} language="ja" onUpdate={vi.fn()} reportId="r1" />
    )

    fireEvent.click(screen.getByRole('button', { name: /AI生成/ }))

    await waitFor(() => {
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-busy', 'true')
    })

    resolveFetch({
      ok: true,
      json: async () => ({ success: true, content: { ja: '生成済', en: 'generated' } }),
    } as Response)
    fetchMock.mockRestore()
  })
})

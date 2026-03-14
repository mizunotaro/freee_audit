import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IRReportList } from '@/components/reports/ir/ir-report-list'
import type { IRReport } from '@/types/reports/ir-report'

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

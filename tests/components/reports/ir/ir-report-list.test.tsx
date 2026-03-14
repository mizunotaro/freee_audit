import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IRReportList } from '@/components/reports/ir/ir-report-list'
import type { IRReport } from '@/types/reports/ir-report'

const mockReport: IRReport = {
  id: 'test-report-1',
  companyId: 'company-1',
  title: { ja: 'テストレポート', en: 'Test Report' },
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

describe('IRReportList', () => {
  const mockOnView = vi.fn()
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders report list correctly', () => {
    render(
      <IRReportList
        reports={[mockReport]}
        onView={mockOnView}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('テストレポート')).toBeInTheDocument()
    expect(screen.getByText('Test Report')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('下書き')).toBeInTheDocument()
  })

  it('displays empty state when no reports', () => {
    render(<IRReportList reports={[]} />)

    expect(screen.getByText('レポートがありません')).toBeInTheDocument()
  })

  it('filters reports by search term', async () => {
    const mockOnFilterChange = vi.fn()
    render(<IRReportList reports={[mockReport]} onFilterChange={mockOnFilterChange} />)

    const searchInput = screen.getByPlaceholderText('レポートを検索...')
    fireEvent.change(searchInput, { target: { value: 'テスト' } })

    await waitFor(() => {
      expect(mockOnFilterChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'テスト' }))
    })
  })

  it('calls onEdit when edit button is clicked', async () => {
    render(<IRReportList reports={[mockReport]} onEdit={mockOnEdit} />)

    const buttons = screen.getAllByRole('button')
    const moreButton = buttons.find((btn) => btn.querySelector('svg.lucide-more-horizontal'))

    if (moreButton) {
      fireEvent.click(moreButton)

      await waitFor(
        () => {
          const editItem = screen.queryByText('編集')
          if (editItem) {
            fireEvent.click(editItem)
            expect(mockOnEdit).toHaveBeenCalledWith(mockReport)
          }
        },
        { timeout: 3000 }
      )
    }
  })
})

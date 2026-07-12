import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IRReportEditor } from '@/components/reports/ir/ir-report-editor'
import type { IRReport, IRReportSection, Language, ReportStatus } from '@/types/reports/ir-report'

// IRReportEditor mounts Radix <ScrollArea/> (ja/en tabs) which instantiates a
// ResizeObserver at mount; tests/setup.ts only polyfills IntersectionObserver.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }))
  )
})

// Leaf collaborators are unit-tested in their own files; stub them here so the
// editor's own wiring (handlers, state, autosave, status rendering) is isolated
// and the onUpdate/onChange callbacks can be driven deterministically.
vi.mock('@/components/reports/ir/language-toggle', () => ({
  LanguageToggle: ({
    value,
    onChange,
    disabled,
  }: {
    value: Language
    onChange: (language: Language) => void
    disabled?: boolean
  }) => (
    <div
      data-testid="language-toggle"
      data-value={value}
      data-disabled={disabled ? 'true' : undefined}
    >
      <button type="button" data-testid="lt-en" onClick={() => onChange('en')} disabled={disabled}>
        EN
      </button>
    </div>
  ),
}))

vi.mock('@/components/reports/ir/ir-section-editor', () => ({
  IRSectionEditor: ({
    section,
    language,
    onUpdate,
    readOnly,
    reportId,
  }: {
    section: IRReportSection
    language: 'ja' | 'en'
    onUpdate: (updates: Partial<IRReportSection>) => void
    readOnly?: boolean
    reportId: string
  }) => (
    <div
      data-testid="ir-section-editor"
      data-section-id={section.id}
      data-language={language}
      data-readonly={readOnly ? 'true' : undefined}
      data-report-id={reportId}
    >
      <button
        type="button"
        data-testid={`update-${section.id}`}
        onClick={() =>
          onUpdate({ content: { ja: 'edited-ja', en: 'edited-en' }, title: section.title })
        }
      >
        edit {section.id}
      </button>
    </div>
  ),
}))

vi.mock('@/components/reports/ir/ir-preview', () => ({
  IRPreview: ({ report, language }: { report: IRReport; language: Language }) => (
    <div data-testid="ir-preview" data-report-id={report.id} data-language={language}>
      preview
    </div>
  ),
}))

function makeReport(overrides: Partial<IRReport> = {}): IRReport {
  return {
    id: 'report-1',
    companyId: 'company-1',
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
    ...overrides,
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('IRReportEditor', () => {
  describe('rendering', () => {
    it('renders the report title, fiscal year and status badge', () => {
      render(<IRReportEditor report={makeReport()} />)

      expect(screen.getByRole('heading', { name: '2024年度 IRレポート' })).toBeInTheDocument()
      expect(screen.getByText('2024')).toBeInTheDocument()
      expect(screen.getByText('下書き')).toBeInTheDocument()
    })

    it('renders a back button when onBack is provided and omits it otherwise', () => {
      const onBack = vi.fn()
      const { container, rerender } = render(
        <IRReportEditor report={makeReport()} onBack={onBack} />
      )

      const backButton = container.querySelector('svg.lucide-arrow-left')?.closest('button')
      expect(backButton).toBeInTheDocument()
      fireEvent.click(backButton as HTMLElement)
      expect(onBack).toHaveBeenCalledTimes(1)

      rerender(<IRReportEditor report={makeReport()} />)
      expect(container.querySelector('svg.lucide-arrow-left')).toBeNull()
    })

    it('exposes the three language tabs', () => {
      render(<IRReportEditor report={makeReport()} />)

      expect(screen.getByRole('tab', { name: '日本語' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'English' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'プレビュー' })).toBeInTheDocument()
    })
  })

  describe('status badge — STATUS_CONFIG coverage', () => {
    it.each<[ReportStatus, string]>([
      ['draft', '下書き'],
      ['in_review', 'レビュー中'],
      ['approved', '承認済み'],
      ['published', '公開済み'],
      ['archived', 'アーカイブ'],
    ])('renders label "%s" for status %s', (status, label) => {
      render(<IRReportEditor report={makeReport({ status })} />)

      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('sections', () => {
    it('falls back to the default section set when report.sections is empty', () => {
      render(<IRReportEditor report={makeReport()} />)

      const editors = screen.getAllByTestId('ir-section-editor')
      expect(editors).toHaveLength(10)
      expect(screen.getByTestId('update-section_0')).toBeInTheDocument()
    })

    it('renders the provided sections and no default sections', () => {
      const section: IRReportSection = {
        id: 'sec-1',
        type: 'company_overview',
        order: 0,
        title: { ja: 'カスタムセクション', en: 'Custom Section' },
        content: { ja: 'ja-body', en: 'en-body' },
      }

      render(<IRReportEditor report={makeReport({ sections: [section] })} />)

      const editors = screen.getAllByTestId('ir-section-editor')
      expect(editors).toHaveLength(1)
      expect(editors[0]).toHaveAttribute('data-section-id', 'sec-1')
      expect(screen.queryByTestId('update-section_0')).not.toBeInTheDocument()
    })

    it('forwards language, reportId and readOnly to each section editor', () => {
      render(<IRReportEditor report={makeReport()} readOnly />)

      const editor = screen.getAllByTestId('ir-section-editor')[0]
      expect(editor).toHaveAttribute('data-language', 'ja')
      expect(editor).toHaveAttribute('data-report-id', 'report-1')
      expect(editor).toHaveAttribute('data-readonly', 'true')
    })
  })

  describe('language toggle', () => {
    it('reflects report.language and forwards onChange to onLanguageChange', async () => {
      const onLanguageChange = vi.fn()
      render(
        <IRReportEditor
          report={makeReport({ language: 'ja' })}
          onLanguageChange={onLanguageChange}
        />
      )

      expect(screen.getByTestId('language-toggle')).toHaveAttribute('data-value', 'ja')

      await userEvent.click(screen.getByTestId('lt-en'))

      expect(onLanguageChange).toHaveBeenCalledWith('en')
    })

    it('disables the language toggle when readOnly', () => {
      render(<IRReportEditor report={makeReport()} readOnly />)

      expect(screen.getByTestId('language-toggle')).toHaveAttribute('data-disabled', 'true')
    })
  })

  describe('save', () => {
    it('calls onSave with the current report and records the last-saved time', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      render(<IRReportEditor report={makeReport()} onSave={onSave} />)

      await userEvent.click(screen.getByRole('button', { name: '保存' }))

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'report-1' }))
      expect(screen.getByText(/最終保存/)).toBeInTheDocument()
    })

    it('shows 保存中... and locks the button while onSave is pending', async () => {
      const { promise, resolve } = deferred()
      const onSave = vi.fn(() => promise)
      render(<IRReportEditor report={makeReport()} onSave={onSave} />)

      await userEvent.click(screen.getByRole('button', { name: '保存' }))

      await waitFor(() => expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled())

      resolve()

      await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())
    })

    it('logs and recovers when onSave rejects (fail-safe)', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('boom'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<IRReportEditor report={makeReport()} onSave={onSave} />)

      await userEvent.click(screen.getByRole('button', { name: '保存' }))

      await waitFor(() => expect(spy).toHaveBeenCalledWith('Save failed:', expect.any(Error)))
      await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())

      spy.mockRestore()
    })
  })

  describe('publish', () => {
    it('shows the publish action only when status is approved and not readOnly', () => {
      // The editor snapshots `report` into useState on mount, so each scenario
      // is exercised with a fresh mount rather than a re-render.
      let view = render(<IRReportEditor report={makeReport({ status: 'approved' })} />)
      expect(screen.getByRole('button', { name: '公開' })).toBeInTheDocument()
      view.unmount()

      view = render(<IRReportEditor report={makeReport({ status: 'draft' })} />)
      expect(screen.queryByRole('button', { name: '公開' })).not.toBeInTheDocument()
      view.unmount()

      render(<IRReportEditor report={makeReport({ status: 'approved' })} readOnly />)
      expect(screen.queryByRole('button', { name: '公開' })).not.toBeInTheDocument()
    })

    it('calls onPublish with the current report', async () => {
      const onPublish = vi.fn().mockResolvedValue(undefined)
      render(<IRReportEditor report={makeReport({ status: 'approved' })} onPublish={onPublish} />)

      await userEvent.click(screen.getByRole('button', { name: '公開' }))

      await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
      expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ id: 'report-1' }))
    })

    it('logs and recovers when onPublish rejects (fail-safe)', async () => {
      const onPublish = vi.fn().mockRejectedValue(new Error('publish failed'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<IRReportEditor report={makeReport({ status: 'approved' })} onPublish={onPublish} />)

      await userEvent.click(screen.getByRole('button', { name: '公開' }))

      await waitFor(() => expect(spy).toHaveBeenCalledWith('Publish failed:', expect.any(Error)))

      spy.mockRestore()
    })
  })

  describe('section update', () => {
    it('marks the report as having unsaved changes', () => {
      render(<IRReportEditor report={makeReport()} />)

      expect(screen.queryByText(/未保存/)).not.toBeInTheDocument()

      fireEvent.click(screen.getByTestId('update-section_0'))

      expect(screen.getByText(/未保存/)).toBeInTheDocument()
    })
  })

  describe('preview', () => {
    it('switches to the preview tab via the header button and renders IRPreview', async () => {
      render(<IRReportEditor report={makeReport()} />)

      expect(screen.queryByTestId('ir-preview')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'プレビュー' }))

      const preview = screen.getByTestId('ir-preview')
      expect(preview).toBeInTheDocument()
      expect(preview).toHaveAttribute('data-report-id', 'report-1')
    })

    it('passes language "ja" to the preview when report.language is bilingual', async () => {
      render(<IRReportEditor report={makeReport({ language: 'bilingual' })} />)

      await userEvent.click(screen.getByRole('button', { name: 'プレビュー' }))

      expect(screen.getByTestId('ir-preview')).toHaveAttribute('data-language', 'ja')
    })
  })

  describe('read-only mode', () => {
    it('hides the save / preview / publish header actions but keeps sections', () => {
      render(<IRReportEditor report={makeReport({ status: 'approved' })} readOnly />)

      expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'プレビュー' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '公開' })).not.toBeInTheDocument()
      expect(screen.getAllByTestId('ir-section-editor')).toHaveLength(10)
    })
  })

  describe('autosave', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('clears the pending autosave timer on unmount so onSave is never called', () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const { unmount } = render(<IRReportEditor report={makeReport()} onSave={onSave} />)

      fireEvent.click(screen.getByTestId('update-section_0'))
      unmount()

      vi.advanceTimersByTime(10_000)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('fires onSave once after the 3000ms debounce following successive edits', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      render(<IRReportEditor report={makeReport()} onSave={onSave} />)

      fireEvent.click(screen.getByTestId('update-section_0'))
      fireEvent.click(screen.getByTestId('update-section_0'))

      expect(onSave).not.toHaveBeenCalled()
      vi.advanceTimersByTime(2999)
      expect(onSave).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'report-1' }))
    })
  })
})

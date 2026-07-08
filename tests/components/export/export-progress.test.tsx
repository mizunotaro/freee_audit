import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExportProgress, ExportProgressOverlay } from '@/components/export/export-progress'
import type { ExportProgress as ExportProgressType } from '@/services/export'

function makeProgress(overrides: Partial<ExportProgressType> = {}): ExportProgressType {
  return {
    id: 'export-1',
    status: 'processing',
    progress: 42.4,
    message: '',
    ...overrides,
  }
}

describe('ExportProgress', () => {
  it('rounds the percentage for display', () => {
    render(<ExportProgress progress={makeProgress({ progress: 42.4 })} />)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('falls back to the localized status text when no message is supplied', () => {
    render(<ExportProgress progress={makeProgress({ status: 'processing', message: '' })} />)
    expect(screen.getByText('処理中...')).toBeInTheDocument()
  })

  it('prefers the supplied message over the default status text', () => {
    render(
      <ExportProgress progress={makeProgress({ status: 'processing', message: 'PDFを生成中' })} />
    )
    expect(screen.getByText('PDFを生成中')).toBeInTheDocument()
    expect(screen.queryByText('処理中...')).not.toBeInTheDocument()
  })

  it('renders the localized text for each status', () => {
    const { rerender } = render(<ExportProgress progress={makeProgress({ status: 'pending' })} />)
    expect(screen.getByText('待機中...')).toBeInTheDocument()

    rerender(<ExportProgress progress={makeProgress({ status: 'completed' })} />)
    expect(screen.getByText('完了')).toBeInTheDocument()

    rerender(<ExportProgress progress={makeProgress({ status: 'failed' })} />)
    expect(screen.getByText('エラー')).toBeInTheDocument()
  })

  it('shows the error message only when the status is failed', () => {
    const { rerender } = render(
      <ExportProgress progress={makeProgress({ status: 'processing', error: 'oops' })} />
    )
    expect(screen.queryByText('oops')).not.toBeInTheDocument()

    rerender(<ExportProgress progress={makeProgress({ status: 'failed', error: 'oops' })} />)
    expect(screen.getByText('oops')).toBeInTheDocument()
  })

  it('renders the result block when completed with a result', () => {
    render(
      <ExportProgress
        progress={makeProgress({
          status: 'completed',
          result: {
            downloadUrl: '/files/x.pdf',
            filename: 'x.pdf',
            expiresAt: new Date('2026-01-01T00:00:00Z'),
            fileSize: 2048,
            mimeType: 'application/pdf',
          },
        })}
      />
    )
    expect(screen.getByText('ダウンロード準備完了')).toBeInTheDocument()
    // 2048 bytes -> 2.0 KB
    expect(screen.getByText('ファイルサイズ: 2.0 KB')).toBeInTheDocument()
  })

  it('does not render the result block while still processing', () => {
    render(
      <ExportProgress
        progress={makeProgress({
          status: 'processing',
          result: {
            downloadUrl: '/files/x.pdf',
            filename: 'x.pdf',
            expiresAt: new Date('2026-01-01T00:00:00Z'),
            fileSize: 2048,
            mimeType: 'application/pdf',
          },
        })}
      />
    )
    expect(screen.queryByText('ダウンロード準備完了')).not.toBeInTheDocument()
  })
})

describe('ExportProgressOverlay', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <ExportProgressOverlay isVisible={false} progress={makeProgress()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows a download link on completed status and invokes onClose on close', () => {
    const onClose = vi.fn()
    render(
      <ExportProgressOverlay
        isVisible
        onClose={onClose}
        progress={makeProgress({
          status: 'completed',
          result: {
            downloadUrl: '/files/report.pdf',
            filename: 'report.pdf',
            expiresAt: new Date('2026-01-01T00:00:00Z'),
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
        })}
      />
    )
    const link = screen.getByText('ダウンロード').closest('a')
    expect(link).toHaveAttribute('href', '/files/report.pdf')
  })

  it('shows a close button (not a download link) on failed status', () => {
    render(
      <ExportProgressOverlay
        isVisible
        onClose={vi.fn()}
        progress={makeProgress({ status: 'failed', error: 'timeout' })}
      />
    )
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument()
    expect(screen.queryByText('ダウンロード')).not.toBeInTheDocument()
  })
})

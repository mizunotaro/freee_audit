import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExportModal } from '@/components/export/export-modal'
import type { ExportFormat, ExportOptions } from '@/services/export'

function renderModal(
  open = true,
  onExport = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn()
) {
  render(<ExportModal isOpen={open} onClose={onClose} onExport={onExport} />)
  return { onExport, onClose }
}

describe('ExportModal', () => {
  const onClose = vi.fn()
  const onExport = vi.fn()

  beforeEach(() => {
    onClose.mockReset()
    onExport.mockReset()
    onExport.mockResolvedValue(undefined)
  })

  it('renders nothing when closed', () => {
    renderModal(false)
    expect(screen.queryByText('エクスポート設定')).not.toBeInTheDocument()
  })

  it('renders the title and all four format options when open', () => {
    renderModal(true, onExport, onClose)
    expect(screen.getByText('エクスポート設定')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PowerPoint' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
  })

  it('shows paper-size, orientation and chart options only for PDF', () => {
    renderModal(true, onExport, onClose)
    // PDF is the default format → options visible
    expect(screen.getByText('用紙サイズ')).toBeInTheDocument()
    expect(screen.getByText('向き')).toBeInTheDocument()
    expect(screen.getByLabelText('グラフを含める')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))

    expect(screen.queryByText('用紙サイズ')).not.toBeInTheDocument()
    expect(screen.queryByText('向き')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('グラフを含める')).not.toBeInTheDocument()
  })

  it('shows the exchange-rate input only when currency is dual', () => {
    renderModal(true, onExport, onClose)
    expect(screen.queryByText('為替レート (USD/JPY)')).not.toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('日本円 (JPY)'), { target: { value: 'dual' } })

    expect(screen.getByText('為替レート (USD/JPY)')).toBeInTheDocument()
  })

  it('invokes onExport with the selected format and current options, then closes', async () => {
    renderModal(true, onExport, onClose)

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }))
    fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }))

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledTimes(1)
    })

    const [format, options] = onExport.mock.calls[0]
    expect(format).toBe<ExportFormat>('excel')
    expect(options).toMatchObject<Partial<ExportOptions>>({
      format: 'excel',
      language: 'ja',
      currency: 'JPY',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the cancel button is clicked without exporting', () => {
    renderModal(true, onExport, onClose)

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onExport).not.toHaveBeenCalled()
  })

  it('re-enables the export button and keeps the modal open when onExport rejects', async () => {
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    onExport.mockRejectedValue(new Error('boom'))
    try {
      renderModal(true, onExport, onClose)

      fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'エクスポート' })).toBeEnabled()
      })
      // Modal stays open because onClose is only called on success.
      expect(onClose).not.toHaveBeenCalled()
      await new Promise((resolve) => setImmediate(resolve))
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })
})

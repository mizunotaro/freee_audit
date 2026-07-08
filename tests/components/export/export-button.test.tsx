import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExportButton } from '@/components/export/export-button'
import type { ExportFormat } from '@/services/export'

describe('ExportButton', () => {
  const onExport = vi.fn()

  beforeEach(() => {
    onExport.mockReset()
  })

  it('renders the default label', () => {
    render(<ExportButton onExport={onExport} />)
    expect(screen.getByRole('button', { name: 'エクスポート' })).toBeInTheDocument()
  })

  it('calls onExport with pdf when clicked', async () => {
    onExport.mockResolvedValue(undefined)
    render(<ExportButton onExport={onExport} />)

    fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }))

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledTimes(1)
    })
    expect(onExport).toHaveBeenCalledWith('pdf' as ExportFormat)
  })

  it('shows the loading label and re-enables after completion', async () => {
    let resolveExport: () => void
    onExport.mockImplementation(() => new Promise<void>((resolve) => (resolveExport = resolve)))
    render(<ExportButton onExport={onExport} />)

    const button = screen.getByRole('button', { name: 'エクスポート' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'エクスポート中...' })).toBeDisabled()
    })

    resolveExport!()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'エクスポート' })).toBeEnabled()
    })
  })

  it('re-enables the button even when onExport rejects', async () => {
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    onExport.mockRejectedValue(new Error('boom'))
    try {
      render(<ExportButton onExport={onExport} />)

      fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'エクスポート' })).toBeEnabled()
      })
      expect(onExport).toHaveBeenCalledTimes(1)
      await new Promise((resolve) => setImmediate(resolve))
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })

  it('is disabled when the disabled prop is true', () => {
    render(<ExportButton onExport={onExport} disabled />)
    expect(screen.getByRole('button', { name: 'エクスポート' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }))
    expect(onExport).not.toHaveBeenCalled()
  })

  it('does not call onExport while a previous export is still in flight', async () => {
    let resolveExport: () => void
    onExport.mockImplementation(() => new Promise<void>((resolve) => (resolveExport = resolve)))
    render(<ExportButton onExport={onExport} />)

    const button = screen.getByRole('button', { name: 'エクスポート' })
    fireEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())

    // Disabled buttons do not emit click events that reach handlers.
    fireEvent.click(button)

    resolveExport!()
    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1))
  })
})

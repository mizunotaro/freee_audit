import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportButton } from '@/app/[locale]/(authenticated)/analysis/components/export-button'
import { useExport } from '@/app/[locale]/(authenticated)/analysis/hooks/use-export'

vi.mock('@/app/[locale]/(authenticated)/analysis/hooks/use-export', () => ({
  useExport: vi.fn(),
}))

const mockUseExport = vi.mocked(useExport)

function flushOutsideClick() {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
}

describe('ExportButton', () => {
  beforeEach(() => {
    mockUseExport.mockReturnValue({
      isExporting: false,
      exportError: null,
      exportAnalysis: vi.fn(),
      downloadBlob: vi.fn(),
    })
  })

  it('exposes dropdown semantics on the trigger when idle', () => {
    render(<ExportButton onExport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'エクスポート形式を選択' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'true')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls', 'export-button-popup')
    expect(trigger).toHaveAttribute('aria-busy', 'false')
  })

  it('opens a labelled popup on click', async () => {
    const user = userEvent.setup()
    render(<ExportButton onExport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'エクスポート形式を選択' })

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const popup = screen.getByRole('group', { name: 'エクスポート形式を選択' })
    expect(popup).toHaveAttribute('id', 'export-button-popup')
    expect(screen.getByRole('button', { name: /PDF/ })).toBeInTheDocument()
  })

  it('closes the popup on Escape', async () => {
    const user = userEvent.setup()
    render(<ExportButton onExport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'エクスポート形式を選択' })

    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the popup on outside click', async () => {
    const user = userEvent.setup()
    render(<ExportButton onExport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'エクスポート形式を選択' })

    await user.click(trigger)
    expect(screen.getByRole('group')).toBeInTheDocument()

    flushOutsideClick()
    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument())
  })

  it('calls onExport and closes when a format is chosen', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} />)
    const trigger = screen.getByRole('button', { name: 'エクスポート形式を選択' })

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: /Excel/ }))

    expect(onExport).toHaveBeenCalledWith('excel')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('reflects the exporting state via aria-busy and an accessible name', () => {
    mockUseExport.mockReturnValue({
      isExporting: true,
      exportError: null,
      exportAnalysis: vi.fn(),
      downloadBlob: vi.fn(),
    })
    render(<ExportButton onExport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'エクスポート中' })
    expect(trigger).toHaveAttribute('aria-busy', 'true')
    expect(trigger).toBeDisabled()
  })
})

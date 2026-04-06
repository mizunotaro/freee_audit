import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportButton } from '@/app/(dashboard)/analysis/components/export-button'

vi.mock('@/app/(dashboard)/analysis/hooks/use-export', () => ({
  useExport: () => ({
    isExporting: false,
    exportError: null,
    exportAnalysis: vi.fn(),
    downloadBlob: vi.fn(),
  }),
}))

describe('ExportButton', () => {
  it('should render export button', () => {
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} />)

    expect(screen.getByText('エクスポート')).toBeInTheDocument()
  })

  it('should open dropdown on click', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} />)

    await user.click(screen.getByText('エクスポート'))

    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
  })

  it('should call onExport with selected format', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} />)

    await user.click(screen.getByText('エクスポート'))
    await user.click(screen.getByText('PDF'))

    expect(onExport).toHaveBeenCalledWith('pdf')
  })

  it('should call onExport with excel format', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} />)

    await user.click(screen.getByText('エクスポート'))
    await user.click(screen.getByText('Excel'))

    expect(onExport).toHaveBeenCalledWith('excel')
  })

  it('should call onExport with json format', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} />)

    await user.click(screen.getByText('エクスポート'))
    await user.click(screen.getByText('JSON'))

    expect(onExport).toHaveBeenCalledWith('json')
  })

  it('should be disabled when disabled prop is true', () => {
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} disabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('should close dropdown after selecting format', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} />)

    await user.click(screen.getByText('エクスポート'))
    expect(screen.getByText('PDF')).toBeInTheDocument()

    await user.click(screen.getByText('PDF'))
    expect(screen.queryByText('Excel')).not.toBeInTheDocument()
  })
})

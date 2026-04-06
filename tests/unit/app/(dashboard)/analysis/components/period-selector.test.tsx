import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeriodSelector } from '@/app/(dashboard)/analysis/components/period-selector'
import type { FiscalPeriod } from '@/app/(dashboard)/analysis/hooks/use-analysis'

describe('PeriodSelector', () => {
  const defaultProps = {
    value: { fiscalYear: 2024, month: 12 } as FiscalPeriod,
    onChange: vi.fn(),
    disabled: false,
  }

  it('should render formatted period value', () => {
    render(<PeriodSelector {...defaultProps} />)
    expect(screen.getByText('2024年度 12月期')).toBeInTheDocument()
  })

  it('should render calendar icon button', () => {
    render(<PeriodSelector {...defaultProps} />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('should open dropdown on click', async () => {
    const user = userEvent.setup()
    render(<PeriodSelector {...defaultProps} />)

    const button = screen.getByRole('button')
    await user.click(button)

    expect(screen.getByText('年度')).toBeInTheDocument()
    expect(screen.getByText('月')).toBeInTheDocument()
  })

  it('should call onChange when year is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PeriodSelector {...defaultProps} onChange={onChange} />)

    const button = screen.getByRole('button')
    await user.click(button)

    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
    const targetYear = years[1]

    const yearButtons = screen.getAllByText(String(targetYear))
    await user.click(yearButtons[0])

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fiscalYear: targetYear, month: 12 })
    )
  })

  it('should call onChange and close when month is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PeriodSelector {...defaultProps} onChange={onChange} />)

    const button = screen.getByRole('button')
    await user.click(button)

    await user.click(screen.getByText('3月'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fiscalYear: 2024, month: 3 })
    )
  })

  it('should be disabled when disabled prop is true', () => {
    render(<PeriodSelector {...defaultProps} disabled={true} />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('should not open dropdown when disabled', async () => {
    const user = userEvent.setup()
    render(<PeriodSelector {...defaultProps} disabled={true} />)

    const button = screen.getByRole('button')
    await user.click(button)

    expect(screen.queryByText('年度')).not.toBeInTheDocument()
  })

  it('should highlight selected year', async () => {
    const user = userEvent.setup()
    render(<PeriodSelector {...defaultProps} />)

    const button = screen.getByRole('button')
    await user.click(button)

    const yearButton = screen.getAllByText('2024').find((el) => el.closest('button'))
    expect(yearButton?.closest('button')?.className).toContain('bg-primary')
  })

  it('should highlight selected month', async () => {
    const user = userEvent.setup()
    render(<PeriodSelector {...defaultProps} />)

    const button = screen.getByRole('button')
    await user.click(button)

    const monthButton = screen.getByText('12月')
    expect(monthButton?.closest('button')?.className).toContain('bg-primary')
  })
})

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KPIFilters } from '@/components/reports/kpi/kpi-filters'

describe('KPIFilters', () => {
  const onFiscalYearChange = vi.fn()
  const onMonthChange = vi.fn()

  beforeEach(() => {
    onFiscalYearChange.mockReset()
    onMonthChange.mockReset()
  })

  it('renders the fiscal-year and month selects with the current values', () => {
    render(
      <KPIFilters
        fiscalYear={2024}
        month={6}
        onFiscalYearChange={onFiscalYearChange}
        onMonthChange={onMonthChange}
      />
    )

    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
    expect(selects[0]).toHaveValue('2024')
    expect(selects[1]).toHaveValue('6')
  })

  it('offers fiscal years 2022 through 2026', () => {
    render(
      <KPIFilters
        fiscalYear={2024}
        month={6}
        onFiscalYearChange={onFiscalYearChange}
        onMonthChange={onMonthChange}
      />
    )

    const selects = screen.getAllByRole('combobox')
    const yearOptions = selects[0].querySelectorAll('option')
    expect(Array.from(yearOptions).map((o) => o.textContent)).toEqual([
      '2022年度',
      '2023年度',
      '2024年度',
      '2025年度',
      '2026年度',
    ])
  })

  it('offers all twelve months', () => {
    render(
      <KPIFilters
        fiscalYear={2024}
        month={1}
        onFiscalYearChange={onFiscalYearChange}
        onMonthChange={onMonthChange}
      />
    )

    const monthSelect = screen.getAllByRole('combobox')[1]
    const monthOptions = monthSelect.querySelectorAll('option')
    expect(monthOptions).toHaveLength(12)
    expect(monthOptions[0].textContent).toBe('1月')
    expect(monthOptions[11].textContent).toBe('12月')
  })

  it('emits the parsed integer when the fiscal year changes', () => {
    render(
      <KPIFilters
        fiscalYear={2024}
        month={6}
        onFiscalYearChange={onFiscalYearChange}
        onMonthChange={onMonthChange}
      />
    )

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '2025' } })

    expect(onFiscalYearChange).toHaveBeenCalledWith(2025)
    expect(onFiscalYearChange).toHaveBeenCalledTimes(1)
  })

  it('emits the parsed integer when the month changes', () => {
    render(
      <KPIFilters
        fiscalYear={2024}
        month={6}
        onFiscalYearChange={onFiscalYearChange}
        onMonthChange={onMonthChange}
      />
    )

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '9' } })

    expect(onMonthChange).toHaveBeenCalledWith(9)
    expect(onMonthChange).toHaveBeenCalledTimes(1)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeriodSelector } from '@/app/[locale]/(authenticated)/analysis/components/period-selector'
import type { FiscalPeriod } from '@/app/[locale]/(authenticated)/analysis/hooks/use-analysis'

const period: FiscalPeriod = { fiscalYear: 2024, month: 12 }

describe('PeriodSelector', () => {
  it('exposes dropdown semantics on the trigger when closed', () => {
    render(<PeriodSelector value={period} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /期間を選択/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'true')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls', 'period-selector-popup')
    expect(trigger).toHaveAttribute('aria-label', '期間を選択、現在 2024年度 12月期')
  })

  it('opens a labelled popup on click', async () => {
    const user = userEvent.setup()
    render(<PeriodSelector value={period} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /期間を選択/ })

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const popup = screen.getByRole('group', { name: '期間を選択' })
    expect(popup).toHaveAttribute('id', 'period-selector-popup')
  })

  it('closes the popup on Escape', async () => {
    const user = userEvent.setup()
    render(<PeriodSelector value={period} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /期間を選択/ })

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('is keyboard focusable as a native button', () => {
    render(<PeriodSelector value={period} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /期間を選択/ })
    expect(trigger.tagName).toBe('BUTTON')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WACCInputPanel } from '@/components/valuation/wacc-input-panel'

const detailedDefaults = {
  mode: 'detailed' as const,
  onModeChange: vi.fn(),
  simpleValue: 10,
  onSimpleValueChange: vi.fn(),
  detailedInputs: {
    riskFreeRate: 0.8,
    marketRiskPremium: 6,
    beta: 1,
    costOfDebt: 2.5,
    taxRate: 30,
    debtRatio: 30,
  },
  onDetailedInputsChange: vi.fn(),
  result: null,
  onCalculate: vi.fn(),
  isCalculating: false,
  advice: null,
  isLoadingAdvice: false,
  industry: 'software',
  onIndustryChange: vi.fn(),
}

describe('WACCInputPanel', () => {
  it('renders an accessible loading skeleton when advice is loading', () => {
    const { container } = render(<WACCInputPanel {...detailedDefaults} isLoadingAdvice />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('exposes the industry select under an accessible name', () => {
    render(<WACCInputPanel {...detailedDefaults} />)

    const select = screen.getByLabelText('Industry')
    expect(select).toHaveValue('software')
  })

  it('renders the info tooltip triggers as keyboard-accessible, labelled buttons', () => {
    render(<WACCInputPanel {...detailedDefaults} />)

    const riskFreeInfo = screen.getByRole('button', { name: 'Information: Risk-Free Rate' })
    expect(riskFreeInfo.tagName).toBe('BUTTON')
    expect(riskFreeInfo).toHaveAttribute('aria-label', 'Information: Risk-Free Rate')

    const infoButtons = screen.getAllByRole('button', { name: /Information: / })
    expect(infoButtons.length).toBe(6)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { WACCInputPanel } from '@/components/valuation/wacc-input-panel'
import type { WACCResult, WACCAdviceResponse } from '@/services/valuation'

const detailedInputs = {
  riskFreeRate: 0.8,
  marketRiskPremium: 6,
  beta: 1,
  costOfDebt: 2.5,
  taxRate: 30,
  debtRatio: 30,
}

const advice: WACCAdviceResponse = {
  industry: 'software',
  confidence: 'high',
  advice: [],
  warnings: [],
  recommendedValues: {
    riskFreeRate: 0.008,
    marketRiskPremium: 0.06,
    beta: 1.2,
    costOfDebt: 0.025,
    taxRate: 0.3,
    debtRatio: 0.35,
  },
  riskFreeRate: { suggested: 0.008, range: { min: 0, max: 0 }, rationale: '', dataSource: '' },
  marketRiskPremium: { suggested: 0.06, range: { min: 0, max: 0 }, rationale: '', dataSource: '' },
  beta: {
    suggested: 1.2,
    range: { min: 0, max: 0 },
    rationale: '',
    dataSource: '',
    unleveredBeta: 1,
    suggestedLeveredBeta: 1.2,
    comparableCompanies: [],
  },
  costOfDebt: {
    suggested: 0.025,
    range: { min: 0, max: 0 },
    rationale: '',
    dataSource: '',
    spreadOverRiskFree: 0,
  },
  taxRate: {
    suggested: 0.3,
    range: { min: 0, max: 0 },
    rationale: '',
    dataSource: '',
    statutory: 0.3,
  },
  optimalCapitalStructure: { suggestedDERatio: 0.5, industryAverage: 0.5, rationale: '' },
  lastUpdated: '2026-01-01',
}

type PanelProps = ComponentProps<typeof WACCInputPanel>

function buildProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    mode: 'detailed',
    onModeChange: vi.fn(),
    simpleValue: 10,
    onSimpleValueChange: vi.fn(),
    detailedInputs,
    onDetailedInputsChange: vi.fn(),
    result: null,
    onCalculate: vi.fn(),
    isCalculating: false,
    advice: null,
    isLoadingAdvice: false,
    industry: 'software',
    onIndustryChange: vi.fn(),
    ...overrides,
  }
}

function inputValue(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value
}

describe('WACCInputPanel', () => {
  it('renders an accessible loading skeleton when advice is loading', () => {
    const { container } = render(<WACCInputPanel {...buildProps({ isLoadingAdvice: true })} />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('exposes the industry select under an accessible name', () => {
    render(<WACCInputPanel {...buildProps()} />)

    const select = screen.getByLabelText('Industry')
    expect(select).toHaveValue('software')
  })

  it('renders the info tooltip triggers as keyboard-accessible, labelled buttons', () => {
    render(<WACCInputPanel {...buildProps()} />)

    const riskFreeInfo = screen.getByRole('button', { name: 'Information: Risk-Free Rate' })
    expect(riskFreeInfo.tagName).toBe('BUTTON')
    expect(riskFreeInfo).toHaveAttribute('aria-label', 'Information: Risk-Free Rate')

    const infoButtons = screen.getAllByRole('button', { name: /Information: / })
    expect(infoButtons.length).toBe(6)
  })

  it('renders the calculator title and description', () => {
    render(<WACCInputPanel {...buildProps()} />)

    expect(screen.getByText('WACC Calculator')).toBeInTheDocument()
    expect(screen.getByText('Weighted Average Cost of Capital')).toBeInTheDocument()
  })

  it('forwards the className prop onto the card root', () => {
    const { container } = render(<WACCInputPanel {...buildProps({ className: 'custom-wacc' })} />)

    expect(container.querySelector('.custom-wacc')).not.toBeNull()
  })

  describe('calculate button', () => {
    it('is enabled and invokes onCalculate when clicked', () => {
      const onCalculate = vi.fn()
      render(<WACCInputPanel {...buildProps({ onCalculate })} />)

      const button = screen.getByRole('button', { name: 'Calculate WACC' })
      expect(button).toBeEnabled()

      fireEvent.click(button)
      expect(onCalculate).toHaveBeenCalledOnce()
    })

    it('is disabled and relabels while calculating (fail-safe)', () => {
      render(<WACCInputPanel {...buildProps({ isCalculating: true })} />)

      const button = screen.getByRole('button', { name: 'Calculating...' })
      expect(button).toBeDisabled()
    })
  })

  describe('simple mode', () => {
    it('binds the single WACC input to simpleValue and hides the CAPM grid', () => {
      render(<WACCInputPanel {...buildProps({ mode: 'simple', simpleValue: 12.5 })} />)

      expect(inputValue('WACC (%)')).toBe('12.5')
      expect(screen.queryByLabelText('Beta (β)')).toBeNull()
      expect(screen.queryByLabelText('Industry')).toBeNull()
    })

    it('renders a simpleValue of 0 rather than treating it as empty', () => {
      render(<WACCInputPanel {...buildProps({ mode: 'simple', simpleValue: 0 })} />)

      expect(inputValue('WACC (%)')).toBe('0')
    })

    it('forwards parsed numeric edits of the simple input', () => {
      const onSimpleValueChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ mode: 'simple', onSimpleValueChange })} />)

      fireEvent.change(screen.getByLabelText('WACC (%)'), { target: { value: '7.5' } })
      expect(onSimpleValueChange).toHaveBeenCalledWith(7.5)
    })

    it('coerces a cleared input to 0 instead of NaN (fail-safe)', () => {
      const onSimpleValueChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ mode: 'simple', onSimpleValueChange })} />)

      fireEvent.change(screen.getByLabelText('WACC (%)'), { target: { value: '' } })
      expect(onSimpleValueChange).toHaveBeenCalledWith(0)
    })
  })

  describe('mode switch', () => {
    it('reflects the simple state and toggles to detailed on click', () => {
      const onModeChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ mode: 'simple', onModeChange })} />)

      const sw = screen.getByRole('switch')
      expect(sw).toHaveAttribute('aria-checked', 'false')

      fireEvent.click(sw)
      expect(onModeChange).toHaveBeenCalledWith('detailed')
    })

    it('reflects the detailed state and toggles to simple on click', () => {
      const onModeChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ mode: 'detailed', onModeChange })} />)

      const sw = screen.getByRole('switch')
      expect(sw).toHaveAttribute('aria-checked', 'true')

      fireEvent.click(sw)
      expect(onModeChange).toHaveBeenCalledWith('simple')
    })
  })

  describe('detailed inputs', () => {
    it('renders all six CAPM inputs with their current values', () => {
      render(<WACCInputPanel {...buildProps()} />)

      expect(inputValue('Risk-Free Rate')).toBe('0.8')
      expect(inputValue('Market Risk Premium')).toBe('6')
      expect(inputValue('Beta (β)')).toBe('1')
      expect(inputValue('Cost of Debt')).toBe('2.5')
      expect(inputValue('Tax Rate')).toBe('30')
      expect(inputValue('Debt Ratio (D/D+E)')).toBe('30')
    })

    it('merges a single field edit into the detailed inputs, preserving the rest', () => {
      const onDetailedInputsChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ onDetailedInputsChange })} />)

      fireEvent.change(screen.getByLabelText('Beta (β)'), { target: { value: '1.5' } })
      expect(onDetailedInputsChange).toHaveBeenCalledWith({ ...detailedInputs, beta: 1.5 })
    })

    it('updates the cost-of-debt field independently', () => {
      const onDetailedInputsChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ onDetailedInputsChange })} />)

      fireEvent.change(screen.getByLabelText('Cost of Debt'), { target: { value: '3.25' } })
      expect(onDetailedInputsChange).toHaveBeenCalledWith({ ...detailedInputs, costOfDebt: 3.25 })
    })

    it('lists all eight industry options and forwards selection changes', () => {
      const onIndustryChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ onIndustryChange })} />)

      const select = screen.getByLabelText('Industry') as HTMLSelectElement
      expect(select.options).toHaveLength(8)
      expect(Array.from(select.options).map((o) => o.value)).toEqual([
        'software',
        'saas',
        'manufacturing',
        'retail',
        'financial',
        'healthcare',
        'energy',
        'real_estate',
      ])

      fireEvent.change(select, { target: { value: 'saas' } })
      expect(onIndustryChange).toHaveBeenCalledWith('saas')
    })
  })

  describe('AI advice', () => {
    it('renders the recommendations block with formatted values and an Apply All button', () => {
      render(<WACCInputPanel {...buildProps({ advice })} />)

      expect(screen.getByText('AI Recommendations')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Apply All' })).toBeInTheDocument()
      expect(screen.getByText('0.80%')).toBeInTheDocument()
      expect(screen.getByText('1.20')).toBeInTheDocument()
      expect(screen.getByText('6.0%')).toBeInTheDocument()
    })

    it('scales recommended decimal values into percentages when Apply All is clicked', () => {
      const onDetailedInputsChange = vi.fn()
      render(<WACCInputPanel {...buildProps({ advice, onDetailedInputsChange })} />)

      fireEvent.click(screen.getByRole('button', { name: 'Apply All' }))
      expect(onDetailedInputsChange).toHaveBeenCalledWith({
        riskFreeRate: 0.8,
        marketRiskPremium: 6,
        beta: 1.2,
        costOfDebt: 2.5,
        taxRate: 30,
        debtRatio: 35,
      })
    })

    it('omits the recommendations block when no advice is available (fail-safe)', () => {
      render(<WACCInputPanel {...buildProps({ advice: null })} />)

      expect(screen.queryByText('AI Recommendations')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Apply All' })).toBeNull()
    })

    it('does not surface advice in simple mode even when it is provided', () => {
      render(<WACCInputPanel {...buildProps({ mode: 'simple', advice })} />)

      expect(screen.queryByText('AI Recommendations')).toBeNull()
    })
  })

  describe('result display', () => {
    const detailedResult: WACCResult = {
      wacc: 0.0825,
      mode: 'detailed',
      steps: [],
      components: {
        costOfEquity: 0.09,
        costOfDebt: 0.02,
        afterTaxCostOfDebt: 0.015,
        weightedCostOfEquity: 0.063,
        weightedCostOfDebt: 0.0045,
      },
    }

    it('renders the WACC, components and CAPM-Based badge for a detailed result', () => {
      render(<WACCInputPanel {...buildProps({ mode: 'detailed', result: detailedResult })} />)

      expect(screen.getByText('8.25%')).toBeInTheDocument()
      expect(screen.getByText('CAPM-Based')).toBeInTheDocument()
      expect(screen.getByText('9.00%')).toBeInTheDocument()
      expect(screen.getByText('1.50%')).toBeInTheDocument()
    })

    it('renders a simple result without the components breakdown', () => {
      const simpleResult: WACCResult = { wacc: 0.1, mode: 'simple', steps: [] }
      render(<WACCInputPanel {...buildProps({ mode: 'simple', result: simpleResult })} />)

      expect(screen.getByText('10.00%')).toBeInTheDocument()
      expect(screen.queryByText('CAPM-Based')).toBeNull()
      expect(screen.queryByText('Cost of Equity:')).toBeNull()
    })

    it('renders nothing when result is null (fail-safe)', () => {
      render(<WACCInputPanel {...buildProps({ mode: 'simple', result: null })} />)

      expect(screen.queryByText(/^WACC$/)).toBeNull()
    })

    it('formats a zero WACC as 0.00%', () => {
      const zeroResult: WACCResult = { wacc: 0, mode: 'simple', steps: [] }
      render(<WACCInputPanel {...buildProps({ mode: 'simple', result: zeroResult })} />)

      expect(screen.getByText('0.00%')).toBeInTheDocument()
    })

    it('renders a negative WACC without crashing (fail-safe)', () => {
      const negativeResult: WACCResult = { wacc: -0.01, mode: 'simple', steps: [] }
      render(<WACCInputPanel {...buildProps({ mode: 'simple', result: negativeResult })} />)

      expect(screen.getByText('-1.00%')).toBeInTheDocument()
    })
  })
})

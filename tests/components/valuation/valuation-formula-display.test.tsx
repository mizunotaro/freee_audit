import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ValuationFormulaDisplay } from '@/components/valuation/valuation-formula-display'
import type { CalculationStep } from '@/services/valuation/types'

const step: CalculationStep = {
  id: 'step-1',
  name: 'Enterprise Value',
  description: 'Sum of discounted cash flows',
  formula: 'Σ FCF / (1+r)^t',
  formulaWithValues: '1000 / 1.1',
  inputs: { fcf: 1000 },
  output: 909.09,
  unit: 'currency',
}

describe('ValuationFormulaDisplay', () => {
  it('renders an accessible empty state when there are no steps', () => {
    render(<ValuationFormulaDisplay steps={[]} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('No calculation steps available')
    expect(screen.getByText('0 steps')).toBeInTheDocument()
  })

  it('renders the step name when steps are present', () => {
    render(<ValuationFormulaDisplay steps={[step]} />)

    expect(screen.getByText('Enterprise Value')).toBeInTheDocument()
    expect(screen.getByText('1 steps')).toBeInTheDocument()
    expect(screen.queryByText('No calculation steps available')).not.toBeInTheDocument()
  })
})

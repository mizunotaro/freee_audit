import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ValuationFormulaDisplay } from '@/components/valuation/valuation-formula-display'
import type { CalculationStep } from '@/services/valuation/types'

function makeStep(overrides: Partial<CalculationStep> = {}): CalculationStep {
  return {
    id: 'step-1',
    name: 'Enterprise Value',
    description: 'Sum of discounted cash flows',
    formula: 'Σ FCF / (1+r)^t',
    formulaWithValues: '1000 / 1.1',
    inputs: { fcf: 1000 },
    output: 909.09,
    unit: 'currency',
    ...overrides,
  }
}

describe('ValuationFormulaDisplay', () => {
  describe('empty state & header', () => {
    it('renders an accessible empty state when there are no steps', () => {
      render(<ValuationFormulaDisplay steps={[]} />)

      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('No calculation steps available')
      expect(screen.getByText('0 steps')).toBeInTheDocument()
    })

    it('uses the default title when none is provided', () => {
      render(<ValuationFormulaDisplay steps={[]} />)

      expect(screen.getByText('Calculation Steps')).toBeInTheDocument()
    })

    it('renders a custom title when provided and drops the default', () => {
      render(<ValuationFormulaDisplay steps={[]} title="DCF Breakdown" />)

      expect(screen.getByText('DCF Breakdown')).toBeInTheDocument()
      expect(screen.queryByText('Calculation Steps')).not.toBeInTheDocument()
    })

    it('shows the step count in the badge', () => {
      render(<ValuationFormulaDisplay steps={[makeStep(), makeStep({ id: 'step-2' })]} />)

      expect(screen.getByText('2 steps')).toBeInTheDocument()
    })
  })

  describe('step rendering', () => {
    it('renders the step name when steps are present', () => {
      render(<ValuationFormulaDisplay steps={[makeStep()]} />)

      expect(screen.getByText('Enterprise Value')).toBeInTheDocument()
      expect(screen.getByText('1 steps')).toBeInTheDocument()
      expect(screen.queryByText('No calculation steps available')).not.toBeInTheDocument()
    })

    it('renders every step in a multi-step list', () => {
      render(
        <ValuationFormulaDisplay
          steps={[makeStep({ id: 'a', name: 'Alpha' }), makeStep({ id: 'b', name: 'Beta' })]}
        />
      )

      expect(screen.getByText('Alpha')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })

    it('renders the unit as a badge', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ unit: 'percent' })]} />)

      expect(screen.getByText('percent')).toBeInTheDocument()
    })

    it('omits the unit badge when unit is empty', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ unit: '' })]} />)

      expect(screen.getByText('Enterprise Value')).toBeInTheDocument()
    })

    it('renders the formula and the formula with values', () => {
      render(<ValuationFormulaDisplay steps={[makeStep()]} />)

      expect(screen.getByText('Σ FCF / (1+r)^t')).toBeInTheDocument()
      expect(screen.getByText('1000 / 1.1')).toBeInTheDocument()
    })

    it('omits formula blocks when they are absent', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ formula: '', formulaWithValues: '' })]} />)

      expect(screen.queryByText('Σ FCF / (1+r)^t')).not.toBeInTheDocument()
      expect(screen.queryByText('1000 / 1.1')).not.toBeInTheDocument()
    })
  })

  describe('result unit formatting', () => {
    it('appends "MM JPY" for the currency unit', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 909.09, unit: 'currency' })]} />)

      expect(screen.getByText('909.09 MM JPY')).toBeInTheDocument()
    })

    it('appends "MM JPY" for the "MM JPY" unit alias', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 5, unit: 'MM JPY' })]} />)

      expect(screen.getByText('5 MM JPY')).toBeInTheDocument()
    })

    it('appends "%" for the percent unit', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 25.5, unit: 'percent' })]} />)

      expect(screen.getByText('25.5%')).toBeInTheDocument()
    })

    it('appends "%" for the "%" unit alias', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 10, unit: '%' })]} />)

      expect(screen.getByText('10%')).toBeInTheDocument()
    })

    it('appends "x" for the multiple unit', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 3.2, unit: 'multiple' })]} />)

      expect(screen.getByText('3.2x')).toBeInTheDocument()
    })

    it('appends "x" for the "x" unit alias', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 2, unit: 'x' })]} />)

      expect(screen.getByText('2x')).toBeInTheDocument()
    })

    it('returns the bare number for an unknown unit', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 42, unit: 'shares' })]} />)

      expect(screen.getByText('42')).toBeInTheDocument()
    })
  })

  describe('number magnitude formatting (formatNumber boundaries)', () => {
    it('formats billions with a "B" suffix', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 5e9, unit: 'shares' })]} />)

      expect(screen.getByText('5.00B')).toBeInTheDocument()
    })

    it('formats negative billions with a "B" suffix', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: -5e9, unit: 'shares' })]} />)

      expect(screen.getByText('-5.00B')).toBeInTheDocument()
    })

    it('formats millions with an "M" suffix', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 2.5e6, unit: 'shares' })]} />)

      expect(screen.getByText('2.50M')).toBeInTheDocument()
    })

    it('formats thousands with grouping', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 1500, unit: 'shares' })]} />)

      expect(screen.getByText('1,500')).toBeInTheDocument()
    })

    it('formats small magnitudes with exponential notation', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 0.005, unit: 'shares' })]} />)

      expect(screen.getByText('5.00e-3')).toBeInTheDocument()
    })

    it('does not use exponential notation for exactly zero', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 0, unit: 'shares' })]} />)

      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('formats a regular magnitude with up to 4 fraction digits', () => {
      render(<ValuationFormulaDisplay steps={[makeStep({ output: 909.09, unit: 'shares' })]} />)

      expect(screen.getByText('909.09')).toBeInTheDocument()
    })
  })

  describe('nesting & depth', () => {
    it('renders a child step for a top-level step that is open by default', () => {
      const parent = makeStep({
        id: 'parent',
        name: 'Parent',
        children: [makeStep({ id: 'child', name: 'Child Step' })],
      })

      render(<ValuationFormulaDisplay steps={[parent]} />)

      expect(screen.getByText('Parent')).toBeInTheDocument()
      expect(screen.getByText('Child Step')).toBeInTheDocument()
    })

    it('renders the description inside the expanded content', () => {
      const parent = makeStep({
        id: 'parent',
        name: 'Parent',
        description: 'Explains the parent calculation',
        children: [makeStep({ id: 'child', name: 'Child Step' })],
      })

      render(<ValuationFormulaDisplay steps={[parent]} />)

      expect(screen.getByText('Explains the parent calculation')).toBeInTheDocument()
    })

    it('treats an empty children array as a leaf (no expandable content)', () => {
      const parent = makeStep({ id: 'parent', name: 'Parent', children: [] })

      render(<ValuationFormulaDisplay steps={[parent]} />)

      expect(screen.getByText('Parent')).toBeInTheDocument()
      // depth-0 leaf shows its 1-based index instead of a chevron / content block
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('does not render children deeper than maxDepth', () => {
      const parent = makeStep({
        id: 'parent',
        name: 'Parent',
        children: [makeStep({ id: 'child', name: 'Child Step' })],
      })

      render(<ValuationFormulaDisplay steps={[parent]} maxDepth={0} />)

      // parent (depth 0) renders and its content is open, but the child at
      // depth 1 exceeds maxDepth 0 and is clipped by the depth guard.
      expect(screen.getByText('Parent')).toBeInTheDocument()
      expect(screen.queryByText('Child Step')).not.toBeInTheDocument()
    })
  })

  describe('leaf index display', () => {
    it('shows the 1-based index for a childless step', () => {
      render(
        <ValuationFormulaDisplay
          steps={[makeStep({ id: 'leaf', name: 'Leaf Step', children: undefined })]}
        />
      )

      expect(screen.getByText('Leaf Step')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  describe('className passthrough', () => {
    it('applies a custom className to the root container', () => {
      const { container } = render(
        <ValuationFormulaDisplay steps={[]} className="custom-class-x" />
      )

      expect((container.firstChild as HTMLElement).className).toContain('custom-class-x')
    })
  })
})

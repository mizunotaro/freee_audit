import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ValuationAIAdvisor } from '@/components/valuation/valuation-ai-advisor'
import type { ValuationQAResult, WACCAdviceResponse, QAIssue } from '@/services/valuation'

const validationDetails: ValuationQAResult['validationDetails'] = {
  formulaCheck: { passed: true, issues: [] },
  boundaryCheck: { passed: true, warnings: [] },
  consistencyCheck: { passed: true, issues: [] },
  bestPracticeCheck: { passed: true, issues: [] },
}

const qaResult: ValuationQAResult = {
  passed: true,
  score: 85,
  confidence: 'high',
  issues: [],
  recommendations: [],
  validationDetails,
}

const advice: WACCAdviceResponse = {
  industry: 'software',
  confidence: 'high',
  advice: [],
  warnings: [],
  recommendedValues: {
    riskFreeRate: 0.025,
    marketRiskPremium: 0.06,
    beta: 1.2,
    costOfDebt: 0.03,
    taxRate: 0.3,
    debtRatio: 0.2,
  },
  riskFreeRate: {
    suggested: 0.025,
    range: { min: 0.015, max: 0.035 },
    rationale: '10-year JGB yield',
    dataSource: 'MOF JGB 10Y',
  },
  marketRiskPremium: {
    suggested: 0.06,
    range: { min: 0.05, max: 0.07 },
    rationale: 'Damodaran estimate',
    dataSource: 'Damodaran 2024',
  },
  beta: {
    suggested: 1.2,
    range: { min: 1.0, max: 1.5 },
    rationale: 'Industry beta',
    dataSource: 'Bloomberg',
    unleveredBeta: 0.95,
    suggestedLeveredBeta: 1.2,
    comparableCompanies: ['COMP-A', 'COMP-B'],
  },
  costOfDebt: {
    suggested: 0.03,
    range: { min: 0.02, max: 0.04 },
    rationale: 'Rated bond spread',
    dataSource: 'Refinitiv',
    spreadOverRiskFree: 1.5,
  },
  taxRate: {
    suggested: 0.3,
    range: { min: 0.25, max: 0.35 },
    rationale: 'Statutory rate',
    dataSource: 'METI',
    statutory: 0.3,
  },
  optimalCapitalStructure: {
    suggestedDERatio: 0.25,
    industryAverage: 0.2,
    rationale: 'Peer median',
  },
  lastUpdated: '2024-01-15T00:00:00.000Z',
}

function qaWith(score: number, overrides: Partial<ValuationQAResult> = {}): ValuationQAResult {
  return { ...qaResult, score, ...overrides }
}

describe('ValuationAIAdvisor', () => {
  it('renders an accessible loading state', () => {
    const { container } = render(<ValuationAIAdvisor advice={null} qaResult={null} isLoading />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('prefers loading over error when both are set', () => {
    render(<ValuationAIAdvisor advice={null} qaResult={null} isLoading error="boom" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the error message inside an alert', () => {
    render(
      <ValuationAIAdvisor advice={null} qaResult={null} isLoading={false} error="Advisor offline" />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Advisor offline')
  })

  it('offers a keyboard-accessible retry button in the error state', () => {
    const onRefresh = vi.fn()
    render(
      <ValuationAIAdvisor
        advice={null}
        qaResult={null}
        isLoading={false}
        error="Advisor offline"
        onRefresh={onRefresh}
      />
    )

    const retry = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retry)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('renders an accessible empty state when there is no advice or qa result', () => {
    render(<ValuationAIAdvisor advice={null} qaResult={null} isLoading={false} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      'Select an industry and enter parameters to receive AI-powered recommendations'
    )
    expect(status).not.toHaveAttribute('aria-busy')
  })

  it('exposes the quality score as an accessible progressbar', () => {
    render(<ValuationAIAdvisor advice={null} qaResult={qaResult} isLoading={false} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '85')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', 'Quality score 85 of 100')
  })

  describe('ready state with advice', () => {
    it('renders the industry and confidence badge in the description', () => {
      render(<ValuationAIAdvisor advice={advice} qaResult={null} isLoading={false} />)

      expect(screen.getByText('high confidence')).toBeInTheDocument()
      expect(screen.getAllByText(/Industry: software/).length).toBeGreaterThan(0)
    })

    it('renders each WACC recommendation with percentage formatting', () => {
      render(<ValuationAIAdvisor advice={advice} qaResult={null} isLoading={false} />)

      expect(screen.getByText('Risk-Free Rate')).toBeInTheDocument()
      expect(screen.getByText('2.50%')).toBeInTheDocument()
      expect(screen.getByText('Market Risk Premium')).toBeInTheDocument()
      expect(screen.getByText('6.00%')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
      expect(screen.getByText('120.00%')).toBeInTheDocument()
      expect(screen.getByText('Cost of Debt')).toBeInTheDocument()
      expect(screen.getByText('3.00%')).toBeInTheDocument()
      expect(screen.getByText('Range: 1.5% - 3.5%')).toBeInTheDocument()
    })

    it('renders the beta unlevered and cost-of-debt spread extras', () => {
      render(<ValuationAIAdvisor advice={advice} qaResult={null} isLoading={false} />)

      expect(screen.getByText('Unlevered: 0.95')).toBeInTheDocument()
      expect(screen.getByText('Spread: 1.50%')).toBeInTheDocument()
    })

    it('renders the optimal capital structure ratios', () => {
      render(<ValuationAIAdvisor advice={advice} qaResult={null} isLoading={false} />)

      expect(screen.getByText('Optimal Capital Structure')).toBeInTheDocument()
      expect(screen.getAllByText(/D\/E Ratio: 0\.25/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Industry Avg: 0\.20/).length).toBeGreaterThan(0)
    })

    it('renders the last-updated date using the advice timestamp', () => {
      render(<ValuationAIAdvisor advice={advice} qaResult={null} isLoading={false} />)

      expect(screen.getAllByText(/Last updated:/).length).toBeGreaterThan(0)
      const expectedDate = new Date(advice.lastUpdated).toLocaleDateString()
      expect(document.body.textContent).toContain(expectedDate)
    })

    it('renders the Refresh button in the ready state and invokes onRefresh', () => {
      const onRefresh = vi.fn()
      render(
        <ValuationAIAdvisor
          advice={advice}
          qaResult={null}
          isLoading={false}
          onRefresh={onRefresh}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
      expect(onRefresh).toHaveBeenCalledOnce()
    })

    it('forwards a custom className to the root card', () => {
      const { container } = render(
        <ValuationAIAdvisor
          advice={advice}
          qaResult={null}
          isLoading={false}
          className="advisor-root-custom"
        />
      )

      expect(container.querySelector('.advisor-root-custom')).not.toBeNull()
    })

    it('renders each warning string when warnings are present', () => {
      const adviceWithWarnings: WACCAdviceResponse = {
        ...advice,
        warnings: ['Rates are volatile', 'Beta has high uncertainty'],
      }
      render(<ValuationAIAdvisor advice={adviceWithWarnings} qaResult={null} isLoading={false} />)

      expect(screen.getByText('Rates are volatile')).toBeInTheDocument()
      expect(screen.getByText('Beta has high uncertainty')).toBeInTheDocument()
    })

    it('renders the advice section without the QA section when qaResult is absent', () => {
      render(<ValuationAIAdvisor advice={advice} qaResult={null} isLoading={false} />)

      expect(screen.getByText('WACC Recommendations')).toBeInTheDocument()
      expect(screen.queryByText('Quality Assurance')).not.toBeInTheDocument()
    })

    it('renders both QA and advice sections when both are supplied', () => {
      render(<ValuationAIAdvisor advice={advice} qaResult={qaResult} isLoading={false} />)

      expect(screen.getByText('Quality Assurance')).toBeInTheDocument()
      expect(screen.getByText('WACC Recommendations')).toBeInTheDocument()
    })
  })

  describe('ready state with qaResult', () => {
    it('shows an "Issues Found" badge when QA did not pass', () => {
      render(
        <ValuationAIAdvisor
          advice={null}
          qaResult={qaWith(40, { passed: false })}
          isLoading={false}
        />
      )

      expect(screen.getByText('Issues Found')).toBeInTheDocument()
    })

    it('renders issue messages, suggestions, and the issue count', () => {
      const issues: QAIssue[] = [
        {
          id: 'i1',
          category: 'formula',
          severity: 'error',
          message: 'Beta out of bounds',
          suggestion: 'Use a value between 0.5 and 2.0',
        },
        {
          id: 'i2',
          category: 'boundary',
          severity: 'warning',
          message: 'Growth rate near cap',
          suggestion: 'Reduce to 3%',
        },
        {
          id: 'i3',
          category: 'consistency',
          severity: 'info',
          message: 'Consider sensitivity analysis',
          suggestion: 'Add scenario rows',
        },
      ]
      render(
        <ValuationAIAdvisor
          advice={null}
          qaResult={qaWith(40, { passed: false, issues })}
          isLoading={false}
        />
      )

      expect(screen.getByText('Issues (3)')).toBeInTheDocument()
      for (const issue of issues) {
        expect(screen.getByText(issue.message)).toBeInTheDocument()
        expect(screen.getByText(issue.suggestion!)).toBeInTheDocument()
      }
    })

    it('renders each severity inside its corresponding tone container', () => {
      const issues: QAIssue[] = [
        { id: 'i1', category: 'formula', severity: 'error', message: 'Beta out of bounds' },
        { id: 'i2', category: 'boundary', severity: 'warning', message: 'Growth near cap' },
        { id: 'i3', category: 'consistency', severity: 'info', message: 'Add sensitivity' },
      ]
      render(
        <ValuationAIAdvisor
          advice={null}
          qaResult={qaWith(40, { passed: false, issues })}
          isLoading={false}
        />
      )

      expect(
        screen.getByText('Beta out of bounds').closest('[class*="text-red-500"]')
      ).not.toBeNull()
      expect(
        screen.getByText('Growth near cap').closest('[class*="text-yellow-600"]')
      ).not.toBeNull()
      expect(screen.getByText('Add sensitivity').closest('[class*="text-blue-500"]')).not.toBeNull()
    })

    it('caps the rendered issues at five while showing the true count', () => {
      const manyIssues: QAIssue[] = Array.from({ length: 7 }, (_, i) => ({
        id: `i${i}`,
        category: 'formula',
        severity: 'error',
        message: `Issue ${i + 1}`,
      }))
      render(
        <ValuationAIAdvisor
          advice={null}
          qaResult={qaWith(40, { passed: false, issues: manyIssues })}
          isLoading={false}
        />
      )

      expect(screen.getByText('Issues (7)')).toBeInTheDocument()
      expect(screen.getByText('Issue 5')).toBeInTheDocument()
      expect(screen.queryByText('Issue 6')).not.toBeInTheDocument()
      expect(screen.queryByText('Issue 7')).not.toBeInTheDocument()
    })

    it('caps the rendered recommendations at three', () => {
      const recommendations = ['Rec 1', 'Rec 2', 'Rec 3', 'Rec 4', 'Rec 5']
      render(
        <ValuationAIAdvisor
          advice={null}
          qaResult={qaWith(85, { recommendations })}
          isLoading={false}
        />
      )

      expect(screen.getByText('Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Rec 3')).toBeInTheDocument()
      expect(screen.queryByText('Rec 4')).not.toBeInTheDocument()
      expect(screen.queryByText('Rec 5')).not.toBeInTheDocument()
    })

    it.each<[number, string]>([
      [100, 'bg-green-500'],
      [80, 'bg-green-500'],
      [79, 'bg-yellow-500'],
      [60, 'bg-yellow-500'],
      [59, 'bg-red-500'],
      [0, 'bg-red-500'],
    ])('at score %i the quality bar fill is %s', (score, klass) => {
      render(<ValuationAIAdvisor advice={null} qaResult={qaWith(score)} isLoading={false} />)

      const fill = screen.getByRole('progressbar').firstElementChild
      expect(fill).not.toBeNull()
      expect(fill as HTMLElement).toHaveClass(klass)
    })
  })
})

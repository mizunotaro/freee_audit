import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ValuationAIAdvisor } from '@/components/valuation/valuation-ai-advisor'
import type { ValuationQAResult } from '@/services/valuation'

const qaResult: ValuationQAResult = {
  passed: true,
  score: 85,
  confidence: 'high',
  issues: [],
  recommendations: [],
  validationDetails: {
    formulaCheck: { passed: true, issues: [] },
    boundaryCheck: { passed: true, warnings: [] },
    consistencyCheck: { passed: true, issues: [] },
    bestPracticeCheck: { passed: true, issues: [] },
  },
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
})

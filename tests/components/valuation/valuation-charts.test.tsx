import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ValuationCharts } from '@/components/valuation/valuation-charts'
import type { DCFResult } from '@/services/valuation'

const dcfResult: DCFResult = {
  enterpriseValue: 1000,
  terminalValue: 800,
  terminalPV: 600,
  currency: 'JPY',
  unit: 'million',
  steps: [],
  metadata: {
    method: 'dcf',
    calculatedAt: '2024-01-01T00:00:00.000Z',
    version: '1.0.0',
    presentValues: [100, 90, 80],
    terminalValue: 800,
    terminalPV: 600,
  },
}

describe('ValuationCharts', () => {
  it('renders an accessible loading skeleton when isLoading is true', () => {
    const { container } = render(<ValuationCharts isLoading dcfResult={dcfResult} />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText('Run calculations to see charts')).not.toBeInTheDocument()
  })

  it('prefers loading over error when both are set', () => {
    render(<ValuationCharts isLoading error="boom" dcfResult={dcfResult} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the error message inside an alert', () => {
    render(<ValuationCharts error="Chart data unavailable" dcfResult={dcfResult} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Chart data unavailable')
  })

  it('renders an accessible empty state when there is no data', () => {
    render(<ValuationCharts />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Run calculations to see charts')
    expect(status).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the visualization card (not a status/alert) when data is present', () => {
    render(<ValuationCharts dcfResult={dcfResult} />)

    expect(screen.getByText('Visualization')).toBeInTheDocument()
    expect(screen.queryByText('Run calculations to see charts')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

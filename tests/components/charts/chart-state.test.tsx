import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { resolveChartStatus, type ChartResolution } from '@/components/charts/resolve-chart-status'
import { ChartState } from '@/components/charts/chart-state'

function expectResolved(input: unknown): ChartResolution {
  const result = resolveChartStatus(input)
  if (!result.success) {
    throw new Error(`expected success but got failure: ${result.error.code}`)
  }
  return result.data
}

describe('resolveChartStatus', () => {
  it('resolves to loading when loading is true, regardless of error or data', () => {
    expect(expectResolved({ loading: true, error: 'boom', dataLength: 5 })).toBe('loading')
    expect(expectResolved({ loading: true })).toBe('loading')
  })

  it('resolves to error when not loading but error is a non-empty string', () => {
    expect(expectResolved({ loading: false, error: 'boom', dataLength: 5 })).toBe('error')
  })

  it('treats a null/empty error as no error', () => {
    expect(expectResolved({ error: null, dataLength: 0 })).toBe('empty')
    expect(expectResolved({ error: '', dataLength: 0 })).toBe('empty')
  })

  it('resolves to empty when not loading, no error, and dataLength is 0', () => {
    expect(expectResolved({ loading: false, error: null, dataLength: 0 })).toBe('empty')
  })

  it('resolves to ready when data is present', () => {
    expect(expectResolved({ dataLength: 3 })).toBe('ready')
  })

  it('applies loading > error > empty precedence in order', () => {
    expect(expectResolved({ loading: true, error: 'boom', dataLength: 0 })).toBe('loading')
    expect(expectResolved({ loading: false, error: 'boom', dataLength: 0 })).toBe('error')
  })

  it('returns a failure Result for invalid input', () => {
    const result = resolveChartStatus({ dataLength: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('returns a failure Result for unparseable types', () => {
    const result = resolveChartStatus({ loading: 'yes' })
    expect(result.success).toBe(false)
  })

  it('applies schema defaults for omitted optional fields', () => {
    expect(expectResolved({})).toBe('empty')
  })
})

describe('ChartState', () => {
  it('renders an accessible loading skeleton', () => {
    const { container } = render(<ChartState status="loading" />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    const pulses = container.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBe(5)
  })

  it('renders the requested number of skeleton lines', () => {
    const { container } = render(<ChartState status="loading" skeletonLines={3} />)

    expect(container.querySelectorAll('.animate-pulse').length).toBe(3)
  })

  it('renders the custom error message inside an alert', () => {
    render(<ChartState status="error" error="通信エラーが発生しました" />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('通信エラーが発生しました')
  })

  it('falls back to the default error message when none is provided', () => {
    render(<ChartState status="error" />)

    expect(screen.getByRole('alert')).toHaveTextContent('データの取得に失敗しました')
  })

  it('renders the custom empty message', () => {
    render(<ChartState status="empty" emptyMessage="表示できるデータがありません" />)

    expect(screen.getByText('表示できるデータがありません')).toBeInTheDocument()
  })

  it('falls back to the default empty message when none is provided', () => {
    render(<ChartState status="empty" />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
  })
})

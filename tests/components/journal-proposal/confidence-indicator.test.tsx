import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ConfidenceIndicator,
  getConfidenceLevel,
  getConfidenceColor,
} from '@/components/journal-proposal'

describe('journal-proposal/ConfidenceIndicator — accessibility', () => {
  it('exposes the confidence as an accessible progressbar with current/min/max values', () => {
    render(<ConfidenceIndicator confidence={0.85} size="md" />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '85')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', '信頼度 85% (中)')
  })

  it('keeps the progressbar semantics even when the visible label is hidden', () => {
    render(<ConfidenceIndicator confidence={0.95} showLabel={false} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '95')
    expect(bar).toHaveAttribute('aria-label', '信頼度 95% (高)')
  })

  it('reports 100% at full confidence', () => {
    render(<ConfidenceIndicator confidence={1} showLabel={false} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('reports 0% at zero confidence', () => {
    render(<ConfidenceIndicator confidence={0} showLabel={false} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('journal-proposal/ConfidenceIndicator — level helpers', () => {
  it('maps confidence to the configured threshold levels', () => {
    expect(getConfidenceLevel(0.95)).toBe('high')
    expect(getConfidenceLevel(0.75)).toBe('medium')
    expect(getConfidenceLevel(0.55)).toBe('low')
    expect(getConfidenceLevel(0.2)).toBe('very-low')
  })

  it('returns a text colour class for each band', () => {
    expect(getConfidenceColor(0.95)).toBe('text-green-600')
    expect(getConfidenceColor(0.2)).toBe('text-red-600')
  })
})

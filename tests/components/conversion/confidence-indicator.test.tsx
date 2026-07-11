import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceIndicator } from '@/components/conversion/confidence-indicator'

function fill(): HTMLElement {
  return screen.getByRole('progressbar').firstElementChild as HTMLElement
}

describe('ConfidenceIndicator — percentage computation', () => {
  it('rounds confidence*100 to the nearest integer (0.927 rounds up to 93)', () => {
    render(<ConfidenceIndicator confidence={0.927} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '93')
    expect(fill().style.width).toBe('93%')
  })

  it('rounds down when the first decimal is below 5 (0.923 -> 92)', () => {
    render(<ConfidenceIndicator confidence={0.923} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '92')
  })

  it('computes 0% for confidence 0', () => {
    render(<ConfidenceIndicator confidence={0} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(fill().style.width).toBe('0%')
  })

  it('computes 100% for confidence 1', () => {
    render(<ConfidenceIndicator confidence={1} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(fill().style.width).toBe('100%')
  })
})

const BUCKET_CASES = [
  { confidence: 0.9, percentage: 90, color: 'bg-green-500', label: '高' },
  { confidence: 1.0, percentage: 100, color: 'bg-green-500', label: '高' },
  { confidence: 0.89, percentage: 89, color: 'bg-yellow-500', label: '中' },
  { confidence: 0.7, percentage: 70, color: 'bg-yellow-500', label: '中' },
  { confidence: 0.69, percentage: 69, color: 'bg-orange-500', label: '低' },
  { confidence: 0.5, percentage: 50, color: 'bg-orange-500', label: '低' },
  { confidence: 0.49, percentage: 49, color: 'bg-red-500', label: '要確認' },
  { confidence: 0, percentage: 0, color: 'bg-red-500', label: '要確認' },
] as const

describe('ConfidenceIndicator — color & label buckets at each threshold boundary', () => {
  it.each(BUCKET_CASES)(
    'confidence $confidence -> $color / "$label" (aria-valuenow $percentage)',
    ({ confidence, percentage, color, label }) => {
      render(<ConfidenceIndicator confidence={confidence} />)
      const bar = screen.getByRole('progressbar')
      expect(fill().className).toContain(color)
      expect(bar).toHaveAttribute('aria-valuenow', String(percentage))
      expect(bar).toHaveAttribute('aria-label', `信頼度 ${percentage}% (${label})`)
    }
  )

  it('exposes the bucket color only on the fill, never on the track', () => {
    render(<ConfidenceIndicator confidence={0.95} />)
    const bar = screen.getByRole('progressbar')
    expect(fill().className).toContain('bg-green-500')
    expect(bar.className).not.toContain('bg-green-500')
    expect(bar.className).toContain('bg-gray-200')
  })
})

describe('ConfidenceIndicator — visible label', () => {
  it('renders the percentage and label text by default (showLabel defaults to true)', () => {
    render(<ConfidenceIndicator confidence={0.85} />)
    expect(screen.getByText('85% (中)')).toBeInTheDocument()
  })

  it('hides the visible label when showLabel is false but keeps the value accessible via aria-label', () => {
    render(<ConfidenceIndicator confidence={0.85} showLabel={false} />)
    expect(screen.queryByText('85% (中)')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', '信頼度 85% (中)')
  })
})

describe('ConfidenceIndicator — size variants', () => {
  it.each([
    { size: 'sm', h: 'h-1.5', w: 'w-16' },
    { size: 'md', h: 'h-2', w: 'w-24' },
    { size: 'lg', h: 'h-3', w: 'w-32' },
  ] as const)('applies $size track dimensions ($h $w)', ({ size, h, w }) => {
    render(<ConfidenceIndicator confidence={0.8} size={size} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain(h)
    expect(bar.className).toContain(w)
  })

  it('defaults to md size when size is omitted', () => {
    render(<ConfidenceIndicator confidence={0.8} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.className).toContain('h-2')
    expect(bar.className).toContain('w-24')
  })
})

describe('ConfidenceIndicator — accessibility & structure', () => {
  it('renders a progressbar with aria value min/max', () => {
    render(<ConfidenceIndicator confidence={0.75} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '75')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar.className).toContain('rounded-full')
  })

  it('sizes the fill to the percentage width and full height', () => {
    render(<ConfidenceIndicator confidence={0.6} />)
    const f = fill()
    expect(f.style.width).toBe('60%')
    expect(f.style.height).toBe('100%')
    expect(f.className).toContain('rounded-full')
    expect(f.className).toContain('transition-all')
  })

  it('merges a custom className onto the root element alongside the base classes', () => {
    render(<ConfidenceIndicator confidence={0.8} className="my-custom-class" />)
    const root = screen.getByRole('progressbar').parentElement as HTMLElement
    expect(root.className).toContain('my-custom-class')
    expect(root.className).toContain('flex')
    expect(root.className).toContain('items-center')
  })
})

describe('ConfidenceIndicator — fail-safe on out-of-range input', () => {
  it('renders without throwing for negative confidence and degrades to the red/要確認 bucket', () => {
    expect(() => render(<ConfidenceIndicator confidence={-0.2} />)).not.toThrow()
    const bar = screen.getByRole('progressbar')
    expect(fill().className).toContain('bg-red-500')
    expect(bar).toHaveAttribute('aria-label', '信頼度 -20% (要確認)')
  })

  it('renders without throwing for confidence above 1', () => {
    expect(() => render(<ConfidenceIndicator confidence={1.5} />)).not.toThrow()
    expect(fill().className).toContain('bg-green-500')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '150')
  })
})

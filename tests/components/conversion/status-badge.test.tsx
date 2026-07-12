import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/conversion/status-badge'
import type { ConversionStatus } from '@/types/conversion'

function badgeFor(text: string): HTMLElement {
  return screen.getByText(text)
}

// For each status the single most-reliable class present in the rendered badge.
// Secondary-variant statuses carry a status-specific bg-*-100 color that, via
// tailwind-merge, REPLACES (not layers with) the bg-secondary base — so for those
// the status color is the observable marker, while for the plain-variant statuses
// the variant's own class survives.
const STATUS_CASES: ReadonlyArray<{
  status: ConversionStatus
  label: string
  presentClass: string
  overriddenBase?: string
}> = [
  { status: 'draft', label: '下書き', presentClass: 'text-foreground' },
  {
    status: 'mapping',
    label: 'マッピング中',
    presentClass: 'bg-blue-100',
    overriddenBase: 'bg-secondary',
  },
  {
    status: 'validating',
    label: '検証中',
    presentClass: 'bg-yellow-100',
    overriddenBase: 'bg-secondary',
  },
  { status: 'converting', label: '変換中', presentClass: 'bg-primary' },
  {
    status: 'reviewing',
    label: 'レビュー中',
    presentClass: 'bg-purple-100',
    overriddenBase: 'bg-secondary',
  },
  {
    status: 'completed',
    label: '完了',
    presentClass: 'bg-green-100',
    overriddenBase: 'bg-secondary',
  },
  { status: 'error', label: 'エラー', presentClass: 'bg-destructive' },
]

describe('StatusBadge — label & variant for every ConversionStatus', () => {
  it.each(STATUS_CASES)(
    'status "$status" renders label "$label" and applies "$presentClass"',
    ({ status, label, presentClass }) => {
      render(<StatusBadge status={status} />)
      const badge = badgeFor(label)
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain(presentClass)
    }
  )

  it.each(STATUS_CASES.filter((c) => c.overriddenBase))(
    'status "$status" status color ($presentClass) overrides the $overriddenBase base (no double-bg)',
    ({ status, label, presentClass, overriddenBase }) => {
      render(<StatusBadge status={status} />)
      const className = badgeFor(label).className
      expect(className).toContain(presentClass)
      expect(className).not.toContain(overriddenBase as string)
    }
  )

  it('renders exactly one badge per render', () => {
    const { container } = render(<StatusBadge status="completed" />)
    expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('完了')).toHaveLength(1)
  })
})

describe('StatusBadge — size variants', () => {
  it.each([
    { size: 'sm', cls: 'text-xs' },
    { size: 'md', cls: 'text-sm' },
    { size: 'lg', cls: 'text-base' },
  ] as const)('applies $size size classes ($cls)', ({ size, cls }) => {
    render(<StatusBadge status="draft" size={size} />)
    expect(badgeFor('下書き').className).toContain(cls)
  })

  it.each([
    { size: 'sm', cls: 'px-1.5 py-0' },
    { size: 'md', cls: 'px-2 py-0.5' },
    { size: 'lg', cls: 'px-3 py-1' },
  ] as const)('applies $size padding classes ($cls)', ({ size, cls }) => {
    render(<StatusBadge status="draft" size={size} />)
    expect(badgeFor('下書き').className).toContain(cls)
  })

  it('defaults to md size when size is omitted', () => {
    render(<StatusBadge status="draft" />)
    const className = badgeFor('下書き').className
    expect(className).toContain('text-sm')
    expect(className).toContain('px-2')
  })
})

describe('StatusBadge — className merging', () => {
  it('appends a custom className onto the badge', () => {
    render(<StatusBadge status="error" className="my-custom-class" />)
    expect(badgeFor('エラー').className).toContain('my-custom-class')
  })

  it('keeps the base badge classes alongside a custom className', () => {
    render(<StatusBadge status="converting" className="my-custom-class" />)
    const className = badgeFor('変換中').className
    expect(className).toContain('my-custom-class')
    expect(className).toContain('bg-primary')
    expect(className).toContain('rounded-full')
  })

  it('renders an empty-string className without affecting the badge', () => {
    render(<StatusBadge status="draft" className="" />)
    expect(badgeFor('下書き')).toBeInTheDocument()
  })
})

describe('StatusBadge — structure', () => {
  it('renders a rounded-full badge element', () => {
    render(<StatusBadge status="mapping" />)
    expect(badgeFor('マッピング中').className).toContain('rounded-full')
  })

  it('never renders the label text more than once for a single status', () => {
    render(<StatusBadge status="validating" />)
    expect(screen.getAllByText('検証中')).toHaveLength(1)
  })
})

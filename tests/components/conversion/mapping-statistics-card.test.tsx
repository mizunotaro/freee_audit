import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MappingStatisticsCard } from '@/components/conversion/mapping-statistics-card'

// The prop shape mirrors the unexported `MappingStatistics` interface in the
// target module. Keeping a local factory lets the call site stay type-checked
// against the real component prop without importing a private type.
function makeStatistics(
  overrides: Partial<{
    total: number
    approved: number
    pending: number
    needsReview: number
    averageConfidence?: number
    byType?: Record<string, number>
  }> = {}
) {
  return {
    total: 100,
    approved: 60,
    pending: 25,
    needsReview: 15,
    averageConfidence: 0.85,
    byType: { asset: 40, liability: 20, equity: 15, revenue: 15, expense: 10 },
    ...overrides,
  }
}

// CardTitle(<div>) -> CardHeader(<div>) -> Card(<div>). Climbing two parents
// from a card's unique title lands on the Card wrapper, so we can scope value
// lookups without relying on Tailwind class names.
function cardFor(title: string): HTMLElement {
  const titleEl = screen.getByText(title)
  return titleEl.parentElement!.parentElement!
}

describe('conversion/MappingStatisticsCard — structure', () => {
  it('renders the four statistic cards with their titles and static captions', () => {
    render(<MappingStatisticsCard statistics={makeStatistics()} />)

    // Every card title is present.
    expect(screen.getByText('総マッピング数')).toBeInTheDocument()
    expect(screen.getByText('承認済み')).toBeInTheDocument()
    expect(screen.getByText('要確認')).toBeInTheDocument()
    expect(screen.getByText('平均信頼度')).toBeInTheDocument()

    // Static helper captions on the derived cards.
    expect(screen.getByText('手動レビューが必要')).toBeInTheDocument()
    expect(screen.getByText('AI推論の信頼度')).toBeInTheDocument()
  })

  it('renders the raw counts and derived percentages for typical input', () => {
    render(<MappingStatisticsCard statistics={makeStatistics()} />)

    // Total card shows the raw total.
    expect(within(cardFor('総マッピング数')).getByText('100')).toBeInTheDocument()
    // Approved card shows the raw approved count and its approval rate.
    expect(within(cardFor('承認済み')).getByText('60')).toBeInTheDocument()
    expect(within(cardFor('承認済み')).getByText('60%')).toBeInTheDocument()
    // Needs-review card shows the raw needsReview count.
    expect(within(cardFor('要確認')).getByText('15')).toBeInTheDocument()
    // Confidence card shows averageConfidence scaled to a whole percent.
    expect(within(cardFor('平均信頼度')).getByText('85%')).toBeInTheDocument()
  })

  it('accepts the full statistics shape (incl. unused pending / byType) without crashing', () => {
    // pending and byType are declared on the prop type but are not rendered;
    // supplying them must not affect output or throw.
    const { container } = render(<MappingStatisticsCard statistics={makeStatistics()} />)
    expect(container.firstChild).not.toBeNull()
    expect(screen.queryByText('25')).not.toBeInTheDocument() // pending is not displayed
  })
})

describe('conversion/MappingStatisticsCard — approval rate', () => {
  it('rounds the approval percentage to a whole number', () => {
    // 1/3 = 33.33 -> rounds down to 33.
    const { rerender } = render(
      <MappingStatisticsCard statistics={makeStatistics({ total: 3, approved: 1 })} />
    )
    expect(within(cardFor('承認済み')).getByText('33%')).toBeInTheDocument()

    // 2/3 = 66.67 -> rounds up to 67.
    rerender(<MappingStatisticsCard statistics={makeStatistics({ total: 3, approved: 2 })} />)
    expect(within(cardFor('承認済み')).getByText('67%')).toBeInTheDocument()
  })

  it('reports 100% when every mapping is approved', () => {
    render(<MappingStatisticsCard statistics={makeStatistics({ total: 7, approved: 7 })} />)
    expect(within(cardFor('承認済み')).getByText('100%')).toBeInTheDocument()
  })

  it('renders a progressbar for the approval rate with bounded min/max', () => {
    // NOTE: the shared Progress wrapper (src/components/ui/progress.tsx) does
    // not forward `value` to Radix's Root, so aria-valuenow is always absent
    // regardless of the rate. Only role/min/max are reliably set here; the
    // visible "{rate}%" text (asserted elsewhere) is what actually conveys the
    // computed approval rate.
    render(<MappingStatisticsCard statistics={makeStatistics({ total: 10, approved: 4 })} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('does not clamp approval rates above 100% (documents current behaviour)', () => {
    // approved > total is a data inconsistency; the component does not clamp it.
    render(<MappingStatisticsCard statistics={makeStatistics({ total: 10, approved: 15 })} />)
    expect(within(cardFor('承認済み')).getByText('150%')).toBeInTheDocument()
  })

  it('degrades the approval rate to 0 when total is 0 (no division by zero)', () => {
    render(<MappingStatisticsCard statistics={makeStatistics({ total: 0, approved: 0 })} />)
    expect(within(cardFor('承認済み')).getByText('0%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('keeps the approval rate at 0 when total is 0 even if approved is non-zero', () => {
    // Fail-safe: total === 0 short-circuits before the division, so a stray
    // approved count never produces NaN or Infinity.
    render(<MappingStatisticsCard statistics={makeStatistics({ total: 0, approved: 5 })} />)
    expect(within(cardFor('承認済み')).getByText('0%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})

describe('conversion/MappingStatisticsCard — average confidence', () => {
  it('scales averageConfidence (0..1) to a whole percent', () => {
    const { rerender } = render(
      <MappingStatisticsCard statistics={makeStatistics({ averageConfidence: 0.856 })} />
    )
    // 0.856 * 100 = 85.6 -> rounds up to 86.
    expect(within(cardFor('平均信頼度')).getByText('86%')).toBeInTheDocument()

    rerender(<MappingStatisticsCard statistics={makeStatistics({ averageConfidence: 0.854 })} />)
    // 0.854 * 100 = 85.4 -> rounds down to 85.
    expect(within(cardFor('平均信頼度')).getByText('85%')).toBeInTheDocument()
  })

  it('reports 100% at full confidence', () => {
    render(<MappingStatisticsCard statistics={makeStatistics({ averageConfidence: 1 })} />)
    expect(within(cardFor('平均信頼度')).getByText('100%')).toBeInTheDocument()
  })

  it('reports 0% at zero confidence', () => {
    render(<MappingStatisticsCard statistics={makeStatistics({ averageConfidence: 0 })} />)
    expect(within(cardFor('平均信頼度')).getByText('0%')).toBeInTheDocument()
  })

  it('degrades to 0% when averageConfidence is omitted', () => {
    // averageConfidence ?? 0 guards the optional so a missing value never
    // renders "NaN%".
    render(<MappingStatisticsCard statistics={makeStatistics({ averageConfidence: undefined })} />)
    expect(within(cardFor('平均信頼度')).getByText('0%')).toBeInTheDocument()
  })
})

describe('conversion/MappingStatisticsCard — empty / fail-safe state', () => {
  it('renders zeros everywhere with no confidence and no division by zero', () => {
    render(
      <MappingStatisticsCard
        statistics={{
          total: 0,
          approved: 0,
          pending: 0,
          needsReview: 0,
        }}
      />
    )

    expect(within(cardFor('総マッピング数')).getByText('0')).toBeInTheDocument()
    expect(within(cardFor('承認済み')).getByText('0')).toBeInTheDocument()
    expect(within(cardFor('承認済み')).getByText('0%')).toBeInTheDocument()
    expect(within(cardFor('要確認')).getByText('0')).toBeInTheDocument()
    // No averageConfidence supplied -> 0%.
    expect(within(cardFor('平均信頼度')).getByText('0%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})

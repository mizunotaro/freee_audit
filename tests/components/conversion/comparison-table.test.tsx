import { describe, it, expect } from 'vitest'
import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import { ComparisonTable } from '@/components/conversion/comparison-table'

type ComparisonItem = ComponentProps<typeof ComparisonTable>['items'][number]

function makeItem(overrides: Partial<ComparisonItem> = {}): ComparisonItem {
  return {
    sourceCode: '1000',
    sourceName: '現金',
    sourceAmount: 1_000_000,
    targetCode: '1010',
    targetName: 'Cash',
    targetAmount: 980_000,
    difference: -20_000,
    differencePercent: -2.0,
    ...overrides,
  }
}

/** Class string of the trend icon rendered in the difference cell identified by `percentText`. */
function diffIconClass(percentText: string): string | null {
  const span = screen.getByText(percentText)
  const svg = span.closest('div')?.querySelector('svg')
  return svg?.getAttribute('class') ?? null
}

/** The <tr> that contains `cellText` (e.g. a source name). */
function rowFor(cellText: string): HTMLElement | null {
  return screen.getByText(cellText).closest('tr')
}

describe('ComparisonTable — structure', () => {
  it('renders the title in an <h3> heading', () => {
    render(<ComparisonTable title="試算表の比較" items={[]} />)

    const heading = screen.getByRole('heading', { name: '試算表の比較' })
    expect(heading.tagName).toBe('H3')
  })

  it('renders the source/target group headers and per-column headers by default', () => {
    render(<ComparisonTable title="比較" items={[]} />)

    expect(screen.getByRole('columnheader', { name: '変換元' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '変換後' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '差異' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader', { name: 'コード' })).toHaveLength(2)
    expect(screen.getAllByRole('columnheader', { name: '科目名' })).toHaveLength(2)
    expect(screen.getAllByRole('columnheader', { name: '金額' })).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: '%' })).toBeInTheDocument()
  })

  it('renders all 12 column headers (including the two spacer cells) when the percentage column is shown', () => {
    render(<ComparisonTable title="比較" items={[]} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(12)
  })

  it('keeps the headers but renders zero body rows when items is empty', () => {
    render(<ComparisonTable title="比較" items={[]} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '変換元' })).toBeInTheDocument()
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
    expect(screen.queryByText('要確認')).not.toBeInTheDocument()
  })

  it('omits the difference and % headers when showPercentage is false (10 headers remain)', () => {
    render(<ComparisonTable title="比較" items={[]} showPercentage={false} />)

    expect(screen.queryByRole('columnheader', { name: '差異' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '%' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(10)
  })
})

describe('ComparisonTable — item rows & amount formatting (formatAmount)', () => {
  it('renders one row per item with codes, names and formatted amounts', () => {
    render(<ComparisonTable title="比較" items={[makeItem()]} />)

    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('1000')).toBeInTheDocument()
    expect(screen.getByText('1010')).toBeInTheDocument()
    // amounts are locale-grouped — mirror the implementation's own formatting
    expect(screen.getByText((1_000_000).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText((980_000).toLocaleString())).toBeInTheDocument()
  })

  it('renders multiple rows, one per item', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[
          makeItem({ sourceName: '現金', sourceCode: '1000' }),
          makeItem({ sourceName: '預金', sourceCode: '1100' }),
        ]}
      />
    )

    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('預金')).toBeInTheDocument()
    expect(screen.getAllByText('Cash')).toHaveLength(2)
  })

  it('formats large and zero amounts via toLocaleString', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[
          makeItem({
            sourceName: '売掛金',
            sourceAmount: 1_234_567_890,
            targetName: 'AR',
            targetAmount: 0,
          }),
        ]}
      />
    )

    expect(screen.getByText((1_234_567_890).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText((0).toLocaleString())).toBeInTheDocument()
  })

  it('formats negative amounts with a leading minus', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[
          makeItem({
            sourceName: '累損',
            sourceAmount: -5_000,
            targetName: 'Deficit',
            targetAmount: -2_500,
          }),
        ]}
      />
    )

    expect(screen.getByText((-5_000).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText((-2_500).toLocaleString())).toBeInTheDocument()
  })
})

describe('ComparisonTable — percentage formatting (formatPercent)', () => {
  it('prefixes non-negative percent with +', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: 12.5 })]} />)
    expect(screen.getByText('+12.5%')).toBeInTheDocument()
  })

  it('rounds to one decimal place (12.34 -> 12.3)', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: 12.34 })]} />)
    expect(screen.getByText('+12.3%')).toBeInTheDocument()
  })

  it('renders negative percent with its own minus and no extra sign', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: -3.2 })]} />)
    expect(screen.getByText('-3.2%')).toBeInTheDocument()
  })

  it('renders exactly zero as +0.0%', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: 0 })]} />)
    expect(screen.getByText('+0.0%')).toBeInTheDocument()
  })
})

describe('ComparisonTable — difference icon (getDifferenceIcon)', () => {
  it('shows the up (green) icon for a positive change above the noise floor', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: 5 })]} />)
    expect(diffIconClass('+5.0%')).toContain('text-green-600')
  })

  it('shows the down (red) icon for a negative change', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: -5 })]} />)
    expect(diffIconClass('-5.0%')).toContain('text-red-600')
  })

  it('shows the neutral icon for a near-zero change (|p| < 0.1)', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: 0.04 })]} />)
    const cls = diffIconClass('+0.0%')
    expect(cls).not.toContain('text-green-600')
    expect(cls).not.toContain('text-red-600')
  })

  it('treats exactly 0.1 as an upward change (boundary is strict < 0.1)', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: 0.1 })]} />)
    expect(diffIconClass('+0.1%')).toContain('text-green-600')
  })
})

describe('ComparisonTable — significance highlighting (isSignificant)', () => {
  it('flags a row at/above the default threshold with the 要確認 badge and yellow background', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[makeItem({ sourceName: '現金', differencePercent: 5 })]}
      />
    )

    expect(screen.getByText('要確認')).toBeInTheDocument()
    expect(rowFor('現金')?.getAttribute('class') ?? '').toContain('bg-yellow-50')
  })

  it('does not flag a row below the default threshold', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[makeItem({ sourceName: '現金', differencePercent: 4.9 })]}
      />
    )

    expect(screen.queryByText('要確認')).not.toBeInTheDocument()
    expect(rowFor('現金')?.getAttribute('class') ?? '').not.toContain('bg-yellow-50')
  })

  it('treats the boundary |percent| === threshold (negative side) as significant', () => {
    render(<ComparisonTable title="比較" items={[makeItem({ differencePercent: -5 })]} />)
    expect(screen.getByText('要確認')).toBeInTheDocument()
  })

  it('respects a custom highlightThreshold', () => {
    const { rerender } = render(
      <ComparisonTable
        title="比較"
        items={[makeItem({ sourceName: 'A', differencePercent: 8 })]}
        highlightThreshold={10}
      />
    )
    expect(screen.queryByText('要確認')).not.toBeInTheDocument()

    rerender(
      <ComparisonTable
        title="比較"
        items={[makeItem({ sourceName: 'A', differencePercent: 10 })]}
        highlightThreshold={10}
      />
    )
    expect(screen.getByText('要確認')).toBeInTheDocument()
  })
})

describe('ComparisonTable — showPercentage={false}', () => {
  it('renders codes, names and amounts but omits the entire difference cell', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[makeItem({ sourceName: '現金', targetName: 'Cash', differencePercent: 99 })]}
        showPercentage={false}
      />
    )

    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText((1_000_000).toLocaleString())).toBeInTheDocument()
    // no percentage UI at all: no badge, no formatted percent text, no 差異 header
    expect(screen.queryByText('要確認')).not.toBeInTheDocument()
    expect(screen.queryByText('+99.0%')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '差異' })).not.toBeInTheDocument()
  })
})

describe('ComparisonTable — fail-safe on non-finite inputs', () => {
  it('does not crash on NaN differencePercent and degrades without a badge or highlight', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[makeItem({ sourceName: '現金', differencePercent: NaN })]}
      />
    )

    // the row still renders
    expect(screen.getByText('現金')).toBeInTheDocument()
    // Math.abs(NaN) >= threshold is always false -> never significant
    expect(screen.queryByText('要確認')).not.toBeInTheDocument()
    expect(rowFor('現金')?.getAttribute('class') ?? '').not.toContain('bg-yellow-50')
  })

  it('treats +Infinity as a significant positive change', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[makeItem({ sourceName: '現金', differencePercent: Infinity })]}
      />
    )

    expect(screen.getByText('要確認')).toBeInTheDocument()
    expect(rowFor('現金')?.getAttribute('class') ?? '').toContain('bg-yellow-50')
    expect(diffIconClass('+Infinity%')).toContain('text-green-600')
  })

  it('accepts the optional props (currency / highlightThreshold) without affecting output or crashing', () => {
    render(
      <ComparisonTable
        title="比較"
        items={[makeItem()]}
        currency="USD"
        highlightThreshold={1}
        showPercentage={false}
      />
    )

    // currency is intentionally unused in the view (_currency); the row renders normally
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })
})

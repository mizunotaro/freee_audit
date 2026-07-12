import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const capture = vi.hoisted(() => ({
  renderLog: [] as string[],
  data: null as { wrapper: string; data: unknown } | null,
}))

vi.mock('recharts', () => {
  interface MockProps {
    children?: unknown
    data?: unknown
    [key: string]: unknown
  }
  const stub =
    (name: string) =>
    (props: MockProps): unknown => {
      capture.renderLog.push(name)
      if (props.data !== undefined) {
        capture.data = { wrapper: name, data: props.data }
      }
      return props.children ?? null
    }
  return {
    ResponsiveContainer: stub('ResponsiveContainer'),
    BarChart: stub('BarChart'),
    ComposedChart: stub('ComposedChart'),
    LineChart: stub('LineChart'),
    PieChart: stub('PieChart'),
    Bar: stub('Bar'),
    Line: stub('Line'),
    XAxis: stub('XAxis'),
    YAxis: stub('YAxis'),
    CartesianGrid: stub('CartesianGrid'),
    Tooltip: stub('Tooltip'),
    Legend: stub('Legend'),
    ReferenceLine: stub('ReferenceLine'),
    Cell: stub('Cell'),
    Pie: stub('Pie'),
  }
})

import { KPIGauge, KPIRing, KPIBar, KPICard } from '@/components/charts/KPIGauge'

const reset = () => {
  capture.renderLog = []
  capture.data = null
}

const hexToRgb = (hex: string): string => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const hasInlineColor = (container: HTMLElement, hex: string): boolean => {
  const variants = [hex.toLowerCase(), hexToRgb(hex)]
  return Array.from(container.querySelectorAll('[style]')).some((el) => {
    const style = el.getAttribute('style') || ''
    return variants.some((v) => style.toLowerCase().includes(v))
  })
}

describe('KPIGauge', () => {
  beforeEach(reset)

  it('renders the value, target and label and caps the gauge fill at 100%', () => {
    const { container } = render(<KPIGauge value={200} target={100} label="達成率" />)

    expect(container.textContent).toContain('200.0')
    expect(container.textContent).toContain('達成率')
    expect(container.textContent).toContain('目標: 100')

    const pieData = capture.data?.data as Array<{ value: number; color: string }>
    expect(pieData[0].value).toBe(100)
    expect(pieData[1].value).toBe(0)
  })

  it('uses the green status color when the percentage is at least 100', () => {
    const { container } = render(<KPIGauge value={100} target={100} label="指標" />)

    expect(hasInlineColor(container, '#10b981')).toBe(true)
  })

  it('uses the blue status color when the percentage is between 80 and 99', () => {
    const { container } = render(<KPIGauge value={80} target={100} label="指標" />)

    expect(hasInlineColor(container, '#3b82f6')).toBe(true)
  })

  it('uses the amber status color when the percentage is between 60 and 79', () => {
    const { container } = render(<KPIGauge value={60} target={100} label="指標" />)

    expect(hasInlineColor(container, '#f59e0b')).toBe(true)
    expect(hasInlineColor(container, '#ef4444')).toBe(false)
  })

  it('uses the red status color when the percentage is below 60', () => {
    const { container } = render(<KPIGauge value={40} target={100} label="指標" />)

    expect(hasInlineColor(container, '#ef4444')).toBe(true)
  })

  it('accepts a custom unit and size', () => {
    const { container } = render(
      <KPIGauge value={5} target={10} label="件数" unit="件" size={300} />
    )

    expect(container.textContent).toContain('5.0件')
    expect(container.textContent).toContain('目標: 10件')
    expect(capture.renderLog).toContain('ResponsiveContainer')
  })
})

describe('KPIRing', () => {
  beforeEach(reset)

  it('renders the percentage and label and caps at 100%', () => {
    const { container } = render(<KPIRing value={200} max={100} label="進捗" />)

    expect(container.textContent).toContain('100.0%')
    expect(container.textContent).toContain('進捗')
  })

  it('renders a partial percentage', () => {
    const { container } = render(<KPIRing value={25} max={100} label="完了" />)

    expect(container.textContent).toContain('25.0%')
  })

  it('passes a custom color through', () => {
    const { container } = render(<KPIRing value={50} max={100} label="進捗" color="#abc123" />)

    expect(hasInlineColor(container, '#abc123')).toBe(true)
  })
})

describe('KPIBar', () => {
  beforeEach(reset)

  it('renders the label and target and shows the percentage capped at 150 for the text', () => {
    const { container } = render(<KPIBar label="成長率" value={200} target={100} />)

    expect(container.textContent).toContain('成長率')
    expect(container.textContent).toContain('200.0')
    expect(container.textContent).toContain('目標: 100')
    expect(container.textContent).toContain('150%')
  })

  it('caps the bar width at 100% even when the percentage exceeds 100', () => {
    const { container } = render(<KPIBar label="x" value={200} target={100} />)

    const bar = container.querySelector('[style]') as HTMLElement | null
    expect(bar).not.toBeNull()
    expect(bar!.getAttribute('style')).toContain('width: 100%')
  })

  it('renders the value only when showValue is true', () => {
    const { container } = render(<KPIBar label="x" value={50} target={100} showValue={false} />)

    expect(container.textContent).toContain('x')
    expect(container.textContent).not.toContain('50.0')
    expect(container.textContent).toContain('50%')
  })
})

describe('KPICard', () => {
  beforeEach(reset)

  it('renders the title and a numeric value with locale grouping', () => {
    const { container } = render(<KPICard title="売上高" value={1234567} unit="円" />)

    expect(container.textContent).toContain('売上高')
    expect(container.textContent).toContain('1,234,567')
    expect(container.textContent).not.toContain('↑')
    expect(container.textContent).not.toContain('↓')
  })

  it('renders a string value as-is without a change indicator', () => {
    const { container } = render(<KPICard title="状態" value="良好" />)

    expect(container.textContent).toContain('良好')
    expect(container.textContent).not.toContain('%')
  })

  it('computes the upward change and renders the up trend icon', () => {
    const { container } = render(
      <KPICard title="利益" value={150} previousValue={100} trend="up" />
    )

    expect(container.textContent).toContain('↑')
    expect(container.textContent).toContain('50.0%')
  })

  it('computes the downward change and renders the down trend icon', () => {
    const { container } = render(
      <KPICard title="費用" value={80} previousValue={100} trend="down" />
    )

    expect(container.textContent).toContain('↓')
    expect(container.textContent).toContain('20.0%')
  })

  it('renders the description when provided', () => {
    const { container } = render(<KPICard title="x" value={1} description="前期比" />)

    expect(container.textContent).toContain('前期比')
  })
})

describe('KPIGauge — accessibility', () => {
  beforeEach(reset)

  it('gives the gauge a role=img text alternative', () => {
    const { getByRole } = render(<KPIGauge value={80} target={100} label="ROE" />)

    expect(getByRole('img', { name: 'ROEのゲージ' })).toBeInTheDocument()
  })

  it('gives the ring a role=img text alternative', () => {
    const { getByRole } = render(<KPIRing value={50} max={100} label="完了" />)

    expect(getByRole('img', { name: '完了のリング' })).toBeInTheDocument()
  })

  it('exposes the bar as a progressbar capped at 100', () => {
    const { getByRole } = render(<KPIBar label="成長率" value={200} target={100} />)

    const bar = getByRole('progressbar', { name: '成長率' })
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('announces an upward trend via an sr-only label', () => {
    const { container } = render(
      <KPICard title="利益" value={150} previousValue={100} trend="up" />
    )

    expect(container.querySelector('.sr-only')).toHaveTextContent('上昇')
  })

  it('announces a downward trend via an sr-only label', () => {
    const { container } = render(
      <KPICard title="費用" value={80} previousValue={100} trend="down" />
    )

    expect(container.querySelector('.sr-only')).toHaveTextContent('下降')
  })
})

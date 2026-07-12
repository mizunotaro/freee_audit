import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  DualCurrencyDisplay,
  DualCurrencyInline,
  ExchangeRateBadge,
} from '@/components/currency/dual-currency-display'
import { formatCurrency, formatDualCurrency } from '@/services/currency'

describe('DualCurrencyDisplay', () => {
  it('renders a single formatted amount when showDual is false (default)', () => {
    const amount = 100000
    const { container } = render(<DualCurrencyDisplay amount={amount} currency="JPY" />)

    expect(container.textContent).toContain(formatCurrency(amount, 'JPY', 'ja'))
    expect(container.querySelectorAll('span').length).toBe(1)
  })

  it('renders a single formatted amount when exchangeRate is omitted even if showDual is true', () => {
    const amount = 50000
    const { container } = render(<DualCurrencyDisplay amount={amount} currency="USD" showDual />)

    expect(container.textContent).toContain(formatCurrency(amount, 'USD', 'ja'))
    expect(container.querySelectorAll('span').length).toBe(1)
    expect(container.textContent).not.toContain('@')
  })

  it('converts JPY -> USD (division) and shows the rate marker in dual mode', () => {
    const amount = 100000
    const rate = 150
    const { container } = render(
      <DualCurrencyDisplay amount={amount} currency="JPY" exchangeRate={rate} showDual />
    )

    expect(container.textContent).toContain(formatCurrency(amount / rate, 'USD', 'ja'))
    expect(container.textContent).toContain(`@${rate.toFixed(2)}`)
  })

  it('converts non-JPY -> JPY (multiplication) in dual mode', () => {
    const amount = 1000
    const rate = 150
    const { container } = render(
      <DualCurrencyDisplay amount={amount} currency="USD" exchangeRate={rate} showDual />
    )

    expect(container.textContent).toContain(formatCurrency(amount * rate, 'JPY', 'ja'))
    expect(container.textContent).toContain(`@${rate.toFixed(2)}`)
  })

  it('renders the base amount in the primary position in dual mode', () => {
    const amount = 100000
    const rate = 150
    const { container } = render(
      <DualCurrencyDisplay amount={amount} currency="JPY" exchangeRate={rate} showDual />
    )

    expect(container.textContent).toContain(formatCurrency(amount, 'JPY', 'ja'))
  })

  it('applies the custom className', () => {
    const { container } = render(
      <DualCurrencyDisplay amount={1} currency="JPY" className="custom-class" />
    )

    const nodes = container.querySelectorAll('.custom-class')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].textContent).toContain(formatCurrency(1, 'JPY', 'ja'))
  })

  it('labels the converted amount as a converted equivalent for screen readers (en)', () => {
    const { container } = render(
      <DualCurrencyDisplay amount={100000} currency="JPY" exchangeRate={150} showDual locale="en" />
    )

    const secondary = container.querySelector('.text-gray-500')
    expect(secondary?.getAttribute('aria-label')).toBe(
      `Converted: ${formatCurrency(100000 / 150, 'USD', 'en')} @ 150.00`
    )
  })

  it('uses the localized converted-equivalent label (ja)', () => {
    const { container } = render(
      <DualCurrencyDisplay amount={1000} currency="USD" exchangeRate={150} showDual locale="ja" />
    )

    const secondary = container.querySelector('.text-gray-500')
    expect(secondary?.getAttribute('aria-label')).toContain('換算')
  })
})

describe('DualCurrencyInline', () => {
  it('delegates to formatDualCurrency for a JPY base', () => {
    const amount = 100000
    const rate = 150
    const { container } = render(
      <DualCurrencyInline amount={amount} currency="JPY" exchangeRate={rate} />
    )

    expect(container.textContent).toContain(formatDualCurrency(amount, 'JPY', rate, 'ja'))
    expect(container.textContent).toContain(`@${rate.toFixed(2)}`)
  })

  it('produces a different converted amount for a USD base than a JPY base', () => {
    const rate = 150
    const { container: jpy } = render(
      <DualCurrencyInline amount={1000} currency="JPY" exchangeRate={rate} />
    )
    const { container: usd } = render(
      <DualCurrencyInline amount={1000} currency="USD" exchangeRate={rate} />
    )

    expect(jpy.textContent).not.toEqual(usd.textContent)
  })

  it('applies the custom className', () => {
    const { container } = render(
      <DualCurrencyInline amount={1} currency="JPY" exchangeRate={1} className="inline-class" />
    )

    const nodes = container.querySelectorAll('.inline-class')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].textContent).toContain(formatDualCurrency(1, 'JPY', 1, 'ja'))
  })
})

describe('ExchangeRateBadge', () => {
  it('renders the USD/JPY rate formatted to two decimals', () => {
    const { container } = render(<ExchangeRateBadge rate={150} />)

    expect(container.textContent).toContain('USD/JPY: 150.00')
    expect(container.textContent).not.toContain('(')
  })

  it('renders the date when provided', () => {
    const date = new Date(2024, 0, 15)
    const { container } = render(<ExchangeRateBadge rate={149.5} date={date} />)

    expect(container.textContent).toContain('USD/JPY: 149.50')
    expect(container.textContent).toContain('2024/1/15')
  })

  it('rounds the displayed rate to two decimals', () => {
    const { container } = render(<ExchangeRateBadge rate={149.999} />)

    expect(container.textContent).toContain('USD/JPY: 150.00')
  })

  it('applies the custom className', () => {
    const { container } = render(<ExchangeRateBadge rate={150} className="badge-class" />)

    const nodes = container.querySelectorAll('.badge-class')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].textContent).toContain('USD/JPY: 150.00')
  })
})

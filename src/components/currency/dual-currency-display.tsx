'use client'

import { Currency, formatCurrency, formatDualCurrency } from '@/services/currency'

interface DualCurrencyDisplayProps {
  amount: number
  currency: Currency
  exchangeRate?: number
  showDual?: boolean
  locale?: 'ja' | 'en'
  className?: string
}

export function DualCurrencyDisplay({
  amount,
  currency,
  exchangeRate,
  showDual = false,
  locale = 'ja',
  className = '',
}: DualCurrencyDisplayProps) {
  if (!showDual || !exchangeRate) {
    return <span className={className}>{formatCurrency(amount, currency, locale)}</span>
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <span className="font-medium">{formatCurrency(amount, currency, locale)}</span>
      <span className="text-sm text-gray-500">
        {currency === 'JPY'
          ? formatCurrency(amount / exchangeRate, 'USD', locale)
          : formatCurrency(amount * exchangeRate, 'JPY', locale)}
        <span className="ml-1 text-xs">@{exchangeRate.toFixed(2)}</span>
      </span>
    </div>
  )
}

interface DualCurrencyInlineProps {
  amount: number
  currency: Currency
  exchangeRate: number
  locale?: 'ja' | 'en'
  className?: string
}

export function DualCurrencyInline({
  amount,
  currency,
  exchangeRate,
  locale = 'ja',
  className = '',
}: DualCurrencyInlineProps) {
  return (
    <span className={className}>{formatDualCurrency(amount, currency, exchangeRate, locale)}</span>
  )
}

interface ExchangeRateBadgeProps {
  rate: number
  date?: Date
  className?: string
}

export function ExchangeRateBadge({ rate, date, className = '' }: ExchangeRateBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 ${className}`}
    >
      USD/JPY: {rate.toFixed(2)}
      {date && <span className="ml-1 text-gray-500">({date.toLocaleDateString('ja-JP')})</span>}
    </span>
  )
}

export default DualCurrencyDisplay

import { Locale, defaultLocale, locales, Messages } from './types'
import { getRequestConfig } from 'next-intl/server'

export { locales, defaultLocale }
export type { Locale, Messages }

export default getRequestConfig(async ({ requestLocale }) => {
  let resolvedLocale: Locale = defaultLocale

  const locale = await requestLocale

  if (locale && locales.includes(locale as Locale)) {
    resolvedLocale = locale as Locale
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../../../messages/${resolvedLocale}.json`)).default,
  }
})

export function getMessages(locale: Locale): Promise<Messages> {
  return import(`../../../messages/${locale}.json`).then((m) => m.default)
}

export function getDirection(_locale: Locale): 'ltr' | 'rtl' {
  return 'ltr'
}

export function formatDate(
  locale: Locale,
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
  return new Intl.DateTimeFormat(
    locale === 'ja' ? 'ja-JP' : 'en-US',
    options || defaultOptions
  ).format(date)
}

export function formatNumber(
  locale: Locale,
  number: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', options).format(number)
}

export function formatCurrency(locale: Locale, amount: number, currency: 'JPY' | 'USD'): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}

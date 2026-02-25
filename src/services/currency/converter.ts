import type { CurrencyConversion } from '@/types'
import { prisma } from '@/lib/db'

export interface ExchangeRate {
  rateDate: Date
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
}

export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date: Date
): Promise<ExchangeRate | null> {
  if (fromCurrency === toCurrency) {
    return {
      rateDate: date,
      fromCurrency,
      toCurrency,
      rate: 1,
      source: 'identity',
    }
  }

  const rate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
      rateDate: {
        lte: date,
      },
    },
    orderBy: {
      rateDate: 'desc',
    },
  })

  if (!rate) return null

  return {
    rateDate: rate.rateDate,
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    rate: rate.rate,
    source: rate.source,
  }
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate: number
): CurrencyConversion {
  const convertedAmount = amount / exchangeRate

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    fromCurrency,
    toCurrency,
    convertedCurrency: toCurrency,
    amount,
    rate: exchangeRate,
    convertedAmount: Math.round(convertedAmount * 100) / 100,
    rateDate: new Date(),
    source: 'BOJ',
  }
}

export function formatDualCurrency(
  jpyAmount: number,
  usdAmount: number,
  exchangeRate: number
): string {
  return `¥${jpyAmount.toLocaleString()} ($${usdAmount.toLocaleString()} @${exchangeRate.toFixed(2)})`
}

export function getMonthEndTTMDate(date: Date): Date {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1)
  }

  return lastDay
}

export async function saveExchangeRate(rate: ExchangeRate): Promise<void> {
  await prisma.exchangeRate.create({
    data: {
      rateDate: rate.rateDate,
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate,
      source: rate.source,
    },
  })
}

export const SUPPORTED_CURRENCIES = ['JPY', 'USD', 'EUR', 'GBP'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export function isValidCurrency(currency: string): currency is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)
}

export type Currency = 'JPY' | 'USD'

export type ExchangeRateSource = 'BOJ' | 'ECB'

export interface ExchangeRate {
  date: Date
  fromCurrency: Currency
  toCurrency: Currency
  rate: number
  source: ExchangeRateSource
}

export interface CurrencyConversion {
  originalAmount: number
  originalCurrency: Currency
  convertedAmount: number
  convertedCurrency: Currency
  exchangeRate: ExchangeRate
}

export interface ExchangeRateService {
  getRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate>
  getLatestRate(from: Currency, to: Currency): Promise<ExchangeRate>
  getMonthlyRates(year: number, month: number): Promise<ExchangeRate[]>
}

export interface CurrencyConverter {
  convert(amount: number, from: Currency, to: Currency, rate: ExchangeRate): CurrencyConversion
  convertWithLatestRate(amount: number, from: Currency, to: Currency): Promise<CurrencyConversion>
}

export interface DualCurrencyDisplayProps {
  amount: number
  baseCurrency: Currency
  displayCurrency: Currency
  exchangeRate: number
  showBoth?: boolean
}

export interface RunwayCalculation {
  monthlyBurnRate: number
  runwayMonths: number
  zeroCashDate: Date
}

export interface CurrencyFormatOptions {
  locale: 'ja' | 'en'
  currency: Currency
  showSymbol?: boolean
  showCode?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

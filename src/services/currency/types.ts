import { Result } from '@/types/result'

export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AUD'
  | 'CNY'
  | 'CHF'
  | 'CAD'
  | 'HKD'
  | 'KRW'
  | 'SGD'

export type ExchangeRateSource = 'BOJ' | 'ECB' | 'MURC' | 'OPEN_EXCHANGE' | 'MANUAL'

export type TransactionType = 'receivable' | 'payable'

export type TransactionStatus = 'open' | 'settled' | 'revalued'

export type ExchangeGainLossType = 'gain' | 'loss'

export type Currency = 'JPY' | CurrencyCode

export interface ExchangeRate {
  id: string
  rateDate: Date
  fromCurrency: string
  toCurrency: string
  rate: number
  source: ExchangeRateSource
  sourceUrl: string | null
  confidence: number
  isOfficial: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ExchangeRateProvider {
  readonly source: ExchangeRateSource
  readonly priority: number
  readonly confidence: number

  fetchRates(date: Date): Promise<Result<ExchangeRate[], Error>>
  isAvailable(): Promise<boolean>
}

export interface ExchangeRateService {
  getRate(date: Date, from: Currency, to: Currency): Promise<ExchangeRate>
  getLatestRate(from: Currency, to: Currency): Promise<ExchangeRate>
  getMonthlyRates(year: number, month: number): Promise<ExchangeRate[]>
  getRatesInRange(
    startDate: Date,
    endDate: Date,
    from: CurrencyCode,
    to: CurrencyCode
  ): Promise<ExchangeRate[]>
  saveRate(rate: Omit<ExchangeRate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExchangeRate>
}

export interface ForeignCurrencyTransaction {
  id: string
  companyId: string

  transactionDate: Date
  transactionType: TransactionType
  currencyCode: CurrencyCode
  originalAmount: number
  exchangeRateId: string
  exchangedAmount: number

  referenceNumber?: string
  partnerId?: string
  partnerName?: string
  documentId?: string
  description?: string

  settlementDate?: Date
  settlementRateId?: string
  settlementAmount?: number
  exchangeGainLoss?: number
  exchangeGainLossType?: ExchangeGainLossType

  revaluationDate?: Date
  revaluationRateId?: string
  revaluationGainLoss?: number

  journalId?: string
  settlementJournalId?: string
  revaluationJournalId?: string

  status: TransactionStatus
  createdAt: Date
  updatedAt: Date
}

export interface TransactionMatchScore {
  transactionId: string
  score: number
  breakdown: {
    partnerNameSimilarity: number
    amountMatch: number
    dateProximity: number
  }
  requiresHumanReview: boolean
}

export interface JournalProposal {
  id: string
  transactionId: string
  proposalType: 'occurrence' | 'settlement' | 'revaluation'
  lines: JournalProposalLine[]
  exchangeGainLoss?: number
  confidence: number
  reasoning: string
  requiresReview: boolean
  createdAt: Date
}

export interface JournalProposalLine {
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description?: string
}

export interface ExchangeRateFetchResult {
  success: boolean
  source: ExchangeRateSource
  rateDate: Date
  recordsCount: number
  errorMessage?: string
  durationMs: number
}

export interface AlertConfig {
  slackEnabled: boolean
  slackWebhookUrl?: string
  slackChannel?: string
  emailEnabled: boolean
  emailRecipients: string[]
}

export interface CurrencyConversion {
  originalAmount: number
  originalCurrency: Currency
  convertedAmount: number
  convertedCurrency: Currency
  exchangeRate: ExchangeRate
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

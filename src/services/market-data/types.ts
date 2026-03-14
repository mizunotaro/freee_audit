export type MarketDataProviderType = 'jquants' | 'edinet'

export interface MarketDataCredential {
  provider: MarketDataProviderType
  email?: string
  password?: string
  apiKey?: string
}

export interface StockQuote {
  ticker: string
  name: string
  exchange: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number | null
  per: number | null
  pbr: number | null
  dividendYield: number | null
  timestamp: Date
}

export interface FinancialStatement {
  ticker: string
  name: string
  fiscalYear: number
  period: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY'
  revenue: number
  operatingIncome: number
  netIncome: number
  totalAssets: number
  totalEquity: number
  totalDebt: number
  cashFlow: number
  eps: number
  bps: number
}

export interface CompanyInfo {
  ticker: string
  name: string
  nameEn: string | null
  industry: string
  sector: string | null
  exchange: string
  listedDate: Date | null
  employees: number | null
  description: string | null
}

export interface MarketDataFetchOptions {
  tickers?: string[]
  industry?: string
  limit?: number
}

export type MarketDataResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } }

export interface ProviderConfig {
  enabled: boolean
  priority: number
  timeout: number
  retries: number
}

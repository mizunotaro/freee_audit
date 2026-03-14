import type {
  MarketDataProviderType,
  MarketDataCredential,
  StockQuote,
  FinancialStatement,
  CompanyInfo,
  MarketDataFetchOptions,
  MarketDataResult,
  ProviderConfig,
} from './types'

export abstract class BaseMarketDataProvider {
  abstract readonly name: MarketDataProviderType
  protected config: ProviderConfig

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      enabled: true,
      priority: 10,
      timeout: 30000,
      retries: 3,
      ...config,
    }
  }

  abstract authenticate(credential: MarketDataCredential): Promise<MarketDataResult<void>>
  abstract testConnection(): Promise<MarketDataResult<boolean>>
  abstract getQuotes(options: MarketDataFetchOptions): Promise<MarketDataResult<StockQuote[]>>
  abstract getFinancials(ticker: string): Promise<MarketDataResult<FinancialStatement[]>>
  abstract getCompanyInfo(ticker: string): Promise<MarketDataResult<CompanyInfo>>
  abstract searchCompanies(query: string): Promise<MarketDataResult<CompanyInfo[]>>

  protected async fetchWithTimeout<T>(
    url: string,
    options: RequestInit = {},
    timeout = this.config.timeout
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries = this.config.retries
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  }
}

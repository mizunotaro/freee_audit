import type {
  MarketDataCredential,
  StockQuote,
  FinancialStatement,
  CompanyInfo,
  MarketDataFetchOptions,
  MarketDataResult,
} from '../types'
import { BaseMarketDataProvider } from '../base-provider'

const JQUANTS_API_BASE = 'https://api.jquants.com/v1'

interface JQuantsToken {
  accessToken: string
  expiresAt: Date
}

export class JQuantsProvider extends BaseMarketDataProvider {
  readonly name = 'jquants' as const
  private credential: MarketDataCredential | null = null
  private token: JQuantsToken | null = null

  async authenticate(credential: MarketDataCredential): Promise<MarketDataResult<void>> {
    this.credential = credential

    if (!credential.email || !credential.password) {
      return {
        success: false,
        error: {
          code: 'invalid_credential',
          message: 'J-Quants requires email and password',
        },
      }
    }

    try {
      const refreshTokenResponse = await this.fetchWithTimeout<{
        refreshToken: string
      }>(`${JQUANTS_API_BASE}/token/auth_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailaddress: credential.email,
          password: credential.password,
        }),
      })

      const idTokenResponse = await this.fetchWithTimeout<{ idToken: string }>(
        `${JQUANTS_API_BASE}/token/auth_refresh?refreshtoken=${refreshTokenResponse.refreshToken}`
      )

      this.token = {
        accessToken: idTokenResponse.idToken,
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
      }

      return { success: true, data: undefined }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'auth_failed',
          message: error instanceof Error ? error.message : 'Authentication failed',
        },
      }
    }
  }

  async testConnection(): Promise<MarketDataResult<boolean>> {
    if (!this.token || new Date() >= this.token.expiresAt) {
      if (!this.credential) {
        return {
          success: false,
          error: { code: 'not_authenticated', message: 'Not authenticated' },
        }
      }
      const authResult = await this.authenticate(this.credential)
      if (!authResult.success) return authResult as MarketDataResult<boolean>
    }

    try {
      await this.getQuotes({ limit: 1 })
      return { success: true, data: true }
    } catch {
      return { success: true, data: false }
    }
  }

  async getQuotes(options: MarketDataFetchOptions): Promise<MarketDataResult<StockQuote[]>> {
    try {
      await this.ensureToken()

      const params = new URLSearchParams()
      if (options.tickers?.length) {
        params.set('code', options.tickers.join(','))
      }
      if (options.industry) {
        params.set('sector33code', options.industry)
      }

      const url = `${JQUANTS_API_BASE}/prices/daily?${params.toString()}`
      const response = await this.fetchWithAuth<{ daily_quotes: JQuantsQuote[] }>(url)

      const quotes = (response.daily_quotes ?? []).slice(0, options.limit ?? 100).map(this.mapQuote)

      return { success: true, data: quotes }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'fetch_failed',
          message: error instanceof Error ? error.message : 'Failed to fetch quotes',
        },
      }
    }
  }

  async getFinancials(ticker: string): Promise<MarketDataResult<FinancialStatement[]>> {
    try {
      await this.ensureToken()

      const url = `${JQUANTS_API_BASE}/fins/statements?code=${ticker}`
      const response = await this.fetchWithAuth<{ statements: JQuantsFinancial[] }>(url)

      const financials = (response.statements ?? []).map(this.mapFinancial)

      return { success: true, data: financials }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'fetch_failed',
          message: error instanceof Error ? error.message : 'Failed to fetch financials',
        },
      }
    }
  }

  async getCompanyInfo(ticker: string): Promise<MarketDataResult<CompanyInfo>> {
    try {
      await this.ensureToken()

      const url = `${JQUANTS_API_BASE}/listed/info?code=${ticker}`
      const response = await this.fetchWithAuth<{ info: JQuantsCompany[] }>(url)

      const company = response.info?.[0]
      if (!company) {
        return {
          success: false,
          error: { code: 'not_found', message: 'Company not found' },
        }
      }

      return { success: true, data: this.mapCompany(company) }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'fetch_failed',
          message: error instanceof Error ? error.message : 'Failed to fetch company info',
        },
      }
    }
  }

  async searchCompanies(query: string): Promise<MarketDataResult<CompanyInfo[]>> {
    try {
      await this.ensureToken()

      const url = `${JQUANTS_API_BASE}/listed/info?keyword=${encodeURIComponent(query)}`
      const response = await this.fetchWithAuth<{ info: JQuantsCompany[] }>(url)

      const companies = (response.info ?? []).map(this.mapCompany)

      return { success: true, data: companies }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'search_failed',
          message: error instanceof Error ? error.message : 'Failed to search companies',
        },
      }
    }
  }

  private async ensureToken(): Promise<void> {
    if (!this.token || new Date() >= this.token.expiresAt) {
      if (!this.credential) {
        throw new Error('Not authenticated')
      }
      const result = await this.authenticate(this.credential)
      if (!result.success) {
        throw new Error(result.error.message)
      }
    }
  }

  private async fetchWithAuth<T>(url: string): Promise<T> {
    if (!this.token) {
      throw new Error('No token available')
    }

    return this.retryWithBackoff(() =>
      this.fetchWithTimeout<T>(url, {
        headers: {
          Authorization: `Bearer ${this.token!.accessToken}`,
        },
      })
    )
  }

  private mapQuote(q: JQuantsQuote): StockQuote {
    return {
      ticker: q.Code?.substring(0, 4) ?? '',
      name: q.CompanyName ?? '',
      exchange: 'JPX',
      price: parseFloat(q.Close ?? '0'),
      change: parseFloat(q.Close ?? '0') - parseFloat(q.Open ?? '0'),
      changePercent:
        parseFloat(q.Open ?? '0') > 0
          ? ((parseFloat(q.Close ?? '0') - parseFloat(q.Open ?? '0')) / parseFloat(q.Open ?? '1')) *
            100
          : 0,
      volume: parseInt(q.Volume ?? '0', 10),
      marketCap: null,
      per: null,
      pbr: null,
      dividendYield: null,
      timestamp: new Date(q.Date ?? new Date()),
    }
  }

  private mapFinancial(f: JQuantsFinancial): FinancialStatement {
    return {
      ticker: f.LocalCode?.substring(0, 4) ?? '',
      name: f.CompanyName ?? '',
      fiscalYear: parseInt(f.FiscalYear ?? '0', 10),
      period: this.mapPeriod(f.TypeOfCurrentPeriod),
      revenue: parseFloat(f.NetSales ?? '0'),
      operatingIncome: parseFloat(f.OperatingProfit ?? '0'),
      netIncome: parseFloat(f.Profit ?? '0'),
      totalAssets: parseFloat(f.TotalAssets ?? '0'),
      totalEquity: parseFloat(f.Equity ?? '0'),
      totalDebt: parseFloat(f.TotalLiabilities ?? '0'),
      cashFlow: parseFloat(f.CashFlowFromOperatingActivities ?? '0'),
      eps: parseFloat(f.EarningsPerShare ?? '0'),
      bps: parseFloat(f.BookValuePerShare ?? '0'),
    }
  }

  private mapPeriod(period?: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' {
    if (!period) return 'FY'
    if (period.includes('1Q')) return 'Q1'
    if (period.includes('2Q')) return 'Q2'
    if (period.includes('3Q')) return 'Q3'
    if (period.includes('FY') || period.includes('4Q')) return 'FY'
    return 'FY'
  }

  private mapCompany(c: JQuantsCompany): CompanyInfo {
    return {
      ticker: c.Code?.substring(0, 4) ?? '',
      name: c.CompanyName ?? '',
      nameEn: c.CompanyNameEnglish ?? null,
      industry: c.Sector33CodeName ?? '',
      sector: c.Sector17CodeName ?? null,
      exchange: c.MarketCodeName ?? 'JPX',
      listedDate: c.ListingDate ? new Date(c.ListingDate) : null,
      employees: null,
      description: null,
    }
  }
}

interface JQuantsQuote {
  Date?: string
  Code?: string
  CompanyName?: string
  Open?: string
  Close?: string
  Volume?: string
}

interface JQuantsFinancial {
  LocalCode?: string
  CompanyName?: string
  FiscalYear?: string
  TypeOfCurrentPeriod?: string
  NetSales?: string
  OperatingProfit?: string
  Profit?: string
  TotalAssets?: string
  Equity?: string
  TotalLiabilities?: string
  CashFlowFromOperatingActivities?: string
  EarningsPerShare?: string
  BookValuePerShare?: string
}

interface JQuantsCompany {
  Code?: string
  CompanyName?: string
  CompanyNameEnglish?: string
  Sector33CodeName?: string
  Sector17CodeName?: string
  MarketCodeName?: string
  ListingDate?: string
}

export function createJQuantsProvider(): JQuantsProvider {
  return new JQuantsProvider()
}

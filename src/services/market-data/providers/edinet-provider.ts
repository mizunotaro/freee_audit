import type {
  MarketDataCredential,
  StockQuote,
  FinancialStatement,
  CompanyInfo,
  MarketDataFetchOptions,
  MarketDataResult,
} from '../types'
import { BaseMarketDataProvider } from '../base-provider'

const EDINET_API_BASE = 'https://api.edinet-fsa.go.jp/api/v2'

export class EDINETProvider extends BaseMarketDataProvider {
  readonly name = 'edinet' as const
  private apiKey: string | null = null

  async authenticate(credential: MarketDataCredential): Promise<MarketDataResult<void>> {
    if (!credential.apiKey) {
      return {
        success: false,
        error: {
          code: 'invalid_credential',
          message: 'EDINET requires API key',
        },
      }
    }

    this.apiKey = credential.apiKey
    return { success: true, data: undefined }
  }

  async testConnection(): Promise<MarketDataResult<boolean>> {
    if (!this.apiKey) {
      return {
        success: false,
        error: { code: 'not_authenticated', message: 'Not authenticated' },
      }
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const url = `${EDINET_API_BASE}/documents.json?date=${today}&type=2&Subscription-Key=${this.apiKey}`
      await this.fetchWithTimeout<EDINETDocumentListResponse>(url)
      return { success: true, data: true }
    } catch {
      return { success: true, data: false }
    }
  }

  async getQuotes(_options: MarketDataFetchOptions): Promise<MarketDataResult<StockQuote[]>> {
    return {
      success: false,
      error: {
        code: 'not_supported',
        message: 'EDINET does not provide real-time stock quotes. Use J-Quants instead.',
      },
    }
  }

  async getFinancials(ticker: string): Promise<MarketDataResult<FinancialStatement[]>> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: { code: 'not_authenticated', message: 'Not authenticated' },
        }
      }

      const documents = await this.searchDocumentsByTicker(ticker)
      if (!documents.length) {
        return {
          success: false,
          error: { code: 'not_found', message: 'No documents found for ticker' },
        }
      }

      const financials: FinancialStatement[] = []
      for (const doc of documents.slice(0, 5)) {
        const docUrl = `${EDINET_API_BASE}/documents/${doc.docID}?type=5&Subscription-Key=${this.apiKey}`
        try {
          const data = await this.fetchWithTimeout<EDINETDocumentResponse>(docUrl)
          if (data) {
            financials.push(this.mapFinancialFromXBRL(ticker, doc, data))
          }
        } catch {
          continue
        }
      }

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
      if (!this.apiKey) {
        return {
          success: false,
          error: { code: 'not_authenticated', message: 'Not authenticated' },
        }
      }

      const documents = await this.searchDocumentsByTicker(ticker)
      if (!documents.length) {
        return {
          success: false,
          error: { code: 'not_found', message: 'Company not found' },
        }
      }

      const doc = documents[0]
      return {
        success: true,
        data: {
          ticker,
          name: doc.filerName ?? '',
          nameEn: null,
          industry: '',
          sector: null,
          exchange: 'JPX',
          listedDate: null,
          employees: null,
          description: null,
        },
      }
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
      if (!this.apiKey) {
        return {
          success: false,
          error: { code: 'not_authenticated', message: 'Not authenticated' },
        }
      }

      const documents = await this.searchDocuments(query)
      const companies = documents.slice(0, 20).map((doc) => ({
        ticker: doc.edinetCode?.substring(0, 4) ?? '',
        name: doc.filerName ?? '',
        nameEn: null,
        industry: '',
        sector: null,
        exchange: 'JPX',
        listedDate: null,
        employees: null,
        description: null,
      }))

      const uniqueCompanies = companies.filter(
        (c, i, arr) => arr.findIndex((x) => x.ticker === c.ticker) === i
      )

      return { success: true, data: uniqueCompanies }
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

  private async searchDocuments(query: string): Promise<EDINETDocument[]> {
    const results: EDINETDocument[] = []
    const today = new Date()

    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      try {
        const url = `${EDINET_API_BASE}/documents.json?date=${dateStr}&type=2&Subscription-Key=${this.apiKey}`
        const response = await this.fetchWithTimeout<EDINETDocumentListResponse>(url)

        if (response.results?.length) {
          const matches = response.results.filter(
            (r) =>
              r.filerName?.includes(query) ||
              r.edinetCode?.includes(query) ||
              r.docDescription?.includes(query)
          )
          results.push(...matches)
        }
      } catch {
        continue
      }

      if (results.length >= 20) break
    }

    return results
  }

  private async searchDocumentsByTicker(ticker: string): Promise<EDINETDocument[]> {
    const results: EDINETDocument[] = []
    const today = new Date()

    for (let i = 0; i < 365; i += 30) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      try {
        const url = `${EDINET_API_BASE}/documents.json?date=${dateStr}&type=2&Subscription-Key=${this.apiKey}`
        const response = await this.fetchWithTimeout<EDINETDocumentListResponse>(url)

        if (response.results?.length) {
          const matches = response.results.filter(
            (r) =>
              r.edinetCode?.startsWith(ticker) ||
              r.secCode?.startsWith(ticker) ||
              r.filerName?.includes(ticker)
          )
          results.push(...matches)
        }
      } catch {
        continue
      }

      if (results.length >= 5) break
    }

    return results
  }

  private mapFinancialFromXBRL(
    ticker: string,
    doc: EDINETDocument,
    _data: EDINETDocumentResponse
  ): FinancialStatement {
    return {
      ticker,
      name: doc.filerName ?? '',
      fiscalYear: new Date(doc.submitDateTime ?? '').getFullYear(),
      period: 'FY',
      revenue: 0,
      operatingIncome: 0,
      netIncome: 0,
      totalAssets: 0,
      totalEquity: 0,
      totalDebt: 0,
      cashFlow: 0,
      eps: 0,
      bps: 0,
    }
  }
}

interface EDINETDocumentListResponse {
  metadata?: {
    status: string
    message: string
  }
  results?: EDINETDocument[]
}

interface EDINETDocument {
  docID?: string
  edinetCode?: string
  secCode?: string
  filerName?: string
  docDescription?: string
  docTypeCode?: string
  submitDateTime?: string
}

interface EDINETDocumentResponse {
  [key: string]: unknown
}

export function createEDINETProvider(): EDINETProvider {
  return new EDINETProvider()
}

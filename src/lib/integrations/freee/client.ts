import type {
  FreeeClientConfig,
  FreeeTokenResponse,
  FreeeReceiptsResponse,
  FreeeReceiptParams,
  FreeeTrialBalanceResponse,
  FreeeTrialBalanceParams,
  FreeeAccountItemsResponse,
  FreeeError,
  FreeeConnectionStatus,
  FreeeJournal,
  FreeeDocument,
  FreeeCompany,
  FreeePaginatedResponse,
} from './types'
import { FreeeApiError } from './types'
import { freeeRateLimiter, freeeCircuitBreaker, withRetry } from './rate-limiter'
import { getToken, saveToken, deleteToken, isTokenExpired } from './token-store'

const FREEE_API_BASE_URL = 'https://api.freee.co.jp'
const FREEE_AUTH_URL = 'https://accounts.secure.freee.co.jp/public_api/authorize'
const FREEE_TOKEN_URL = 'https://accounts.secure.freee.co.jp/public_api/token'

function isMockMode(): boolean {
  return (
    process.env.FREEE_MOCK_MODE === 'true' ||
    !process.env.FREEE_CLIENT_ID ||
    !process.env.FREEE_CLIENT_SECRET
  )
}

export class FreeeClient {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private companyId?: string
  private accessToken?: string

  constructor(config?: Partial<FreeeClientConfig> & { accessToken?: string }, companyId?: string) {
    this.clientId = config?.clientId || process.env.FREEE_CLIENT_ID || ''
    this.clientSecret = config?.clientSecret || process.env.FREEE_CLIENT_SECRET || ''
    this.redirectUri =
      config?.redirectUri ||
      process.env.FREEE_REDIRECT_URI ||
      'http://localhost:3000/api/freee/callback'
    this.companyId = companyId
    this.accessToken = config?.accessToken
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'read write',
    })

    if (state) {
      params.append('state', state)
    }

    return `${FREEE_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(code: string): Promise<FreeeTokenResponse> {
    if (isMockMode()) {
      return this.getMockTokenResponse()
    }

    const response = await fetch(FREEE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }).toString(),
    })

    if (!response.ok) {
      const error = (await response.json()) as FreeeError
      throw new FreeeApiError(error)
    }

    return response.json()
  }

  async refreshToken(refreshToken: string): Promise<FreeeTokenResponse> {
    if (isMockMode()) {
      return this.getMockTokenResponse()
    }

    const response = await fetch(FREEE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    })

    if (!response.ok) {
      const error = (await response.json()) as FreeeError
      throw new FreeeApiError(error)
    }

    return response.json()
  }

  private async getValidAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken
    }

    if (!this.companyId) {
      throw new Error('Company ID is required')
    }

    if (isMockMode()) {
      return 'mock_access_token'
    }

    const token = await getToken(this.companyId)
    if (!token) {
      throw new Error('No token found. Please authenticate first.')
    }

    if (await isTokenExpired(this.companyId)) {
      const newTokenResponse = await this.refreshToken(token.refreshToken)
      await saveToken(this.companyId, newTokenResponse)
      return newTokenResponse.access_token
    }

    return token.accessToken
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      params?: Record<string, string | number | undefined>
      body?: Record<string, unknown>
      rateLimitType?: string
    }
  ): Promise<T> {
    if (isMockMode()) {
      return this.getMockResponse<T>(endpoint, options?.params)
    }

    await freeeRateLimiter.waitForToken(options?.rateLimitType || 'data')

    return freeeCircuitBreaker.execute(async () => {
      return withRetry(async () => {
        const accessToken = await this.getValidAccessToken()

        const url = new URL(`${FREEE_API_BASE_URL}${endpoint}`)
        if (options?.params) {
          Object.entries(options.params).forEach(([key, value]) => {
            if (value !== undefined) {
              url.searchParams.append(key, String(value))
            }
          })
        }

        const response = await fetch(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        })

        if (!response.ok) {
          const error = (await response.json()) as FreeeError
          throw new FreeeApiError(error)
        }

        return response.json()
      })
    })
  }

  async getCompanies(): Promise<FreeeCompany[]> {
    if (isMockMode()) {
      return this.getMockResponse<FreeeCompany[]>('/api/1/companies')
    }
    const response = await this.request<{ companies: FreeeCompany[] }>('GET', '/api/1/companies', {
      rateLimitType: 'data',
    })
    return response.companies
  }

  async getJournals(
    companyId: number,
    startDate?: string,
    endDate?: string,
    limit = 100,
    offset = 0
  ): Promise<FreeePaginatedResponse<FreeeJournal>> {
    if (isMockMode()) {
      return this.getMockResponse<FreeePaginatedResponse<FreeeJournal>>('/api/1/journals', {
        company_id: companyId,
        start_issue_date: startDate,
        end_issue_date: endDate,
        limit,
        offset,
      })
    }

    const response = await this.request<{
      journals: FreeeJournal[]
      meta: { total_count: number; limit: number; offset: number }
    }>('GET', '/api/1/journals', {
      params: {
        company_id: companyId,
        start_issue_date: startDate,
        end_issue_date: endDate,
        limit,
        offset,
      },
      rateLimitType: 'data',
    })

    return {
      data: response.journals,
      meta: response.meta,
    }
  }

  async getDocuments(
    companyId: number,
    startDate?: string,
    endDate?: string,
    limit = 100,
    offset = 0
  ): Promise<FreeePaginatedResponse<FreeeDocument>> {
    if (isMockMode()) {
      return this.getMockResponse<FreeePaginatedResponse<FreeeDocument>>('/api/1/documents', {
        company_id: companyId,
        start_issue_date: startDate,
        end_issue_date: endDate,
        limit,
        offset,
      })
    }

    const response = await this.request<{
      documents: FreeeDocument[]
      meta: { total_count: number; limit: number; offset: number }
    }>('GET', '/api/1/documents', {
      params: {
        company_id: companyId,
        start_issue_date: startDate,
        end_issue_date: endDate,
        limit,
        offset,
      },
      rateLimitType: 'data',
    })

    return {
      data: response.documents,
      meta: response.meta,
    }
  }

  async downloadDocument(
    companyId: number,
    documentId: number
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (isMockMode()) {
      return {
        buffer: Buffer.from('mock document content'),
        contentType: 'application/pdf',
      }
    }

    const accessToken = await this.getValidAccessToken()
    const response = await fetch(
      `${FREEE_API_BASE_URL}/api/1/documents/${documentId}/download?company_id=${companyId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    }
  }

  async getReceipts(params: FreeeReceiptParams): Promise<FreeeReceiptsResponse> {
    return this.request<FreeeReceiptsResponse>('GET', '/api/1/receipts', {
      params: {
        company_id: params.company_id,
        start_issue_date: params.start_issue_date,
        end_issue_date: params.end_issue_date,
        partner_id: params.partner_id,
        offset: params.offset,
        limit: params.limit,
      },
      rateLimitType: 'data',
    })
  }

  async getTrialBalance(params: FreeeTrialBalanceParams): Promise<FreeeTrialBalanceResponse> {
    return this.request<FreeeTrialBalanceResponse>('GET', '/api/1/reports/trial_balance', {
      params: {
        company_id: params.company_id,
        fiscal_year: params.fiscal_year,
        start_month: params.start_month,
        end_month: params.end_month,
        start_date: params.start_date,
        end_date: params.end_date,
        breakdown_display_type: params.breakdown_display_type,
      },
      rateLimitType: 'report',
    })
  }

  async getAccountItems(companyId: number): Promise<FreeeAccountItemsResponse> {
    return this.request<FreeeAccountItemsResponse>('GET', '/api/1/account_items', {
      params: {
        company_id: companyId,
      },
      rateLimitType: 'data',
    })
  }

  async getConnectionStatus(companyId: string): Promise<FreeeConnectionStatus> {
    if (isMockMode()) {
      return {
        connected: true,
        companyId: 123456,
        companyName: 'サンプル株式会社',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        lastSyncAt: new Date(),
      }
    }

    const token = await getToken(companyId)
    if (!token) {
      return { connected: false }
    }

    const expired = await isTokenExpired(companyId)
    if (expired) {
      return { connected: false }
    }

    try {
      const companies = await this.getCompanies()
      const company = companies[0]

      return {
        connected: true,
        companyId: company?.id,
        companyName: company?.display_name,
        expiresAt: token.expiresAt,
        lastSyncAt: new Date(),
      }
    } catch {
      return { connected: false }
    }
  }

  async disconnect(companyId: string): Promise<void> {
    await deleteToken(companyId)
  }

  private getMockTokenResponse(): FreeeTokenResponse {
    return {
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'read write',
    }
  }

  private getMockResponse<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>
  ): T {
    if (endpoint.includes('/companies')) {
      return [
        {
          id: 123456,
          name: 'サンプル株式会社',
          name_kana: 'サンプルカブシキガイシャ',
          display_name: 'サンプル株式会社',
        },
      ] as T
    }

    if (endpoint.includes('/journals')) {
      return {
        data: [
          {
            id: 1001,
            issue_date: '2024-01-15',
            description: '売上計上',
            details: [
              {
                id: 10011,
                account_item_id: 101,
                account_item_name: '現金',
                amount: 110000,
                vat: 10000,
                vat_name: '消費税10%',
                entry_side: 'debit',
                description: '売上代金',
              },
              {
                id: 10012,
                account_item_id: 401,
                account_item_name: '売上高',
                amount: 100000,
                vat: null,
                vat_name: null,
                entry_side: 'credit',
                description: '売上計上',
              },
            ],
          },
        ],
        meta: {
          total_count: 1,
          limit: params?.limit || 100,
          offset: params?.offset || 0,
        },
      } as T
    }

    if (endpoint.includes('/documents') || endpoint.includes('/receipts')) {
      return {
        data: [
          {
            id: 2001,
            name: '請求書_001.pdf',
            description: '取引先Aへの請求書',
            issue_date: '2024-01-10',
            file: {
              id: 20011,
              name: '請求書_001.pdf',
              content_type: 'application/pdf',
              size: 102400,
            },
          },
        ],
        meta: {
          total_count: 1,
          limit: params?.limit || 100,
          offset: params?.offset || 0,
        },
      } as T
    }

    if (endpoint.includes('/trial_balance')) {
      return {
        trial_balance: {
          company_id: params?.company_id || 123456,
          fiscal_year: 2024,
          start_month: 1,
          end_month: 1,
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          account_items: [
            {
              account_item_id: 101,
              account_item_name: '現金',
              hierarchy_level: 2,
              opening_balance: 1000000,
              closing_balance: 1100000,
            },
            {
              account_item_id: 102,
              account_item_name: '普通預金',
              hierarchy_level: 2,
              opening_balance: 5000000,
              closing_balance: 5500000,
            },
            {
              account_item_id: 401,
              account_item_name: '売上高',
              hierarchy_level: 2,
              opening_balance: 0,
              closing_balance: 1000000,
            },
          ],
        },
      } as T
    }

    if (endpoint.includes('/account_items')) {
      return {
        account_items: [
          {
            id: 101,
            name: '現金',
            shortcut: 'genkin',
            shortcut_num: '100',
            account_category_id: 1,
            account_category_name: '流動資産',
            searchable: true,
          },
          {
            id: 102,
            name: '普通預金',
            shortcut: 'yokin',
            shortcut_num: '101',
            account_category_id: 1,
            account_category_name: '流動資産',
            searchable: true,
          },
          {
            id: 401,
            name: '売上高',
            shortcut: 'uriage',
            shortcut_num: '400',
            account_category_id: 10,
            account_category_name: '売上高',
            searchable: true,
          },
        ],
      } as T
    }

    return {} as T
  }
}

export function createFreeeClient(accessToken?: string, companyId?: string): FreeeClient {
  return new FreeeClient({ accessToken }, companyId)
}

export const freeeClient = new FreeeClient()

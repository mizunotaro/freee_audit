import type { JournalEntry, ApiResponse } from '@/types'

export interface FreeeConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  mockMode: boolean
}

export interface FreeeToken {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface FreeeJournal {
  id: number
  issue_date: string
  description: string
  details: Array<{
    account_item_id: number
    account_item_name: string
    amount: number
    vat_id?: number
    vat_name?: string
  }>
}

const DEFAULT_CONFIG: FreeeConfig = {
  clientId: process.env.FREEE_CLIENT_ID || '',
  clientSecret: process.env.FREEE_CLIENT_SECRET || '',
  redirectUri: process.env.FREEE_REDIRECT_URI || '',
  mockMode: process.env.FREEE_MOCK_MODE === 'true',
}

export class FreeeClient {
  private config: FreeeConfig
  private token: FreeeToken | null = null

  constructor(config: Partial<FreeeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  setToken(token: FreeeToken): void {
    this.token = token
  }

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'read write',
    })
    return `https://secure.freee.co.jp/oauth/authorize?${params.toString()}`
  }

  async exchangeCodeForToken(code: string): Promise<FreeeToken> {
    if (this.config.mockMode) {
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      }
    }

    const response = await fetch('https://api.freee.co.jp/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  }

  async getJournals(
    companyId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ApiResponse<JournalEntry[]>> {
    if (this.config.mockMode) {
      return {
        data: generateMockJournals(startDate, endDate),
      }
    }

    if (!this.token) {
      return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }
    }

    const params = new URLSearchParams({
      company_id: companyId.toString(),
      start_issue_date: startDate.toISOString().split('T')[0],
      end_issue_date: endDate.toISOString().split('T')[0],
    })

    const response = await fetch(`https://api.freee.co.jp/api/1/journals?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${this.token.accessToken}`,
      },
    })

    if (!response.ok) {
      return { error: { code: 'API_ERROR', message: `API error: ${response.status}` } }
    }

    const data = await response.json()
    const journals = mapFreeeJournals(data.journals || [])

    return { data: journals }
  }

  async getBalanceSheet(_companyId: number, _asOfDate: Date): Promise<ApiResponse<unknown>> {
    if (this.config.mockMode) {
      return { data: generateMockBalanceSheet() }
    }

    return { error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented' } }
  }

  async getProfitLoss(
    _companyId: number,
    _startDate: Date,
    _endDate: Date
  ): Promise<ApiResponse<unknown>> {
    if (this.config.mockMode) {
      return { data: generateMockProfitLoss() }
    }

    return { error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented' } }
  }
}

function generateMockJournals(startDate: Date, endDate: Date): JournalEntry[] {
  const journals: JournalEntry[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    journals.push({
      id: `mock-${currentDate.getTime()}`,
      entryDate: new Date(currentDate),
      description: '売上計上',
      debitAccount: '普通預金',
      creditAccount: '売上高',
      amount: 100000,
      taxAmount: 10000,
      taxType: 'TAXABLE_10',
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return journals.slice(0, 10)
}

function generateMockBalanceSheet(): unknown {
  return {
    assets: {
      current: [
        { accountCode: '100', accountName: '現金', amount: 500000 },
        { accountCode: '101', accountName: '普通預金', amount: 10000000 },
      ],
      fixed: [],
    },
    liabilities: {
      current: [{ accountCode: '200', accountName: '買掛金', amount: 2000000 }],
      fixed: [],
    },
    equity: {
      items: [{ accountCode: '300', accountName: '資本金', amount: 5000000 }],
    },
  }
}

function generateMockProfitLoss(): unknown {
  return {
    revenue: [{ accountCode: '400', accountName: '売上高', amount: 50000000 }],
    costOfSales: [{ accountCode: '500', accountName: '売上原価', amount: 20000000 }],
    operatingExpenses: [{ accountCode: '600', accountName: '給与手当', amount: 15000000 }],
  }
}

function mapFreeeJournals(freeeJournals: FreeeJournal[]): JournalEntry[] {
  return freeeJournals.map((j) => {
    const details = j.details || []
    const debit = details.find((d) => d.amount > 0) || details[0]
    const credit = details.find((d) => d !== debit) || details[1]

    return {
      id: j.id.toString(),
      entryDate: new Date(j.issue_date),
      description: j.description,
      debitAccount: debit?.account_item_name || '',
      creditAccount: credit?.account_item_name || '',
      amount: Math.abs(debit?.amount || 0),
      taxAmount: 0,
      taxType: debit?.vat_name,
    }
  })
}

export const freeeClient = new FreeeClient()

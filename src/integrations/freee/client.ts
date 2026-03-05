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

export interface FreeeAccountItem {
  id: number
  name: string
  shortcut: string
  shortcut_num: string
  account_category_id: number
  account_category_name: string
  account_category: string
  corresponding_income_id: number | null
  corresponding_income_name: string | null
  corresponding_expense_id: number | null
  corresponding_expense_name: string | null
  searchable: boolean
  wallettx_account_name: string | null
  account_category_balance: string
  cumulable: boolean
  partner_id: number | null
  walletable_id: number | null
}

export interface FreeeDeal {
  id: number
  company_id: number
  issue_date: string
  due_date: string | null
  partner_id: number | null
  partner: {
    id: number
    name: string
    shortcut: string
  } | null
  details: Array<{
    account_item_id: number
    account_item_name: string
    amount: number
    description: string
    vat_id: number | null
    vat_name: string | null
  }>
  payments: Array<{
    date: string
    from_walletable_id: number
    from_walletable_name: string
    amount: number
  }>
  amount: number
  due_amount: number
  status: string
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

  async getAccountItems(companyId: number): Promise<ApiResponse<FreeeAccountItem[]>> {
    if (this.config.mockMode) {
      return { data: generateMockAccountItems() }
    }

    if (!this.token) {
      return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }
    }

    const params = new URLSearchParams({
      company_id: companyId.toString(),
    })

    const response = await fetch(
      `https://api.freee.co.jp/api/1/account_items?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.token.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      return { error: { code: 'API_ERROR', message: `API error: ${response.status}` } }
    }

    const data = await response.json()
    return { data: data.account_items || [] }
  }

  async getDeals(
    companyId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ApiResponse<FreeeDeal[]>> {
    if (this.config.mockMode) {
      return { data: generateMockDeals() }
    }

    if (!this.token) {
      return { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }
    }

    const params = new URLSearchParams({
      company_id: companyId.toString(),
      start_issue_date: startDate.toISOString().split('T')[0],
      end_issue_date: endDate.toISOString().split('T')[0],
      status: 'unsettled',
    })

    const response = await fetch(`https://api.freee.co.jp/api/1/deals?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${this.token.accessToken}`,
      },
    })

    if (!response.ok) {
      return { error: { code: 'API_ERROR', message: `API error: ${response.status}` } }
    }

    const data = await response.json()
    return { data: data.deals || [] }
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

function generateMockAccountItems(): FreeeAccountItem[] {
  return [
    {
      id: 100,
      name: '現金',
      shortcut: '100',
      shortcut_num: '100',
      account_category_id: 1,
      account_category_name: '流動資産',
      account_category: 'current_assets',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: '現金',
      account_category_balance: 'debit',
      cumulable: false,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 101,
      name: '普通預金',
      shortcut: '101',
      shortcut_num: '101',
      account_category_id: 1,
      account_category_name: '流動資産',
      account_category: 'current_assets',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: '普通預金',
      account_category_balance: 'debit',
      cumulable: false,
      partner_id: null,
      walletable_id: 1,
    },
    {
      id: 102,
      name: '売掛金',
      shortcut: '102',
      shortcut_num: '102',
      account_category_id: 1,
      account_category_name: '流動資産',
      account_category: 'current_assets',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: false,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 200,
      name: '買掛金',
      shortcut: '200',
      shortcut_num: '200',
      account_category_id: 5,
      account_category_name: '流動負債',
      account_category: 'current_liabilities',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'credit',
      cumulable: false,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 300,
      name: '資本金',
      shortcut: '300',
      shortcut_num: '300',
      account_category_id: 9,
      account_category_name: '純資産',
      account_category: 'net_assets',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'credit',
      cumulable: false,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 400,
      name: '売上高',
      shortcut: '400',
      shortcut_num: '400',
      account_category_id: 10,
      account_category_name: '売上',
      account_category: 'sales',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: 200,
      corresponding_expense_name: '買掛金',
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'credit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 500,
      name: '売上原価',
      shortcut: '500',
      shortcut_num: '500',
      account_category_id: 11,
      account_category_name: '売上原価',
      account_category: 'cost_of_sales',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 600,
      name: '給与手当',
      shortcut: '600',
      shortcut_num: '600',
      account_category_id: 12,
      account_category_name: '販管費',
      account_category: 'sga_expenses',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 610,
      name: '福利厚生費',
      shortcut: '610',
      shortcut_num: '610',
      account_category_id: 12,
      account_category_name: '販管費',
      account_category: 'sga_expenses',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 620,
      name: '旅費交通費',
      shortcut: '620',
      shortcut_num: '620',
      account_category_id: 12,
      account_category_name: '販管費',
      account_category: 'sga_expenses',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 630,
      name: '通信費',
      shortcut: '630',
      shortcut_num: '630',
      account_category_id: 12,
      account_category_name: '販管費',
      account_category: 'sga_expenses',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 640,
      name: '地代家賃',
      shortcut: '640',
      shortcut_num: '640',
      account_category_id: 12,
      account_category_name: '販管費',
      account_category: 'sga_expenses',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
    {
      id: 650,
      name: '減価償却費',
      shortcut: '650',
      shortcut_num: '650',
      account_category_id: 12,
      account_category_name: '販管費',
      account_category: 'sga_expenses',
      corresponding_income_id: null,
      corresponding_income_name: null,
      corresponding_expense_id: null,
      corresponding_expense_name: null,
      searchable: true,
      wallettx_account_name: null,
      account_category_balance: 'debit',
      cumulable: true,
      partner_id: null,
      walletable_id: null,
    },
  ]
}

function generateMockDeals(): FreeeDeal[] {
  const today = new Date()
  const futureDates = [30, 60, 90, 120, 180]

  return futureDates.map((days, index) => {
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + days)

    return {
      id: 1000 + index,
      company_id: 1,
      issue_date: today.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      partner_id: 100 + index,
      partner: {
        id: 100 + index,
        name: `取引先${index + 1}`,
        shortcut: `T${100 + index}`,
      },
      details: [
        {
          account_item_id: 200,
          account_item_name: '買掛金',
          amount: 500000 * (index + 1),
          description: `商品仕入_${index + 1}`,
          vat_id: 1,
          vat_name: '課税10%',
        },
      ],
      payments: [],
      amount: 500000 * (index + 1),
      due_amount: 500000 * (index + 1),
      status: 'unsettled',
    }
  })
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

export interface FreeeToken {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  tokenType: string
  scope?: string
}

export interface FreeeTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
  created_at?: number
}

export interface FreeeCompany {
  id: number
  name: string
  name_kana?: string
  display_name: string
  fiscal_years?: FreeeFiscalYear[]
}

export interface FreeeFiscalYear {
  fiscal_year: number
  start_date: string
  end_date: string
  closing_status: string
}

export interface FreeeCompaniesResponse {
  companies: FreeeCompany[]
}

export interface FreeeJournalEntry {
  id: number
  issue_date: string
  side: 'debit' | 'credit'
  amount: number
  account_item_id: number
  account_item_name: string
  partner_id?: number
  partner_name?: string
  description?: string
  tag_ids?: number[]
  segment_ids?: number[]
  walletable_id?: number
  walletable_name?: string
  tag_names?: string[]
}

export interface FreeeJournal {
  id: number
  issue_date: string
  entry_side: 'debit' | 'credit'
  amount: number
  account_item_id: number
  account_item_name: string
  partner_id?: number
  partner_name?: string
  description?: string
  tag_ids?: number[]
  segment_ids?: number[]
  walletable_id?: number
  walletable_name?: string
  details?: FreeeJournalDetail[]
}

export interface FreeeJournalDetail {
  id: number
  account_item_id: number
  account_item_name: string
  amount: number
  vat: number | null
  vat_name: string | null
  entry_side: 'debit' | 'credit'
  description: string
}

export interface FreeeDocument {
  id: number
  name: string
  description: string
  issue_date: string
  file: {
    id: number
    name: string
    content_type: string
    size: number
  }
}

export interface FreeePaginatedResponse<T> {
  data: T[]
  meta: {
    total_count: number
    limit: number
    offset: number
  }
}

export interface FreeeJournalsResponse {
  journals: FreeeJournal[]
  meta: {
    total_count: number
    limit: number
    offset: number
  }
}

export interface FreeeJournalParams {
  company_id: number
  start_issue_date?: string
  end_issue_date?: string
  start_create_date?: string
  end_create_date?: string
  offset?: number
  limit?: number
}

export interface FreeeReceipt {
  id: number
  status: string
  description?: string
  receipt_metadatas?: FreeeReceiptMetadata[]
  issue_date?: string
  amount?: number
  partner_name?: string
  mime_type?: string
}

export interface FreeeReceiptMetadata {
  id: number
  receipt_id: number
  mime_type: string
  user_id?: number
  created_at: string
}

export interface FreeeReceiptsResponse {
  receipts: FreeeReceipt[]
  meta: {
    total_count: number
    limit: number
    offset: number
  }
}

export interface FreeeReceiptParams {
  company_id: number
  start_issue_date?: string
  end_issue_date?: string
  partner_id?: number
  offset?: number
  limit?: number
}

export interface FreeeTrialBalanceItem {
  account_item_id: number
  account_item_name: string
  hierarchy_level: number
  parent_id?: number
  opening_balance: number
  closing_balance: number
  closing_dr_balance?: number
  closing_cr_balance?: number
  children?: FreeeTrialBalanceItem[]
}

export interface FreeeTrialBalanceResponse {
  trial_balance: {
    company_id: number
    fiscal_year: number
    start_month: number
    end_month: number
    start_date: string
    end_date: string
    account_items: FreeeTrialBalanceItem[]
  }
}

export interface FreeeTrialBalanceParams {
  company_id: number
  fiscal_year?: number
  start_month?: number
  end_month?: number
  start_date?: string
  end_date?: string
  breakdown_display_type?: 'account_item' | 'partner'
}

export interface FreeeAccountItem {
  id: number
  name: string
  shortcut: string
  shortcut_num: string
  account_category_id: number
  account_category_name: string
  default_tax_id?: number
  default_tax_code?: string
  searchable: boolean
  categories?: FreeeAccountCategory[]
  walletable_id?: number
}

export interface FreeeAccountCategory {
  id: number
  name: string
  account_category: string
}

export interface FreeeAccountItemsResponse {
  account_items: FreeeAccountItem[]
}

export interface FreeeError {
  code: string
  message: string
  status: number
  errors?: Record<string, string[]>
}

export class FreeeApiError extends Error {
  code: string
  status: number
  errors?: Record<string, string[]>

  constructor(error: FreeeError) {
    super(error.message)
    this.name = 'FreeeApiError'
    this.code = error.code
    this.status = error.status
    this.errors = error.errors
  }
}

export interface FreeeClientConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export interface FreeeConnectionStatus {
  connected: boolean
  companyId?: number
  companyName?: string
  expiresAt?: Date
  lastSyncAt?: Date
}

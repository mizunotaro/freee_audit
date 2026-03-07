import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FreeeClient, createFreeeClient, freeeClient } from '@/lib/integrations/freee/client'
import { FreeeApiError } from '@/lib/integrations/freee/types'
import { fetchWithTimeout } from '@/lib/utils/timeout'

vi.mock('@/lib/utils/timeout', () => ({
  fetchWithTimeout: vi.fn(),
  API_TIMEOUTS: {
    FREEE_API: 30000,
    AI_API: 60000,
    SLACK_API: 10000,
    BOX_API: 60000,
    BOX_UPLOAD: 300000,
  },
}))

vi.mock('@/lib/integrations/freee/token-store', () => ({
  getToken: vi.fn(),
  saveToken: vi.fn(),
  deleteToken: vi.fn(),
  isTokenExpired: vi.fn(),
}))

vi.mock('@/lib/integrations/freee/rate-limiter', () => ({
  freeeRateLimiter: {
    waitForToken: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
  },
  freeeCircuitBreaker: {
    execute: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
    reset: vi.fn(),
    getState: vi.fn().mockReturnValue('CLOSED'),
  },
  withRetry: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
}))

const mockFetchWithTimeout = vi.mocked(fetchWithTimeout)

describe('FreeeClient', () => {
  let client: FreeeClient

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FREEE_MOCK_MODE = 'true'
    client = new FreeeClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.FREEE_MOCK_MODE
    delete process.env.FREEE_CLIENT_ID
    delete process.env.FREEE_CLIENT_SECRET
    delete process.env.FREEE_REDIRECT_URI
  })

  describe('constructor', () => {
    it('should create client with default config', () => {
      const defaultClient = new FreeeClient()
      expect(defaultClient).toBeInstanceOf(FreeeClient)
    })

    it('should create client with custom config', () => {
      const customClient = new FreeeClient({
        clientId: 'custom_id',
        clientSecret: 'custom_secret',
        redirectUri: 'https://custom.callback',
      })
      expect(customClient).toBeInstanceOf(FreeeClient)
    })

    it('should create client with access token', () => {
      const clientWithToken = new FreeeClient({ accessToken: 'test_token' })
      expect(clientWithToken).toBeInstanceOf(FreeeClient)
    })

    it('should create client with company ID', () => {
      const clientWithCompany = new FreeeClient({}, 'company_123')
      expect(clientWithCompany).toBeInstanceOf(FreeeClient)
    })

    it('should use environment variables for config', () => {
      process.env.FREEE_CLIENT_ID = 'env_client_id'
      process.env.FREEE_CLIENT_SECRET = 'env_secret'
      process.env.FREEE_REDIRECT_URI = 'https://env.callback'

      const envClient = new FreeeClient()
      expect(envClient).toBeInstanceOf(FreeeClient)
    })
  })

  describe('getAuthorizationUrl', () => {
    it('should generate correct OAuth URL', () => {
      const url = client.getAuthorizationUrl('test-state')

      expect(url).toContain('accounts.secure.freee.co.jp/public_api/authorize')
      expect(url).toContain('client_id=')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('response_type=code')
      expect(url).toContain('scope=read+write')
      expect(url).toContain('state=test-state')
    })

    it('should generate URL without state parameter', () => {
      const url = client.getAuthorizationUrl()

      expect(url).toContain('accounts.secure.freee.co.jp/public_api/authorize')
      expect(url).not.toContain('state=')
    })

    it('should encode redirect URI properly', () => {
      const customClient = new FreeeClient({
        redirectUri: 'https://example.com/callback?param=value',
      })
      const url = customClient.getAuthorizationUrl()

      expect(url).toContain('redirect_uri=')
    })
  })

  describe('exchangeCodeForToken', () => {
    it('should return mock token in mock mode', async () => {
      const token = await client.exchangeCodeForToken('auth_code')

      expect(token.access_token).toContain('mock_access_token')
      expect(token.refresh_token).toContain('mock_refresh_token')
      expect(token.expires_in).toBe(3600)
      expect(token.token_type).toBe('Bearer')
    })
  })

  describe('refreshToken', () => {
    it('should return mock token in mock mode', async () => {
      const token = await client.refreshToken('old_refresh_token')

      expect(token.access_token).toContain('mock_access_token')
      expect(token.refresh_token).toContain('mock_refresh_token')
    })
  })

  describe('getCompanies', () => {
    it('should return mock companies in mock mode', async () => {
      const companies = await client.getCompanies()

      expect(companies).toHaveLength(1)
      expect(companies[0].id).toBe(123456)
      expect(companies[0].name).toBe('サンプル株式会社')
      expect(companies[0].display_name).toBe('サンプル株式会社')
    })
  })

  describe('getJournals', () => {
    it('should return mock journals in mock mode', async () => {
      const result = await client.getJournals(123456, '2024-01-01', '2024-01-31')

      expect(result.data).toHaveLength(1)
      expect(result.meta.total_count).toBe(1)
      expect(result.data[0].issue_date).toBe('2024-01-15')
    })

    it('should accept pagination parameters', async () => {
      const result = await client.getJournals(123456, '2024-01-01', '2024-01-31', 50, 10)

      expect(result.meta.limit).toBe(50)
      expect(result.meta.offset).toBe(10)
    })

    it('should use default pagination values', async () => {
      const result = await client.getJournals(123456)

      expect(result.meta.limit).toBe(100)
      expect(result.meta.offset).toBe(0)
    })
  })

  describe('getDocuments', () => {
    it('should return mock documents in mock mode', async () => {
      const result = await client.getDocuments(123456, '2024-01-01', '2024-01-31')

      expect(result.data).toHaveLength(1)
      expect(result.meta.total_count).toBe(1)
      expect(result.data[0].name).toBe('請求書_001.pdf')
    })

    it('should accept pagination parameters', async () => {
      const result = await client.getDocuments(123456, '2024-01-01', '2024-01-31', 25, 5)

      expect(result.meta.limit).toBe(25)
      expect(result.meta.offset).toBe(5)
    })
  })

  describe('downloadDocument', () => {
    it('should return mock buffer in mock mode', async () => {
      const result = await client.downloadDocument(123456, 2001)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.buffer.toString()).toBe('mock document content')
      expect(result.contentType).toBe('application/pdf')
    })
  })

  describe('getReceipts', () => {
    it('should return mock receipts', async () => {
      const result = await client.getReceipts({
        company_id: 123456,
      })

      expect(result).toBeDefined()
    })
  })

  describe('getTrialBalance', () => {
    it('should return mock trial balance in mock mode', async () => {
      const result = await client.getTrialBalance({
        company_id: 123456,
        fiscal_year: 2024,
      })

      expect(result.trial_balance).toBeDefined()
      expect(result.trial_balance.company_id).toBe(123456)
      expect(result.trial_balance.fiscal_year).toBe(2024)
      expect(result.trial_balance.account_items).toHaveLength(3)
    })

    it('should accept all optional parameters', async () => {
      const result = await client.getTrialBalance({
        company_id: 123456,
        fiscal_year: 2024,
        start_month: 1,
        end_month: 3,
        breakdown_display_type: 'account_item',
      })

      expect(result.trial_balance).toBeDefined()
    })
  })

  describe('getAccountItems', () => {
    it('should return mock account items in mock mode', async () => {
      const result = await client.getAccountItems(123456)

      expect(result.account_items).toHaveLength(3)
      expect(result.account_items[0].name).toBe('現金')
      expect(result.account_items[1].name).toBe('普通預金')
      expect(result.account_items[2].name).toBe('売上高')
    })
  })

  describe('getConnectionStatus', () => {
    it('should return connected status in mock mode', async () => {
      const result = await client.getConnectionStatus('company_123')

      expect(result.connected).toBe(true)
      expect(result.companyId).toBe(123456)
      expect(result.companyName).toBe('サンプル株式会社')
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(result.lastSyncAt).toBeInstanceOf(Date)
    })
  })

  describe('disconnect', () => {
    it('should call deleteToken', async () => {
      const { deleteToken } = await import('@/lib/integrations/freee/token-store')
      await client.disconnect('company_123')
      expect(deleteToken).toHaveBeenCalledWith('company_123')
    })
  })
})

describe('FreeeClient Non-Mock Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.FREEE_MOCK_MODE
    process.env.FREEE_CLIENT_ID = 'test_client_id'
    process.env.FREEE_CLIENT_SECRET = 'test_client_secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.FREEE_CLIENT_ID
    delete process.env.FREEE_CLIENT_SECRET
  })

  describe('exchangeCodeForToken', () => {
    it('should call token endpoint', async () => {
      const mockResponse = {
        access_token: 'test_access',
        refresh_token: 'test_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new FreeeClient()
      const result = await client.exchangeCodeForToken('auth_code')

      expect(result).toEqual(mockResponse)
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://accounts.secure.freee.co.jp/public_api/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
        30000
      )
    })

    it('should throw FreeeApiError on failure', async () => {
      const mockError = {
        code: 'invalid_grant',
        message: 'Invalid authorization code',
        status: 400,
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new FreeeClient()

      await expect(client.exchangeCodeForToken('invalid_code')).rejects.toThrow(FreeeApiError)
    })
  })

  describe('refreshToken', () => {
    it('should call token endpoint with refresh_token', async () => {
      const mockResponse = {
        access_token: 'new_access',
        refresh_token: 'new_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new FreeeClient()
      const result = await client.refreshToken('old_refresh')

      expect(result).toEqual(mockResponse)
    })

    it('should throw FreeeApiError on refresh failure', async () => {
      const mockError = {
        code: 'invalid_grant',
        message: 'Invalid refresh token',
        status: 400,
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new FreeeClient()

      await expect(client.refreshToken('invalid_refresh')).rejects.toThrow(FreeeApiError)
    })
  })

  describe('getCompanies with access token', () => {
    it('should fetch companies with access token', async () => {
      const mockResponse = {
        companies: [
          { id: 1, name: 'Company A', display_name: 'Company A' },
          { id: 2, name: 'Company B', display_name: 'Company B' },
        ],
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new FreeeClient({ accessToken: 'test_token' })
      const companies = await client.getCompanies()

      expect(companies).toHaveLength(2)
      expect(companies[0].name).toBe('Company A')
    })

    it('should throw FreeeApiError on API error', async () => {
      const mockError = {
        code: 'unauthorized',
        message: 'Unauthorized',
        status: 401,
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new FreeeClient({ accessToken: 'invalid_token' })

      await expect(client.getCompanies()).rejects.toThrow(FreeeApiError)
    })
  })

  describe('getJournals with access token', () => {
    it('should fetch journals with pagination', async () => {
      const mockResponse = {
        journals: [
          {
            id: 1,
            issue_date: '2024-01-01',
            entry_side: 'debit',
            amount: 10000,
            account_item_id: 101,
            account_item_name: '現金',
          },
        ],
        meta: { total_count: 1, limit: 100, offset: 0 },
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new FreeeClient({ accessToken: 'test_token' })
      const result = await client.getJournals(1, '2024-01-01', '2024-01-31')

      expect(result.data).toHaveLength(1)
      expect(result.meta.total_count).toBe(1)
    })
  })

  describe('getDocuments with access token', () => {
    it('should fetch documents', async () => {
      const mockResponse = {
        documents: [
          {
            id: 1,
            name: 'invoice.pdf',
            description: 'Invoice',
            issue_date: '2024-01-01',
            file: { id: 1, name: 'invoice.pdf', content_type: 'application/pdf', size: 1024 },
          },
        ],
        meta: { total_count: 1, limit: 100, offset: 0 },
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new FreeeClient({ accessToken: 'test_token' })
      const result = await client.getDocuments(1)

      expect(result.data).toHaveLength(1)
    })
  })

  describe('downloadDocument with access token', () => {
    it('should download document as buffer', async () => {
      const mockBuffer = new Uint8Array([1, 2, 3, 4])

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockBuffer.buffer,
        headers: new Headers({ 'content-type': 'application/pdf' }),
      } as Response)

      const client = new FreeeClient({ accessToken: 'test_token' })
      const result = await client.downloadDocument(1, 1)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.contentType).toBe('application/pdf')
    })

    it('should throw error on download failure', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const client = new FreeeClient({ accessToken: 'test_token' })

      await expect(client.downloadDocument(1, 999)).rejects.toThrow('Failed to download document')
    })
  })

  describe('getTrialBalance with access token', () => {
    it('should fetch trial balance', async () => {
      const mockResponse = {
        trial_balance: {
          company_id: 1,
          fiscal_year: 2024,
          start_month: 1,
          end_month: 12,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          account_items: [],
        },
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new FreeeClient({ accessToken: 'test_token' })
      const result = await client.getTrialBalance({ company_id: 1 })

      expect(result.trial_balance.company_id).toBe(1)
    })
  })

  describe('getAccountItems with access token', () => {
    it('should fetch account items', async () => {
      const mockResponse = {
        account_items: [
          {
            id: 1,
            name: '現金',
            shortcut: 'genkin',
            shortcut_num: '100',
            account_category_id: 1,
            account_category_name: '流動資産',
            searchable: true,
          },
        ],
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new FreeeClient({ accessToken: 'test_token' })
      const result = await client.getAccountItems(1)

      expect(result.account_items).toHaveLength(1)
    })
  })
})

describe('FreeeApiError', () => {
  it('should create error with all properties', () => {
    const freeeError = {
      code: 'validation_error',
      message: 'Validation failed',
      status: 400,
      errors: {
        field: ['is required'],
      },
    }

    const error = new FreeeApiError(freeeError)

    expect(error.name).toBe('FreeeApiError')
    expect(error.code).toBe('validation_error')
    expect(error.status).toBe(400)
    expect(error.message).toBe('Validation failed')
    expect(error.errors).toEqual({ field: ['is required'] })
  })

  it('should be instance of Error', () => {
    const freeeError = {
      code: 'error',
      message: 'Error message',
      status: 500,
    }

    const error = new FreeeApiError(freeeError)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(FreeeApiError)
  })

  it('should handle error without errors field', () => {
    const freeeError = {
      code: 'not_found',
      message: 'Resource not found',
      status: 404,
    }

    const error = new FreeeApiError(freeeError)

    expect(error.errors).toBeUndefined()
  })
})

describe('createFreeeClient', () => {
  it('should create client with access token', () => {
    const client = createFreeeClient('test_token', 'company_123')
    expect(client).toBeInstanceOf(FreeeClient)
  })

  it('should create client without parameters', () => {
    process.env.FREEE_MOCK_MODE = 'true'
    const client = createFreeeClient()
    expect(client).toBeInstanceOf(FreeeClient)
  })
})

describe('freeeClient export', () => {
  it('should export default client instance', () => {
    expect(freeeClient).toBeInstanceOf(FreeeClient)
  })
})

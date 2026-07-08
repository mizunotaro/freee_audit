import {
  JQuantsProvider,
  createJQuantsProvider,
} from '@/services/market-data/providers/jquants-provider'

vi.stubGlobal('fetch', vi.fn())

describe('JQuantsProvider', () => {
  let provider: JQuantsProvider

  beforeEach(() => {
    provider = new JQuantsProvider()
    vi.mocked(fetch).mockReset()
  })

  it('has name jquants', () => {
    expect(provider.name).toBe('jquants')
  })

  describe('authenticate', () => {
    it('fails without email and password', async () => {
      const result = await provider.authenticate({ provider: 'jquants' })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('invalid_credential')
    })

    it('fails on API error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await provider.authenticate({
        provider: 'jquants',
        email: 'test@test.com',
        password: 'password',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('auth_failed')
    })
  })

  describe('getQuotes', () => {
    it('fails when not authenticated', async () => {
      const result = await provider.getQuotes({ tickers: ['7203'] })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('fetch_failed')
    })

    it('fails with fetch_failed when token refresh fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      await provider.authenticate({
        provider: 'jquants',
        email: 'test@test.com',
        password: 'password',
      })

      const result = await provider.getQuotes({ tickers: ['7203'] })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('fetch_failed')
        expect(result.error.message).toBe('Network error')
      }
    })
  })

  describe('getFinancials', () => {
    it('fails when not authenticated', async () => {
      const result = await provider.getFinancials('7203')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('fetch_failed')
    })
  })

  describe('getCompanyInfo', () => {
    it('fails when not authenticated', async () => {
      const result = await provider.getCompanyInfo('7203')
      expect(result.success).toBe(false)
    })
  })

  describe('searchCompanies', () => {
    it('fails when not authenticated', async () => {
      const result = await provider.searchCompanies('トヨタ')
      expect(result.success).toBe(false)
    })
  })

  describe('createJQuantsProvider', () => {
    it('creates provider instance', () => {
      expect(createJQuantsProvider()).toBeInstanceOf(JQuantsProvider)
    })
  })
})

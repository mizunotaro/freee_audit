import {
  EDINETProvider,
  createEDINETProvider,
} from '@/services/market-data/providers/edinet-provider'

vi.stubGlobal('fetch', vi.fn())

describe('EDINETProvider', () => {
  let provider: EDINETProvider

  beforeEach(() => {
    provider = new EDINETProvider()
    vi.mocked(fetch).mockReset()
  })

  it('has name edinet', () => {
    expect(provider.name).toBe('edinet')
  })

  describe('authenticate', () => {
    it('fails without API key', async () => {
      const result = await provider.authenticate({ provider: 'edinet' })
      expect(result.success).toBe(false)
    })

    it('succeeds with API key', async () => {
      const result = await provider.authenticate({ provider: 'edinet', apiKey: 'test-key' })
      expect(result.success).toBe(true)
    })
  })

  describe('testConnection', () => {
    it('fails when not authenticated', async () => {
      const result = await provider.testConnection()
      expect(result.success).toBe(false)
    })

    it('returns true on successful connection', async () => {
      await provider.authenticate({ provider: 'edinet', apiKey: 'key' })
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ metadata: { status: '200' }, results: [] }),
      } as Response)
      const result = await provider.testConnection()
      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toBe(true)
    })
  })

  describe('getQuotes', () => {
    it('returns not_supported error', async () => {
      const result = await provider.getQuotes({ tickers: ['7203'] })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('not_supported')
    })
  })

  describe('getCompanyInfo', () => {
    it('fails when not authenticated', async () => {
      const result = await provider.getCompanyInfo('7203')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('not_authenticated')
    })

    it('returns company info with documents', async () => {
      await provider.authenticate({ provider: 'edinet', apiKey: 'key' })

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                docID: 'doc1',
                edinetCode: 'E01234',
                secCode: '72030',
                filerName: 'トヨタ自動車',
                submitDateTime: '2024-03-31',
              },
            ],
          }),
      } as Response)

      const result = await provider.getCompanyInfo('7203')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ticker).toBe('7203')
        expect(result.data.name).toBe('トヨタ自動車')
      }
    })
  })

  describe('searchCompanies', () => {
    it('fails when not authenticated', async () => {
      const result = await provider.searchCompanies('トヨタ')
      expect(result.success).toBe(false)
    })
  })

  describe('createEDINETProvider', () => {
    it('creates provider instance', () => {
      expect(createEDINETProvider()).toBeInstanceOf(EDINETProvider)
    })
  })
})

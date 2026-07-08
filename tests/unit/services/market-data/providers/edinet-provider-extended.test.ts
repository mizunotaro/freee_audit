import { EDINETProvider } from '@/services/market-data/providers/edinet-provider'

vi.stubGlobal('fetch', vi.fn())

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

function stubEdinetFetch(listResults: unknown[]): void {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/documents.json')) {
      return jsonResponse({ results: listResults })
    }
    // Individual document (XBRL) endpoint.
    return jsonResponse({})
  })
}

describe('EDINETProvider (extended)', () => {
  let provider: EDINETProvider

  beforeEach(() => {
    provider = new EDINETProvider()
    vi.mocked(fetch).mockReset()
  })

  describe('getFinancials', () => {
    it('maps matching documents into financial statements', async () => {
      await provider.authenticate({ provider: 'edinet', apiKey: 'key' })
      stubEdinetFetch(
        Array.from({ length: 5 }, (_, i) => ({
          docID: `doc-${i}`,
          edinetCode: 'E01234',
          secCode: '72030',
          filerName: 'トヨタ自動車',
          submitDateTime: '2024-03-31',
        }))
      )

      const result = await provider.getFinancials('7203')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(5)
        expect(result.data[0].ticker).toBe('7203')
        expect(result.data[0].name).toBe('トヨタ自動車')
        expect(result.data[0].fiscalYear).toBe(2024)
        expect(result.data[0].period).toBe('FY')
      }
    })

    it('returns not_found when no documents match the ticker', async () => {
      await provider.authenticate({ provider: 'edinet', apiKey: 'key' })
      stubEdinetFetch([])

      const result = await provider.getFinancials('0000')

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('not_found')
    })
  })

  describe('searchCompanies', () => {
    it('deduplicates companies by ticker', async () => {
      await provider.authenticate({ provider: 'edinet', apiKey: 'key' })
      const sharedTicker = Array.from({ length: 10 }, (_, i) => ({
        edinetCode: `E0123${i}`,
        filerName: `Corp A ${i}`,
      }))
      const otherTicker = Array.from({ length: 10 }, (_, i) => ({
        edinetCode: `E0999${i}`,
        filerName: `Corp B ${i}`,
      }))
      stubEdinetFetch([...sharedTicker, ...otherTicker])

      const result = await provider.searchCompanies('')

      expect(result.success).toBe(true)
      if (result.success) {
        const tickers = result.data.map((c) => c.ticker)
        expect(tickers).toEqual(['E012', 'E099'])
        expect(result.data).toHaveLength(2)
      }
    })
  })

  describe('getCompanyInfo', () => {
    it('returns not_found when no documents match the ticker', async () => {
      await provider.authenticate({ provider: 'edinet', apiKey: 'key' })
      stubEdinetFetch([])

      const result = await provider.getCompanyInfo('0000')

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('not_found')
    })
  })
})

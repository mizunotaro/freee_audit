import { JQuantsProvider } from '@/services/market-data/providers/jquants-provider'

vi.stubGlobal('fetch', vi.fn())

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

describe('JQuantsProvider (extended)', () => {
  let provider: JQuantsProvider

  beforeEach(() => {
    provider = new JQuantsProvider()
    vi.mocked(fetch).mockReset()
  })

  async function authenticate(): Promise<void> {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ refreshToken: 'rt-token' }))
      .mockResolvedValueOnce(jsonResponse({ idToken: 'id-token' }))
    await provider.authenticate({
      provider: 'jquants',
      email: 'user@example.com',
      password: 'secret',
    })
  }

  describe('authenticate', () => {
    it('succeeds and stores a reusable token', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse({ refreshToken: 'rt-token' }))
        .mockResolvedValueOnce(jsonResponse({ idToken: 'id-token' }))
      const result = await provider.authenticate({
        provider: 'jquants',
        email: 'user@example.com',
        password: 'secret',
      })
      expect(result.success).toBe(true)

      // A later authenticated call reuses the token (no new auth round-trips).
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ info: [] }))
      const info = await provider.getCompanyInfo('7203')
      expect(info.success).toBe(false)
      if (!info.success) expect(info.error.code).toBe('not_found')

      // The company-info fetch must carry the stored bearer token.
      const lastCallInit = vi.mocked(fetch).mock.calls.at(-1)?.[1]
      expect((lastCallInit?.headers as Record<string, string>)?.Authorization).toBe(
        'Bearer id-token'
      )
    })
  })

  describe('getQuotes', () => {
    it('maps daily_quotes into StockQuote objects', async () => {
      await authenticate()
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          daily_quotes: [
            {
              Code: '72030',
              CompanyName: 'トヨタ自動車',
              Open: '3000',
              Close: '3150',
              Volume: '1000',
              Date: '2024-01-15',
            },
          ],
        })
      )

      const result = await provider.getQuotes({ tickers: ['7203'] })

      expect(result.success).toBe(true)
      if (result.success) {
        const q = result.data[0]
        expect(q.ticker).toBe('7203')
        expect(q.name).toBe('トヨタ自動車')
        expect(q.exchange).toBe('JPX')
        expect(q.price).toBe(3150)
        expect(q.change).toBe(150)
        expect(q.changePercent).toBeCloseTo(5, 5)
        expect(q.volume).toBe(1000)
      }
    })
  })

  describe('getFinancials', () => {
    it('maps statement fields and normalizes the fiscal period', async () => {
      await authenticate()
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          statements: [
            {
              LocalCode: '72030',
              CompanyName: 'トヨタ自動車',
              FiscalYear: '2024',
              TypeOfCurrentPeriod: '1Q',
              NetSales: '1000000',
              OperatingProfit: '200000',
              Profit: '150000',
              TotalAssets: '5000000',
              Equity: '2000000',
              TotalLiabilities: '3000000',
              CashFlowFromOperatingActivities: '300000',
              EarningsPerShare: '50.5',
              BookValuePerShare: '200',
            },
            {
              LocalCode: '72030',
              CompanyName: 'トヨタ自動車',
              FiscalYear: '2024',
              TypeOfCurrentPeriod: '2Q',
            },
            {
              LocalCode: '72030',
              CompanyName: 'トヨタ自動車',
              FiscalYear: '2024',
              TypeOfCurrentPeriod: '3Q',
            },
            {
              LocalCode: '72030',
              CompanyName: 'トヨタ自動車',
              FiscalYear: '2024',
              TypeOfCurrentPeriod: '4Q',
            },
            {
              LocalCode: '72030',
              CompanyName: 'トヨタ自動車',
              FiscalYear: '2024',
              TypeOfCurrentPeriod: 'FY2024',
            },
            {
              LocalCode: '72030',
              CompanyName: 'トヨタ自動車',
              FiscalYear: '2024',
              TypeOfCurrentPeriod: 'Annual',
            },
          ],
        })
      )

      const result = await provider.getFinancials('7203')

      expect(result.success).toBe(true)
      if (result.success) {
        const [q1, q2, q3, q4, fy, fallback] = result.data
        expect(q1.ticker).toBe('7203')
        expect(q1.revenue).toBe(1000000)
        expect(q1.operatingIncome).toBe(200000)
        expect(q1.netIncome).toBe(150000)
        expect(q1.eps).toBe(50.5)
        expect(q1.bps).toBe(200)
        expect(q1.period).toBe('Q1')
        expect(q2.period).toBe('Q2')
        expect(q3.period).toBe('Q3')
        expect(q4.period).toBe('FY')
        expect(fy.period).toBe('FY')
        expect(fallback.period).toBe('FY')
      }
    })
  })

  describe('getCompanyInfo', () => {
    it('maps the listed-info record into a CompanyInfo', async () => {
      await authenticate()
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          info: [
            {
              Code: '72030',
              CompanyName: 'トヨタ自動車',
              CompanyNameEnglish: 'Toyota Motor',
              Sector33CodeName: '輸送用機器',
              Sector17CodeName: '素材',
              MarketCodeName: 'プライム',
              ListingDate: '2024-04-01',
            },
          ],
        })
      )

      const result = await provider.getCompanyInfo('7203')

      expect(result.success).toBe(true)
      if (result.success) {
        const c = result.data
        expect(c.ticker).toBe('7203')
        expect(c.name).toBe('トヨタ自動車')
        expect(c.nameEn).toBe('Toyota Motor')
        expect(c.industry).toBe('輸送用機器')
        expect(c.sector).toBe('素材')
        expect(c.exchange).toBe('プライム')
      }
    })
  })

  describe('searchCompanies', () => {
    it('maps listed-info search results into CompanyInfo objects', async () => {
      await authenticate()
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          info: [
            {
              Code: '72030',
              CompanyName: 'トヨタ自動車',
              Sector33CodeName: '輸送用機器',
              MarketCodeName: 'プライム',
            },
          ],
        })
      )

      const result = await provider.searchCompanies('トヨタ')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].name).toBe('トヨタ自動車')
        expect(result.data[0].industry).toBe('輸送用機器')
      }
    })
  })

  describe('testConnection', () => {
    it('returns true when the API responds to a quotes probe', async () => {
      await authenticate()
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ daily_quotes: [] }))

      const result = await provider.testConnection()

      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toBe(true)
    })
  })
})

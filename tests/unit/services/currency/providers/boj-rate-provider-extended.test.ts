import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BOJRateProvider,
  createBOJRateProvider,
} from '@/services/currency/providers/boj-rate-provider'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    exchangeRate: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    exchangeRateFetchLog: {
      create: vi.fn(),
    },
  },
}))

function csvResponse(csv: string) {
  return { ok: true, text: async () => csv } as Response
}

describe('BOJRateProvider (extended)', () => {
  let provider: BOJRateProvider

  beforeEach(() => {
    provider = new BOJRateProvider()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('fetchRates — saveRates update path', () => {
    it('updates the existing rate instead of creating a new row', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(csvResponse('Currency,Rate\nUSD,150.00'))
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValueOnce({
        id: 'existing-usd',
        rateDate: new Date(),
        fromCurrency: 'JPY',
        toCurrency: 'USD',
        rate: 149,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.exchangeRate.update).mockResolvedValue({
        id: 'existing-usd',
        rateDate: new Date(),
        fromCurrency: 'JPY',
        toCurrency: 'USD',
        rate: 150,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as never)

      const result = await provider.fetchRates(new Date('2024-01-15'))

      expect(result.success).toBe(true)
      expect(prisma.exchangeRate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-usd' },
          data: expect.objectContaining({ rate: 150, confidence: 1.0, isOfficial: true }),
        })
      )
      expect(prisma.exchangeRate.create).not.toHaveBeenCalled()
      if (result.success) {
        expect(result.data[0].rate).toBe(150)
        expect(result.data[0].isOfficial).toBe(true)
      }
    })
  })

  describe('fetchRates — CSV parsing', () => {
    it('filters out malformed rows and keeps only valid currency lines', async () => {
      const malformedCSV = [
        'Currency,Rate',
        'USD,149.50',
        'INVALID',
        ',EUR',
        'GBP,not-a-number',
        'EUR,162.30',
      ].join('\n')

      vi.mocked(fetch).mockResolvedValueOnce(csvResponse(malformedCSV))
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.exchangeRate.create).mockResolvedValue({
        id: 'x',
        rateDate: new Date(),
        fromCurrency: 'JPY',
        toCurrency: 'USD',
        rate: 149.5,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as never)

      const result = await provider.fetchRates(new Date('2024-01-15'))

      expect(result.success).toBe(true)
      expect(prisma.exchangeRate.create).toHaveBeenCalledTimes(2)
      expect(prisma.exchangeRate.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ toCurrency: 'USD' }) })
      )
      expect(prisma.exchangeRate.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ toCurrency: 'EUR' }) })
      )
      expect(prisma.exchangeRate.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ toCurrency: 'GBP' }) })
      )
      if (result.success) expect(result.data).toHaveLength(2)
    })

    it('builds the CSV URL from the requested year and month', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(csvResponse('Currency,Rate\nUSD,149.50'))
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.exchangeRate.create).mockResolvedValue({
        id: 'x',
        rateDate: new Date(),
        fromCurrency: 'JPY',
        toCurrency: 'USD',
        rate: 149.5,
        source: 'BOJ',
        sourceUrl: null,
        confidence: 1.0,
        isOfficial: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as never)

      await provider.fetchRates(new Date('2024-01-15'))

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/202401.csv'), expect.anything())
    })
  })

  describe('createBOJRateProvider', () => {
    it('returns a BOJRateProvider instance', () => {
      expect(createBOJRateProvider()).toBeInstanceOf(BOJRateProvider)
    })
  })
})

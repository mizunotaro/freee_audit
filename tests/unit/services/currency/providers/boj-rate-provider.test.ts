import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BOJRateProvider } from '@/services/currency/providers/boj-rate-provider'
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

describe('BOJRateProvider', () => {
  let provider: BOJRateProvider

  beforeEach(() => {
    provider = new BOJRateProvider()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('properties', () => {
    it('should have correct source', () => {
      expect(provider.source).toBe('BOJ')
    })

    it('should have highest priority (1)', () => {
      expect(provider.priority).toBe(1)
    })

    it('should have confidence of 1.0', () => {
      expect(provider.confidence).toBe(1.0)
    })
  })

  describe('fetchRates', () => {
    it('should fetch and parse BOJ CSV correctly', async () => {
      const mockCSV = `Currency,Rate
USD,149.50
EUR,162.30
GBP,189.20`

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => mockCSV,
      })

      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.exchangeRate.create).mockResolvedValue({
        id: 'test-id',
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
        kpis: [],
        transactionRates: [],
        settlementRates: [],
        revaluationRates: [],
      } as any)
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as any)

      const result = await provider.fetchRates(new Date('2024-01-15'))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0)
        expect(result.data[0].source).toBe('BOJ')
        expect(result.data[0].confidence).toBe(1.0)
        expect(result.data[0].isOfficial).toBe(true)
      }
    })

    it('should handle fetch failure gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as any)

      const result = await provider.fetchRates(new Date('1900-01-01'))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
      }
    })

    it('should handle non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as any)

      const result = await provider.fetchRates(new Date('2024-01-15'))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('404')
      }
    })

    it('should handle empty CSV response', async () => {
      const mockCSV = `Currency,Rate`

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => mockCSV,
      })
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as any)

      const result = await provider.fetchRates(new Date('2024-01-15'))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('No rates found')
      }
    })

    it('should log fetch attempts', async () => {
      const mockCSV = `Currency,Rate
USD,149.50`

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => mockCSV,
      })

      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.exchangeRate.create).mockResolvedValue({
        id: 'test-id',
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
      } as any)
      vi.mocked(prisma.exchangeRateFetchLog.create).mockResolvedValue({} as any)

      await provider.fetchRates(new Date('2024-01-15'))

      expect(prisma.exchangeRateFetchLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'BOJ',
            status: 'SUCCESS',
          }),
        })
      )
    })
  })

  describe('isAvailable', () => {
    it('should return true when BOJ is reachable', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
      })

      const available = await provider.isAvailable()
      expect(available).toBe(true)
    })

    it('should return false when BOJ is unreachable', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const available = await provider.isAvailable()
      expect(available).toBe(false)
    })

    it('should return false when BOJ returns non-OK status', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
      })

      const available = await provider.isAvailable()
      expect(available).toBe(false)
    })
  })
})

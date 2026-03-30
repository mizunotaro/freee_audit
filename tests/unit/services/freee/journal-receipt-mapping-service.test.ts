import {
  JournalReceiptMappingService,
  journalReceiptMappingService,
} from '@/services/freee/journal-receipt-mapping-service'

vi.mock('@/lib/integrations/freee/client', () => {
  function MockFreeeClient(this: any) {
    this.getDeals = vi.fn()
    this.getReceiptDetails = vi.fn()
    this.getDeal = vi.fn()
    this.getJournals = vi.fn()
  }
  return { FreeeClient: MockFreeeClient as any }
})

describe('JournalReceiptMappingService', () => {
  let service: JournalReceiptMappingService
  let mockClient: any

  beforeEach(async () => {
    const MockFreeeClient = vi.mocked(await import('@/lib/integrations/freee/client')).FreeeClient
    mockClient = new MockFreeeClient()
    mockClient.getDeals = vi.fn()
    mockClient.getReceiptDetails = vi.fn()
    mockClient.getDeal = vi.fn()
    mockClient.getJournals = vi.fn()
    service = new JournalReceiptMappingService(mockClient, { cacheEnabled: true })
  })

  describe('getConfig', () => {
    it('returns config with version', () => {
      const config = service.getConfig()
      expect(config.version).toBe('1.0.0')
      expect(config.config.cacheEnabled).toBe(true)
    })
  })

  describe('getCacheSize', () => {
    it('returns 0 initially', () => {
      expect(service.getCacheSize()).toBe(0)
    })
  })

  describe('clearCache', () => {
    it('clears the cache', () => {
      service.clearCache()
      expect(service.getCacheSize()).toBe(0)
    })
  })

  describe('getReceiptsByJournalId', () => {
    it('returns error for missing journalId', async () => {
      const result = await service.getReceiptsByJournalId(1, '', '2024-01-01')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('INVALID_INPUT')
    })

    it('returns error for missing journalDate', async () => {
      const result = await service.getReceiptsByJournalId(1, 'j-1', '')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('INVALID_INPUT')
    })

    it('returns error for invalid date format', async () => {
      const result = await service.getReceiptsByJournalId(1, 'j-1', 'not-a-date')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('INVALID_INPUT')
    })

    it('returns receipt IDs from deals', async () => {
      mockClient.getDeals.mockResolvedValueOnce({
        deals: [{ id: 1, receipts: [{ id: 101 }, { id: 102 }], details: [{ receipt_id: 103 }] }],
        meta: { total_count: 1 },
      })

      const result = await service.getReceiptsByJournalId(1, 'j-1', '2024-01-15')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([101, 102, 103])
      }
    })

    it('returns empty array when no deals', async () => {
      mockClient.getDeals.mockResolvedValueOnce({
        deals: [],
        meta: { total_count: 0 },
      })

      const result = await service.getReceiptsByJournalId(1, 'j-1', '2024-01-15')
      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toEqual([])
    })

    it('caches results', async () => {
      mockClient.getDeals.mockResolvedValue({
        deals: [{ id: 1, receipts: [{ id: 101 }] }],
        meta: { total_count: 1 },
      })

      await service.getReceiptsByJournalId(1, 'j-cached', '2024-01-01')
      expect(service.getCacheSize()).toBe(1)
    })

    it('handles API errors', async () => {
      mockClient.getDeals.mockRejectedValueOnce(new Error('API error'))

      const result = await service.getReceiptsByJournalId(1, 'j-1', '2024-01-15')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('API_ERROR')
    })
  })

  describe('getDealByReceiptId', () => {
    it('returns error for invalid receiptId', async () => {
      const result = await service.getDealByReceiptId(1, 0)
      expect(result.success).toBe(false)
    })

    it('returns null when receipt has no deal', async () => {
      mockClient.getReceiptDetails.mockResolvedValueOnce({ deal_id: null })

      const result = await service.getDealByReceiptId(1, 100)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.dealId).toBeNull()
      }
    })

    it('returns deal info when linked', async () => {
      mockClient.getReceiptDetails.mockResolvedValueOnce({ deal_id: 42 })
      mockClient.getDeal.mockResolvedValueOnce({ issue_date: '2024-01-15' })

      const result = await service.getDealByReceiptId(1, 100)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.dealId).toBe(42)
        expect(result.data.journalDate).toBe('2024-01-15')
      }
    })
  })

  describe('syncMappings', () => {
    it('returns error for invalid dates', async () => {
      const result = await service.syncMappings(1, 'bad-date', '2024-12-31')
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('syncs journals with deals', async () => {
      mockClient.getJournals.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            issue_date: '2024-01-15',
            amount: 1000,
            details: [{ entry_side: 'debit', amount: 1000 }],
          },
        ],
        meta: { total_count: 1 },
      })
      mockClient.getDeals.mockResolvedValueOnce({
        deals: [
          {
            id: 10,
            issue_date: '2024-01-15',
            amount: 1000,
            receipts: [{ id: 200 }],
            details: [{ amount: 1000 }],
          },
        ],
        meta: { total_count: 1 },
      })

      const result = await service.syncMappings(1, '2024-01-01', '2024-01-31')
      expect(result.totalJournals).toBe(1)
      expect(result.totalDeals).toBe(1)
      expect(result.totalMappings).toBe(1)
      expect(result.newMappings).toBe(1)
    })
  })

  describe('default instance', () => {
    it('is exported as singleton', () => {
      expect(journalReceiptMappingService).toBeInstanceOf(JournalReceiptMappingService)
    })
  })
})

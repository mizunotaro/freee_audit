import { PeerCompanyService } from '@/services/peer-companies/peer-company-service'
import type { PeerCompany } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  prisma: {
    peerCompany: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/db'

const mockPeer: PeerCompany = {
  id: 'peer-1',
  companyId: 'company-1',
  ticker: '7203',
  name: 'トヨタ自動車',
  nameEn: 'Toyota Motor',
  exchange: 'JPX',
  industry: '製造業',
  marketCap: 30000000000000,
  revenue: 30000000000000,
  employees: 370000,
  per: 10,
  pbr: 1.2,
  evEbitda: 8,
  psr: 0.5,
  beta: 0.8,
  similarityScore: 0.9,
  sourceUrl: null,
  dataSource: 'manual',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PeerCompanyService (extended)', () => {
  let service: PeerCompanyService

  beforeEach(() => {
    service = new PeerCompanyService()
    vi.mocked(prisma.peerCompany.create).mockReset()
    vi.mocked(prisma.peerCompany.findUnique).mockReset()
    vi.mocked(prisma.peerCompany.findFirst).mockReset()
    vi.mocked(prisma.peerCompany.findMany).mockReset()
    vi.mocked(prisma.peerCompany.update).mockReset()
    vi.mocked(prisma.peerCompany.delete).mockReset()
    vi.mocked(prisma.peerCompany.updateMany).mockReset()
    vi.mocked(prisma.$transaction).mockReset()
  })

  describe('create', () => {
    it('skips the duplicate check when no ticker is provided', async () => {
      vi.mocked(prisma.peerCompany.create).mockResolvedValueOnce(mockPeer)

      const result = await service.create('company-1', { name: 'No Ticker' })

      expect(result.success).toBe(true)
      expect(prisma.peerCompany.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('returns duplicate_ticker when changing to a ticker already in use', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(mockPeer)
      vi.mocked(prisma.peerCompany.findUnique).mockResolvedValueOnce(mockPeer)

      const result = await service.update('company-1', 'peer-1', {
        ticker: '6758',
        name: 'ソニー',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('duplicate_ticker')
      expect(prisma.peerCompany.update).not.toHaveBeenCalled()
    })

    it('skips the duplicate check when the ticker is unchanged', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(mockPeer)
      vi.mocked(prisma.peerCompany.update).mockResolvedValueOnce({ ...mockPeer, name: 'Updated' })

      const result = await service.update('company-1', 'peer-1', {
        ticker: '7203',
        name: 'Updated',
      })

      expect(result.success).toBe(true)
      expect(prisma.peerCompany.findUnique).not.toHaveBeenCalled()
    })

    it('returns update_failed when the database throws', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(mockPeer)
      vi.mocked(prisma.peerCompany.update).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.update('company-1', 'peer-1', { name: 'X' })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('update_failed')
    })
  })

  describe('list', () => {
    it('applies a minimum similarity score filter', async () => {
      vi.mocked(prisma.peerCompany.findMany).mockResolvedValueOnce([])

      await service.list('company-1', { minSimilarityScore: 0.8 })

      expect(prisma.peerCompany.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1',
            similarityScore: { gte: 0.8 },
          }),
        })
      )
    })

    it('returns list_failed when the database throws', async () => {
      vi.mocked(prisma.peerCompany.findMany).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.list('company-1')

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('list_failed')
    })
  })

  describe('findById', () => {
    it('returns find_failed when the database throws', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.findById('company-1', 'peer-1')

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('find_failed')
    })
  })

  describe('delete', () => {
    it('returns delete_failed when the database throws', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(mockPeer)
      vi.mocked(prisma.peerCompany.delete).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.delete('company-1', 'peer-1')

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('delete_failed')
    })
  })

  describe('bulkCreate', () => {
    it('returns bulk_create_failed when the database throws mid-batch', async () => {
      vi.mocked(prisma.peerCompany.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.peerCompany.create).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.bulkCreate('company-1', [{ name: 'A', ticker: '7203' }])

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('bulk_create_failed')
    })
  })

  describe('setSimilarityScores', () => {
    it('returns update_scores_failed when the transaction throws', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('TX error'))

      const result = await service.setSimilarityScores('company-1', [
        { peerId: 'peer-1', score: 0.95 },
      ])

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('update_scores_failed')
    })
  })
})

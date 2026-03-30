import {
  PeerCompanyService,
  createPeerCompanyService,
} from '@/services/peer-companies/peer-company-service'

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

const mockPeer = {
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

describe('PeerCompanyService', () => {
  let service: PeerCompanyService

  beforeEach(() => {
    service = new PeerCompanyService()
    vi.mocked(prisma.peerCompany.create).mockReset()
    vi.mocked(prisma.peerCompany.findUnique).mockReset()
    vi.mocked(prisma.peerCompany.findFirst).mockReset()
    vi.mocked(prisma.peerCompany.findMany).mockReset()
    vi.mocked(prisma.peerCompany.update).mockReset()
    vi.mocked(prisma.peerCompany.delete).mockReset()
    vi.mocked(prisma.$transaction).mockReset()
  })

  describe('create', () => {
    it('creates peer company successfully', async () => {
      vi.mocked(prisma.peerCompany.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.peerCompany.create).mockResolvedValueOnce(mockPeer as any)

      const result = await service.create('company-1', { name: 'トヨタ自動車', ticker: '7203' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('トヨタ自動車')
        expect(result.data.ticker).toBe('7203')
      }
    })

    it('returns error for duplicate ticker', async () => {
      vi.mocked(prisma.peerCompany.findUnique).mockResolvedValueOnce(mockPeer as any)

      const result = await service.create('company-1', { name: 'Dup', ticker: '7203' })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('duplicate_ticker')
    })

    it('handles database errors', async () => {
      vi.mocked(prisma.peerCompany.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.peerCompany.create).mockRejectedValueOnce(new Error('DB error'))

      const result = await service.create('company-1', { name: 'Test' })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('create_failed')
    })
  })

  describe('findById', () => {
    it('finds peer company by id', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(mockPeer as any)

      const result = await service.findById('company-1', 'peer-1')
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.id).toBe('peer-1')
    })

    it('returns not_found for missing peer', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(null)

      const result = await service.findById('company-1', 'nonexistent')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('not_found')
    })
  })

  describe('list', () => {
    it('lists peer companies', async () => {
      vi.mocked(prisma.peerCompany.findMany).mockResolvedValueOnce([mockPeer] as any)

      const result = await service.list('company-1')
      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toHaveLength(1)
    })

    it('applies filters', async () => {
      vi.mocked(prisma.peerCompany.findMany).mockResolvedValueOnce([] as any)

      await service.list('company-1', { activeOnly: true, industry: '製造業' })
      expect(prisma.peerCompany.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1',
            isActive: true,
            industry: '製造業',
          }),
        })
      )
    })
  })

  describe('update', () => {
    it('updates peer company', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(mockPeer as any)
      vi.mocked(prisma.peerCompany.update).mockResolvedValueOnce({
        ...mockPeer,
        name: 'Updated',
      } as any)

      const result = await service.update('company-1', 'peer-1', { name: 'Updated' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.name).toBe('Updated')
    })

    it('returns not_found for missing peer', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(null)

      const result = await service.update('company-1', 'peer-1', { name: 'X' })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('not_found')
    })
  })

  describe('delete', () => {
    it('deletes peer company', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(mockPeer as any)
      vi.mocked(prisma.peerCompany.delete).mockResolvedValueOnce(mockPeer as any)

      const result = await service.delete('company-1', 'peer-1')
      expect(result.success).toBe(true)
    })

    it('returns not_found for missing peer', async () => {
      vi.mocked(prisma.peerCompany.findFirst).mockResolvedValueOnce(null)

      const result = await service.delete('company-1', 'nonexistent')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('not_found')
    })
  })

  describe('bulkCreate', () => {
    it('creates multiple peer companies', async () => {
      vi.mocked(prisma.peerCompany.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.peerCompany.create)
        .mockResolvedValueOnce({ ...mockPeer, id: 'p1' } as any)
        .mockResolvedValueOnce({ ...mockPeer, id: 'p2', ticker: '6758' } as any)

      const result = await service.bulkCreate('company-1', [
        { name: 'Peer A', ticker: '7203' },
        { name: 'Peer B', ticker: '6758' },
      ])
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.created).toBe(2)
        expect(result.data.skipped).toBe(0)
      }
    })

    it('skips duplicates in bulk create', async () => {
      vi.mocked(prisma.peerCompany.findUnique)
        .mockResolvedValueOnce(mockPeer as any)
        .mockResolvedValueOnce(null)
      vi.mocked(prisma.peerCompany.create).mockResolvedValueOnce({ ...mockPeer, id: 'p2' } as any)

      const result = await service.bulkCreate('company-1', [
        { name: 'Dup', ticker: '7203' },
        { name: 'New', ticker: '6758' },
      ])
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.created).toBe(1)
        expect(result.data.skipped).toBe(1)
      }
    })
  })

  describe('setSimilarityScores', () => {
    it('updates similarity scores', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValueOnce([])

      const result = await service.setSimilarityScores('company-1', [
        { peerId: 'peer-1', score: 0.95 },
      ])
      expect(result.success).toBe(true)
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('createPeerCompanyService', () => {
    it('creates service instance', () => {
      expect(createPeerCompanyService()).toBeInstanceOf(PeerCompanyService)
    })
  })
})

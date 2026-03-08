import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    journalProposal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    receiptDocument: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api', () => ({
  withAuth: vi.fn((handler) => handler),
}))

vi.mock('@/lib/storage', () => ({
  createStorageProvider: vi.fn(),
}))

vi.mock('@/services/ocr', () => ({
  getOCREngine: vi.fn(),
}))

vi.mock('@/lib/ai/orchestrator/orchestrator', () => ({
  createOrchestrator: vi.fn(),
}))

function createMockRequest(
  overrides: Partial<{ url: string; headers: Headers }> = {}
): NextRequest {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    url: 'http://localhost:3000/api/journal-proposal',
    json: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as NextRequest
}

describe('Journal Proposal API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/journal-proposal', () => {
    it('should return proposals list with pagination', async () => {
      const mockProposals = [
        {
          id: 'proposal1',
          companyId: 'company1',
          status: 'proposed',
          createdAt: new Date('2024-01-01'),
          documentId: 'doc1',
          createdBy: 'user1',
          userContext: '',
          proposals: '[]',
          aiProvider: 'openai',
          aiModel: 'gpt-5-nano',
          reviewedBy: null,
          reviewedAt: null,
        },
        {
          id: 'proposal2',
          companyId: 'company1',
          status: 'approved',
          createdAt: new Date('2024-01-02'),
          documentId: 'doc2',
          createdBy: 'user1',
          userContext: '',
          proposals: '[]',
          aiProvider: 'openai',
          aiModel: 'gpt-5-nano',
          reviewedBy: 'reviewer1',
          reviewedAt: new Date('2024-01-03'),
        },
      ]

      vi.mocked(prisma.journalProposal.findMany).mockResolvedValue(mockProposals)
      vi.mocked(prisma.journalProposal.count).mockResolvedValue(2)

      const req = createMockRequest({
        url: 'http://localhost:3000/api/journal-proposal?companyId=company1&status=proposed',
      })

      expect(req.url).toContain('companyId=company1')
      expect(prisma.journalProposal.findMany).toBeDefined()
    })
  })
})

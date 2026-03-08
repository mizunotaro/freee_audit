import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthenticatedRequest } from '@/lib/api'

vi.mock('@/lib/api/auth-helpers', () => {
  const defaultMockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'ACCOUNTANT' as const,
    companyId: 'company-1',
  }
  return {
    getAuthenticatedUser: vi.fn().mockImplementation((req: { user?: typeof defaultMockUser }) => {
      return Promise.resolve(req.user || defaultMockUser)
    }),
    requireRole: vi.fn().mockResolvedValue(undefined),
    requireCompanyAccess: vi.fn().mockResolvedValue(undefined),
    createAuthenticatedRequest: vi.fn((req: NextRequest, user: typeof defaultMockUser) => {
      const authReq = req as AuthenticatedRequest
      authReq.user = user
      return authReq
    }),
    handleAuthError: vi.fn((error: unknown) => {
      const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500
      return { status, json: vi.fn() }
    }),
    AuthenticationError: class AuthenticationError extends Error {
      constructor(message: string = 'Unauthorized') {
        super(message)
        this.name = 'AuthenticationError'
      }
    },
    AuthorizationError: class AuthorizationError extends Error {
      constructor(message: string = 'Insufficient permissions') {
        super(message)
        this.name = 'AuthorizationError'
      }
    },
  }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    accountMapping: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    chartOfAccountItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    chartOfAccount: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    conversionProject: {
      findFirst: vi.fn(),
    },
    conversionAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        accountMapping: {
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        conversionAuditLog: {
          create: vi.fn(),
        },
      }
      return fn(mockTx)
    }),
  },
}))

vi.mock('@/services/conversion/ai-conversion-advisor', () => ({
  aiConversionAdvisor: {
    suggestMappings: vi.fn(),
  },
}))

vi.mock('@/services/conversion/chart-of-account-service', () => ({
  chartOfAccountService: {
    getById: vi.fn(),
    getByCompany: vi.fn(),
  },
}))

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ACCOUNTANT' as const,
  companyId: 'company-1',
}

import { GET, POST } from '@/app/api/conversion/mappings/route'
import { GET as GetById, PUT, DELETE } from '@/app/api/conversion/mappings/[id]/route'
import { POST as BatchPost } from '@/app/api/conversion/mappings/batch/route'
import { POST as SuggestPost } from '@/app/api/conversion/mappings/suggest/route'
import { GET as StatsGet } from '@/app/api/conversion/mappings/statistics/route'
import { GET as ExportGet } from '@/app/api/conversion/mappings/export/route'

const mockMapping = {
  id: 'mapping-1',
  companyId: 'company-1',
  sourceCoaId: 'source-coa-1',
  sourceItemId: 'source-item-1',
  targetCoaId: 'target-coa-1',
  targetItemId: 'target-item-1',
  mappingType: '1to1',
  conversionRule: null,
  percentage: null,
  confidence: 1.0,
  isManualReview: false,
  isApproved: false,
  notes: null,
  createdBy: 'user-1',
  approvedBy: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sourceItem: {
    id: 'source-item-1',
    code: '1000',
    name: '現金',
    nameEn: 'Cash',
    coaId: 'source-coa-1',
  },
  targetItem: {
    id: 'target-item-1',
    code: '1100',
    name: 'Cash and Cash Equivalents',
    nameEn: 'Cash and Cash Equivalents',
    coaId: 'target-coa-1',
  },
}

const mockCoa = {
  id: 'source-coa-1',
  companyId: 'company-1',
  standard: 'JGAAP',
  name: 'JGAAP COA',
  description: 'Test COA',
  items: [
    {
      id: 'source-item-1',
      code: '1000',
      name: '現金',
      nameEn: 'Cash',
      standard: 'JGAAP',
      category: 'current_asset' as const,
      subcategory: null,
      normalBalance: 'debit' as const,
      parentId: null,
      level: 0,
      isConvertible: true,
      metadata: null,
    },
  ],
  version: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function createAuthenticatedRequest(
  url: string,
  user: typeof mockUser = mockUser
): AuthenticatedRequest {
  const req = new NextRequest(url) as AuthenticatedRequest
  req.user = user
  return req
}

function createAuthenticatedRequestWithBody(
  url: string,
  body: unknown,
  user: typeof mockUser = mockUser
): AuthenticatedRequest {
  const req = new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as AuthenticatedRequest
  req.user = user
  return req
}

describe('Mappings API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/conversion/mappings', () => {
    it('should return paginated mappings', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(1)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([mockMapping] as any)

      const req = createAuthenticatedRequest(
        'http://localhost/api/conversion/mappings?page=1&limit=50'
      )
      const res = await GET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data).toHaveLength(1)
      expect(data.pagination.total).toBe(1)
    })

    it('should filter by approval status', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])

      const req = createAuthenticatedRequest(
        'http://localhost/api/conversion/mappings?isApproved=true'
      )
      await GET(req)

      expect(prisma.accountMapping.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isApproved: true }),
        })
      )
    })

    it('should filter by confidence level', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])

      const req = createAuthenticatedRequest(
        'http://localhost/api/conversion/mappings?minConfidence=0.8'
      )
      await GET(req)

      expect(prisma.accountMapping.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ confidence: { gte: 0.8 } }),
        })
      )
    })

    it('should return 400 when company ID is missing', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/conversion/mappings', {
        ...mockUser,
        companyId: null as unknown as string,
      })
      const res = await GET(req)

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/conversion/mappings', () => {
    it('should create 1to1 mapping', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.chartOfAccountItem.findUnique)
        .mockResolvedValueOnce(mockMapping.sourceItem as any)
        .mockResolvedValueOnce(mockMapping.targetItem as any)
      vi.mocked(prisma.chartOfAccount.findUnique)
        .mockResolvedValueOnce({ id: 'source-coa-1' } as any)
        .mockResolvedValueOnce({ id: 'target-coa-1' } as any)
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.create).mockResolvedValue(mockMapping as any)

      const req = createAuthenticatedRequestWithBody('http://localhost/api/conversion/mappings', {
        sourceCoaId: 'source-coa-1',
        sourceItemId: 'source-item-1',
        targetCoaId: 'target-coa-1',
        targetItemId: 'target-item-1',
        mappingType: '1to1',
      })
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.data).toBeDefined()
    })

    it('should reject duplicate mappings', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping as any)

      const req = createAuthenticatedRequestWithBody('http://localhost/api/conversion/mappings', {
        sourceCoaId: 'source-coa-1',
        sourceItemId: 'source-item-1',
        targetCoaId: 'target-coa-1',
        targetItemId: 'target-item-1',
        mappingType: '1to1',
      })
      const res = await POST(req)

      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/conversion/mappings/[id]', () => {
    it('should return mapping by id', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping as any)

      const req = createAuthenticatedRequest('http://localhost/api/conversion/mappings/mapping-1')
      const res = await GetById(req, { params: { id: 'mapping-1' } })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.id).toBe('mapping-1')
    })

    it('should return 404 for non-existent mapping', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(null)

      const req = createAuthenticatedRequest(
        'http://localhost/api/conversion/mappings/non-existent'
      )
      const res = await GetById(req, { params: { id: 'non-existent' } })

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/conversion/mappings/[id]', () => {
    it('should update mapping', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.update).mockResolvedValue({
        ...mockMapping,
        notes: 'Updated',
      } as any)

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/mapping-1',
        { notes: 'Updated' }
      )
      req.json = async () => ({ notes: 'Updated' })

      const res = await PUT(req, { params: { id: 'mapping-1' } })
      const data = await res.json()

      expect(res.status).toBe(200)
    })
  })

  describe('DELETE /api/conversion/mappings/[id]', () => {
    it('should delete mapping', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.findUnique).mockResolvedValue(mockMapping as any)
      vi.mocked(prisma.accountMapping.delete).mockResolvedValue(mockMapping as any)

      const req = createAuthenticatedRequest('http://localhost/api/conversion/mappings/mapping-1')
      const res = await DELETE(req, { params: { id: 'mapping-1' } })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('POST /api/conversion/mappings/batch', () => {
    it('should create multiple mappings', async () => {
      const { prisma } = await import('@/lib/db')
      const mockTx = {
        accountMapping: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockMapping),
        },
        conversionAuditLog: {
          create: vi.fn(),
        },
      }
      vi.mocked(prisma.chartOfAccountItem.findUnique).mockResolvedValue(
        mockMapping.sourceItem as any
      )
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue({ id: 'coa-1' } as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(mockTx as any))

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/batch',
        {
          action: 'create',
          mappings: [
            {
              sourceCoaId: 'source-coa-1',
              sourceItemId: 'source-item-1',
              targetCoaId: 'target-coa-1',
              targetItemId: 'target-item-1',
              mappingType: '1to1',
            },
          ],
        }
      )
      const res = await BatchPost(req)
      const data = await res.json()

      expect(res.status).toBe(200)
    })

    it('should approve multiple mappings', async () => {
      const { prisma } = await import('@/lib/db')
      const mockTx = {
        accountMapping: {
          findUnique: vi.fn().mockResolvedValue(mockMapping),
          update: vi.fn().mockResolvedValue({ ...mockMapping, isApproved: true }),
        },
        conversionAuditLog: {
          create: vi.fn(),
        },
      }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(mockTx as any))

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/batch',
        {
          action: 'approve',
          mappingIds: ['mapping-1'],
        }
      )
      const res = await BatchPost(req)
      const data = await res.json()

      expect(res.status).toBe(200)
    })

    it('should delete multiple mappings', async () => {
      const { prisma } = await import('@/lib/db')
      const mockTx = {
        accountMapping: {
          findUnique: vi.fn().mockResolvedValue(mockMapping),
          delete: vi.fn().mockResolvedValue(mockMapping),
        },
        conversionAuditLog: {
          create: vi.fn(),
        },
      }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(mockTx as any))

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/batch',
        {
          action: 'delete',
          mappingIds: ['mapping-1'],
        }
      )
      const res = await BatchPost(req)
      const data = await res.json()

      expect(res.status).toBe(200)
    })

    it('should handle partial failures', async () => {
      const { prisma } = await import('@/lib/db')
      const mockTx = {
        accountMapping: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        conversionAuditLog: {
          create: vi.fn(),
        },
      }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(mockTx as any))

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/batch',
        {
          action: 'approve',
          mappingIds: ['non-existent'],
        }
      )
      const res = await BatchPost(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.failed).toBe(1)
    })

    it('should respect batch size limit', async () => {
      const largeMappingIds = Array(501).fill('mapping-id')

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/batch',
        {
          action: 'approve',
          mappingIds: largeMappingIds,
        }
      )
      const res = await BatchPost(req)

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/conversion/mappings/suggest', () => {
    it('should return AI suggestions', async () => {
      const { chartOfAccountService } =
        await import('@/services/conversion/chart-of-account-service')
      const { aiConversionAdvisor } = await import('@/services/conversion/ai-conversion-advisor')

      vi.mocked(chartOfAccountService.getById)
        .mockResolvedValueOnce(mockCoa as any)
        .mockResolvedValueOnce({
          ...mockCoa,
          id: 'target-coa-1',
          standard: 'USGAAP',
        } as any)

      vi.mocked(aiConversionAdvisor.suggestMappings).mockResolvedValue([
        {
          sourceAccountCode: '1000',
          sourceAccountName: '現金',
          suggestedTargetCode: '1100',
          suggestedTargetName: 'Cash and Cash Equivalents',
          confidence: 0.95,
          reasoning: 'Direct correspondence',
          alternatives: [],
        },
      ])

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/suggest',
        {
          sourceCoaId: 'source-coa-1',
          targetCoaId: 'target-coa-1',
          targetStandard: 'USGAAP',
        }
      )
      const res = await SuggestPost(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.meta.method).toBe('ai')
    })

    it('should fallback to rule-based on AI failure', async () => {
      const { chartOfAccountService } =
        await import('@/services/conversion/chart-of-account-service')
      const { aiConversionAdvisor } = await import('@/services/conversion/ai-conversion-advisor')

      vi.mocked(chartOfAccountService.getById)
        .mockResolvedValueOnce(mockCoa as any)
        .mockResolvedValueOnce({
          ...mockCoa,
          id: 'target-coa-1',
          standard: 'USGAAP',
          items: [],
        } as any)

      vi.mocked(aiConversionAdvisor.suggestMappings).mockRejectedValue(new Error('AI failed'))

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/suggest',
        {
          sourceCoaId: 'source-coa-1',
          targetCoaId: 'target-coa-1',
          targetStandard: 'USGAAP',
        }
      )
      const res = await SuggestPost(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.meta.method).toBe('rule-based')
    })

    it('should filter by source account codes', async () => {
      const { chartOfAccountService } =
        await import('@/services/conversion/chart-of-account-service')
      const { aiConversionAdvisor } = await import('@/services/conversion/ai-conversion-advisor')

      vi.mocked(chartOfAccountService.getById)
        .mockResolvedValueOnce(mockCoa as any)
        .mockResolvedValueOnce({
          ...mockCoa,
          id: 'target-coa-1',
          standard: 'USGAAP',
        } as any)

      vi.mocked(aiConversionAdvisor.suggestMappings).mockResolvedValue([])

      const req = createAuthenticatedRequestWithBody(
        'http://localhost/api/conversion/mappings/suggest',
        {
          sourceCoaId: 'source-coa-1',
          targetCoaId: 'target-coa-1',
          targetStandard: 'USGAAP',
          sourceAccountCodes: ['1000'],
        }
      )
      const res = await SuggestPost(req)

      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/conversion/mappings/statistics', () => {
    it('should return correct statistics', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.count)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0.85 },
      } as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.chartOfAccount.findMany).mockResolvedValue([])

      const req = createAuthenticatedRequest('http://localhost/api/conversion/mappings/statistics')
      const res = await StatsGet(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.data.total).toBe(10)
      expect(data.data.approved).toBe(7)
    })
  })

  describe('GET /api/conversion/mappings/export', () => {
    it('should export to CSV', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([mockMapping] as any)

      const req = createAuthenticatedRequest(
        'http://localhost/api/conversion/mappings/export?targetCoaId=target-1&format=csv'
      )
      const res = await ExportGet(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/csv')
    })

    it('should return 400 for missing targetCoaId', async () => {
      const req = createAuthenticatedRequest('http://localhost/api/conversion/mappings/export')
      const res = await ExportGet(req)

      expect(res.status).toBe(400)
    })
  })
})

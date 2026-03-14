import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { success, failure, type Result } from '@/types/result'
import type {
  ShareholderComposition,
  CreateShareholderData,
  UpdateShareholderData,
  ShareholderCategory,
} from '@/types/ir-report'

type ShareholderServiceError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

type ShareholderResult<T> = Result<T, ShareholderServiceError>

const DB_TIMEOUT_MS = 30000
const DB_MAX_WAIT_MS = 5000

function createServiceError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ShareholderServiceError {
  return { code, message, details }
}

async function getShareholders(
  companyId: string
): Promise<ShareholderResult<ShareholderComposition[]>> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'companyId is required'))
  }

  try {
    const shareholders = await prisma.$transaction(
      async (tx) => {
        return tx.shareholderComposition.findMany({
          where: { companyId },
          orderBy: [{ percentage: 'desc' }],
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(shareholders as ShareholderComposition[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get shareholders'
    return failure(createServiceError('DATABASE_ERROR', message, { companyId }))
  }
}

async function createShareholder(
  data: CreateShareholderData
): Promise<ShareholderResult<ShareholderComposition>> {
  if (!data.companyId || !data.shareholderName) {
    return failure(createServiceError('VALIDATION_ERROR', 'Missing required fields'))
  }

  if (data.percentage < 0 || data.percentage > 100) {
    return failure(createServiceError('VALIDATION_ERROR', 'percentage must be between 0 and 100'))
  }

  if (data.sharesHeld < 0) {
    return failure(createServiceError('VALIDATION_ERROR', 'sharesHeld must be non-negative'))
  }

  try {
    const shareholder = await prisma.$transaction(
      async (tx) => {
        return tx.shareholderComposition.create({
          data: {
            companyId: data.companyId,
            asOfDate: data.asOfDate,
            shareholderType: data.shareholderType,
            shareholderName: data.shareholderName,
            sharesHeld: data.sharesHeld,
            percentage: data.percentage,
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(shareholder as ShareholderComposition)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create shareholder'
    return failure(createServiceError('DATABASE_ERROR', message, { data }))
  }
}

async function updateShareholder(
  id: string,
  data: UpdateShareholderData
): Promise<ShareholderResult<ShareholderComposition>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  if (!data || Object.keys(data).length === 0) {
    return failure(createServiceError('VALIDATION_ERROR', 'No update data provided'))
  }

  if (data.percentage !== undefined && (data.percentage < 0 || data.percentage > 100)) {
    return failure(createServiceError('VALIDATION_ERROR', 'percentage must be between 0 and 100'))
  }

  try {
    const shareholder = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.shareholderComposition.findUnique({ where: { id } })
        if (!existing) {
          throw new Error('NOT_FOUND')
        }
        return tx.shareholderComposition.update({
          where: { id },
          data,
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(shareholder as ShareholderComposition)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError('NOT_FOUND', `Shareholder not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to update shareholder'
    return failure(createServiceError('DATABASE_ERROR', message, { id, data }))
  }
}

async function deleteShareholder(id: string): Promise<ShareholderResult<void>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.shareholderComposition.findUnique({ where: { id } })
        if (!existing) {
          throw new Error('NOT_FOUND')
        }
        await tx.shareholderComposition.delete({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(undefined)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError('NOT_FOUND', `Shareholder not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to delete shareholder'
    return failure(createServiceError('DATABASE_ERROR', message, { id }))
  }
}

async function getShareholderSummary(
  companyId: string
): Promise<ShareholderResult<Record<ShareholderCategory, number>>> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'companyId is required'))
  }

  try {
    const shareholders = await prisma.$transaction(
      async (tx) => {
        return tx.shareholderComposition.findMany({
          where: { companyId },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    const summary = shareholders.reduce(
      (acc, s) => {
        const shareholderType = s.shareholderType as ShareholderCategory
        acc[shareholderType] = (acc[shareholderType] || 0) + (s.percentage as number)
        return acc
      },
      {} as Record<ShareholderCategory, number>
    )

    return success(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get shareholder summary'
    return failure(createServiceError('DATABASE_ERROR', message, { companyId }))
  }
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    shareholderComposition: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

describe('IRShareholderService', () => {
  const mockCompanyId = 'company-123'
  const mockShareholderId = 'shareholder-456'

  const mockShareholder: ShareholderComposition = {
    id: mockShareholderId,
    companyId: mockCompanyId,
    asOfDate: new Date('2024-12-31'),
    shareholderType: 'FINANCIAL_INSTITUTION',
    shareholderName: 'テスト銀行',
    sharesHeld: 1000000,
    percentage: 25.5,
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getShareholders', () => {
    it('should return success with shareholders list', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findMany: vi.fn().mockResolvedValue([mockShareholder]),
          },
        }
        return fn(tx)
      })

      const result = await getShareholders(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].shareholderName).toBe('テスト銀行')
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await getShareholders('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return empty array when no shareholders', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        }
        return fn(tx)
      })

      const result = await getShareholders(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([])
      }
    })

    it('should return failure on database error', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database error'))

      const result = await getShareholders(mockCompanyId)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('createShareholder', () => {
    const createData: CreateShareholderData = {
      companyId: mockCompanyId,
      asOfDate: new Date('2024-12-31'),
      shareholderType: 'FINANCIAL_INSTITUTION',
      shareholderName: 'テスト銀行',
      sharesHeld: 1000000,
      percentage: 25.5,
    }

    it('should return success with created shareholder', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            create: vi.fn().mockResolvedValue(mockShareholder),
          },
        }
        return fn(tx)
      })

      const result = await createShareholder(createData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.shareholderName).toBe('テスト銀行')
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await createShareholder({ ...createData, companyId: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Missing required fields')
      }
    })

    it('should return failure when shareholderName is missing', async () => {
      const result = await createShareholder({ ...createData, shareholderName: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when percentage is negative', async () => {
      const result = await createShareholder({ ...createData, percentage: -10 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('percentage must be between 0 and 100')
      }
    })

    it('should return failure when percentage exceeds 100', async () => {
      const result = await createShareholder({ ...createData, percentage: 150 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when sharesHeld is negative', async () => {
      const result = await createShareholder({ ...createData, sharesHeld: -1000 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('sharesHeld must be non-negative')
      }
    })

    it('should create shareholder with voting rights', async () => {
      const dataWithVotingRights = { ...createData, votingRightsRatio: 25.0 }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            create: vi.fn().mockResolvedValue({
              ...mockShareholder,
              votingRightsRatio: 25.0,
            }),
          },
        }
        return fn(tx)
      })

      const result = await createShareholder(dataWithVotingRights)

      expect(result.success).toBe(true)
    })
  })

  describe('updateShareholder', () => {
    const updateData: UpdateShareholderData = {
      shareholderName: 'Updated Name',
    }

    it('should return success with updated shareholder', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findUnique: vi.fn().mockResolvedValue(mockShareholder),
            update: vi.fn().mockResolvedValue({ ...mockShareholder, ...updateData }),
          },
        }
        return fn(tx)
      })

      const result = await updateShareholder(mockShareholderId, updateData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.shareholderName).toBe('Updated Name')
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await updateShareholder('', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when no update data provided', async () => {
      const result = await updateShareholder(mockShareholderId, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('No update data provided')
      }
    })

    it('should return failure when percentage is invalid', async () => {
      const result = await updateShareholder(mockShareholderId, { percentage: -5 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when shareholder not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await updateShareholder('non-existent', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('deleteShareholder', () => {
    it('should return success when shareholder deleted', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findUnique: vi.fn().mockResolvedValue(mockShareholder),
            delete: vi.fn().mockResolvedValue(mockShareholder),
          },
        }
        return fn(tx)
      })

      const result = await deleteShareholder(mockShareholderId)

      expect(result.success).toBe(true)
    })

    it('should return failure when id is missing', async () => {
      const result = await deleteShareholder('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when shareholder not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findUnique: vi.fn().mockResolvedValue(null),
            delete: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await deleteShareholder('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('getShareholderSummary', () => {
    it('should return success with shareholder summary', async () => {
      const shareholders = [
        { ...mockShareholder, shareholderType: 'FINANCIAL_INSTITUTION', percentage: 30 },
        { ...mockShareholder, shareholderType: 'INDIVIDUAL', percentage: 25 },
        { ...mockShareholder, shareholderType: 'FOREIGN_INVESTOR', percentage: 20 },
        { ...mockShareholder, shareholderType: 'OTHER_CORPORATION', percentage: 15 },
        { ...mockShareholder, shareholderType: 'TREASURY_STOCK', percentage: 10 },
      ]

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findMany: vi.fn().mockResolvedValue(shareholders),
          },
        }
        return fn(tx)
      })

      const result = await getShareholderSummary(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data['FINANCIAL_INSTITUTION']).toBe(30)
        expect(result.data['INDIVIDUAL']).toBe(25)
        expect(result.data['FOREIGN_INVESTOR']).toBe(20)
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await getShareholderSummary('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return empty summary when no shareholders', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        }
        return fn(tx)
      })

      const result = await getShareholderSummary(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({})
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle multiple shareholders with same shareholderType', async () => {
      const shareholders = [
        {
          ...mockShareholder,
          id: 'sh-1',
          shareholderType: 'FINANCIAL_INSTITUTION',
          percentage: 15,
        },
        {
          ...mockShareholder,
          id: 'sh-2',
          shareholderType: 'FINANCIAL_INSTITUTION',
          percentage: 20,
        },
      ]

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            findMany: vi.fn().mockResolvedValue(shareholders),
          },
        }
        return fn(tx)
      })

      const result = await getShareholderSummary(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data['FINANCIAL_INSTITUTION']).toBe(35)
      }
    })

    it('should handle zero percentage', async () => {
      const createData: CreateShareholderData = {
        companyId: mockCompanyId,
        asOfDate: new Date(),
        shareholderType: 'INDIVIDUAL',
        shareholderName: 'Zero Share',
        sharesHeld: 0,
        percentage: 0,
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            create: vi.fn().mockResolvedValue({
              ...mockShareholder,
              percentage: 0,
              sharesHeld: 0,
            }),
          },
        }
        return fn(tx)
      })

      const result = await createShareholder(createData)

      expect(result.success).toBe(true)
    })

    it('should handle boundary percentage of 100', async () => {
      const createData: CreateShareholderData = {
        companyId: mockCompanyId,
        asOfDate: new Date(),
        shareholderType: 'INDIVIDUAL',
        shareholderName: 'Full Owner',
        sharesHeld: 1000000,
        percentage: 100,
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          shareholderComposition: {
            create: vi.fn().mockResolvedValue({
              ...mockShareholder,
              percentage: 100,
            }),
          },
        }
        return fn(tx)
      })

      const result = await createShareholder(createData)

      expect(result.success).toBe(true)
    })
  })
})

export {
  getShareholders,
  createShareholder,
  updateShareholder,
  deleteShareholder,
  getShareholderSummary,
}

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { success, failure, type Result } from '@/types/result'
import type { FAQ, FAQList, CreateFAQData, UpdateFAQData, ReorderFAQsData } from '@/types/ir-report'

type FAQServiceError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

type FAQResult<T> = Result<T, FAQServiceError>

const DB_TIMEOUT_MS = 30000
const DB_MAX_WAIT_MS = 5000

function createServiceError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): FAQServiceError {
  return { code, message, details }
}

async function getFAQs(companyId: string): Promise<FAQResult<FAQList[]>> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'companyId is required'))
  }

  try {
    const faqs = await prisma.$transaction(
      async (tx) => {
        return tx.fAQ.findMany({
          where: { companyId },
          select: {
            id: true,
            companyId: true,
            question: true,
            category: true,
            sortOrder: true,
            isActive: true,
          },
          orderBy: [{ sortOrder: 'asc' }],
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(faqs as FAQList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get FAQs'
    return failure(createServiceError('DATABASE_ERROR', message, { companyId }))
  }
}

async function getFAQ(id: string): Promise<FAQResult<FAQ>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  try {
    const faq = await prisma.$transaction(
      async (tx) => {
        return tx.fAQ.findUnique({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    if (!faq) {
      return failure(createServiceError('NOT_FOUND', `FAQ not found: ${id}`))
    }

    return success(faq as FAQ)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get FAQ'
    return failure(createServiceError('DATABASE_ERROR', message, { id }))
  }
}

async function createFAQ(data: CreateFAQData): Promise<FAQResult<FAQ>> {
  if (!data.companyId || !data.question || !data.answer) {
    return failure(createServiceError('VALIDATION_ERROR', 'Missing required fields'))
  }

  if (data.question.length > 1000) {
    return failure(createServiceError('VALIDATION_ERROR', 'Question is too long'))
  }

  if (data.answer.length > 10000) {
    return failure(createServiceError('VALIDATION_ERROR', 'Answer is too long'))
  }

  try {
    const faq = await prisma.$transaction(
      async (tx) => {
        return tx.fAQ.create({
          data: {
            companyId: data.companyId,
            question: data.question,
            answer: data.answer,
            category: data.category ?? null,
            sortOrder: data.sortOrder ?? 0,
            isActive: true,
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(faq as FAQ)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create FAQ'
    return failure(createServiceError('DATABASE_ERROR', message, { data }))
  }
}

async function updateFAQ(id: string, data: UpdateFAQData): Promise<FAQResult<FAQ>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  if (!data || Object.keys(data).length === 0) {
    return failure(createServiceError('VALIDATION_ERROR', 'No update data provided'))
  }

  if (data.question && data.question.length > 1000) {
    return failure(createServiceError('VALIDATION_ERROR', 'Question is too long'))
  }

  if (data.answer && data.answer.length > 10000) {
    return failure(createServiceError('VALIDATION_ERROR', 'Answer is too long'))
  }

  try {
    const faq = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.fAQ.findUnique({ where: { id } })
        if (!existing) {
          throw new Error('NOT_FOUND')
        }
        return tx.fAQ.update({
          where: { id },
          data,
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(faq as FAQ)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError('NOT_FOUND', `FAQ not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to update FAQ'
    return failure(createServiceError('DATABASE_ERROR', message, { id, data }))
  }
}

async function deleteFAQ(id: string): Promise<FAQResult<void>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.fAQ.findUnique({ where: { id } })
        if (!existing) {
          throw new Error('NOT_FOUND')
        }
        await tx.fAQ.delete({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(undefined)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError('NOT_FOUND', `FAQ not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to delete FAQ'
    return failure(createServiceError('DATABASE_ERROR', message, { id }))
  }
}

async function reorderFAQs(companyId: string, data: ReorderFAQsData): Promise<FAQResult<void>> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'companyId is required'))
  }

  if (!data?.faqIds || !Array.isArray(data.faqIds)) {
    return failure(createServiceError('VALIDATION_ERROR', 'faqIds array is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const faqs = await tx.fAQ.findMany({
          where: { companyId },
        })

        const faqMap = new Map(faqs.map((f) => [f.id, f]))
        for (const faqId of data.faqIds) {
          if (!faqMap.has(faqId)) {
            throw new Error(`INVALID_FAQ: ${faqId}`)
          }
        }

        const updates = data.faqIds.map((faqId, index) =>
          tx.fAQ.update({
            where: { id: faqId },
            data: { sortOrder: index },
          })
        )

        await Promise.all(updates)
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(undefined)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('INVALID_FAQ')) {
      return failure(
        createServiceError('VALIDATION_ERROR', `Invalid FAQ ID in order: ${error.message}`)
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to reorder FAQs'
    return failure(createServiceError('DATABASE_ERROR', message, { companyId }))
  }
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    fAQ: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

describe('IRFAQService', () => {
  const mockCompanyId = 'company-123'
  const mockFAQId = 'faq-456'

  const mockFAQ: FAQ = {
    id: mockFAQId,
    companyId: mockCompanyId,
    question: '配当政策について教えてください',
    answer: '当社は安定した配当を維持することを目指しています。',
    category: '配当',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockFAQList: FAQList = {
    id: mockFAQId,
    companyId: mockCompanyId,
    question: '配当政策について教えてください',
    category: '配当',
    sortOrder: 0,
    isActive: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFAQs', () => {
    it('should return success with FAQs list', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findMany: vi.fn().mockResolvedValue([mockFAQList]),
          },
        }
        return fn(tx)
      })

      const result = await getFAQs(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].question).toBe('配当政策について教えてください')
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await getFAQs('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return empty array when no FAQs', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        }
        return fn(tx)
      })

      const result = await getFAQs(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([])
      }
    })

    it('should return failure on database error', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database error'))

      const result = await getFAQs(mockCompanyId)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('getFAQ', () => {
    it('should return success with FAQ details', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findUnique: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await getFAQ(mockFAQId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(mockFAQId)
        expect(result.data.answer).toBe('当社は安定した配当を維持することを目指しています。')
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await getFAQ('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when FAQ not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        }
        return fn(tx)
      })

      const result = await getFAQ('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('createFAQ', () => {
    const createData: CreateFAQData = {
      companyId: mockCompanyId,
      question: '新しいFAQ',
      answer: '回答内容',
    }

    it('should return success with created FAQ', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            create: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await createFAQ(createData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await createFAQ({ ...createData, companyId: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Missing required fields')
      }
    })

    it('should return failure when question is missing', async () => {
      const result = await createFAQ({ ...createData, question: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when answer is missing', async () => {
      const result = await createFAQ({ ...createData, answer: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when question is too long', async () => {
      const result = await createFAQ({ ...createData, question: 'a'.repeat(1001) })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Question is too long')
      }
    })

    it('should return failure when answer is too long', async () => {
      const result = await createFAQ({ ...createData, answer: 'a'.repeat(10001) })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Answer is too long')
      }
    })

    it('should create FAQ with category', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            create: vi.fn().mockResolvedValue({ ...mockFAQ, category: '財務' }),
          },
        }
        return fn(tx)
      })

      const result = await createFAQ({ ...createData, category: '財務' })

      expect(result.success).toBe(true)
    })
  })

  describe('updateFAQ', () => {
    const updateData: UpdateFAQData = {
      question: 'Updated Question',
    }

    it('should return success with updated FAQ', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findUnique: vi.fn().mockResolvedValue(mockFAQ),
            update: vi.fn().mockResolvedValue({ ...mockFAQ, ...updateData }),
          },
        }
        return fn(tx)
      })

      const result = await updateFAQ(mockFAQId, updateData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.question).toBe('Updated Question')
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await updateFAQ('', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when no update data provided', async () => {
      const result = await updateFAQ(mockFAQId, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('No update data provided')
      }
    })

    it('should return failure when FAQ not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await updateFAQ('non-existent', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('should update isActive status', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findUnique: vi.fn().mockResolvedValue(mockFAQ),
            update: vi.fn().mockResolvedValue({ ...mockFAQ, isActive: false }),
          },
        }
        return fn(tx)
      })

      const result = await updateFAQ(mockFAQId, { isActive: false })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(false)
      }
    })
  })

  describe('deleteFAQ', () => {
    it('should return success when FAQ deleted', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findUnique: vi.fn().mockResolvedValue(mockFAQ),
            delete: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await deleteFAQ(mockFAQId)

      expect(result.success).toBe(true)
    })

    it('should return failure when id is missing', async () => {
      const result = await deleteFAQ('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when FAQ not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findUnique: vi.fn().mockResolvedValue(null),
            delete: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await deleteFAQ('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('reorderFAQs', () => {
    const mockFAQs = [
      { ...mockFAQ, id: 'faq-1', sortOrder: 0 },
      { ...mockFAQ, id: 'faq-2', sortOrder: 1 },
      { ...mockFAQ, id: 'faq-3', sortOrder: 2 },
    ]

    it('should return success when FAQs reordered', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findMany: vi.fn().mockResolvedValue(mockFAQs),
            update: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await reorderFAQs(mockCompanyId, {
        faqIds: ['faq-3', 'faq-1', 'faq-2'],
      })

      expect(result.success).toBe(true)
    })

    it('should return failure when companyId is missing', async () => {
      const result = await reorderFAQs('', { faqIds: ['faq-1'] })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when faqIds is missing', async () => {
      const result = await reorderFAQs(mockCompanyId, {} as any)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('faqIds array is required')
      }
    })

    it('should return failure when invalid FAQ ID in order', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            findMany: vi.fn().mockResolvedValue(mockFAQs),
            update: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await reorderFAQs(mockCompanyId, {
        faqIds: ['invalid-faq-id'],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Invalid FAQ ID')
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle boundary question length', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            create: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await createFAQ({
        companyId: mockCompanyId,
        question: 'a'.repeat(1000),
        answer: 'Answer',
      })

      expect(result.success).toBe(true)
    })

    it('should handle boundary answer length', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            create: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await createFAQ({
        companyId: mockCompanyId,
        question: 'Question',
        answer: 'a'.repeat(10000),
      })

      expect(result.success).toBe(true)
    })

    it('should handle special characters in question', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            create: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await createFAQ({
        companyId: mockCompanyId,
        question: '特殊文字 <>&"\'テスト',
        answer: 'Answer',
      })

      expect(result.success).toBe(true)
    })

    it('should handle markdown in answer', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          fAQ: {
            create: vi.fn().mockResolvedValue(mockFAQ),
          },
        }
        return fn(tx)
      })

      const result = await createFAQ({
        companyId: mockCompanyId,
        question: 'Question',
        answer: '# Header\n\n- Item 1\n- Item 2\n\n**Bold**',
      })

      expect(result.success).toBe(true)
    })
  })
})

export { getFAQs, getFAQ, createFAQ, updateFAQ, deleteFAQ, reorderFAQs }

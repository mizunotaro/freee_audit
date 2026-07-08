import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { getActiveFAQs } from '@/services/reports/ir-faq-service'

type MockFn = ReturnType<typeof vi.fn>

type MockDb = {
  $transaction: MockFn
  fAQ: {
    findMany: MockFn
  }
}

const db = prisma as unknown as MockDb

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    fAQ: {
      findMany: vi.fn(),
    },
  },
}))

const mockFaqList = [
  {
    id: 'faq-1',
    companyId: 'company-1',
    question: '配当はいつですか？',
    category: 'dividend',
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 'faq-2',
    companyId: 'company-1',
    question: '決算発表はいつですか？',
    category: 'schedule',
    sortOrder: 1,
    isActive: true,
  },
]

describe('ir-faq-service / getActiveFAQs (real export)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ fAQ: db.fAQ }))
  })

  it('fails with VALIDATION_ERROR when companyId is missing', async () => {
    const result = await getActiveFAQs('')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('returns active FAQs ordered by sortOrder ascending', async () => {
    db.fAQ.findMany.mockResolvedValue(mockFaqList)

    const result = await getActiveFAQs('company-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(mockFaqList)
    }

    const callArg = db.fAQ.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>
      orderBy: Array<Record<string, unknown>>
    }
    expect(callArg.where).toMatchObject({ companyId: 'company-1', isActive: true })
    expect(callArg.orderBy).toEqual([{ sortOrder: 'asc' }])
  })

  it('returns an empty list when no active FAQs exist', async () => {
    db.fAQ.findMany.mockResolvedValue([])

    const result = await getActiveFAQs('company-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([])
    }
  })

  it('fails with DATABASE_ERROR when the transaction rejects', async () => {
    db.fAQ.findMany.mockRejectedValue(new Error('boom'))

    const result = await getActiveFAQs('company-1')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR')
    }
  })
})

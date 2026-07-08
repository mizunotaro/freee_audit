import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { getUpcomingIREvents } from '@/services/reports/ir-event-service'

type MockFn = ReturnType<typeof vi.fn>

type MockDb = {
  $transaction: MockFn
  iREvent: {
    findMany: MockFn
  }
}

const db = prisma as unknown as MockDb

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    iREvent: {
      findMany: vi.fn(),
    },
  },
}))

const mockEventList = [
  {
    id: 'ev-1',
    companyId: 'company-1',
    eventType: 'earnings',
    title: '第1四半期決算説明会',
    scheduledDate: new Date('2099-04-15'),
    status: 'scheduled',
  },
  {
    id: 'ev-2',
    companyId: 'company-1',
    eventType: 'meeting',
    title: '株主総会',
    scheduledDate: new Date('2099-06-20'),
    status: 'scheduled',
  },
]

describe('ir-event-service / getUpcomingIREvents (real export)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ iREvent: db.iREvent })
    )
  })

  it('fails with VALIDATION_ERROR when companyId is missing', async () => {
    const result = await getUpcomingIREvents('')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('returns upcoming scheduled events and limits to 10', async () => {
    db.iREvent.findMany.mockResolvedValue(mockEventList)

    const result = await getUpcomingIREvents('company-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(mockEventList)
    }

    const callArg = db.iREvent.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>
      take: number
    }
    expect(callArg.where).toMatchObject({
      companyId: 'company-1',
      status: 'scheduled',
    })
    expect((callArg.where.scheduledDate as { gte: unknown }).gte).toBeInstanceOf(Date)
    expect(callArg.take).toBe(10)
  })

  it('returns an empty list when no upcoming events exist', async () => {
    db.iREvent.findMany.mockResolvedValue([])

    const result = await getUpcomingIREvents('company-1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([])
    }
  })

  it('fails with DATABASE_ERROR when the transaction rejects', async () => {
    db.iREvent.findMany.mockRejectedValue(new Error('boom'))

    const result = await getUpcomingIREvents('company-1')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR')
    }
  })
})

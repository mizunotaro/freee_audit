import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import {
  getShareholderCompositions,
  upsertShareholderComposition,
  deleteShareholderComposition,
  getLatestShareholderComposition,
} from '@/services/reports/ir-shareholder-service'

type MockFn = ReturnType<typeof vi.fn>

type MockDb = {
  $transaction: MockFn
  shareholderComposition: {
    findMany: MockFn
    findFirst: MockFn
    findUnique: MockFn
    create: MockFn
    update: MockFn
    delete: MockFn
  }
}

const db = prisma as unknown as MockDb

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    shareholderComposition: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const asOfDate = new Date('2024-03-31')

const mockComposition = {
  id: 'sc-1',
  companyId: 'company-1',
  asOfDate,
  shareholderType: 'FINANCIAL_INSTITUTION',
  shareholderName: 'テスト銀行',
  sharesHeld: 1000,
  percentage: 30,
}

const upsertInput = {
  companyId: 'company-1',
  asOfDate,
  shareholderType: 'FINANCIAL_INSTITUTION',
  shareholderName: 'テスト銀行',
  sharesHeld: 1000,
  percentage: 30,
}

describe('ir-shareholder-service (real exports)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ shareholderComposition: db.shareholderComposition })
    )
  })

  describe('getShareholderCompositions', () => {
    it('fails with VALIDATION_ERROR when companyId is missing', async () => {
      const result = await getShareholderCompositions('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('returns compositions ordered as stored by the database', async () => {
      db.shareholderComposition.findMany.mockResolvedValue([mockComposition])

      const result = await getShareholderCompositions('company-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([mockComposition])
      }
      expect(db.shareholderComposition.findMany).toHaveBeenCalledTimes(1)
      const callArg = db.shareholderComposition.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>
      }
      expect(callArg.where).toMatchObject({ companyId: 'company-1' })
    })

    it('passes asOfDate and shareholderType filters into the where clause', async () => {
      db.shareholderComposition.findMany.mockResolvedValue([])

      await getShareholderCompositions('company-1', {
        asOfDate,
        shareholderType: 'INDIVIDUAL',
      })

      const callArg = db.shareholderComposition.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>
      }
      expect(callArg.where).toMatchObject({
        companyId: 'company-1',
        asOfDate,
        shareholderType: 'INDIVIDUAL',
      })
    })

    it('fails with DATABASE_ERROR when the transaction rejects', async () => {
      db.shareholderComposition.findMany.mockRejectedValue(new Error('boom'))

      const result = await getShareholderCompositions('company-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('upsertShareholderComposition', () => {
    it('creates a new composition when none exists', async () => {
      db.shareholderComposition.findFirst.mockResolvedValue(null)
      db.shareholderComposition.create.mockResolvedValue(mockComposition)

      const result = await upsertShareholderComposition(upsertInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockComposition)
      }
      expect(db.shareholderComposition.create).toHaveBeenCalledTimes(1)
      expect(db.shareholderComposition.update).not.toHaveBeenCalled()
    })

    it('updates the existing composition when a match is found', async () => {
      db.shareholderComposition.findFirst.mockResolvedValue(mockComposition)
      db.shareholderComposition.update.mockResolvedValue({
        ...mockComposition,
        percentage: 35,
      })

      const result = await upsertShareholderComposition(upsertInput)

      expect(result.success).toBe(true)
      expect(db.shareholderComposition.update).toHaveBeenCalledTimes(1)
      expect(db.shareholderComposition.create).not.toHaveBeenCalled()
    })

    it('fails with VALIDATION_ERROR when companyId is missing', async () => {
      const result = await upsertShareholderComposition({ ...upsertInput, companyId: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('fails with VALIDATION_ERROR when asOfDate is not a Date', async () => {
      const result = await upsertShareholderComposition({
        ...upsertInput,
        asOfDate: '2024-03-31' as unknown as Date,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('fails with VALIDATION_ERROR when shareholderType is missing', async () => {
      const result = await upsertShareholderComposition({
        ...upsertInput,
        shareholderType: '',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('fails with VALIDATION_ERROR when sharesHeld is negative', async () => {
      const result = await upsertShareholderComposition({
        ...upsertInput,
        sharesHeld: -5,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('fails with VALIDATION_ERROR when percentage is out of range', async () => {
      const result = await upsertShareholderComposition({
        ...upsertInput,
        percentage: 150,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('fails with DATABASE_ERROR when the transaction rejects', async () => {
      db.shareholderComposition.findFirst.mockRejectedValue(new Error('boom'))

      const result = await upsertShareholderComposition(upsertInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('deleteShareholderComposition', () => {
    it('fails with VALIDATION_ERROR when id is missing', async () => {
      const result = await deleteShareholderComposition('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('deletes the composition and returns an empty list on success', async () => {
      db.shareholderComposition.findUnique.mockResolvedValue(mockComposition)
      db.shareholderComposition.delete.mockResolvedValue(mockComposition)

      const result = await deleteShareholderComposition('sc-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([])
      }
      expect(db.shareholderComposition.delete).toHaveBeenCalledTimes(1)
    })

    it('fails with NOT_FOUND when the composition does not exist', async () => {
      db.shareholderComposition.findUnique.mockResolvedValue(null)

      const result = await deleteShareholderComposition('missing')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
        expect(result.error.message).toContain('missing')
      }
      expect(db.shareholderComposition.delete).not.toHaveBeenCalled()
    })

    it('fails with DATABASE_ERROR when the transaction rejects', async () => {
      db.shareholderComposition.findUnique.mockRejectedValue(new Error('boom'))

      const result = await deleteShareholderComposition('sc-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('getLatestShareholderComposition', () => {
    it('fails with VALIDATION_ERROR when companyId is missing', async () => {
      const result = await getLatestShareholderComposition('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('returns the compositions for the latest asOfDate', async () => {
      db.shareholderComposition.findFirst.mockResolvedValue({ asOfDate })
      db.shareholderComposition.findMany.mockResolvedValue([mockComposition])

      const result = await getLatestShareholderComposition('company-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([mockComposition])
      }
    })

    it('returns an empty list when no compositions exist', async () => {
      db.shareholderComposition.findFirst.mockResolvedValue(null)

      const result = await getLatestShareholderComposition('company-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([])
      }
      expect(db.shareholderComposition.findMany).not.toHaveBeenCalled()
    })

    it('fails with DATABASE_ERROR when the transaction rejects', async () => {
      db.shareholderComposition.findFirst.mockRejectedValue(new Error('boom'))

      const result = await getLatestShareholderComposition('company-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })
})

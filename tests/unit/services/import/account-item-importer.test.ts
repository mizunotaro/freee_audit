import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AccountItemImporter,
  AccountItemImportSchema,
  accountItemImporter,
} from '@/services/import/account-item-importer'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    accountItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('AccountItemImportSchema', () => {
  it('validates a valid account item', () => {
    const validRow = {
      freeeId: 1001,
      name: '現金',
      shortcut: 'ゲンキン',
      shortcutNum: '1',
      categoryId: 100,
      categoryName: '流動資産',
      categoryType: 'asset',
      searchable: true,
      cumulable: false,
      balance: 'debit' as const,
    }

    const result = AccountItemImportSchema.safeParse(validRow)
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const invalidRow = {
      freeeId: 1001,
      name: '',
      categoryId: 100,
      categoryName: '流動資産',
      categoryType: 'asset',
      searchable: true,
      cumulable: false,
      balance: 'debit' as const,
    }

    const result = AccountItemImportSchema.safeParse(invalidRow)
    expect(result.success).toBe(false)
  })

  it('rejects invalid balance', () => {
    const invalidRow = {
      freeeId: 1001,
      name: '現金',
      categoryId: 100,
      categoryName: '流動資産',
      categoryType: 'asset',
      searchable: true,
      cumulable: false,
      balance: 'invalid',
    }

    const result = AccountItemImportSchema.safeParse(invalidRow)
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const validRow = {
      freeeId: 1001,
      name: '現金',
      categoryId: 100,
      categoryName: '流動資産',
      categoryType: 'asset',
      searchable: true,
      cumulable: false,
      balance: 'debit' as const,
    }

    const result = AccountItemImportSchema.safeParse(validRow)
    expect(result.success).toBe(true)
  })

  it('rejects zero freeeId', () => {
    const invalidRow = {
      freeeId: 0,
      name: '現金',
      categoryId: 100,
      categoryName: '流動資産',
      categoryType: 'asset',
      searchable: true,
      cumulable: false,
      balance: 'debit' as const,
    }

    const result = AccountItemImportSchema.safeParse(invalidRow)
    expect(result.success).toBe(false)
  })
})

describe('AccountItemImporter', () => {
  let importer: AccountItemImporter

  beforeEach(() => {
    importer = new AccountItemImporter()
    vi.clearAllMocks()
  })

  describe('importSingleRow', () => {
    const validRow = {
      freeeId: 1001,
      name: '現金',
      shortcut: 'ゲンキン',
      shortcutNum: '1',
      categoryId: 100,
      categoryName: '流動資産',
      categoryType: 'asset',
      correspondingIncomeId: undefined,
      correspondingIncomeName: undefined,
      correspondingExpenseId: undefined,
      correspondingExpenseName: undefined,
      searchable: true,
      cumulable: false,
      balance: 'debit' as const,
    }

    const context = { companyId: 'company1' }

    it('creates new account item', async () => {
      vi.mocked(db.prisma.accountItem.findUnique).mockResolvedValue(null)
      vi.mocked(db.prisma.accountItem.create).mockResolvedValue({ id: '1' } as any)

      const result = await importer['importSingleRow'](validRow, context, {
        skipDuplicates: true,
        updateExisting: false,
        language: 'ja',
        dryRun: false,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('imported')
      }
      expect(db.prisma.accountItem.create).toHaveBeenCalled()
    })

    it('skips duplicate when skipDuplicates is true', async () => {
      vi.mocked(db.prisma.accountItem.findUnique).mockResolvedValue({ id: 'existing' } as any)

      const result = await importer['importSingleRow'](validRow, context, {
        skipDuplicates: true,
        updateExisting: false,
        language: 'ja',
        dryRun: false,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('skipped')
      }
    })

    it('updates existing when updateExisting is true', async () => {
      vi.mocked(db.prisma.accountItem.findUnique).mockResolvedValue({ id: 'existing' } as any)
      vi.mocked(db.prisma.accountItem.update).mockResolvedValue({ id: 'existing' } as any)

      const result = await importer['importSingleRow'](validRow, context, {
        skipDuplicates: false,
        updateExisting: true,
        language: 'ja',
        dryRun: false,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('imported')
      }
      expect(db.prisma.accountItem.update).toHaveBeenCalled()
    })

    it('returns duplicate error when neither skip nor update', async () => {
      vi.mocked(db.prisma.accountItem.findUnique).mockResolvedValue({ id: 'existing' } as any)

      const result = await importer['importSingleRow'](validRow, context, {
        skipDuplicates: false,
        updateExisting: false,
        language: 'ja',
        dryRun: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DUPLICATE')
      }
    })

    it('handles database error gracefully', async () => {
      vi.mocked(db.prisma.accountItem.findUnique).mockRejectedValue(new Error('DB Error'))

      const result = await importer['importSingleRow'](validRow, context, {
        skipDuplicates: true,
        updateExisting: false,
        language: 'ja',
        dryRun: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('generateTemplate', () => {
    it('generates Japanese template', () => {
      const template = importer.generateTemplate('ja')
      expect(template).toContain('科目ID')
      expect(template).toContain('科目名')
      expect(template).toContain('残高方向')
      expect(template.split('\n').length).toBeGreaterThan(1)
    })

    it('generates English template', () => {
      const template = importer.generateTemplate('en')
      expect(template).toContain('freee_id')
      expect(template).toContain('name')
      expect(template).toContain('balance')
      expect(template.split('\n').length).toBeGreaterThan(1)
    })
  })

  describe('validateRows', () => {
    it('validates and transforms rows', () => {
      const rows = [
        {
          freeeId: 1001,
          name: '現金',
          categoryId: 100,
          categoryName: '流動資産',
          categoryType: '資産',
          searchable: 'true',
          cumulable: 'false',
          balance: '借方',
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.valid.length).toBe(1)
      expect(result.valid[0].categoryType).toBe('asset')
      expect(result.valid[0].balance).toBe('debit')
    })

    it('handles invalid rows', () => {
      const rows = [
        {
          freeeId: 0,
          name: '',
          categoryId: 0,
          categoryName: '',
          categoryType: '',
          searchable: true,
          cumulable: false,
          balance: 'invalid',
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.invalid.length).toBe(1)
    })

    it('maps Japanese category types', () => {
      const rows = [
        {
          freeeId: 1001,
          name: '売上',
          categoryId: 400,
          categoryName: '売上',
          categoryType: '収益',
          searchable: true,
          cumulable: false,
          balance: 'credit',
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.valid[0]?.categoryType).toBe('revenue')
    })

    it('maps balance directions', () => {
      const rows = [
        {
          freeeId: 2001,
          name: '買掛金',
          categoryId: 200,
          categoryName: '流動負債',
          categoryType: '負債',
          searchable: true,
          cumulable: false,
          balance: '貸方',
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.valid[0]?.balance).toBe('credit')
    })
  })

  it('exports singleton instance', () => {
    expect(accountItemImporter).toBeInstanceOf(AccountItemImporter)
  })
})

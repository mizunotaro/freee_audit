import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JournalImporter, JournalImportSchema } from '@/services/import/journal-importer'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('JournalImporter', () => {
  let importer: JournalImporter

  beforeEach(() => {
    importer = new JournalImporter()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('JournalImportSchema', () => {
    it('should validate a valid journal row', () => {
      const validRow = {
        entryDate: '2024-01-15',
        description: '売上計上',
        debitAccount: '普通預金',
        creditAccount: '売上高',
        amount: 110000,
        taxAmount: 10000,
        taxType: '課税10%',
      }

      const result = JournalImportSchema.safeParse(validRow)
      expect(result.success).toBe(true)
    })

    it('should reject invalid date format', () => {
      const invalidRow = {
        entryDate: '2024/01/15',
        description: '売上計上',
        debitAccount: '普通預金',
        creditAccount: '売上高',
        amount: 110000,
        taxAmount: 10000,
      }

      const result = JournalImportSchema.safeParse(invalidRow)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('YYYY-MM-DD')
      }
    })

    it('should reject empty description', () => {
      const invalidRow = {
        entryDate: '2024-01-15',
        description: '',
        debitAccount: '普通預金',
        creditAccount: '売上高',
        amount: 110000,
        taxAmount: 10000,
      }

      const result = JournalImportSchema.safeParse(invalidRow)
      expect(result.success).toBe(false)
    })

    it('should reject negative amount', () => {
      const invalidRow = {
        entryDate: '2024-01-15',
        description: '売上計上',
        debitAccount: '普通預金',
        creditAccount: '売上高',
        amount: -1000,
        taxAmount: 0,
      }

      const result = JournalImportSchema.safeParse(invalidRow)
      expect(result.success).toBe(false)
    })

    it('should accept optional taxType', () => {
      const validRow = {
        entryDate: '2024-01-15',
        description: '売上計上',
        debitAccount: '普通預金',
        creditAccount: '売上高',
        amount: 110000,
        taxAmount: 10000,
      }

      const result = JournalImportSchema.safeParse(validRow)
      expect(result.success).toBe(true)
    })
  })

  describe('generateTemplate', () => {
    it('should generate Japanese template', () => {
      const template = importer.generateTemplate('ja')

      expect(template).toContain('日付')
      expect(template).toContain('摘要')
      expect(template).toContain('借方科目')
      expect(template).toContain('貸方科目')
      expect(template).toContain('金額')
    })

    it('should generate English template', () => {
      const template = importer.generateTemplate('en')

      expect(template).toContain('date')
      expect(template).toContain('description')
      expect(template).toContain('debit_account')
      expect(template).toContain('credit_account')
      expect(template).toContain('amount')
    })

    it('should include sample data row', () => {
      const template = importer.generateTemplate('ja')
      const lines = template.split('\n')

      expect(lines.length).toBe(2)
      expect(lines[1]).toContain('2024-01-15')
    })
  })

  describe('type property', () => {
    it('should return journal type', () => {
      expect(importer.type).toBe('journal')
    })
  })
})

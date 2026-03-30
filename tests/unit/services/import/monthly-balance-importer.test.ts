import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MonthlyBalanceImporter,
  MonthlyBalanceImportSchema,
  monthlyBalanceImporter,
} from '@/services/import/monthly-balance-importer'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    monthlyBalance: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/services/import/parsers/csv-parser', () => ({
  CsvParser: vi.fn(function () {
    return { parse: vi.fn() }
  }),
}))

vi.mock('@/services/import/parsers/excel-parser', () => ({
  ExcelParser: vi.fn(function () {
    return { parse: vi.fn() }
  }),
}))

describe('MonthlyBalanceImportSchema', () => {
  it('validates valid row', () => {
    const validRow = {
      fiscalYear: 2024,
      month: 1,
      accountCode: '100',
      accountName: '現金',
      category: 'current_asset',
      amount: 500000,
    }

    const result = MonthlyBalanceImportSchema.safeParse(validRow)
    expect(result.success).toBe(true)
  })

  it('rejects invalid month', () => {
    const invalidRow = {
      fiscalYear: 2024,
      month: 13,
      accountCode: '100',
      accountName: '現金',
      category: 'current_asset',
      amount: 500000,
    }

    const result = MonthlyBalanceImportSchema.safeParse(invalidRow)
    expect(result.success).toBe(false)
  })

  it('rejects empty accountCode', () => {
    const invalidRow = {
      fiscalYear: 2024,
      month: 1,
      accountCode: '',
      accountName: '現金',
      category: 'current_asset',
      amount: 500000,
    }

    const result = MonthlyBalanceImportSchema.safeParse(invalidRow)
    expect(result.success).toBe(false)
  })

  it('rejects year out of range', () => {
    const invalidRow = {
      fiscalYear: 1999,
      month: 1,
      accountCode: '100',
      accountName: '現金',
      category: 'current_asset',
      amount: 500000,
    }

    const result = MonthlyBalanceImportSchema.safeParse(invalidRow)
    expect(result.success).toBe(false)
  })
})

describe('MonthlyBalanceImporter', () => {
  let importer: MonthlyBalanceImporter

  beforeEach(() => {
    importer = new MonthlyBalanceImporter()
    vi.clearAllMocks()
  })

  describe('generateTemplate', () => {
    it('generates Japanese template', () => {
      const template = importer.generateTemplate('ja')
      expect(template).toContain('年度')
      expect(template).toContain('月')
      expect(template).toContain('勘定科目コード')
      expect(template.split('\n').length).toBeGreaterThan(1)
    })

    it('generates English template', () => {
      const template = importer.generateTemplate('en')
      expect(template).toContain('fiscal_year')
      expect(template).toContain('month')
      expect(template).toContain('account_code')
      expect(template.split('\n').length).toBeGreaterThan(1)
    })
  })

  describe('validateRows', () => {
    it('validates valid rows', () => {
      const rows = [
        {
          fiscalYear: 2024,
          month: 1,
          accountCode: '100',
          accountName: '現金',
          category: '流動資産',
          amount: 500000,
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.valid.length).toBe(1)
      expect(result.valid[0].fiscalYear).toBe(2024)
    })

    it('handles string fiscalYear and month', () => {
      const rows = [
        {
          fiscalYear: '2024',
          month: '1',
          accountCode: '100',
          accountName: '現金',
          category: 'current_asset',
          amount: 500000,
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.valid.length).toBe(1)
      expect(result.valid[0].fiscalYear).toBe(2024)
      expect(result.valid[0].month).toBe(1)
    })

    it('parses string amounts with commas', () => {
      const rows = [
        {
          fiscalYear: 2024,
          month: 1,
          accountCode: '100',
          accountName: '現金',
          category: 'current_asset',
          amount: '1,000,000',
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.valid.length).toBe(1)
      expect(result.valid[0].amount).toBe(1000000)
    })

    it('returns invalid for bad data', () => {
      const rows = [
        {
          fiscalYear: 1999,
          month: 13,
          accountCode: '',
          accountName: '',
          category: '',
          amount: 0,
        },
      ]

      const result = importer['validateRows'](rows)
      expect(result.invalid.length).toBe(1)
    })
  })

  describe('import', () => {
    it('returns error for unsupported file type', async () => {
      const file = new File(['data'], 'test.txt', { type: 'text/plain' })
      const context = { companyId: 'company1' }

      const result = await importer.import(file, context)
      expect(result.success).toBe(false)
    })
  })

  describe('preview', () => {
    it('returns error for unsupported file type', async () => {
      const file = new File(['data'], 'test.txt', { type: 'text/plain' })

      const result = await importer.preview(file)
      expect(result.success).toBe(false)
    })
  })

  it('exports singleton instance', () => {
    expect(monthlyBalanceImporter).toBeInstanceOf(MonthlyBalanceImporter)
  })
})

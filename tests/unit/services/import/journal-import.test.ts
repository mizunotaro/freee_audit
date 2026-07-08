import { describe, it, expect, vi } from 'vitest'
import {
  parseJournalCsv,
  validateJournalRows,
  importJournals,
  generateJournalTemplate,
  JournalImportSchema,
} from '@/services/import/journal-import'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('JournalImportSchema', () => {
  it('should validate a valid journal row', function () {
    const result = JournalImportSchema.safeParse({
      entryDate: '2024-01-15',
      description: 'Test entry',
      debitAccount: 'Cash',
      creditAccount: 'Revenue',
      amount: 10000,
    })

    expect(result.success).toBe(true)
  })

  it('should reject invalid date format', function () {
    const result = JournalImportSchema.safeParse({
      entryDate: '2024/01/15',
      description: 'Test',
      debitAccount: 'Cash',
      creditAccount: 'Revenue',
      amount: 10000,
    })

    expect(result.success).toBe(false)
  })

  it('should reject empty description', function () {
    const result = JournalImportSchema.safeParse({
      entryDate: '2024-01-15',
      description: '',
      debitAccount: 'Cash',
      creditAccount: 'Revenue',
      amount: 10000,
    })

    expect(result.success).toBe(false)
  })

  it('should reject negative amount', function () {
    const result = JournalImportSchema.safeParse({
      entryDate: '2024-01-15',
      description: 'Test',
      debitAccount: 'Cash',
      creditAccount: 'Revenue',
      amount: -100,
    })

    expect(result.success).toBe(false)
  })

  it('should default taxAmount to 0', function () {
    const result = JournalImportSchema.safeParse({
      entryDate: '2024-01-15',
      description: 'Test',
      debitAccount: 'Cash',
      creditAccount: 'Revenue',
      amount: 10000,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.taxAmount).toBe(0)
    }
  })
})

describe('parseJournalCsv', () => {
  it('should parse valid CSV content', function () {
    const csv = `日付,摘要,借方科目,貸方科目,金額,税額,税区分
2024-01-15,売上計上,普通預金,売上高,110000,10000,課税10%`

    const result = parseJournalCsv(csv)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).toHaveLength(1)
    expect(result.data[0].entryDate).toBe('2024-01-15')
    expect(result.data[0].description).toBe('売上計上')
    expect(result.data[0].amount).toBe(110000)
  })

  it('should return failure for CSV with no data rows', function () {
    const csv = '日付,摘要,借方科目,貸方科目,金額'

    const result = parseJournalCsv(csv)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toBe('CSVファイルにはヘッダー行とデータ行が必要です')
  })

  it('should return failure for missing required headers', function () {
    const csv = `日付,摘要
2024-01-15,test`

    const result = parseJournalCsv(csv)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toContain('必須ヘッダーが不足しています')
  })

  it('should handle Japanese header mappings', function () {
    const csv = `伝票日付,摘要,借方,貸方,金額
2024-02-01,Test,現金,売上,50000`

    const result = parseJournalCsv(csv)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).toHaveLength(1)
    expect(result.data[0].debitAccount).toBe('現金')
  })

  it('should handle comma-separated values with quotes', function () {
    const csv = `日付,摘要,借方科目,貸方科目,金額
2024-01-15,"Test, with comma",現金,売上,50000`

    const result = parseJournalCsv(csv)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).toHaveLength(1)
    expect(result.data[0].description).toBe('Test, with comma')
  })
})

describe('validateJournalRows', () => {
  it('should return valid rows and errors', function () {
    const rows = [
      {
        entryDate: '2024-01-15',
        description: 'Valid',
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        amount: 1000,
        taxAmount: 0,
      },
      {
        entryDate: 'invalid',
        description: 'Invalid',
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        amount: 1000,
        taxAmount: 0,
      },
    ]

    const result = validateJournalRows(rows)

    expect(result.valid).toHaveLength(1)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should pass all valid rows', function () {
    const rows = [
      {
        entryDate: '2024-01-15',
        description: 'Entry 1',
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        amount: 1000,
        taxAmount: 0,
      },
      {
        entryDate: '2024-02-15',
        description: 'Entry 2',
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        amount: 2000,
        taxAmount: 100,
      },
    ]

    const result = validateJournalRows(rows)

    expect(result.valid).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })
})

describe('importJournals', () => {
  it('should skip duplicates when skipDuplicates is true', async function () {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.journal.findUnique).mockResolvedValue({ id: 'existing' } as any)

    const rows = [
      {
        entryDate: '2024-01-15',
        description: 'Test',
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        amount: 1000,
        taxAmount: 0,
      },
    ]

    const result = await importJournals(rows, 'co-1', {
      skipDuplicates: true,
      updateExisting: false,
    })

    expect(result.skipped).toBe(1)
    expect(result.imported).toBe(0)
  })

  it('should update existing when updateExisting is true', async function () {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.journal.findUnique).mockResolvedValue({ id: 'existing' } as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const rows = [
      {
        entryDate: '2024-01-15',
        description: 'Test',
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        amount: 1000,
        taxAmount: 0,
      },
    ]

    const result = await importJournals(rows, 'co-1', {
      skipDuplicates: false,
      updateExisting: true,
    })

    expect(result.imported).toBe(1)
    expect(prisma.journal.update).toHaveBeenCalled()
  })

  it('should create new journal entries', async function () {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.journal.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.journal.create).mockResolvedValue({} as any)

    const rows = [
      {
        entryDate: '2024-01-15',
        description: 'Test',
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        amount: 1000,
        taxAmount: 0,
      },
    ]

    const result = await importJournals(rows, 'co-1', {
      skipDuplicates: true,
      updateExisting: false,
    })

    expect(result.imported).toBe(1)
    expect(prisma.journal.create).toHaveBeenCalled()
  })
})

describe('generateJournalTemplate', () => {
  it('should generate CSV template with headers and sample row', function () {
    const template = generateJournalTemplate()

    expect(template).toContain('日付')
    expect(template).toContain('摘要')
    expect(template).toContain('借方科目')
    expect(template).toContain('貸方科目')
    expect(template).toContain('金額')

    const lines = template.split('\n')
    expect(lines).toHaveLength(2)
  })
})

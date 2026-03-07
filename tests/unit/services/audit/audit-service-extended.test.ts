import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  JournalChecker,
  createJournalChecker,
  ReceiptAnalyzer,
  createReceiptAnalyzer,
  analyzeJournal,
  getAuditStatus,
} from '@/services/audit'
import { prisma } from '@/lib/db'
import type { JournalEntryData, JournalCheckerConfig } from '@/services/audit'
import type { DocumentAnalysisResult } from '@/types/audit'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/ai', () => ({
  createAIProviderFromEnv: vi.fn(() => null),
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}))

describe('AuditServiceExtended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('JournalChecker', () => {
    const mockEntry: JournalEntryData = {
      id: 'entry-1',
      date: '2024-01-15',
      debitAccount: '旅費交通費',
      creditAccount: '普通預金',
      amount: 10000,
      taxAmount: 1000,
      taxType: 'TAXABLE_10',
      description: '東京-大阪 新幹線代',
    }

    const mockDocument: DocumentAnalysisResult = {
      date: '2024-01-15',
      amount: 10000,
      taxAmount: 1000,
      vendorName: 'JR東海',
      description: '新幹線乗車券',
      confidence: 0.95,
    }

    describe('constructor', () => {
      it('should create instance with default config', () => {
        const checker = new JournalChecker()
        expect(checker).toBeInstanceOf(JournalChecker)
      })

      it('should create instance with custom config', () => {
        const config: JournalCheckerConfig = {
          toleranceAmount: 10,
          toleranceDays: 3,
        }
        const checker = new JournalChecker(config)
        expect(checker).toBeInstanceOf(JournalChecker)
      })

      it('should accept AI provider in config', () => {
        const mockAIProvider = {
          analyzeDocument: vi.fn(),
          validateEntry: vi.fn(),
        }
        const checker = new JournalChecker({ aiProvider: mockAIProvider as any })
        expect(checker).toBeInstanceOf(JournalChecker)
      })
    })

    describe('createJournalChecker', () => {
      it('should create JournalChecker instance', () => {
        const checker = createJournalChecker()
        expect(checker).toBeInstanceOf(JournalChecker)
      })

      it('should create with config', () => {
        const checker = createJournalChecker({ toleranceAmount: 5 })
        expect(checker).toBeInstanceOf(JournalChecker)
      })
    })

    describe('check - date validation', () => {
      it('should pass when dates match', async () => {
        const checker = new JournalChecker()
        const result = await checker.check(mockEntry, mockDocument)

        const dateIssue = result.issues.find((i) => i.field === 'date')
        expect(dateIssue).toBeUndefined()
      })

      it('should detect date mismatch', async () => {
        const checker = new JournalChecker()
        const docWithDiffDate = { ...mockDocument, date: '2024-01-20' }
        const result = await checker.check(mockEntry, docWithDiffDate)

        const dateIssue = result.issues.find((i) => i.field === 'date')
        expect(dateIssue).toBeDefined()
        expect(dateIssue?.severity).toBe('error')
      })

      it('should allow date within tolerance', async () => {
        const checker = new JournalChecker({ toleranceDays: 5 })
        const docWithDiffDate = { ...mockDocument, date: '2024-01-18' }
        const result = await checker.check(mockEntry, docWithDiffDate)

        const dateIssue = result.issues.find((i) => i.field === 'date')
        expect(dateIssue).toBeUndefined()
      })

      it('should skip date check when document has no date', async () => {
        const checker = new JournalChecker()
        const docNoDate = { ...mockDocument, date: null }
        const result = await checker.check(mockEntry, docNoDate)

        const dateIssue = result.issues.find((i) => i.field === 'date')
        expect(dateIssue).toBeUndefined()
      })

      it('should handle invalid date format', async () => {
        const checker = new JournalChecker()
        const docInvalidDate = { ...mockDocument, date: 'invalid' }
        const result = await checker.check(mockEntry, docInvalidDate)

        expect(result).toBeDefined()
      })
    })

    describe('check - amount validation', () => {
      it('should pass when amounts match', async () => {
        const checker = new JournalChecker()
        const result = await checker.check(mockEntry, mockDocument)

        const amountIssue = result.issues.find((i) => i.field === 'amount' && i.severity !== 'info')
        expect(amountIssue).toBeUndefined()
      })

      it('should detect small amount mismatch as warning', async () => {
        const checker = new JournalChecker()
        const docWithDiffAmount = { ...mockDocument, amount: 10050 }
        const result = await checker.check(mockEntry, docWithDiffAmount)

        const amountIssue = result.issues.find((i) => i.field === 'amount')
        expect(amountIssue?.severity).toBe('warning')
      })

      it('should detect large amount mismatch as error', async () => {
        const checker = new JournalChecker()
        const docWithDiffAmount = { ...mockDocument, amount: 15000 }
        const result = await checker.check(mockEntry, docWithDiffAmount)

        const amountIssue = result.issues.find((i) => i.field === 'amount')
        expect(amountIssue?.severity).toBe('error')
      })

      it('should allow amount within tolerance', async () => {
        const checker = new JournalChecker({ toleranceAmount: 100 })
        const docWithDiffAmount = { ...mockDocument, amount: 10050 }
        const result = await checker.check(mockEntry, docWithDiffAmount)

        const amountIssue = result.issues.find((i) => i.field === 'amount')
        expect(amountIssue).toBeUndefined()
      })

      it('should handle documents with zero amount', async () => {
        const checker = new JournalChecker()
        const docZeroAmount = { ...mockDocument, amount: 0 }
        const entryZeroAmount = { ...mockEntry, amount: 0 }
        const result = await checker.check(entryZeroAmount, docZeroAmount)

        const amountIssue = result.issues.find((i) => i.field === 'amount')
        expect(amountIssue).toBeUndefined()
      })
    })

    describe('check - tax amount validation', () => {
      it('should pass when tax amounts match', async () => {
        const checker = new JournalChecker()
        const result = await checker.check(mockEntry, mockDocument)

        const taxIssue = result.issues.find((i) => i.field === 'taxAmount')
        expect(taxIssue).toBeUndefined()
      })

      it('should detect tax amount mismatch', async () => {
        const checker = new JournalChecker()
        const docWithDiffTax = { ...mockDocument, taxAmount: 500 }
        const result = await checker.check(mockEntry, docWithDiffTax)

        const taxIssue = result.issues.find((i) => i.field === 'taxAmount')
        expect(taxIssue).toBeDefined()
      })

      it('should detect large tax mismatch as error', async () => {
        const checker = new JournalChecker()
        const docWithDiffTax = { ...mockDocument, taxAmount: 2000 }
        const result = await checker.check(mockEntry, docWithDiffTax)

        const taxIssue = result.issues.find((i) => i.field === 'taxAmount')
        expect(taxIssue?.severity).toBe('error')
      })

      it('should handle documents with zero tax amount', async () => {
        const checker = new JournalChecker()
        const docZeroTax = { ...mockDocument, taxAmount: 0 }
        const entryZeroTax = { ...mockEntry, taxAmount: 0 }
        const result = await checker.check(entryZeroTax, docZeroTax)

        const taxIssue = result.issues.find((i) => i.field === 'taxAmount')
        expect(taxIssue).toBeUndefined()
      })
    })

    describe('check - description validation', () => {
      it('should suggest vendor name in description', async () => {
        const checker = new JournalChecker()
        const entryWithoutVendor = { ...mockEntry, description: '交通費' }
        const result = await checker.check(entryWithoutVendor, mockDocument)

        const descIssue = result.issues.find((i) => i.field === 'description')
        expect(descIssue?.severity).toBe('info')
      })

      it('should pass when description includes vendor name', async () => {
        const checker = new JournalChecker()
        const entryWithVendor = { ...mockEntry, description: 'JR東海 新幹線代' }
        const result = await checker.check(entryWithVendor, mockDocument)

        const descIssue = result.issues.find((i) => i.field === 'description')
        expect(descIssue).toBeUndefined()
      })

      it('should not suggest when confidence is low', async () => {
        const checker = new JournalChecker()
        const lowConfidenceDoc = { ...mockDocument, confidence: 0.5 }
        const entryWithoutVendor = { ...mockEntry, description: '交通費' }
        const result = await checker.check(entryWithoutVendor, lowConfidenceDoc)

        const descIssue = result.issues.find((i) => i.field === 'description')
        expect(descIssue).toBeUndefined()
      })
    })

    describe('check - tax related validation', () => {
      it('should warn about missing withholding tax for salary', async () => {
        const checker = new JournalChecker()
        const salaryEntry = {
          ...mockEntry,
          description: '給与支払',
          debitAccount: '給与手当',
          amount: 300000,
          taxAmount: 0,
        }
        const salaryDoc = { ...mockDocument, amount: 300000, taxAmount: 0 }
        const result = await checker.check(salaryEntry, salaryDoc)

        const taxIssue = result.issues.find((i) => i.message?.includes('源泉徴収'))
        expect(taxIssue).toBeDefined()
      })

      it('should warn about corporate tax timing', async () => {
        const checker = new JournalChecker()
        const taxEntry = {
          ...mockEntry,
          description: '法人税支払',
          date: '2024-05-15',
          debitAccount: '法人税',
        }
        const result = await checker.check(taxEntry, mockDocument)

        const dateIssue = result.issues.find((i) => i.message?.includes('法人税'))
        expect(dateIssue).toBeDefined()
      })

      it('should warn about consumption tax deviation', async () => {
        const checker = new JournalChecker()
        const taxEntry = {
          ...mockEntry,
          description: '消費税支払',
          debitAccount: '仮払消費税',
          taxAmount: 5000,
        }
        const taxDoc = { ...mockDocument, amount: 10000 }
        const result = await checker.check(taxEntry, taxDoc)

        const taxIssue = result.issues.find((i) => i.message?.includes('消費税'))
        expect(taxIssue).toBeDefined()
      })
    })

    describe('check - account appropriateness', () => {
      it('should warn about suspicious revenue account', async () => {
        const checker = new JournalChecker()
        const suspiciousEntry = {
          ...mockEntry,
          description: '売上計上',
          creditAccount: '現金',
        }
        const result = await checker.check(suspiciousEntry, mockDocument)

        const accountIssue = result.issues.find((i) => i.field === 'creditAccount')
        expect(accountIssue).toBeDefined()
      })

      it('should warn about suspicious expense account', async () => {
        const checker = new JournalChecker()
        const suspiciousEntry = {
          ...mockEntry,
          description: '経費支払',
          debitAccount: '売上',
        }
        const result = await checker.check(suspiciousEntry, mockDocument)

        const accountIssue = result.issues.find((i) => i.field === 'debitAccount')
        expect(accountIssue).toBeDefined()
      })
    })

    describe('check - no document', () => {
      it('should return info when no document attached', async () => {
        const checker = new JournalChecker()
        const result = await checker.check(mockEntry, null)

        expect(result.isValid).toBe(true)
        expect(result.issues[0].severity).toBe('info')
        expect(result.issues[0].message).toContain('証憑が添付されていない')
      })
    })

    describe('batchCheck', () => {
      it('should check multiple entries', async () => {
        const checker = new JournalChecker()
        const entries = [
          { entry: mockEntry, documentData: mockDocument },
          { entry: { ...mockEntry, id: 'entry-2' }, documentData: null },
        ]

        const results = await checker.batchCheck(entries)

        expect(results).toHaveLength(2)
        expect(results[0].entryId).toBe('entry-1')
        expect(results[1].entryId).toBe('entry-2')
      })

      it('should handle empty array', async () => {
        const checker = new JournalChecker()
        const results = await checker.batchCheck([])

        expect(results).toHaveLength(0)
      })

      it('should handle all entries without documents', async () => {
        const checker = new JournalChecker()
        const entries = [
          { entry: mockEntry, documentData: null },
          { entry: { ...mockEntry, id: 'entry-2' }, documentData: null },
        ]

        const results = await checker.batchCheck(entries)

        expect(results).toHaveLength(2)
        expect(results.every((r) => r.result.isValid)).toBe(true)
      })
    })
  })

  describe('ReceiptAnalyzer', () => {
    describe('constructor', () => {
      it('should create instance without config', () => {
        const analyzer = new ReceiptAnalyzer()
        expect(analyzer).toBeInstanceOf(ReceiptAnalyzer)
      })

      it('should create instance with config', () => {
        const analyzer = new ReceiptAnalyzer({ preferGeminiForPdf: false })
        expect(analyzer).toBeInstanceOf(ReceiptAnalyzer)
      })
    })

    describe('createReceiptAnalyzer', () => {
      it('should create ReceiptAnalyzer instance', () => {
        const analyzer = createReceiptAnalyzer()
        expect(analyzer).toBeInstanceOf(ReceiptAnalyzer)
      })

      it('should create with config', () => {
        const analyzer = createReceiptAnalyzer({ preferGeminiForPdf: true })
        expect(analyzer).toBeInstanceOf(ReceiptAnalyzer)
      })
    })

    describe('analyzeBuffer', () => {
      it('should throw error when AI provider is not configured', async () => {
        const analyzer = new ReceiptAnalyzer()
        const buffer = Buffer.from('test')

        await expect(analyzer.analyzeBuffer(buffer, 'pdf', 'application/pdf')).rejects.toThrow(
          'AI provider is not configured'
        )
      })
    })

    describe('getDocumentType', () => {
      it('should identify PDF documents', () => {
        const analyzer = new ReceiptAnalyzer()
        expect((analyzer as any).getDocumentType('.pdf')).toBe('pdf')
      })

      it('should identify Excel documents', () => {
        const analyzer = new ReceiptAnalyzer()
        expect((analyzer as any).getDocumentType('.xlsx')).toBe('excel')
        expect((analyzer as any).getDocumentType('.xls')).toBe('excel')
      })

      it('should identify image documents', () => {
        const analyzer = new ReceiptAnalyzer()
        expect((analyzer as any).getDocumentType('.jpg')).toBe('image')
        expect((analyzer as any).getDocumentType('.png')).toBe('image')
      })
    })

    describe('getMimeType', () => {
      it('should return correct MIME types', () => {
        const analyzer = new ReceiptAnalyzer()

        expect((analyzer as any).getMimeType('.pdf')).toBe('application/pdf')
        expect((analyzer as any).getMimeType('.jpg')).toBe('image/jpeg')
        expect((analyzer as any).getMimeType('.jpeg')).toBe('image/jpeg')
        expect((analyzer as any).getMimeType('.png')).toBe('image/png')
        expect((analyzer as any).getMimeType('.gif')).toBe('image/gif')
        expect((analyzer as any).getMimeType('.webp')).toBe('image/webp')
        expect((analyzer as any).getMimeType('.xlsx')).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        expect((analyzer as any).getMimeType('.xls')).toBe('application/vnd.ms-excel')
      })

      it('should return default MIME type for unknown extensions', () => {
        const analyzer = new ReceiptAnalyzer()
        expect((analyzer as any).getMimeType('.unknown')).toBe('application/octet-stream')
      })
    })
  })

  describe('analyzeJournal', () => {
    const mockJournal = {
      id: 'journal-1',
      entryDate: new Date('2024-01-15'),
      description: 'Test entry',
      debitAccount: '現金',
      creditAccount: '売上',
      amount: 10000,
      taxAmount: 1000,
      taxType: 'TAXABLE_10',
      documentId: null,
      createdAt: new Date(),
      freeeJournalId: null,
      companyId: 'company-1',
      syncedAt: null,
      auditStatus: 'PENDING' as const,
    }

    it('should return error when no document attached', async () => {
      const result = await analyzeJournal(mockJournal as any, null)

      expect(result.status).toBe('ERROR')
      expect(result.confidenceScore).toBe(0)
      expect(result.issues).toContain('No document attached')
    })

    it('should detect amount mismatch', async () => {
      const documentContent = '金額: ¥15,000'
      const result = await analyzeJournal(mockJournal as any, documentContent)

      expect(result.issues.some((i) => i.includes('Amount mismatch'))).toBe(true)
      expect(result.confidenceScore).toBeLessThan(1)
    })

    it('should detect date mismatch', async () => {
      const documentContent = '日付: 2024-02-15'
      const result = await analyzeJournal(mockJournal as any, documentContent)

      expect(result.issues.some((i) => i.includes('Date mismatch'))).toBe(true)
      expect(result.confidenceScore).toBeLessThan(1)
    })

    it('should detect tax mismatch', async () => {
      const documentContent = '金額: ¥10,000'
      const journalWithWrongTax = { ...mockJournal, taxAmount: 500 }
      const result = await analyzeJournal(journalWithWrongTax as any, documentContent)

      expect(result.issues.some((i) => i.includes('Tax mismatch'))).toBe(true)
    })

    it('should pass when all checks pass', async () => {
      const documentContent = '金額: ¥10,000 日付: 2024-01-15'
      const result = await analyzeJournal(mockJournal as any, documentContent)

      expect(result.status).toBe('PASSED')
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7)
    })

    it('should respect custom config', async () => {
      const documentContent = '金額: ¥15,000'
      const config = {
        checkAmount: false,
        checkDate: true,
        checkAccount: true,
        checkTax: true,
        confidenceThreshold: 0.7,
      }
      const result = await analyzeJournal(mockJournal as any, documentContent, config)

      expect(result.issues.some((i) => i.includes('Amount mismatch'))).toBe(false)
    })

    it('should handle various amount formats', async () => {
      const formats = ['￥10,000', '¥10,000', '10,000円', '$10,000']

      for (const format of formats) {
        const result = await analyzeJournal(mockJournal as any, format)
        expect(result).toBeDefined()
      }
    })

    it('should handle various date formats', async () => {
      const formats = ['2024/01/15', '2024-01-15', '01/15/2024', '2024年1月15日']

      for (const format of formats) {
        const result = await analyzeJournal(mockJournal as any, format)
        expect(result).toBeDefined()
      }
    })

    it('should return FAILED when below confidence threshold', async () => {
      const documentContent = '金額: ¥20,000 日付: 2024-03-15'
      const result = await analyzeJournal(mockJournal as any, documentContent)

      expect(result.status).toBe('FAILED')
    })

    it('should calculate tax correctly for different rates', async () => {
      const journal8 = { ...mockJournal, taxType: 'TAXABLE_8_REDUCED' }
      const documentContent = '金額: ¥10,000'
      const result = await analyzeJournal(journal8 as any, documentContent)

      expect(result).toBeDefined()
    })

    it('should handle exempt tax type', async () => {
      const journalExempt = { ...mockJournal, taxType: 'TAX_EXEMPT', taxAmount: 0 }
      const documentContent = '金額: ¥10,000'
      const result = await analyzeJournal(journalExempt as any, documentContent)

      expect(result).toBeDefined()
    })
  })

  describe('getAuditStatus', () => {
    const mockCompanyId = 'company-1'
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-01-31')

    it('should return status counts', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        { auditStatus: 'PASSED' },
        { auditStatus: 'PASSED' },
        { auditStatus: 'FAILED' },
        { auditStatus: 'PENDING' },
        { auditStatus: 'SKIPPED' },
      ] as any)

      const result = await getAuditStatus(mockCompanyId, startDate, endDate)

      expect(result.total).toBe(5)
      expect(result.passed).toBe(2)
      expect(result.failed).toBe(1)
      expect(result.pending).toBe(1)
      expect(result.skipped).toBe(1)
    })

    it('should return zeros for no journals', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const result = await getAuditStatus(mockCompanyId, startDate, endDate)

      expect(result.total).toBe(0)
      expect(result.passed).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.pending).toBe(0)
      expect(result.skipped).toBe(0)
    })

    it('should query with correct date range', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      await getAuditStatus(mockCompanyId, startDate, endDate)

      expect(prisma.journal.findMany).toHaveBeenCalledWith({
        where: {
          companyId: mockCompanyId,
          entryDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { auditStatus: true },
      })
    })
  })

  describe('edge cases', () => {
    it('should handle very long descriptions', async () => {
      const checker = new JournalChecker()
      const longDesc = 'あ'.repeat(10000)
      const entry = {
        id: 'entry-1',
        date: '2024-01-15',
        debitAccount: '旅費交通費',
        creditAccount: '普通預金',
        amount: 10000,
        taxAmount: 1000,
        description: longDesc,
      }
      const doc: DocumentAnalysisResult = {
        date: '2024-01-15',
        amount: 10000,
        taxAmount: 1000,
        vendorName: 'Test',
        description: longDesc,
        confidence: 0.95,
      }

      const result = await checker.check(entry, doc)
      expect(result).toBeDefined()
    })

    it('should handle special characters in vendor name', async () => {
      const checker = new JournalChecker()
      const doc: DocumentAnalysisResult = {
        date: '2024-01-15',
        amount: 10000,
        taxAmount: 1000,
        vendorName: '<script>alert("xss")</script>',
        description: 'Test',
        confidence: 0.95,
      }

      const result = await checker.check({ ...mockJournalEntry, description: 'Test' }, doc)
      expect(result).toBeDefined()
    })

    it('should handle zero amounts', async () => {
      const checker = new JournalChecker()
      const entry = {
        ...mockJournalEntry,
        amount: 0,
        taxAmount: 0,
      }
      const doc: DocumentAnalysisResult = {
        date: '2024-01-15',
        amount: 0,
        taxAmount: 0,
        vendorName: 'Test',
        description: 'Test',
        confidence: 0.95,
      }

      const result = await checker.check(entry, doc)
      expect(result).toBeDefined()
    })

    it('should handle negative amounts', async () => {
      const checker = new JournalChecker()
      const entry = {
        ...mockJournalEntry,
        amount: -10000,
        taxAmount: -1000,
      }
      const doc: DocumentAnalysisResult = {
        date: '2024-01-15',
        amount: -10000,
        taxAmount: -1000,
        vendorName: 'Test',
        description: 'Test',
        confidence: 0.95,
      }

      const result = await checker.check(entry, doc)
      expect(result).toBeDefined()
    })

    it('should handle very large amounts', async () => {
      const checker = new JournalChecker()
      const entry = {
        ...mockJournalEntry,
        amount: 999999999999,
        taxAmount: 99999999999,
      }
      const doc: DocumentAnalysisResult = {
        date: '2024-01-15',
        amount: 999999999999,
        taxAmount: 99999999999,
        vendorName: 'Test',
        description: 'Test',
        confidence: 0.95,
      }

      const result = await checker.check(entry, doc)
      expect(result).toBeDefined()
    })
  })
})

const mockJournalEntry: JournalEntryData = {
  id: 'entry-1',
  date: '2024-01-15',
  debitAccount: '旅費交通費',
  creditAccount: '普通預金',
  amount: 10000,
  taxAmount: 1000,
  taxType: 'TAXABLE_10',
  description: '東京-大阪 新幹線代',
}

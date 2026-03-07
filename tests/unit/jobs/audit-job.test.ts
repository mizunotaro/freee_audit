import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runAuditJob } from '@/jobs/audit-job'
import { prisma } from '@/lib/db'
import { createReceiptAnalyzer } from '@/services/audit/receipt-analyzer'
import { createJournalChecker } from '@/services/audit/journal-checker'
import { createAuditNotifier } from '@/lib/integrations/slack/notifier'
import fs from 'fs/promises'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditResult: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/services/audit/receipt-analyzer', () => ({
  createReceiptAnalyzer: vi.fn(),
}))

vi.mock('@/services/audit/journal-checker', () => ({
  createJournalChecker: vi.fn(),
}))

vi.mock('@/lib/integrations/slack/notifier', () => ({
  createAuditNotifier: vi.fn(),
}))

vi.mock('@/lib/audit/audit-logger', () => ({
  auditLogger: {
    logAuditRun: vi.fn(),
  },
}))

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}))

describe('audit-job parallel processing', () => {
  let mockReceiptAnalyzer: any
  let mockJournalChecker: any
  let mockNotifier: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockReceiptAnalyzer = {
      analyzeBuffer: vi.fn().mockResolvedValue({
        date: '2024-01-15',
        amount: 10000,
        confidence: 0.95,
      }),
    }
    mockJournalChecker = {
      check: vi.fn().mockResolvedValue({
        isValid: true,
        issues: [],
      }),
    }
    mockNotifier = {
      notifyAuditComplete: vi.fn(),
    }

    vi.mocked(createReceiptAnalyzer).mockReturnValue(mockReceiptAnalyzer)
    vi.mocked(createJournalChecker).mockReturnValue(mockJournalChecker)
    vi.mocked(createAuditNotifier).mockReturnValue(mockNotifier)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockJournal = (id: string, delay = 0) => ({
    id,
    freeeJournalId: `FREEE-${id}`,
    entryDate: new Date('2024-01-15'),
    debitAccount: '現金',
    creditAccount: '売上',
    amount: 10000,
    taxAmount: 1000,
    taxType: 'TAXABLE',
    description: 'Test entry',
    documentId: null,
    document: null,
  })

  it('should process journals in parallel with default concurrency', async () => {
    const journals = Array.from({ length: 10 }, (_, i) => createMockJournal(`journal-${i}`))

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const startTime = Date.now()
    const result = await runAuditJob()
    const duration = Date.now() - startTime

    expect(result.totalProcessed).toBe(10)
    expect(result.passed).toBe(10)
    expect(result.failed).toBe(0)
    expect(result.errors).toBe(0)
    expect(prisma.journal.findMany).toHaveBeenCalled()
  })

  it('should use custom concurrency from options', async () => {
    const journals = Array.from({ length: 20 }, (_, i) => createMockJournal(`journal-${i}`))

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const result = await runAuditJob({ concurrency: 3 })

    expect(result.totalProcessed).toBe(20)
    expect(result.passed).toBe(20)
  })

  it('should use custom concurrency from environment variable', async () => {
    const originalEnv = process.env.AUDIT_CONCURRENCY
    process.env.AUDIT_CONCURRENCY = '7'

    const journals = Array.from({ length: 15 }, (_, i) => createMockJournal(`journal-${i}`))

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(15)
    expect(result.passed).toBe(15)

    process.env.AUDIT_CONCURRENCY = originalEnv
  })

  it('should continue processing when errors occur', async () => {
    const journals = Array.from({ length: 10 }, (_, i) => createMockJournal(`journal-${i}`))

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)

    let callCount = 0
    mockJournalChecker.check.mockImplementation(async () => {
      callCount++
      if (callCount === 3 || callCount === 7) {
        throw new Error('Test error')
      }
      return { isValid: true, issues: [] }
    })

    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(10)
    expect(result.errors).toBe(2)
    expect(result.passed).toBe(8)
  })

  it('should handle mixed passed and failed results', async () => {
    const journals = Array.from({ length: 10 }, (_, i) => createMockJournal(`journal-${i}`))

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)

    let callCount = 0
    mockJournalChecker.check.mockImplementation(async () => {
      callCount++
      if (callCount % 2 === 0) {
        return {
          isValid: false,
          issues: [{ field: 'amount', severity: 'error', message: 'Amount mismatch' }],
        }
      }
      return { isValid: true, issues: [] }
    })

    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(10)
    expect(result.passed).toBe(5)
    expect(result.failed).toBe(5)
    expect(result.errors).toBe(0)
  })

  it('should log progress for large batches', async () => {
    const journals = Array.from({ length: 100 }, (_, i) => createMockJournal(`journal-${i}`))

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const consoleSpy = vi.spyOn(console, 'log')

    await runAuditJob({ concurrency: 10 })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Progress: 50/100'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Progress: 100/100'))
  })

  it('should log memory usage for large batches', async () => {
    const journals = Array.from({ length: 150 }, (_, i) => createMockJournal(`journal-${i}`))

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    const consoleSpy = vi.spyOn(console, 'log')

    await runAuditJob({ concurrency: 20 })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Memory] Before processing'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Memory] After'))
  })

  it('should respect skipDocumentAnalysis option', async () => {
    const journals = [
      {
        ...createMockJournal('journal-1'),
        documentId: 'doc-1',
        document: { id: 'doc-1', filePath: '/test.pdf' },
      },
    ]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    await runAuditJob({ skipDocumentAnalysis: true })

    expect(mockReceiptAnalyzer.analyzeBuffer).not.toHaveBeenCalled()
  })

  it('should handle empty journal list', async () => {
    vi.mocked(prisma.journal.findMany).mockResolvedValue([])

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(0)
    expect(result.passed).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('should call notifier when notifyOnComplete is true', async () => {
    const journals = [createMockJournal('journal-1')]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    await runAuditJob({ notifyOnComplete: true })

    expect(mockNotifier.notifyAuditComplete).toHaveBeenCalled()
  })

  it('should handle document analysis errors', async () => {
    const journals = [
      {
        ...createMockJournal('journal-1'),
        documentId: 'doc-1',
        document: { id: 'doc-1', filePath: '/test.pdf' },
      },
    ]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('test'))
    mockReceiptAnalyzer.analyzeBuffer.mockRejectedValue(new Error('Analysis failed'))

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(1)
    expect(result.errors).toBe(1)
  })

  it('should handle journals with documents successfully', async () => {
    const journals = [
      {
        ...createMockJournal('journal-1'),
        documentId: 'doc-1',
        document: { id: 'doc-1', filePath: '/test.pdf' },
      },
    ]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('test'))

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(1)
    expect(result.passed).toBe(1)
    expect(mockReceiptAnalyzer.analyzeBuffer).toHaveBeenCalled()
  })

  it('should handle failed validation with issues', async () => {
    const journals = [createMockJournal('journal-1')]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    mockJournalChecker.check.mockResolvedValue({
      isValid: false,
      issues: [
        { field: 'amount', severity: 'error', message: 'Amount mismatch' },
        { field: 'date', severity: 'warning', message: 'Date mismatch' },
      ],
    })

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.passed).toBe(0)
  })

  it('should apply date filters correctly', async () => {
    const journals = [createMockJournal('journal-1')]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    await runAuditJob({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    })

    expect(prisma.journal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entryDate: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          },
        }),
      })
    )
  })

  it('should apply company filter correctly', async () => {
    const journals = [createMockJournal('journal-1')]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    await runAuditJob({
      companyId: 'company-123',
    })

    expect(prisma.journal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-123',
        }),
      })
    )
  })

  it('should apply status filter correctly', async () => {
    const journals = [createMockJournal('journal-1')]

    vi.mocked(prisma.journal.findMany).mockResolvedValue(journals as any)
    vi.mocked(prisma.auditResult.create).mockResolvedValue({} as any)
    vi.mocked(prisma.journal.update).mockResolvedValue({} as any)

    await runAuditJob({
      statusFilter: 'FAILED',
    })

    expect(prisma.journal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          auditStatus: 'FAILED',
        }),
      })
    )
  })
})

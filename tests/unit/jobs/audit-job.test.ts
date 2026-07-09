import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { runAuditJob } from '@/jobs/audit-job'
import { prisma } from '@/lib/db'
import { createReceiptAnalyzer } from '@/services/audit/receipt-analyzer'
import { createJournalChecker } from '@/services/audit/journal-checker'
import { createAuditNotifier } from '@/lib/integrations/slack/notifier'
import fs from 'fs/promises'
import type { Journal } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
      count: vi.fn(),
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

interface MockJournal {
  id: string
  freeeJournalId: string
  entryDate: Date
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number | null
  taxType: string | null
  description: string | null
  documentId: string | null
  document: { filePath: string } | null
}

interface FindManyArgs {
  take?: number
  skip?: number
  cursor?: { id?: string }
}

const findManyMock = prisma.journal.findMany as unknown as Mock<
  (args?: FindManyArgs) => Promise<Journal[]>
>

// Simulates PERF-03-01 keyset cursor paging over a fixed set so the job can be
// exercised end-to-end against the mock without an unbounded single findMany.
function setupJournals(journals: MockJournal[]): void {
  vi.mocked(prisma.journal.count).mockResolvedValue(journals.length)
  findManyMock.mockImplementation(async (args) => {
    const take = args?.take ?? journals.length
    const skip = args?.skip ?? 0
    const cursorId = args?.cursor?.id
    let startIdx = 0
    if (cursorId) {
      const idx = journals.findIndex((j) => j.id === cursorId)
      startIdx = idx >= 0 ? idx + skip : journals.length
    }
    return journals.slice(startIdx, startIdx + take) as unknown as Journal[]
  })
  vi.mocked(prisma.auditResult.create).mockResolvedValue({} as never)
  vi.mocked(prisma.journal.update).mockResolvedValue({} as never)
}

describe('audit-job parallel processing', () => {
  let mockReceiptAnalyzer: { analyzeBuffer: Mock }
  let mockJournalChecker: { check: Mock }
  let mockNotifier: { notifyAuditComplete: Mock }

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

    vi.mocked(createReceiptAnalyzer).mockReturnValue(
      mockReceiptAnalyzer as unknown as ReturnType<typeof createReceiptAnalyzer>
    )
    vi.mocked(createJournalChecker).mockReturnValue(
      mockJournalChecker as unknown as ReturnType<typeof createJournalChecker>
    )
    vi.mocked(createAuditNotifier).mockReturnValue(
      mockNotifier as unknown as ReturnType<typeof createAuditNotifier>
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockJournal = (id: string): MockJournal => ({
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

    setupJournals(journals)

    const startTime = Date.now()
    const result = await runAuditJob()
    const duration = Date.now() - startTime

    expect(result.totalProcessed).toBe(10)
    expect(result.passed).toBe(10)
    expect(result.failed).toBe(0)
    expect(result.errors).toBe(0)
    expect(prisma.journal.findMany).toHaveBeenCalled()
    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('should use custom concurrency from options', async () => {
    const journals = Array.from({ length: 20 }, (_, i) => createMockJournal(`journal-${i}`))

    setupJournals(journals)

    const result = await runAuditJob({ concurrency: 3 })

    expect(result.totalProcessed).toBe(20)
    expect(result.passed).toBe(20)
  })

  it('should use custom concurrency from environment variable', async () => {
    const originalEnv = process.env.AUDIT_CONCURRENCY
    process.env.AUDIT_CONCURRENCY = '7'

    const journals = Array.from({ length: 15 }, (_, i) => createMockJournal(`journal-${i}`))

    setupJournals(journals)

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(15)
    expect(result.passed).toBe(15)

    process.env.AUDIT_CONCURRENCY = originalEnv
  })

  it('should continue processing when errors occur', async () => {
    const journals = Array.from({ length: 10 }, (_, i) => createMockJournal(`journal-${i}`))

    setupJournals(journals)

    let callCount = 0
    mockJournalChecker.check.mockImplementation(async () => {
      callCount++
      if (callCount === 3 || callCount === 7) {
        throw new Error('Test error')
      }
      return { isValid: true, issues: [] }
    })

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(10)
    expect(result.errors).toBe(2)
    expect(result.passed).toBe(8)
  })

  it('should handle mixed passed and failed results', async () => {
    const journals = Array.from({ length: 10 }, (_, i) => createMockJournal(`journal-${i}`))

    setupJournals(journals)

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

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(10)
    expect(result.passed).toBe(5)
    expect(result.failed).toBe(5)
    expect(result.errors).toBe(0)
  })

  it('should log progress for large batches', async () => {
    const journals = Array.from({ length: 100 }, (_, i) => createMockJournal(`journal-${i}`))

    setupJournals(journals)

    const consoleSpy = vi.spyOn(console, 'log')

    await runAuditJob({ concurrency: 10 })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Progress: 50/100'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Progress: 100/100'))
  })

  it('should log memory usage for large batches', async () => {
    const journals = Array.from({ length: 150 }, (_, i) => createMockJournal(`journal-${i}`))

    setupJournals(journals)

    const consoleSpy = vi.spyOn(console, 'log')

    await runAuditJob({ concurrency: 20 })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Memory] Before processing'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Memory] After'))
  })

  it('should respect skipDocumentAnalysis option', async () => {
    const journals: MockJournal[] = [
      {
        ...createMockJournal('journal-1'),
        documentId: 'doc-1',
        document: { filePath: '/test.pdf' },
      },
    ]

    setupJournals(journals)

    await runAuditJob({ skipDocumentAnalysis: true })

    expect(mockReceiptAnalyzer.analyzeBuffer).not.toHaveBeenCalled()
  })

  it('should handle empty journal list', async () => {
    setupJournals([])

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(0)
    expect(result.passed).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('should call notifier when notifyOnComplete is true', async () => {
    const journals = [createMockJournal('journal-1')]

    setupJournals(journals)

    await runAuditJob({ notifyOnComplete: true })

    expect(mockNotifier.notifyAuditComplete).toHaveBeenCalled()
  })

  it('should handle document analysis errors', async () => {
    const journals: MockJournal[] = [
      {
        ...createMockJournal('journal-1'),
        documentId: 'doc-1',
        document: { filePath: '/test.pdf' },
      },
    ]

    setupJournals(journals)

    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('test'))
    mockReceiptAnalyzer.analyzeBuffer.mockRejectedValue(new Error('Analysis failed'))

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(1)
    expect(result.errors).toBe(1)
  })

  it('should handle journals with documents successfully', async () => {
    const journals: MockJournal[] = [
      {
        ...createMockJournal('journal-1'),
        documentId: 'doc-1',
        document: { filePath: '/test.pdf' },
      },
    ]

    setupJournals(journals)
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('test'))

    const result = await runAuditJob()

    expect(result.totalProcessed).toBe(1)
    expect(result.passed).toBe(1)
    expect(mockReceiptAnalyzer.analyzeBuffer).toHaveBeenCalled()
  })

  it('should handle failed validation with issues', async () => {
    const journals = [createMockJournal('journal-1')]

    setupJournals(journals)

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

    setupJournals(journals)

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

    setupJournals(journals)

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

    setupJournals(journals)

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

  it('should page through results using a bounded cursor (PERF-03-01)', async () => {
    const journals = Array.from({ length: 120 }, (_, i) => createMockJournal(`journal-${i}`))

    setupJournals(journals)

    const result = await runAuditJob({ concurrency: 5 })

    expect(result.totalProcessed).toBe(120)
    // pageSize = concurrency(5) * PAGE_MULTIPLIER(5) = 25 -> ceil(120/25) = 5 pages
    // (4 full pages + 1 partial), so findMany is called more than once.
    expect(findManyMock.mock.calls.length).toBeGreaterThan(1)
    // First page has no cursor; every subsequent page advances via cursor + skip:1.
    const calls = findManyMock.mock.calls
    expect(calls[0]?.[0]?.cursor).toBeUndefined()
    expect(calls[1]?.[0]?.cursor).toEqual({ id: expect.any(String) })
    expect(calls[1]?.[0]?.skip).toBe(1)
  })

  it('should project only filePath from the document relation (PERF-03-05)', async () => {
    const journals: MockJournal[] = [
      {
        ...createMockJournal('journal-1'),
        documentId: 'doc-1',
        document: { filePath: '/test.pdf' },
      },
    ]

    setupJournals(journals)

    await runAuditJob()

    expect(prisma.journal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { document: { select: { filePath: true } } },
      })
    )
  })
})

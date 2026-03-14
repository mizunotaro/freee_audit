import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ConversionEngine,
  conversionEngine,
  type ConversionProgress,
  type DryRunResult,
} from '@/services/conversion/conversion-engine'
import {
  JournalConverter,
  journalConverter,
  type UnmappedAccount,
  type BatchResult,
} from '@/services/conversion/journal-converter'
import {
  FinancialStatementConverter,
  financialStatementConverter,
  type ComparisonReport,
} from '@/services/conversion/financial-statement-converter'
import { prisma } from '@/lib/db'
import { isSuccess, isFailure } from '@/types/result'
import type {
  AccountMapping,
  JournalConversion,
  ConvertedJournalLine,
  ConversionSettings,
} from '@/types/conversion'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    conversionProject: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    conversionResult: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    chartOfAccountItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    cashFlow: {
      findMany: vi.fn(),
    },
    accountMapping: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    chartOfAccount: {
      findUnique: vi.fn(),
    },
    conversionAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        accountMapping: {
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        conversionAuditLog: {
          create: vi.fn(),
        },
      }
      return fn(mockTx)
    }),
  },
}))

describe('ConversionEngine', () => {
  let engine: ConversionEngine

  const mockSettings: ConversionSettings = {
    includeJournals: true,
    includeFinancialStatements: true,
    generateAdjustingEntries: false,
    aiAssistedMapping: false,
  }

  const mockProject = {
    id: 'project-1',
    companyId: 'company-1',
    targetCoaId: 'coa-target-1',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
    status: 'draft',
    progress: 0,
    settings: JSON.stringify(mockSettings),
    createdAt: new Date(),
  }

  const mockMappings: AccountMapping[] = [
    {
      id: 'mapping-1',
      sourceAccountId: 'source-1',
      sourceAccountCode: '1000',
      sourceAccountName: '現金',
      targetAccountId: 'target-1',
      targetAccountCode: '1100',
      targetAccountName: 'Cash and Cash Equivalents',
      mappingType: '1to1',
      confidence: 0.95,
      isManualReview: false,
    },
    {
      id: 'mapping-2',
      sourceAccountId: 'source-2',
      sourceAccountCode: '6000',
      sourceAccountName: '販促費',
      targetAccountId: 'target-2',
      targetAccountCode: '6100',
      targetAccountName: 'Advertising Expense',
      mappingType: '1toN',
      conversionRule: {
        type: 'percentage',
        percentage: 60,
      },
      confidence: 0.85,
      isManualReview: false,
    },
  ]

  const mockJournals = [
    {
      id: 'journal-1',
      companyId: 'company-1',
      freeeJournalId: 'freee-1',
      entryDate: new Date('2024-01-15'),
      description: 'Sales revenue',
      debitAccount: '1000',
      creditAccount: '4000',
      amount: 100000,
      taxAmount: 10000,
      taxType: 'taxable',
    },
    {
      id: 'journal-2',
      companyId: 'company-1',
      freeeJournalId: 'freee-2',
      entryDate: new Date('2024-02-15'),
      description: 'Advertising expense',
      debitAccount: '6000',
      creditAccount: '1000',
      amount: 50000,
      taxAmount: 5000,
      taxType: 'taxable',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new ConversionEngine()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('execute', () => {
    it('should convert journals successfully', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(2)
      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(mockMappings.length)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0.9 },
      } as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({} as any)
      vi.mocked(prisma.conversionResult.create).mockResolvedValue({
        id: 'result-1',
        projectId: 'project-1',
        journalConversions: '[]',
        balanceSheet: null,
        profitLoss: null,
        cashFlow: null,
        conversionDate: new Date(),
        conversionDurationMs: 1000,
        warnings: '[]',
        errors: '[]',
      } as any)
      vi.mocked(prisma.chartOfAccountItem.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlow.findMany).mockResolvedValue([])

      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue(
        mockMappings.map((m) => ({
          id: m.id,
          companyId: 'company-1',
          sourceCoaId: 'coa-source-1',
          sourceItemId: m.sourceAccountId,
          targetCoaId: 'coa-target-1',
          targetItemId: m.targetAccountId,
          mappingType: m.mappingType,
          conversionRule: m.conversionRule ? JSON.stringify(m.conversionRule) : null,
          percentage: m.conversionRule?.percentage ?? null,
          confidence: m.confidence,
          isManualReview: m.isManualReview,
          isApproved: true,
          notes: m.notes ?? null,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          approvedBy: null,
          approvedAt: null,
          sourceItem: {
            id: m.sourceAccountId,
            code: m.sourceAccountCode,
            name: m.sourceAccountName,
          },
          targetItem: {
            id: m.targetAccountId,
            code: m.targetAccountCode,
            name: m.targetAccountName,
          },
        })) as any
      )

      const result = await engine.execute('project-1')

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.projectId).toBe('project-1')
        expect(result.data.journalConversions).toBeDefined()
      }
      expect(prisma.conversionProject.update).toHaveBeenCalled()
    })

    it('should handle partial failures', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(2)
      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0 },
      } as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({} as any)
      vi.mocked(prisma.conversionResult.create).mockResolvedValue({
        id: 'result-1',
        projectId: 'project-1',
        journalConversions: '[]',
        balanceSheet: null,
        profitLoss: null,
        cashFlow: null,
        conversionDate: new Date(),
        conversionDurationMs: 1000,
        warnings: '[]',
        errors: '[]',
      } as any)

      const result = await engine.execute('project-1', { skipValidation: true })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.journalConversions).toBeDefined()
      }
    })

    it('should track progress', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProject,
        progress: 50,
      } as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(100)
      vi.mocked(prisma.conversionResult.findFirst).mockResolvedValue(null)

      const progress = await engine.getProgress('project-1')

      expect(isSuccess(progress)).toBe(true)
      if (isSuccess(progress)) {
        expect(progress.data.status).toBe('draft')
        expect(progress.data.progress).toBe(50)
        expect(progress.data.totalJournals).toBe(100)
        expect(progress.data.processedJournals).toBe(50)
      }
    })

    it('should be abortable', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({} as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(10000)
      vi.mocked(prisma.journal.findMany).mockResolvedValue([] as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(0)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0 },
      } as any)

      const executePromise = engine.execute('project-1')

      await engine.abort('project-1')

      await expect(executePromise).rejects.toThrow()
    })
  })

  describe('dryRun', () => {
    it('should estimate without saving', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(100)
      vi.mocked(prisma.journal.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(10)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0.9 },
      } as any)

      const result = await engine.dryRun('project-1')

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.wouldCreate.journalConversions).toBe(100)
        expect(result.data.estimatedDurationMs).toBeGreaterThan(0)
      }
      expect(prisma.conversionResult.create).not.toHaveBeenCalled()
    })

    it('should detect potential issues', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(100)
      vi.mocked(prisma.journal.groupBy).mockResolvedValue([
        {
          debitAccount: '9999',
          _count: { debitAccount: 10 },
          _sum: { amount: 1000000 },
          _min: { description: 'Unmapped expense' },
        },
      ] as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(5)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0.5 },
      } as any)

      const result = await engine.dryRun('project-1')

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.warnings.some((w) => w.code === 'UNMAPPED_ACCOUNTS')).toBe(true)
      }
    })
  })

  describe('resume', () => {
    it('should resume failed project', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProject,
        status: 'error',
      } as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({} as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(2)
      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue(
        mockMappings.map((m) => ({
          id: m.id,
          companyId: 'company-1',
          sourceCoaId: 'coa-source-1',
          sourceItemId: m.sourceAccountId,
          targetCoaId: 'coa-target-1',
          targetItemId: m.targetAccountId,
          mappingType: m.mappingType,
          conversionRule: m.conversionRule ? JSON.stringify(m.conversionRule) : null,
          percentage: m.conversionRule?.percentage ?? null,
          confidence: m.confidence,
          isManualReview: m.isManualReview,
          isApproved: true,
          notes: m.notes ?? null,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          approvedBy: null,
          approvedAt: null,
          sourceItem: {
            id: m.sourceAccountId,
            code: m.sourceAccountCode,
            name: m.sourceAccountName,
          },
          targetItem: {
            id: m.targetAccountId,
            code: m.targetAccountCode,
            name: m.targetAccountName,
          },
        })) as any
      )
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(mockMappings.length)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0.9 },
      } as any)
      vi.mocked(prisma.conversionResult.create).mockResolvedValue({
        id: 'result-1',
        projectId: 'project-1',
        journalConversions: '[]',
        balanceSheet: null,
        profitLoss: null,
        cashFlow: null,
        conversionDate: new Date(),
        conversionDurationMs: 1000,
        warnings: '[]',
        errors: '[]',
      } as any)
      vi.mocked(prisma.chartOfAccountItem.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlow.findMany).mockResolvedValue([])

      const result = await engine.resume('project-1')

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.projectId).toBe('project-1')
      }
    })

    it('should return error for non-failed project', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProject,
        status: 'completed',
      } as any)

      const result = await engine.resume('project-1')
      expect(isFailure(result)).toBe(true)
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported as conversionEngine', () => {
      expect(conversionEngine).toBeInstanceOf(ConversionEngine)
    })
  })
})

describe('JournalConverter', () => {
  let converter: JournalConverter

  const mockMapping1to1: AccountMapping = {
    id: 'mapping-1',
    sourceAccountId: 'source-1',
    sourceAccountCode: '1000',
    sourceAccountName: '現金',
    targetAccountId: 'target-1',
    targetAccountCode: '1100',
    targetAccountName: 'Cash and Cash Equivalents',
    mappingType: '1to1',
    confidence: 0.95,
    isManualReview: false,
  }

  const mockMapping1toN: AccountMapping = {
    id: 'mapping-2',
    sourceAccountId: 'source-2',
    sourceAccountCode: '6000',
    sourceAccountName: '販促費',
    targetAccountId: 'target-2',
    targetAccountCode: '6100',
    targetAccountName: 'Advertising Expense',
    mappingType: '1toN',
    conversionRule: {
      type: 'percentage',
      percentage: 60,
    },
    confidence: 0.85,
    isManualReview: false,
  }

  const mockMappingComplex: AccountMapping = {
    id: 'mapping-3',
    sourceAccountId: 'source-3',
    sourceAccountCode: '6999',
    sourceAccountName: '雑費',
    targetAccountId: 'target-3',
    targetAccountCode: '6200',
    targetAccountName: 'Meeting Expense',
    mappingType: 'complex',
    conversionRule: {
      type: 'direct',
      conditions: [
        {
          field: 'description',
          operator: 'contains',
          value: '会議',
          targetAccountId: 'target-3',
        },
      ],
    },
    confidence: 0.75,
    isManualReview: false,
  }

  const mockJournal = {
    id: 'journal-1',
    companyId: 'company-1',
    freeeJournalId: 'freee-1',
    entryDate: new Date('2024-01-15'),
    description: 'Sales revenue',
    debitAccount: '1000',
    creditAccount: '4000',
    amount: 100000,
    taxAmount: 10000,
    taxType: 'taxable',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    converter = new JournalConverter()
  })

  describe('convertSingle', () => {
    it('should handle 1to1 mapping', async () => {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('1000', mockMapping1to1)
      mappings.set('4000', {
        ...mockMapping1to1,
        sourceAccountCode: '4000',
        sourceAccountName: '売上',
        targetAccountCode: '4000',
        targetAccountName: 'Revenue',
      })

      const result = await converter.convertSingle(mockJournal, mappings)

      expect(result.sourceJournalId).toBe('journal-1')
      expect(result.lines).toHaveLength(2)
      expect(result.lines[0].targetAccountCode).toBe('1100')
      expect(result.lines[0].debitAmount).toBe(100000)
    })

    it('should handle 1toN mapping with percentages', async () => {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('6000', mockMapping1toN)
      mappings.set('1000', mockMapping1to1)

      const journal = {
        ...mockJournal,
        debitAccount: '6000',
        creditAccount: '1000',
        amount: 100000,
      }

      const result = await converter.convertSingle(journal, mappings)

      expect(result.lines).toHaveLength(2)
      const debitLine = result.lines.find((l) => l.debitAmount > 0)
      expect(debitLine?.debitAmount).toBe(60000)
    })

    it('should handle Nto1 mapping', async () => {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('6100', {
        id: 'mapping-nto1',
        sourceAccountId: 'source-6100',
        sourceAccountCode: '6100',
        sourceAccountName: '旅費交通費',
        targetAccountId: 'target-6200',
        targetAccountCode: '6200',
        targetAccountName: 'Travel and Entertainment',
        mappingType: 'Nto1',
        confidence: 0.9,
        isManualReview: false,
      })
      mappings.set('6110', {
        id: 'mapping-nto1',
        sourceAccountId: 'source-6110',
        sourceAccountCode: '6110',
        sourceAccountName: '交際費',
        targetAccountId: 'target-6200',
        targetAccountCode: '6200',
        targetAccountName: 'Travel and Entertainment',
        mappingType: 'Nto1',
        confidence: 0.9,
        isManualReview: false,
      })
      mappings.set('1000', mockMapping1to1)

      const result = await converter.convertSingle(
        {
          ...mockJournal,
          debitAccount: '6100',
        },
        mappings
      )

      expect(result.lines[0].targetAccountCode).toBe('6200')
    })

    it('should handle complex conditional mapping', async () => {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('6999', mockMappingComplex)
      mappings.set('1000', mockMapping1to1)

      const journal = {
        ...mockJournal,
        debitAccount: '6999',
        description: '会議費用',
      }

      const result = await converter.convertSingle(journal, mappings)

      expect(result.lines).toHaveLength(2)
    })

    it('should flag unmapped accounts', async () => {
      const mappings = new Map<string, AccountMapping>()

      const result = await converter.convertSingle(mockJournal, mappings)

      expect(result.requiresReview).toBe(true)
      expect(result.reviewNotes).toContain('Unmapped account')
    })
  })

  describe('convertBatch', () => {
    it('should process journals in batches', async () => {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('1000', mockMapping1to1)
      mappings.set('4000', {
        ...mockMapping1to1,
        sourceAccountCode: '4000',
        targetAccountCode: '4000',
        targetAccountName: 'Revenue',
      })

      const journals = Array.from({ length: 5 }, (_, i) => ({
        ...mockJournal,
        id: `journal-${i}`,
        freeeJournalId: `freee-${i}`,
      }))

      const results: BatchResult[] = []
      for await (const batch of converter.convertBatch(journals, mappings, 2)) {
        results.push(batch)
      }

      expect(results.length).toBe(3)
      expect(results[0].processedCount).toBe(2)
      expect(results[0].successCount).toBe(2)
    })
  })

  describe('findUnmappedAccounts', () => {
    it('should identify unmapped accounts', async () => {
      vi.mocked(prisma.journal.groupBy)
        .mockResolvedValueOnce([
          {
            debitAccount: '1000',
            _count: { debitAccount: 10 },
            _sum: { amount: 1000000 },
            _min: { description: 'Cash payment' },
          },
          {
            debitAccount: '9999',
            _count: { debitAccount: 5 },
            _sum: { amount: 500000 },
            _min: { description: 'Unmapped expense' },
          },
        ] as any)
        .mockResolvedValueOnce([])

      const mappings = new Map<string, AccountMapping>()
      mappings.set('1000', mockMapping1to1)

      const result = await converter.findUnmappedAccounts('company-1', mappings)

      expect(result.some((a) => a.accountCode === '9999')).toBe(true)
      expect(result.some((a) => a.accountCode === '1000')).toBe(false)
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported as journalConverter', () => {
      expect(journalConverter).toBeInstanceOf(JournalConverter)
    })
  })
})

describe('FinancialStatementConverter', () => {
  let converter: FinancialStatementConverter

  const mockJournalConversions: JournalConversion[] = [
    {
      sourceJournalId: 'journal-1',
      sourceDate: new Date('2024-01-15'),
      sourceDescription: 'Sales',
      lines: [
        {
          sourceAccountCode: '1000',
          sourceAccountName: '現金',
          targetAccountCode: '1100',
          targetAccountName: 'Cash',
          debitAmount: 100000,
          creditAmount: 0,
          mappingId: 'mapping-1',
        },
        {
          sourceAccountCode: '4000',
          sourceAccountName: '売上',
          targetAccountCode: '4100',
          targetAccountName: 'Revenue',
          debitAmount: 0,
          creditAmount: 100000,
          mappingId: 'mapping-2',
        },
      ],
      mappingConfidence: 0.95,
      requiresReview: false,
    },
    {
      sourceJournalId: 'journal-2',
      sourceDate: new Date('2024-02-15'),
      sourceDescription: 'COGS',
      lines: [
        {
          sourceAccountCode: '5000',
          sourceAccountName: '売上原価',
          targetAccountCode: '5100',
          targetAccountName: 'Cost of Sales',
          debitAmount: 50000,
          creditAmount: 0,
          mappingId: 'mapping-3',
        },
        {
          sourceAccountCode: '1000',
          sourceAccountName: '現金',
          targetAccountCode: '1100',
          targetAccountName: 'Cash',
          debitAmount: 0,
          creditAmount: 50000,
          mappingId: 'mapping-1',
        },
      ],
      mappingConfidence: 0.9,
      requiresReview: false,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    converter = new FinancialStatementConverter()
  })

  describe('convertBalanceSheet', () => {
    it('should produce valid BS structure', async () => {
      vi.mocked(prisma.chartOfAccountItem.findMany).mockResolvedValue([
        {
          id: 'item-1',
          code: '1100',
          name: 'Cash',
          nameEn: 'Cash',
          category: 'current_asset',
        },
      ] as any)

      const result = await converter.convertBalanceSheet(
        'company-1',
        2024,
        12,
        mockJournalConversions,
        'coa-target-1'
      )

      expect(result.asOfDate).toBeInstanceOf(Date)
      expect(result.assets).toBeDefined()
      expect(result.liabilities).toBeDefined()
      expect(result.equity).toBeDefined()
      expect(result.totalAssets).toBeDefined()
      expect(result.totalLiabilities).toBeDefined()
      expect(result.totalEquity).toBeDefined()
    })

    it('should balance assets = liabilities + equity', async () => {
      vi.mocked(prisma.chartOfAccountItem.findMany).mockResolvedValue([])

      const result = await converter.convertBalanceSheet(
        'company-1',
        2024,
        12,
        mockJournalConversions,
        'coa-target-1'
      )

      const balanceCheck =
        Math.abs(result.totalAssets - result.totalLiabilities - result.totalEquity) < 0.01

      expect(typeof result.totalAssets).toBe('number')
      expect(typeof result.totalLiabilities).toBe('number')
      expect(typeof result.totalEquity).toBe('number')
    })
  })

  describe('convertProfitLoss', () => {
    it('should produce valid PL structure', async () => {
      const result = await converter.convertProfitLoss(
        'company-1',
        2024,
        12,
        mockJournalConversions
      )

      expect(result.periodStart).toBeInstanceOf(Date)
      expect(result.periodEnd).toBeInstanceOf(Date)
      expect(result.revenue).toBeDefined()
      expect(result.costOfSales).toBeDefined()
      expect(result.sgaExpenses).toBeDefined()
      expect(result.grossProfit).toBeDefined()
      expect(result.operatingIncome).toBeDefined()
      expect(result.netIncome).toBeDefined()
    })

    it('should calculate profit correctly', async () => {
      const result = await converter.convertProfitLoss(
        'company-1',
        2024,
        12,
        mockJournalConversions
      )

      const totalRevenue = result.revenue.reduce((sum, r) => sum + r.amount, 0)
      const totalCOGS = result.costOfSales.reduce((sum, c) => sum + c.amount, 0)

      expect(result.grossProfit).toBe(totalRevenue - totalCOGS)
    })
  })

  describe('convertCashFlow', () => {
    it('should produce valid CF structure', async () => {
      vi.mocked(prisma.cashFlow.findMany).mockResolvedValue([])

      const result = await converter.convertCashFlow('company-1', 2024, mockJournalConversions)

      expect(result.periodStart).toBeInstanceOf(Date)
      expect(result.periodEnd).toBeInstanceOf(Date)
      expect(result.operatingActivities).toBeDefined()
      expect(result.investingActivities).toBeDefined()
      expect(result.financingActivities).toBeDefined()
      expect(result.netCashFromOperating).toBeDefined()
      expect(result.netCashFromInvesting).toBeDefined()
      expect(result.netCashFromFinancing).toBeDefined()
      expect(result.netChangeInCash).toBeDefined()
    })
  })

  describe('generateComparisonReport', () => {
    it('should generate comparison report', async () => {
      const sourceBS = {
        asOfDate: new Date('2024-12-31'),
        assets: [{ code: '1000', name: '現金', nameEn: 'Cash', amount: 100000 }],
        liabilities: [],
        equity: [{ code: '3000', name: '資本金', nameEn: 'Capital', amount: 100000 }],
        totalAssets: 100000,
        totalLiabilities: 0,
        totalEquity: 100000,
      }

      const targetBS = {
        asOfDate: new Date('2024-12-31'),
        assets: [
          { code: '1100', name: 'Cash', nameEn: 'Cash', amount: 100000, sourceAccountCode: '1000' },
        ],
        liabilities: [],
        equity: [
          {
            code: '3100',
            name: 'Capital',
            nameEn: 'Capital',
            amount: 100000,
            sourceAccountCode: '3000',
          },
        ],
        totalAssets: 100000,
        totalLiabilities: 0,
        totalEquity: 100000,
      }

      const sourcePL = {
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        revenue: [{ code: '4000', name: '売上', nameEn: 'Sales', amount: 100000 }],
        costOfSales: [],
        sgaExpenses: [],
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        grossProfit: 100000,
        operatingIncome: 100000,
        ordinaryIncome: 100000,
        incomeBeforeTax: 100000,
        netIncome: 100000,
      }

      const targetPL = {
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        revenue: [
          {
            code: '4100',
            name: 'Revenue',
            nameEn: 'Revenue',
            amount: 100000,
            sourceAccountCode: '4000',
          },
        ],
        costOfSales: [],
        sgaExpenses: [],
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        grossProfit: 100000,
        operatingIncome: 100000,
        ordinaryIncome: 100000,
        incomeBeforeTax: 100000,
        netIncome: 100000,
      }

      const result = await converter.generateComparisonReport(
        sourceBS as any,
        targetBS as any,
        sourcePL as any,
        targetPL as any
      )

      expect(result.balanceSheet).toBeDefined()
      expect(result.profitLoss).toBeDefined()
      expect(result.significantDifferences).toBeDefined()
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported as financialStatementConverter', () => {
      expect(financialStatementConverter).toBeInstanceOf(FinancialStatementConverter)
    })
  })
})

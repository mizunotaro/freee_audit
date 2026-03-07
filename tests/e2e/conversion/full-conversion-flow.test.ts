import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'
import { accountMappingService } from '@/services/conversion/account-mapping-service'
import { conversionEngine } from '@/services/conversion/conversion-engine'
import { conversionExportService } from '@/services/conversion/conversion-export-service'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    accountingStandard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    chartOfAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    chartOfAccountItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    conversionProject: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    conversionResult: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    accountMapping: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    conversionExport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    journal: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    cashFlow: {
      findMany: vi.fn(),
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

vi.mock('@/lib/conversion/exporters/pdf-exporter', () => ({
  PDFExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('<html>test</html>'),
      fileName: 'conversion_test.html',
      mimeType: 'text/html',
    }),
  })),
}))

vi.mock('@/lib/conversion/exporters/excel-exporter', () => ({
  ExcelExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('csv,data'),
      fileName: 'conversion_test.csv',
      mimeType: 'text/csv',
    }),
  })),
}))

vi.mock('@/lib/conversion/exporters/csv-exporter', () => ({
  CSVExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('record_type,account_code'),
      fileName: 'conversion_data_test.csv',
      mimeType: 'text/csv',
    }),
  })),
}))

vi.mock('@/lib/conversion/exporters/json-exporter', () => ({
  JSONExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('{"test": true}'),
      fileName: 'conversion_test.json',
      mimeType: 'application/json',
    }),
  })),
}))

describe('Full Conversion Flow E2E', () => {
  const mockUser = {
    id: 'user-1',
    companyId: 'company-1',
  }

  const mockJgaapStandard = {
    id: 'jgaap-id',
    code: 'JGAAP',
    name: '日本一般企業会計原則',
  }

  const mockUsgaapStandard = {
    id: 'usgaap-id',
    code: 'USGAAP',
    name: '米国会計基準',
  }

  const mockTargetCoa = {
    id: 'coa-target-1',
    companyId: 'company-1',
    standardId: 'usgaap-id',
    name: 'USGAAP Chart of Accounts',
  }

  const mockSourceItems = [
    { id: 'item-1', code: '1000', name: '現金', nameEn: 'Cash', category: 'current_asset' },
    {
      id: 'item-2',
      code: '1100',
      name: '普通預金',
      nameEn: 'Ordinary Deposits',
      category: 'current_asset',
    },
    {
      id: 'item-3',
      code: '2000',
      name: '買掛金',
      nameEn: 'Accounts Payable',
      category: 'current_liability',
    },
    { id: 'item-4', code: '3000', name: '資本金', nameEn: 'Capital Stock', category: 'equity' },
    { id: 'item-5', code: '4000', name: '売上高', nameEn: 'Sales', category: 'revenue' },
    { id: 'item-6', code: '5000', name: '売上原価', nameEn: 'Cost of Sales', category: 'cogs' },
  ]

  const mockTargetItems = [
    {
      id: 'target-1',
      code: '1100',
      name: 'Cash and Cash Equivalents',
      nameEn: 'Cash and Cash Equivalents',
      category: 'current_asset',
    },
    {
      id: 'target-2',
      code: '2100',
      name: 'Accounts Payable',
      nameEn: 'Accounts Payable',
      category: 'current_liability',
    },
    {
      id: 'target-3',
      code: '3100',
      name: 'Common Stock',
      nameEn: 'Common Stock',
      category: 'equity',
    },
    { id: 'target-4', code: '4100', name: 'Revenue', nameEn: 'Revenue', category: 'revenue' },
    {
      id: 'target-5',
      code: '5100',
      name: 'Cost of Revenue',
      nameEn: 'Cost of Revenue',
      category: 'cogs',
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
      amount: 1000000,
      taxAmount: 100000,
      taxType: 'taxable',
    },
    {
      id: 'journal-2',
      companyId: 'company-1',
      freeeJournalId: 'freee-2',
      entryDate: new Date('2024-02-15'),
      description: 'Purchase inventory',
      debitAccount: '5000',
      creditAccount: '2000',
      amount: 500000,
      taxAmount: 50000,
      taxType: 'taxable',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete JGAAP to USGAAP Conversion', () => {
    it('should execute full conversion workflow', async () => {
      vi.mocked(prisma.accountingStandard.findUnique)
        .mockResolvedValueOnce(mockJgaapStandard as any)
        .mockResolvedValueOnce(mockUsgaapStandard as any)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockTargetCoa as any)

      const mockProjectDb = {
        id: 'project-1',
        companyId: 'company-1',
        name: 'FY2024 JGAAP to USGAAP Conversion',
        description: 'Annual conversion project',
        sourceStandardId: 'jgaap-id',
        targetStandardId: 'usgaap-id',
        targetCoaId: 'coa-target-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        status: 'draft',
        progress: 0,
        settings: JSON.stringify({
          includeJournals: true,
          includeFinancialStatements: true,
          generateAdjustingEntries: true,
          aiAssistedMapping: true,
        }),
        statistics: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        sourceStandard: mockJgaapStandard,
        targetStandard: mockUsgaapStandard,
        targetCoa: mockTargetCoa,
      }

      vi.mocked(prisma.conversionProject.create).mockResolvedValue(mockProjectDb as any)

      const project = await conversionProjectService.create(
        'company-1',
        {
          name: 'FY2024 JGAAP to USGAAP Conversion',
          description: 'Annual conversion project',
          targetStandard: 'USGAAP',
          targetCoaId: 'coa-target-1',
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          settings: {
            includeJournals: true,
            includeFinancialStatements: true,
            generateAdjustingEntries: true,
            aiAssistedMapping: true,
          },
        },
        'user-1'
      )

      expect(project.id).toBe('project-1')
      expect(project.status).toBe('draft')
    })

    it('should create account mappings', async () => {
      const mockMappings = mockSourceItems.map((item, idx) => ({
        id: `mapping-${idx}`,
        companyId: 'company-1',
        sourceCoaId: 'coa-source-1',
        sourceItemId: item.id,
        targetCoaId: 'coa-target-1',
        targetItemId: mockTargetItems[idx % mockTargetItems.length].id,
        mappingType: '1to1',
        conversionRule: null,
        percentage: null,
        confidence: 0.95,
        isManualReview: false,
        isApproved: true,
        notes: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedBy: 'user-1',
        approvedAt: new Date(),
        sourceItem: item,
        targetItem: mockTargetItems[idx % mockTargetItems.length],
      }))

      vi.mocked(prisma.accountMapping.create).mockResolvedValue(mockMappings[0] as any)

      const mapping = await accountMappingService.create({
        companyId: 'company-1',
        sourceCoaId: 'coa-source-1',
        sourceItemId: 'item-1',
        targetCoaId: 'coa-target-1',
        targetItemId: 'target-1',
        mappingType: '1to1',
        confidence: 0.95,
        isManualReview: false,
      })

      expect(mapping.mappingType).toBe('1to1')
    })

    it('should execute conversion', async () => {
      const mockProject = {
        id: 'project-1',
        companyId: 'company-1',
        targetCoaId: 'coa-target-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        status: 'mapping',
        progress: 0,
        settings: JSON.stringify({
          includeJournals: true,
          includeFinancialStatements: true,
          generateAdjustingEntries: false,
          aiAssistedMapping: false,
        }),
      }

      const mockMappings = [
        {
          id: 'mapping-1',
          companyId: 'company-1',
          sourceCoaId: 'coa-source-1',
          sourceItemId: 'item-1',
          targetCoaId: 'coa-target-1',
          targetItemId: 'target-1',
          mappingType: '1to1',
          conversionRule: null,
          confidence: 0.95,
          isManualReview: false,
          isApproved: true,
          sourceItem: { id: 'item-1', code: '1000', name: '現金' },
          targetItem: { id: 'target-1', code: '1100', name: 'Cash' },
        },
        {
          id: 'mapping-2',
          companyId: 'company-1',
          sourceCoaId: 'coa-source-1',
          sourceItemId: 'item-5',
          targetCoaId: 'coa-target-1',
          targetItemId: 'target-4',
          mappingType: '1to1',
          conversionRule: null,
          confidence: 0.95,
          isManualReview: false,
          isApproved: true,
          sourceItem: { id: 'item-5', code: '4000', name: '売上高' },
          targetItem: { id: 'target-4', code: '4100', name: 'Revenue' },
        },
      ]

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(2)
      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)
      vi.mocked(prisma.accountMapping.findMany).mockResolvedValue(mockMappings as any)
      vi.mocked(prisma.accountMapping.count).mockResolvedValue(mockMappings.length)
      vi.mocked(prisma.accountMapping.groupBy).mockResolvedValue([])
      vi.mocked(prisma.accountMapping.aggregate).mockResolvedValue({
        _avg: { confidence: 0.95 },
      } as any)
      vi.mocked(prisma.conversionProject.update).mockResolvedValue({} as any)
      vi.mocked(prisma.conversionResult.create).mockResolvedValue({
        id: 'result-1',
        projectId: 'project-1',
        journalConversions: JSON.stringify([]),
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

      const result = await conversionEngine.execute('project-1')

      expect(result.projectId).toBe('project-1')
      expect(prisma.conversionResult.create).toHaveBeenCalled()
    })

    it('should export conversion result', async () => {
      const mockProjectWithResults = {
        id: 'project-1',
        companyId: 'company-1',
        name: 'Test Project',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        status: 'completed',
        company: { id: 'company-1', name: 'Test Company' },
        sourceStandard: { code: 'JGAAP' },
        targetStandard: { code: 'USGAAP' },
        results: [
          {
            id: 'result-1',
            projectId: 'project-1',
            journalConversions: JSON.stringify([]),
            balanceSheet: JSON.stringify({
              asOfDate: '2024-12-31',
              assets: [],
              liabilities: [],
              equity: [],
              totalAssets: 0,
              totalLiabilities: 0,
              totalEquity: 0,
            }),
            profitLoss: null,
            cashFlow: null,
            conversionDate: new Date(),
            conversionDurationMs: 1000,
            warnings: '[]',
            errors: '[]',
          },
        ],
      }

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(
        mockProjectWithResults as any
      )
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify({}),
        fileName: 'conversion_test.html',
        fileSize: 100,
        generatedBy: 'user-1',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const result = await conversionExportService.export(
        'project-1',
        {
          format: 'pdf',
          includeJournals: true,
          includeFinancialStatements: true,
          includeAdjustingEntries: false,
          includeDisclosures: false,
          includeAIAnalysis: false,
          language: 'ja',
          currency: 'source',
        },
        'user-1'
      )

      expect(result.format).toBe('pdf')
      expect(result.fileName).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing mappings gracefully', async () => {
      const mockProject = {
        id: 'project-1',
        companyId: 'company-1',
        targetCoaId: 'coa-target-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        status: 'mapping',
        progress: 0,
        settings: JSON.stringify({
          includeJournals: true,
          includeFinancialStatements: true,
          generateAdjustingEntries: false,
          aiAssistedMapping: false,
        }),
      }

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
        journalConversions: JSON.stringify([]),
        balanceSheet: null,
        profitLoss: null,
        cashFlow: null,
        conversionDate: new Date(),
        conversionDurationMs: 1000,
        warnings: '[]',
        errors: '[]',
      } as any)

      const result = await conversionEngine.execute('project-1', { skipValidation: true })

      expect(result.warnings).toBeDefined()
    })

    it('should prevent export of incomplete conversion', async () => {
      const mockIncompleteProject = {
        id: 'project-1',
        companyId: 'company-1',
        name: 'Test Project',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        status: 'converting',
        company: { id: 'company-1', name: 'Test Company' },
        sourceStandard: { code: 'JGAAP' },
        targetStandard: { code: 'USGAAP' },
        results: [],
      }

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockIncompleteProject as any)

      await expect(
        conversionExportService.export('project-1', {
          format: 'pdf',
          includeJournals: true,
          includeFinancialStatements: true,
          includeAdjustingEntries: false,
          includeDisclosures: false,
          includeAIAnalysis: false,
          language: 'ja',
          currency: 'source',
        })
      ).rejects.toThrow('Conversion result not found')
    })
  })

  describe('Progress Tracking', () => {
    it('should track conversion progress', async () => {
      const mockProject = {
        id: 'project-1',
        companyId: 'company-1',
        targetCoaId: 'coa-target-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        status: 'converting',
        progress: 50,
        settings: JSON.stringify({}),
      }

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(100)
      vi.mocked(prisma.conversionResult.findFirst).mockResolvedValue(null)

      const progress = await conversionEngine.getProgress('project-1')

      expect(progress.status).toBe('converting')
      expect(progress.progress).toBe(50)
    })
  })

  describe('Multi-format Export', () => {
    it('should support all export formats', async () => {
      const mockCompletedProject = {
        id: 'project-1',
        companyId: 'company-1',
        name: 'Test Project',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        status: 'completed',
        company: { id: 'company-1', name: 'Test Company' },
        sourceStandard: { code: 'JGAAP' },
        targetStandard: { code: 'USGAAP' },
        results: [
          {
            id: 'result-1',
            projectId: 'project-1',
            journalConversions: JSON.stringify([]),
            balanceSheet: null,
            profitLoss: null,
            cashFlow: null,
            conversionDate: new Date(),
            conversionDurationMs: 1000,
            warnings: '[]',
            errors: '[]',
          },
        ],
      }

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockCompletedProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'json',
        config: JSON.stringify({}),
        fileName: 'test.json',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const formats = ['pdf', 'excel', 'csv', 'json'] as const

      for (const format of formats) {
        const result = await conversionExportService.export('project-1', {
          format,
          includeJournals: true,
          includeFinancialStatements: true,
          includeAdjustingEntries: false,
          includeDisclosures: false,
          includeAIAnalysis: false,
          language: 'ja',
          currency: 'source',
        })

        expect(result.format).toBe(format)
      }
    })
  })
})

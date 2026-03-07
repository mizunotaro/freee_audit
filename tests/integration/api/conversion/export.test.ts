import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { conversionExportService } from '@/services/conversion/conversion-export-service'

vi.mock('@/lib/db', () => ({
  prisma: {
    conversionProject: {
      findUnique: vi.fn(),
    },
    conversionExport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/conversion/exporters/pdf-exporter', () => ({
  PDFExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('<html>test</html>'),
      fileName: 'test.html',
      mimeType: 'text/html',
    }),
  })),
}))

vi.mock('@/lib/conversion/exporters/excel-exporter', () => ({
  ExcelExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('csv,data'),
      fileName: 'test.csv',
      mimeType: 'text/csv',
    }),
  })),
}))

vi.mock('@/lib/conversion/exporters/csv-exporter', () => ({
  CSVExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('record_type,account_code'),
      fileName: 'test.csv',
      mimeType: 'text/csv',
    }),
  })),
}))

vi.mock('@/lib/conversion/exporters/json-exporter', () => ({
  JSONExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue({
      buffer: Buffer.from('{"test": true}'),
      fileName: 'test.json',
      mimeType: 'application/json',
    }),
  })),
}))

describe('Conversion Export API Integration', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    companyId: 'company-1',
    role: 'ACCOUNTANT',
  }

  const mockProject = {
    id: 'project-1',
    companyId: 'company-1',
    name: 'Test Project',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
    status: 'completed',
    company: {
      id: 'company-1',
      name: 'Test Company',
    },
    sourceStandard: {
      code: 'JGAAP',
    },
    targetStandard: {
      code: 'USGAAP',
    },
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
        createdAt: new Date(),
      },
    ],
  }

  const mockExportConfig = {
    format: 'pdf' as const,
    includeJournals: true,
    includeFinancialStatements: true,
    includeAdjustingEntries: true,
    includeDisclosures: true,
    includeAIAnalysis: false,
    language: 'ja' as const,
    currency: 'source' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/conversion/export/:projectId', () => {
    it('should export completed project to PDF', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify(mockExportConfig),
        fileName: 'test.html',
        fileSize: 100,
        generatedBy: 'user-1',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const result = await conversionExportService.export('project-1', mockExportConfig, 'user-1')

      expect(result.format).toBe('pdf')
      expect(result.fileName).toBeDefined()
      expect(result.fileUrl).toBeDefined()
    })

    it('should export to all supported formats', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)

      const formats = ['pdf', 'excel', 'csv', 'json'] as const

      for (const format of formats) {
        vi.mocked(prisma.conversionExport.create).mockResolvedValue({
          id: `export-${format}`,
          resultId: 'result-1',
          format,
          config: JSON.stringify(mockExportConfig),
          fileName: `test.${format === 'excel' ? 'csv' : format}`,
          fileSize: 100,
          generatedBy: 'user-1',
          generatedAt: new Date(),
          expiresAt: new Date(),
          filePath: null,
        } as any)
        vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

        const result = await conversionExportService.export('project-1', {
          ...mockExportConfig,
          format,
        })

        expect(result.format).toBe(format)
      }
    })

    it('should reject export for non-completed project', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProject,
        status: 'draft',
        results: [],
      } as any)

      await expect(conversionExportService.export('project-1', mockExportConfig)).rejects.toThrow(
        'Conversion result not found'
      )
    })

    it('should reject invalid format', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)

      await expect(
        conversionExportService.export('project-1', {
          ...mockExportConfig,
          format: 'invalid' as any,
        })
      ).rejects.toThrow('Unsupported export format')
    })

    it('should handle missing project', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      await expect(
        conversionExportService.export('non-existent', mockExportConfig)
      ).rejects.toThrow('Project not found')
    })
  })

  describe('GET /api/conversion/export/:projectId', () => {
    it('should return export history', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([
        {
          id: 'export-1',
          resultId: 'result-1',
          format: 'pdf',
          fileName: 'test1.html',
          fileSize: 1000,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          filePath: null,
        },
        {
          id: 'export-2',
          resultId: 'result-1',
          format: 'csv',
          fileName: 'test2.csv',
          fileSize: 500,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          filePath: null,
        },
      ] as any)

      const result = await conversionExportService.getExportHistory('project-1')

      expect(result).toHaveLength(2)
      expect(result[0].format).toBe('pdf')
      expect(result[1].format).toBe('csv')
    })

    it('should return empty history for no exports', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([] as any)

      const result = await conversionExportService.getExportHistory('project-1')

      expect(result).toEqual([])
    })

    it('should limit history to 20 items', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([] as any)

      await conversionExportService.getExportHistory('project-1')

      expect(prisma.conversionExport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      )
    })
  })

  describe('Export Configuration', () => {
    it('should support language options', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify(mockExportConfig),
        fileName: 'test.html',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const languages = ['ja', 'en', 'both'] as const

      for (const language of languages) {
        await conversionExportService.export('project-1', {
          ...mockExportConfig,
          language,
        })
      }

      expect(prisma.conversionExport.create).toHaveBeenCalledTimes(3)
    })

    it('should support currency display options', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify(mockExportConfig),
        fileName: 'test.html',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const currencies = ['source', 'target', 'both'] as const

      for (const currency of currencies) {
        await conversionExportService.export('project-1', {
          ...mockExportConfig,
          currency,
        })
      }

      expect(prisma.conversionExport.create).toHaveBeenCalledTimes(3)
    })

    it('should support selective content inclusion', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify(mockExportConfig),
        fileName: 'test.html',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      await conversionExportService.export('project-1', {
        ...mockExportConfig,
        includeJournals: false,
        includeAdjustingEntries: false,
        includeDisclosures: false,
        includeAIAnalysis: true,
      })

      const createCall = vi.mocked(prisma.conversionExport.create).mock.calls[0][0]
      const config = JSON.parse(createCall.data.config as string)

      expect(config.includeJournals).toBe(false)
      expect(config.includeAdjustingEntries).toBe(false)
      expect(config.includeDisclosures).toBe(false)
      expect(config.includeAIAnalysis).toBe(true)
    })
  })

  describe('Export Expiry', () => {
    it('should set expiry time for exports', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify(mockExportConfig),
        fileName: 'test.html',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      await conversionExportService.export('project-1', mockExportConfig)

      const createCall = vi.mocked(prisma.conversionExport.create).mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)

      expect(hoursDiff).toBeCloseTo(24, 0)
    })
  })
})

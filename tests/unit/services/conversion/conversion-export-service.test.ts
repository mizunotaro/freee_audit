import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ConversionExportService,
  conversionExportService,
} from '@/services/conversion/conversion-export-service'
import { prisma } from '@/lib/db'
import type { ExportConfig } from '@/types/conversion'

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
  PDFExporter: class {
    async export() {
      return {
        buffer: Buffer.from('<html>test</html>'),
        fileName: 'test.html',
        mimeType: 'text/html',
      }
    }
  },
}))

vi.mock('@/lib/conversion/exporters/excel-exporter', () => ({
  ExcelExporter: class {
    async export() {
      return {
        buffer: Buffer.from('csv,data'),
        fileName: 'test.csv',
        mimeType: 'text/csv',
      }
    }
  },
}))

vi.mock('@/lib/conversion/exporters/csv-exporter', () => ({
  CSVExporter: class {
    async export() {
      return {
        buffer: Buffer.from('record_type,account_code'),
        fileName: 'test.csv',
        mimeType: 'text/csv',
      }
    }
  },
}))

vi.mock('@/lib/conversion/exporters/json-exporter', () => ({
  JSONExporter: class {
    async export() {
      return {
        buffer: Buffer.from('{"test": true}'),
        fileName: 'test.json',
        mimeType: 'application/json',
      }
    }
  },
}))

describe('ConversionExportService', () => {
  let service: ConversionExportService

  const mockConfig: ExportConfig = {
    format: 'pdf',
    includeJournals: true,
    includeFinancialStatements: true,
    includeAdjustingEntries: true,
    includeDisclosures: true,
    includeAIAnalysis: false,
    language: 'ja',
    currency: 'source',
  }

  const mockProject = {
    id: 'project-1',
    companyId: 'company-1',
    name: 'Test Project',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
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

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ConversionExportService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('export', () => {
    it('should export project to PDF format', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify(mockConfig),
        fileName: 'test.html',
        fileSize: 100,
        generatedBy: 'user-1',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const result = await service.export('project-1', mockConfig, 'user-1')

      expect(result.projectId).toBe('project-1')
      expect(result.format).toBe('pdf')
      expect(result.fileName).toBeDefined()
      expect(result.fileSize).toBeGreaterThan(0)
      expect(result.fileUrl).toContain('/api/conversion/download/')
    })

    it('should export project to Excel format', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'excel',
        config: JSON.stringify(mockConfig),
        fileName: 'test.csv',
        fileSize: 100,
        generatedBy: 'user-1',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const result = await service.export('project-1', { ...mockConfig, format: 'excel' })

      expect(result.format).toBe('excel')
    })

    it('should export project to CSV format', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'csv',
        config: JSON.stringify(mockConfig),
        fileName: 'test.csv',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const result = await service.export('project-1', { ...mockConfig, format: 'csv' })

      expect(result.format).toBe('csv')
    })

    it('should export project to JSON format', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'json',
        config: JSON.stringify(mockConfig),
        fileName: 'test.json',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      const result = await service.export('project-1', { ...mockConfig, format: 'json' })

      expect(result.format).toBe('json')
    })

    it('should throw error when project not found', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      await expect(service.export('non-existent', mockConfig)).rejects.toThrow('Project not found')
    })

    it('should throw error when conversion result not found', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        ...mockProject,
        results: [],
      } as any)

      await expect(service.export('project-1', mockConfig)).rejects.toThrow(
        'Conversion result not found'
      )
    })

    it('should throw error for unsupported format', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)

      await expect(
        service.export('project-1', { ...mockConfig, format: 'invalid' as any })
      ).rejects.toThrow('Unsupported export format')
    })

    it('should set expiry time for exports', async () => {
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionExport.create).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        config: JSON.stringify(mockConfig),
        fileName: 'test.html',
        fileSize: 100,
        generatedBy: null,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)
      vi.mocked(prisma.conversionExport.update).mockResolvedValue({} as any)

      await service.export('project-1', mockConfig)

      const createCall = vi.mocked(prisma.conversionExport.create).mock.calls[0][0]
      expect(createCall.data).toHaveProperty('expiresAt')
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
      expect(hoursDiff).toBeCloseTo(24, 0)
    })
  })

  describe('getExportHistory', () => {
    it('should return export history for project', async () => {
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

      const result = await service.getExportHistory('project-1')

      expect(result).toHaveLength(2)
      expect(result[0].format).toBe('pdf')
      expect(result[1].format).toBe('csv')
    })

    it('should limit history to 20 items', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([] as any)

      await service.getExportHistory('project-1')

      expect(prisma.conversionExport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      )
    })

    it('should order by generatedAt descending', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([] as any)

      await service.getExportHistory('project-1')

      expect(prisma.conversionExport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            generatedAt: 'desc',
          },
        })
      )
    })

    it('should return empty array when no exports', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([] as any)

      const result = await service.getExportHistory('project-1')

      expect(result).toEqual([])
    })
  })

  describe('getExportById', () => {
    it('should return null when export not found', async () => {
      vi.mocked(prisma.conversionExport.findUnique).mockResolvedValue(null)

      const result = await service.getExportById('non-existent')

      expect(result).toBeNull()
    })

    it('should return null when export has no file path', async () => {
      vi.mocked(prisma.conversionExport.findUnique).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        fileName: 'test.html',
        fileSize: 100,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        filePath: null,
      } as any)

      const result = await service.getExportById('export-1')

      expect(result).toBeNull()
    })

    it('should return null when export has expired', async () => {
      vi.mocked(prisma.conversionExport.findUnique).mockResolvedValue({
        id: 'export-1',
        resultId: 'result-1',
        format: 'pdf',
        fileName: 'test.html',
        fileSize: 100,
        generatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        filePath: 'exports/export-1/test.html',
      } as any)

      const result = await service.getExportById('export-1')

      expect(result).toBeNull()
    })
  })

  describe('deleteExpiredExports', () => {
    it('should delete expired exports', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([
        {
          id: 'export-1',
          resultId: 'result-1',
          format: 'pdf',
          fileName: 'test.html',
          filePath: 'exports/export-1/test.html',
          expiresAt: new Date(Date.now() - 1000),
        },
      ] as any)
      vi.mocked(prisma.conversionExport.deleteMany).mockResolvedValue({ count: 1 })

      const result = await service.deleteExpiredExports()

      expect(result).toBe(1)
      expect(prisma.conversionExport.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      })
    })

    it('should return 0 when no expired exports', async () => {
      vi.mocked(prisma.conversionExport.findMany).mockResolvedValue([] as any)
      vi.mocked(prisma.conversionExport.deleteMany).mockResolvedValue({ count: 0 })

      const result = await service.deleteExpiredExports()

      expect(result).toBe(0)
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported correctly', () => {
      expect(conversionExportService).toBeInstanceOf(ConversionExportService)
    })
  })
})

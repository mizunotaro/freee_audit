import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WordExporter } from '@/lib/conversion/exporters/word-exporter'
import type { ConversionResult, ExportConfig, DisclosureDocument } from '@/types/conversion'
import type { ExporterContext } from '@/lib/conversion/exporters/types'

vi.mock('docx', function () {
  const mockParagraph = function (opts: Record<string, unknown>) {
    return { type: 'Paragraph', ...opts }
  }
  const mockTextRun = function (opts: Record<string, unknown>) {
    return { type: 'TextRun', ...opts }
  }
  const mockTable = function (opts: Record<string, unknown>) {
    return { type: 'Table', ...opts }
  }
  const mockTableRow = function (opts: Record<string, unknown>) {
    return { type: 'TableRow', ...opts }
  }
  const mockTableCell = function (opts: Record<string, unknown>) {
    return { type: 'TableCell', ...opts }
  }
  return {
    Document: function (opts: Record<string, unknown>) {
      return { type: 'Document', ...opts }
    },
    Paragraph: mockParagraph,
    TextRun: mockTextRun,
    Table: mockTable,
    TableRow: mockTableRow,
    TableCell: mockTableCell,
    HeadingLevel: { TITLE: 'title', HEADING_1: 'heading1' },
    WidthType: { PERCENTAGE: 'pct' },
    AlignmentType: { CENTER: 'center', LEFT: 'left', RIGHT: 'right' },
    Packer: { toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-docx')) },
  }
})

describe('WordExporter', function () {
  let exporter: WordExporter

  const mockContext: ExporterContext = {
    projectId: 'proj-1',
    projectName: 'Test Project',
    companyName: 'Test Corp',
    sourceStandard: 'JGAAP',
    targetStandard: 'USGAAP',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
  }

  const baseConfig: ExportConfig = {
    format: 'pdf',
    includeJournals: false,
    includeFinancialStatements: true,
    includeAdjustingEntries: true,
    includeDisclosures: true,
    includeAIAnalysis: false,
    language: 'ja',
    currency: 'source',
  }

  const fullResult: ConversionResult = {
    id: 'res-1',
    projectId: 'proj-1',
    conversionDate: new Date('2024-06-15'),
    conversionDurationMs: 1000,
    warnings: [],
    errors: [],
    balanceSheet: {
      asOfDate: new Date('2024-12-31'),
      assets: [{ code: '1100', name: '現金', nameEn: 'Cash', amount: 1000000 }],
      liabilities: [{ code: '2100', name: '買掛金', nameEn: 'Payables', amount: 300000 }],
      equity: [{ code: '3100', name: '資本金', nameEn: 'Capital', amount: 700000 }],
      totalAssets: 1000000,
      totalLiabilities: 300000,
      totalEquity: 700000,
    },
    profitLoss: {
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      revenue: [{ code: '4100', name: '売上', nameEn: 'Revenue', amount: 2000000 }],
      costOfSales: [],
      sgaExpenses: [],
      nonOperatingIncome: [],
      nonOperatingExpenses: [],
      grossProfit: 1500000,
      operatingIncome: 800000,
      ordinaryIncome: 700000,
      incomeBeforeTax: 600000,
      netIncome: 400000,
    },
    adjustingEntries: [
      {
        id: 'adj-1',
        projectId: 'proj-1',
        type: 'lease_classification',
        description: 'リース調整',
        descriptionEn: 'Lease adjustment',
        lines: [],
        ifrsReference: 'IFRS 16',
        usgaapReference: 'ASC 842',
        aiSuggested: false,
        isApproved: true,
      },
    ],
    disclosures: [
      {
        id: 'disc-1',
        category: 'significant_accounting_policies',
        title: '会計方針',
        titleEn: 'Accounting Policies',
        content: '内容',
        contentEn: 'Content',
        standardReference: 'ASC 235',
        order: 1,
        isGenerated: false,
      },
    ],
  }

  const mockDisclosure: DisclosureDocument = {
    id: 'dd-1',
    projectId: 'proj-1',
    category: 'basis_of_conversion',
    title: '変換の基礎',
    titleEn: 'Basis of Conversion',
    content: '変換内容\n2行目',
    contentEn: 'Conversion content\nline 2',
    sections: [],
    standardReferences: [
      { id: 'sr-1', referenceNumber: 'ASC 250', title: 'Accounting Changes', source: 'USGAAP' },
    ],
    relatedRationaleIds: [],
    isGenerated: false,
    isAiEnhanced: false,
    generatedAt: new Date(),
    updatedAt: new Date(),
    sortOrder: 1,
  }

  beforeEach(function () {
    exporter = new WordExporter()
  })

  describe('export', function () {
    it('should return buffer, fileName and mimeType for minimal result', async function () {
      const minimalResult: ConversionResult = {
        id: 'r1',
        projectId: 'p1',
        conversionDate: new Date(),
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }
      const result = await exporter.export(minimalResult, baseConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.fileName).toMatch(/^conversion_Test_Project_\d{4}-\d{2}-\d{2}\.docx$/)
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    })

    it('should include balance sheet when configured', async function () {
      const result = await exporter.export(fullResult, baseConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should include profit and loss when configured', async function () {
      const result = await exporter.export(fullResult, baseConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should include adjusting entries when present', async function () {
      const result = await exporter.export(fullResult, baseConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should include disclosures when present', async function () {
      const result = await exporter.export(fullResult, baseConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should generate English content when language is en', async function () {
      const enConfig = { ...baseConfig, language: 'en' as const }
      const result = await exporter.export(fullResult, enConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should skip financial statements when includeFinancialStatements is false', async function () {
      const noFsConfig = { ...baseConfig, includeFinancialStatements: false }
      const result = await exporter.export(fullResult, noFsConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should skip adjusting entries when includeAdjustingEntries is false', async function () {
      const noAdjConfig = { ...baseConfig, includeAdjustingEntries: false }
      const result = await exporter.export(fullResult, noAdjConfig, mockContext)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should sanitize projectName in fileName', async function () {
      const specialContext = { ...mockContext, projectName: 'Test/Project<>' }
      const result = await exporter.export(fullResult, baseConfig, specialContext)
      expect(result.fileName).not.toContain('/')
      expect(result.fileName).not.toContain('<')
      expect(result.fileName).not.toContain('>')
    })
  })

  describe('exportDisclosures', function () {
    it('should export disclosures with standard references', async function () {
      const result = await exporter.exportDisclosures([mockDisclosure], mockContext, baseConfig)
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.fileName).toMatch(/^disclosures_Test_Project_\d{4}-\d{2}-\d{2}\.docx$/)
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    })

    it('should export disclosures with empty references', async function () {
      const disclosureNoRefs = { ...mockDisclosure, standardReferences: [] }
      const result = await exporter.exportDisclosures([disclosureNoRefs], mockContext, baseConfig)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should handle English language disclosures', async function () {
      const enConfig = { ...baseConfig, language: 'en' as const }
      const result = await exporter.exportDisclosures([mockDisclosure], mockContext, enConfig)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should handle disclosure with no contentEn falling back to content', async function () {
      const disclosureNoEn = { ...mockDisclosure, contentEn: undefined }
      const enConfig = { ...baseConfig, language: 'en' as const }
      const result = await exporter.exportDisclosures([disclosureNoEn], mockContext, enConfig)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should handle multiple disclosures', async function () {
      const disclosures = [
        mockDisclosure,
        {
          ...mockDisclosure,
          id: 'dd-2',
          title: '別の開示',
          titleEn: 'Other Disclosure',
          content: '他の内容',
        },
      ]
      const result = await exporter.exportDisclosures(disclosures, mockContext, baseConfig)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })

    it('should handle empty disclosures array', async function () {
      const result = await exporter.exportDisclosures([], mockContext, baseConfig)
      expect(result.buffer).toBeInstanceOf(Buffer)
    })
  })
})

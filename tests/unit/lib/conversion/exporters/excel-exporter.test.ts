import { describe, it, expect, beforeEach } from 'vitest'
import { ExcelExporter } from '@/lib/conversion/exporters/excel-exporter'
import type { ConversionResult, ExportConfig } from '@/types/conversion'
import type { ExporterContext } from '@/lib/conversion/exporters/types'

describe('ExcelExporter', () => {
  let exporter: ExcelExporter

  const mockContext: ExporterContext = {
    projectId: 'project-1',
    projectName: 'Test Project',
    companyName: 'Test Company',
    sourceStandard: 'JGAAP',
    targetStandard: 'USGAAP',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
  }

  const mockConfig: ExportConfig = {
    format: 'excel',
    includeJournals: true,
    includeFinancialStatements: true,
    includeAdjustingEntries: true,
    includeDisclosures: true,
    includeAIAnalysis: false,
    language: 'ja',
    currency: 'source',
  }

  const mockResult: ConversionResult = {
    id: 'result-1',
    projectId: 'project-1',
    conversionDate: new Date(),
    conversionDurationMs: 1000,
    warnings: [],
    errors: [],
    balanceSheet: {
      asOfDate: new Date('2024-12-31'),
      assets: [
        { code: '1100', name: '現金', nameEn: 'Cash', amount: 1000000 },
        { code: '1200', name: '売掛金', nameEn: 'Accounts Receivable', amount: 500000 },
      ],
      liabilities: [{ code: '2100', name: '買掛金', nameEn: 'Accounts Payable', amount: 300000 }],
      equity: [{ code: '3100', name: '資本金', nameEn: 'Capital', amount: 1200000 }],
      totalAssets: 1500000,
      totalLiabilities: 300000,
      totalEquity: 1200000,
    },
    profitLoss: {
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      revenue: [{ code: '4100', name: '売上', nameEn: 'Revenue', amount: 2000000 }],
      costOfSales: [{ code: '5100', name: '売上原価', nameEn: 'COGS', amount: 800000 }],
      sgaExpenses: [],
      nonOperatingIncome: [],
      nonOperatingExpenses: [],
      grossProfit: 1200000,
      operatingIncome: 700000,
      ordinaryIncome: 700000,
      incomeBeforeTax: 700000,
      netIncome: 500000,
    },
    journalConversions: [
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
        ],
        mappingConfidence: 0.95,
        requiresReview: false,
      },
    ],
    adjustingEntries: [
      {
        id: 'adj-1',
        projectId: 'project-1',
        type: 'lease_classification',
        description: 'リース調整',
        descriptionEn: 'Lease adjustment',
        lines: [],
        ifrsReference: 'IFRS 16',
        aiSuggested: true,
        isApproved: false,
      },
    ],
  }

  beforeEach(() => {
    exporter = new ExcelExporter()
  })

  describe('export', () => {
    it('should generate CSV buffer', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.fileName).toMatch(/\.csv$/)
      expect(result.mimeType).toBe('text/csv')
    })

    it('should include company name in output', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('Test Company')
    })

    it('should include project name in filename', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)

      expect(result.fileName).toContain('Test_Project')
    })

    it('should include date in filename', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const dateStr = new Date().toISOString().split('T')[0]

      expect(result.fileName).toContain(dateStr)
    })

    it('should include balance sheet section', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('貸借対照表')
      expect(csv).toContain('資産')
      expect(csv).toContain('負債')
      expect(csv).toContain('株主資本')
    })

    it('should include profit and loss section', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('損益計算書')
      expect(csv).toContain('売上総利益')
      expect(csv).toContain('営業利益')
      expect(csv).toContain('当期純利益')
    })

    it('should include journal conversions when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('仕訳変換')
      expect(csv).toContain('ソース科目')
      expect(csv).toContain('ターゲット科目')
    })

    it('should include adjusting entries when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('調整仕訳')
    })

    it('should exclude journals when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeJournals: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).not.toContain('仕訳変換')
    })

    it('should exclude financial statements when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeFinancialStatements: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).not.toContain('貸借対照表')
    })

    it('should exclude adjusting entries when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeAdjustingEntries: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).not.toContain('調整仕訳')
    })

    it('should support English language', async () => {
      const config: ExportConfig = { ...mockConfig, language: 'en' }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('Balance Sheet')
      expect(csv).toContain('Profit and Loss Statement')
      expect(csv).toContain('Assets')
    })

    it('should properly escape CSV values with commas', async () => {
      const resultWithCommas: ConversionResult = {
        ...mockResult,
        balanceSheet: {
          asOfDate: new Date(),
          assets: [{ code: '1', name: 'Test, with comma', nameEn: 'Test', amount: 100 }],
          liabilities: [],
          equity: [],
          totalAssets: 100,
          totalLiabilities: 0,
          totalEquity: 100,
        },
      }

      const result = await exporter.export(resultWithCommas, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('"Test, with comma"')
    })

    it('should properly escape CSV values with quotes', async () => {
      const resultWithQuotes: ConversionResult = {
        ...mockResult,
        balanceSheet: {
          asOfDate: new Date(),
          assets: [{ code: '1', name: 'Test "quoted"', nameEn: 'Test', amount: 100 }],
          liabilities: [],
          equity: [],
          totalAssets: 100,
          totalLiabilities: 0,
          totalEquity: 100,
        },
      }

      const result = await exporter.export(resultWithQuotes, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('""quoted""')
    })

    it('should properly escape CSV values with newlines', async () => {
      const resultWithNewlines: ConversionResult = {
        ...mockResult,
        balanceSheet: {
          asOfDate: new Date(),
          assets: [{ code: '1', name: 'Test\nwith newline', nameEn: 'Test', amount: 100 }],
          liabilities: [],
          equity: [],
          totalAssets: 100,
          totalLiabilities: 0,
          totalEquity: 100,
        },
      }

      const result = await exporter.export(resultWithNewlines, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('"Test\nwith newline"')
    })

    it('should include amounts as numbers', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('1000000')
      expect(csv).toContain('1500000')
    })

    it('should include period dates', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('期間')
    })
  })

  describe('escapeCsv', () => {
    it('should not double-escape simple values', async () => {
      const simpleResult: ConversionResult = {
        ...mockResult,
        balanceSheet: {
          asOfDate: new Date(),
          assets: [{ code: '1', name: 'SimpleValue', nameEn: 'Simple', amount: 100 }],
          liabilities: [],
          equity: [],
          totalAssets: 100,
          totalLiabilities: 0,
          totalEquity: 100,
        },
      }

      const result = await exporter.export(simpleResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('SimpleValue')
      expect(csv).not.toContain('""SimpleValue""')
      expect(csv).toMatch(/"SimpleValue",100/)
    })
  })

  describe('empty data handling', () => {
    it('should handle missing balance sheet', async () => {
      const resultNoBs: ConversionResult = {
        ...mockResult,
        balanceSheet: undefined,
      }

      const result = await exporter.export(resultNoBs, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toBeDefined()
    })

    it('should handle missing profit loss', async () => {
      const resultNoPl: ConversionResult = {
        ...mockResult,
        profitLoss: undefined,
      }

      const result = await exporter.export(resultNoPl, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toBeDefined()
    })

    it('should handle empty journal conversions', async () => {
      const resultNoJournals: ConversionResult = {
        ...mockResult,
        journalConversions: [],
      }

      const result = await exporter.export(resultNoJournals, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toBeDefined()
    })
  })
})

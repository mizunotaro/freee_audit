import { describe, it, expect, beforeEach } from 'vitest'
import { CSVExporter } from '@/lib/conversion/exporters/csv-exporter'
import type { ConversionResult, ExportConfig } from '@/types/conversion'
import type { ExporterContext } from '@/lib/conversion/exporters/types'

describe('CSVExporter', () => {
  let exporter: CSVExporter

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
    format: 'csv',
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
        {
          code: '1100',
          name: '現金',
          nameEn: 'Cash',
          amount: 1000000,
          sourceAccountCode: '1000',
        },
        {
          code: '1200',
          name: '売掛金',
          nameEn: 'Accounts Receivable',
          amount: 500000,
          sourceAccountCode: '1100',
        },
      ],
      liabilities: [
        {
          code: '2100',
          name: '買掛金',
          nameEn: 'Accounts Payable',
          amount: 300000,
          sourceAccountCode: '2000',
        },
      ],
      equity: [
        {
          code: '3100',
          name: '資本金',
          nameEn: 'Capital',
          amount: 1200000,
          sourceAccountCode: '3000',
        },
      ],
      totalAssets: 1500000,
      totalLiabilities: 300000,
      totalEquity: 1200000,
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
    ],
    adjustingEntries: [
      {
        id: 'adj-1',
        projectId: 'project-1',
        type: 'lease_classification',
        description: 'リース取引の調整',
        descriptionEn: 'Lease classification adjustment',
        lines: [],
        ifrsReference: 'IFRS 16',
        aiSuggested: true,
        isApproved: false,
      },
      {
        id: 'adj-2',
        projectId: 'project-1',
        type: 'revenue_recognition',
        description: '収益認識の調整',
        descriptionEn: 'Revenue recognition adjustment',
        lines: [],
        usgaapReference: 'ASC 606',
        aiSuggested: false,
        isApproved: true,
      },
    ],
  }

  beforeEach(() => {
    exporter = new CSVExporter()
  })

  describe('export', () => {
    it('should generate CSV buffer', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.fileName).toMatch(/\.csv$/)
      expect(result.mimeType).toBe('text/csv')
    })

    it('should include project name in filename', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)

      expect(result.fileName).toContain('Test_Project')
    })

    it('should use data prefix in filename', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)

      expect(result.fileName).toContain('conversion_data_')
    })

    it('should include date in filename', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const dateStr = new Date().toISOString().split('T')[0]

      expect(result.fileName).toContain(dateStr)
    })

    it('should include header row with expected columns', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')
      const lines = csv.split('\n')

      expect(lines[0]).toContain('record_type')
      expect(lines[0]).toContain('account_code')
      expect(lines[0]).toContain('account_name')
      expect(lines[0]).toContain('account_name_en')
      expect(lines[0]).toContain('amount')
      expect(lines[0]).toContain('source_account_code')
      expect(lines[0]).toContain('category')
      expect(lines[0]).toContain('reference')
    })

    it('should include balance sheet records', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('balance_sheet')
      expect(csv).toContain('asset')
      expect(csv).toContain('liability')
      expect(csv).toContain('equity')
    })

    it('should include journal records when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('journal')
      expect(csv).toContain('debit')
      expect(csv).toContain('credit')
    })

    it('should include adjusting entry records when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('adjusting_entry')
      expect(csv).toContain('lease_classification')
      expect(csv).toContain('revenue_recognition')
    })

    it('should exclude journals when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeJournals: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      const journalLines = csv.split('\n').filter((l) => l.startsWith('journal,'))
      expect(journalLines).toHaveLength(0)
    })

    it('should exclude financial statements when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeFinancialStatements: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      const bsLines = csv.split('\n').filter((l) => l.startsWith('balance_sheet,'))
      expect(bsLines).toHaveLength(0)
    })

    it('should exclude adjusting entries when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeAdjustingEntries: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      const adjLines = csv.split('\n').filter((l) => l.startsWith('adjusting_entry,'))
      expect(adjLines).toHaveLength(0)
    })

    it('should support English language for adjusting entries', async () => {
      const config: ExportConfig = { ...mockConfig, language: 'en' }

      const result = await exporter.export(mockResult, config, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('Lease classification adjustment')
      expect(csv).toContain('Revenue recognition adjustment')
    })

    it('should use Japanese language by default', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('リース取引の調整')
    })

    it('should include IFRS reference for adjusting entries', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('IFRS 16')
    })

    it('should include USGAAP reference for adjusting entries', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('ASC 606')
    })

    it('should include source account codes', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('1000')
      expect(csv).toContain('1100')
    })

    it('should include mapping IDs in journal records', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('mapping-1')
      expect(csv).toContain('mapping-2')
    })
  })

  describe('escapeCsvCell', () => {
    it('should escape values with commas', async () => {
      const resultWithCommas: ConversionResult = {
        ...mockResult,
        balanceSheet: {
          asOfDate: new Date(),
          assets: [
            {
              code: '1',
              name: 'Test, with comma',
              nameEn: 'Test',
              amount: 100,
              sourceAccountCode: '0',
            },
          ],
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

    it('should escape values with double quotes', async () => {
      const resultWithQuotes: ConversionResult = {
        ...mockResult,
        adjustingEntries: [
          {
            id: 'adj-1',
            projectId: 'project-1',
            type: 'other',
            description: 'Test "quoted" value',
            lines: [],
            aiSuggested: false,
            isApproved: false,
          },
        ],
      }

      const result = await exporter.export(resultWithQuotes, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('""quoted""')
    })

    it('should escape values with newlines', async () => {
      const resultWithNewlines: ConversionResult = {
        ...mockResult,
        adjustingEntries: [
          {
            id: 'adj-1',
            projectId: 'project-1',
            type: 'other',
            description: 'Test\nwith\nnewlines',
            lines: [],
            aiSuggested: false,
            isApproved: false,
          },
        ],
      }

      const result = await exporter.export(resultWithNewlines, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('"Test\nwith\nnewlines"')
    })

    it('should not escape simple values', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain(',1100,')
      expect(csv).not.toContain('"1100"')
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

      expect(csv).toContain('record_type')
    })

    it('should handle empty journal conversions', async () => {
      const resultNoJournals: ConversionResult = {
        ...mockResult,
        journalConversions: [],
      }

      const result = await exporter.export(resultNoJournals, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('record_type')
    })

    it('should handle empty adjusting entries', async () => {
      const resultNoAdj: ConversionResult = {
        ...mockResult,
        adjustingEntries: [],
      }

      const result = await exporter.export(resultNoAdj, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('record_type')
    })

    it('should handle completely empty result', async () => {
      const emptyResult: ConversionResult = {
        id: 'result-1',
        projectId: 'project-1',
        conversionDate: new Date(),
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }

      const result = await exporter.export(emptyResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')

      expect(csv).toContain('record_type')
    })
  })

  describe('data structure', () => {
    it('should output one row per balance sheet item', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')
      const lines = csv.split('\n').filter((l) => l.startsWith('balance_sheet,'))

      expect(lines.length).toBe(4)
    })

    it('should output one row per journal line', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')
      const lines = csv.split('\n').filter((l) => l.startsWith('journal,'))

      expect(lines.length).toBe(2)
    })

    it('should output one row per adjusting entry', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const csv = result.buffer.toString('utf-8')
      const lines = csv.split('\n').filter((l) => l.startsWith('adjusting_entry,'))

      expect(lines.length).toBe(2)
    })
  })
})

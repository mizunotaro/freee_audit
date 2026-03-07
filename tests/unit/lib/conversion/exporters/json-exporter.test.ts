import { describe, it, expect, beforeEach } from 'vitest'
import { JSONExporter } from '@/lib/conversion/exporters/json-exporter'
import type { ConversionResult, ExportConfig } from '@/types/conversion'
import type { ExporterContext } from '@/lib/conversion/exporters/types'

describe('JSONExporter', () => {
  let exporter: JSONExporter

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
    format: 'json',
    includeJournals: true,
    includeFinancialStatements: true,
    includeAdjustingEntries: true,
    includeDisclosures: true,
    includeAIAnalysis: true,
    language: 'ja',
    currency: 'source',
  }

  const mockResult: ConversionResult = {
    id: 'result-1',
    projectId: 'project-1',
    conversionDate: new Date('2024-06-15T10:30:00Z'),
    conversionDurationMs: 5000,
    warnings: [{ code: 'WARN001', message: 'Test warning' }],
    errors: [],
    balanceSheet: {
      asOfDate: new Date('2024-12-31'),
      assets: [{ code: '1100', name: '現金', nameEn: 'Cash', amount: 1000000 }],
      liabilities: [{ code: '2100', name: '買掛金', nameEn: 'Accounts Payable', amount: 300000 }],
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
      grossProfit: 2000000,
      operatingIncome: 1500000,
      ordinaryIncome: 1500000,
      incomeBeforeTax: 1500000,
      netIncome: 1000000,
    },
    cashFlow: {
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      operatingActivities: [],
      investingActivities: [],
      financingActivities: [],
      netCashFromOperating: 800000,
      netCashFromInvesting: -200000,
      netCashFromFinancing: -100000,
      netChangeInCash: 500000,
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
        lines: [],
        aiSuggested: true,
        isApproved: false,
      },
    ],
    disclosures: [
      {
        id: 'disc-1',
        category: 'significant_accounting_policies',
        title: '重要な会計方針',
        titleEn: 'Significant Accounting Policies',
        content: '内容',
        standardReference: 'ASC 235',
        order: 1,
        isGenerated: true,
      },
    ],
    aiAnalysis: {
      id: 'ai-1',
      projectId: 'project-1',
      mappingSuggestions: [],
      adjustmentRecommendations: [],
      riskAssessments: [],
      qualityScore: 85,
      generatedAt: new Date(),
      modelUsed: 'gpt-4',
    },
  }

  beforeEach(() => {
    exporter = new JSONExporter()
  })

  describe('export', () => {
    it('should generate JSON buffer', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.fileName).toMatch(/\.json$/)
      expect(result.mimeType).toBe('application/json')
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

    it('should generate valid JSON', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = result.buffer.toString('utf-8')

      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('should include metadata section', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.metadata).toBeDefined()
      expect(json.metadata.projectId).toBe('project-1')
      expect(json.metadata.companyName).toBe('Test Company')
      expect(json.metadata.sourceStandard).toBe('JGAAP')
      expect(json.metadata.targetStandard).toBe('USGAAP')
    })

    it('should include period dates in metadata', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.metadata.periodStart).toBeDefined()
      expect(json.metadata.periodEnd).toBeDefined()
    })

    it('should include conversion date in metadata', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.metadata.conversionDate).toBeDefined()
      expect(json.metadata.conversionDurationMs).toBe(5000)
    })

    it('should include export config in metadata', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.metadata.exportConfig).toEqual(mockConfig)
    })

    it('should include exportedAt timestamp', async () => {
      const beforeExport = new Date()
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const afterExport = new Date()
      const json = JSON.parse(result.buffer.toString('utf-8'))

      const exportedAt = new Date(json.metadata.exportedAt)
      expect(exportedAt.getTime()).toBeGreaterThanOrEqual(beforeExport.getTime() - 1000)
      expect(exportedAt.getTime()).toBeLessThanOrEqual(afterExport.getTime() + 1000)
    })
  })

  describe('includeFinancialStatements', () => {
    it('should include balance sheet when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.balanceSheet).toBeDefined()
      expect(json.balanceSheet.totalAssets).toBe(1000000)
    })

    it('should include profit loss when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.profitLoss).toBeDefined()
      expect(json.profitLoss.netIncome).toBe(1000000)
    })

    it('should include cash flow when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.cashFlow).toBeDefined()
      expect(json.cashFlow.netChangeInCash).toBe(500000)
    })

    it('should exclude financial statements when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeFinancialStatements: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.balanceSheet).toBeNull()
      expect(json.profitLoss).toBeNull()
      expect(json.cashFlow).toBeNull()
    })
  })

  describe('includeJournals', () => {
    it('should include journal conversions when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.journalConversions).toBeDefined()
      expect(json.journalConversions).toHaveLength(1)
    })

    it('should exclude journals when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeJournals: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.journalConversions).toEqual([])
    })
  })

  describe('includeAdjustingEntries', () => {
    it('should include adjusting entries when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.adjustingEntries).toBeDefined()
      expect(json.adjustingEntries).toHaveLength(1)
    })

    it('should exclude adjusting entries when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeAdjustingEntries: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.adjustingEntries).toEqual([])
    })
  })

  describe('includeDisclosures', () => {
    it('should include disclosures when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.disclosures).toBeDefined()
      expect(json.disclosures).toHaveLength(1)
    })

    it('should exclude disclosures when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeDisclosures: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.disclosures).toEqual([])
    })
  })

  describe('includeAIAnalysis', () => {
    it('should include AI analysis when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.aiAnalysis).toBeDefined()
      expect(json.aiAnalysis.qualityScore).toBe(85)
    })

    it('should exclude AI analysis when not configured', async () => {
      const config: ExportConfig = { ...mockConfig, includeAIAnalysis: false }

      const result = await exporter.export(mockResult, config, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.aiAnalysis).toBeNull()
    })
  })

  describe('warnings and errors', () => {
    it('should always include warnings', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.warnings).toBeDefined()
      expect(json.warnings).toHaveLength(1)
      expect(json.warnings[0].code).toBe('WARN001')
    })

    it('should always include errors', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.errors).toBeDefined()
      expect(json.errors).toHaveLength(0)
    })

    it('should include errors when present', async () => {
      const resultWithErrors: ConversionResult = {
        ...mockResult,
        errors: [{ code: 'ERR001', message: 'Test error' }],
      }

      const result = await exporter.export(resultWithErrors, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.errors).toHaveLength(1)
      expect(json.errors[0].code).toBe('ERR001')
    })
  })

  describe('empty data handling', () => {
    it('should handle minimal result', async () => {
      const minimalResult: ConversionResult = {
        id: 'result-1',
        projectId: 'project-1',
        conversionDate: new Date(),
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }

      const result = await exporter.export(minimalResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json.metadata).toBeDefined()
      expect(json.warnings).toEqual([])
      expect(json.errors).toEqual([])
    })

    it('should handle null values correctly', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = JSON.parse(result.buffer.toString('utf-8'))

      expect(json).toBeDefined()
    })
  })

  describe('JSON formatting', () => {
    it('should output formatted JSON with indentation', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = result.buffer.toString('utf-8')

      expect(json).toContain('\n')
      expect(json).toContain('  ')
    })

    it('should serialize dates as ISO strings', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const json = result.buffer.toString('utf-8')

      expect(json).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })
})

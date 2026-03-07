import { describe, it, expect, beforeEach } from 'vitest'
import { PDFExporter } from '@/lib/conversion/exporters/pdf-exporter'
import type { ConversionResult, ExportConfig } from '@/types/conversion'
import type { ExporterContext } from '@/lib/conversion/exporters/types'

describe('PDFExporter', () => {
  let exporter: PDFExporter

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
    format: 'pdf',
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
      revenue: [{ code: '4100', name: '売上高', nameEn: 'Revenue', amount: 2000000 }],
      costOfSales: [{ code: '5100', name: '売上原価', nameEn: 'Cost of Sales', amount: 800000 }],
      sgaExpenses: [],
      nonOperatingIncome: [],
      nonOperatingExpenses: [],
      grossProfit: 1200000,
      operatingIncome: 700000,
      ordinaryIncome: 700000,
      incomeBeforeTax: 700000,
      netIncome: 500000,
    },
    cashFlow: {
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      operatingActivities: [],
      investingActivities: [],
      financingActivities: [],
      netCashFromOperating: 600000,
      netCashFromInvesting: -200000,
      netCashFromFinancing: -100000,
      netChangeInCash: 300000,
    },
    adjustingEntries: [
      {
        id: 'adj-1',
        projectId: 'project-1',
        type: 'lease_classification',
        description: 'リース取引の調整',
        descriptionEn: 'Lease classification adjustment',
        lines: [],
        aiSuggested: true,
        isApproved: false,
        ifrsReference: 'IFRS 16',
      },
    ],
    disclosures: [
      {
        id: 'disc-1',
        category: 'significant_accounting_policies',
        title: '重要な会計方針',
        titleEn: 'Significant Accounting Policies',
        content: '内容',
        contentEn: 'Content',
        standardReference: 'ASC 235',
        order: 1,
        isGenerated: true,
      },
    ],
  }

  beforeEach(() => {
    exporter = new PDFExporter()
  })

  describe('export', () => {
    it('should generate HTML buffer', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.fileName).toMatch(/\.html$/)
      expect(result.mimeType).toBe('text/html')
    })

    it('should include company name in output', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('Test Company')
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

    it('should generate valid HTML structure', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<head>')
      expect(html).toContain('</head>')
      expect(html).toContain('<body>')
      expect(html).toContain('</body>')
    })

    it('should include balance sheet when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('貸借対照表')
      expect(html).toContain('資産合計')
    })

    it('should include profit and loss when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('損益計算書')
      expect(html).toContain('当期純利益')
    })

    it('should include cash flow when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('キャッシュフロー計算書')
    })

    it('should include adjusting entries when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('調整仕訳')
    })

    it('should include disclosures when configured', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('開示注記')
    })

    it('should exclude sections when not configured', async () => {
      const config: ExportConfig = {
        ...mockConfig,
        includeFinancialStatements: false,
        includeAdjustingEntries: false,
        includeDisclosures: false,
      }

      const result = await exporter.export(mockResult, config, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).not.toContain('貸借対照表')
    })

    it('should include warnings when present', async () => {
      const resultWithWarnings: ConversionResult = {
        ...mockResult,
        warnings: [{ code: 'WARN001', message: 'Test warning' }],
      }

      const result = await exporter.export(resultWithWarnings, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('Warnings')
      expect(html).toContain('Test warning')
    })

    it('should support English language', async () => {
      const config: ExportConfig = { ...mockConfig, language: 'en' }

      const result = await exporter.export(mockResult, config, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('Balance Sheet')
      expect(html).toContain('Profit and Loss Statement')
    })

    it('should escape HTML in content', async () => {
      const resultWithHtml: ConversionResult = {
        ...mockResult,
        disclosures: [
          {
            id: 'disc-1',
            category: 'significant_accounting_policies',
            title: '<script>alert("xss")</script>',
            titleEn: 'Title',
            content: 'Test & "quotes"',
            standardReference: 'ASC 235',
            order: 1,
            isGenerated: true,
          },
        ],
      }

      const result = await exporter.export(resultWithHtml, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('&lt;script&gt;')
      expect(html).toContain('&amp;')
      expect(html).toContain('&quot;')
    })

    it('should include CSS styles', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('<style>')
      expect(html).toContain('font-family')
    })

    it('should include print styles', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('@media print')
    })

    it('should include footer with generation info', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('Generated by freee_audit')
    })
  })

  describe('generateFileName', () => {
    it('should sanitize project name', async () => {
      const contextWithSpecialChars: ExporterContext = {
        ...mockContext,
        projectName: 'Test/Project<>:"|?*',
      }

      const result = await exporter.export(mockResult, mockConfig, contextWithSpecialChars)

      expect(result.fileName).not.toMatch(/[<>:"|?*\/]/)
    })
  })

  describe('escapeHtml', () => {
    it('should escape special characters', async () => {
      const resultWithSpecialChars: ConversionResult = {
        ...mockResult,
        balanceSheet: {
          asOfDate: new Date(),
          assets: [{ code: '1', name: 'Test & Co. <script>', nameEn: 'Test', amount: 100 }],
          liabilities: [],
          equity: [],
          totalAssets: 100,
          totalLiabilities: 0,
          totalEquity: 100,
        },
      }

      const result = await exporter.export(resultWithSpecialChars, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('&amp;')
      expect(html).toContain('&lt;')
      expect(html).toContain('&gt;')
    })
  })

  describe('formatting', () => {
    it('should format amounts with locale', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('1,000,000')
      expect(html).toContain('1,500,000')
    })

    it('should format dates', async () => {
      const result = await exporter.export(mockResult, mockConfig, mockContext)
      const html = result.buffer.toString('utf-8')

      expect(html).toContain('Generated:')
    })
  })
})

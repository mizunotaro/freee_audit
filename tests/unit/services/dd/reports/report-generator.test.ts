import { DDReportGenerator } from '@/services/dd/reports/report-generator'
import type { DDChecklistRunResult, DDFinding } from '@/services/dd/types'

describe('DDReportGenerator', () => {
  let generator: DDReportGenerator
  const mockContext = {
    companyId: 'company-123',
    companyName: 'テスト株式会社',
    fiscalYears: [2023, 2024],
    checklistType: 'IPO_SHORT_REVIEW' as const,
    checklistResults: [] as DDChecklistRunResult[],
    findings: [] as DDFinding[],
    overallScore: 85,
    materiality: 50000000,
    accountingStandard: 'JGAAP' as const,
    generatedBy: 'user-123',
  }

  beforeEach(() => {
    generator = new DDReportGenerator()
  })

  describe('generateReport', () => {
    it('should generate a complete report with all sections', async () => {
      const result = await generator.generateReport(mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('IPOショートレビュー報告書')
        expect(result.data.titleEn).toBe('IPO Short Review Report')
        expect(result.data.sections).toHaveLength(4)
        expect(result.data.metadata.overallScore).toBe(85)
      }
    })

    it('should include executive summary', async () => {
      const result = await generator.generateReport(mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.executiveSummary).toContain('テスト株式会社')
        expect(result.data.executiveSummary).toContain('IPOショートレビュー')
        expect(result.data.executiveSummary).toContain('85')
      }
    })

    it('should categorize findings by severity', async () => {
      const contextWithFindings = {
        ...mockContext,
        findings: [
          {
            id: 'f1',
            category: 'REVENUE_RECOGNITION' as const,
            title: '収益認識の問題',
            description: '収益認識基準との乖離',
            impact: '財務諸表の重要な虚偽表示リスク',
            recommendation: '会計方針の見直し',
            severity: 'CRITICAL' as const,
          },
          {
            id: 'f2',
            category: 'ACCOUNTS_RECEIVABLE' as const,
            title: '売掛金の滞留',
            description: '180日以上の売掛金が存在',
            impact: '貸倒損失のリスク',
            recommendation: '貸倒引当金の積増',
            severity: 'HIGH' as const,
          },
          {
            id: 'f3',
            category: 'INVENTORY' as const,
            title: '棚卸資産回転率の低下',
            description: '回転率が前年比で低下',
            impact: '過剰在庫のリスク',
            recommendation: '発注計画の見直し',
            severity: 'MEDIUM' as const,
          },
        ],
      }

      const result = await generator.generateReport(contextWithFindings)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.metadata.totalFindings).toBe(3)
        expect(result.data.metadata.criticalFindings).toBe(1)
        expect(result.data.metadata.highFindings).toBe(1)
      }
    })

    it('should generate report for M&A Financial DD', async () => {
      const maContext = {
        ...mockContext,
        checklistType: 'MA_FINANCIAL_DD' as const,
      }

      const result = await generator.generateReport(maContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('M&A財務DD報告書')
        expect(result.data.titleEn).toBe('M&A Financial Due Diligence Report')
      }
    })

    it('should include appendices', async () => {
      const result = await generator.generateReport(mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.appendices.length).toBeGreaterThan(0)
        expect(result.data.appendices[0].id).toBe('appendix-methodology')
      }
    })
  })

  describe('generateMarkdown', () => {
    it('should generate valid markdown output', async () => {
      const reportResult = await generator.generateReport(mockContext)

      expect(reportResult.success).toBe(true)
      if (reportResult.success) {
        const markdown = await generator.generateMarkdown(reportResult.data)

        expect(markdown).toContain('# IPOショートレビュー報告書')
        expect(markdown).toContain('## IPO Short Review Report')
        expect(markdown).toContain('## エグゼクティブサマリー')
        expect(markdown).toContain('## 調査概要')
        expect(markdown).toContain('## 指摘事項サマリー')
      }
    })

    it('should include findings in markdown', async () => {
      const contextWithFindings = {
        ...mockContext,
        findings: [
          {
            id: 'f1',
            category: 'REVENUE_RECOGNITION' as const,
            title: '収益認識の問題',
            description: 'テスト用の指摘事項',
            impact: '影響あり',
            recommendation: '改善推奨',
            severity: 'HIGH' as const,
          },
        ],
      }

      const reportResult = await generator.generateReport(contextWithFindings)

      expect(reportResult.success).toBe(true)
      if (reportResult.success) {
        const markdown = await generator.generateMarkdown(reportResult.data)

        expect(markdown).toContain('収益認識の問題')
        expect(markdown).toContain('改善推奨')
      }
    })
  })

  describe('score rating', () => {
    it('should return "優秀" for score >= 90', async () => {
      const context = { ...mockContext, overallScore: 95 }
      const result = await generator.generateReport(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.executiveSummary).toContain('優秀')
      }
    })

    it('should return "良好" for score 70-89', async () => {
      const context = { ...mockContext, overallScore: 75 }
      const result = await generator.generateReport(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.executiveSummary).toContain('良好')
      }
    })

    it('should return "要注意" for score 50-69', async () => {
      const context = { ...mockContext, overallScore: 55 }
      const result = await generator.generateReport(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.executiveSummary).toContain('要注意')
      }
    })

    it('should return "重要" for score 30-49', async () => {
      const context = { ...mockContext, overallScore: 40 }
      const result = await generator.generateReport(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.executiveSummary).toContain('重要')
      }
    })

    it('should return "緊急" for score < 30', async () => {
      const context = { ...mockContext, overallScore: 20 }
      const result = await generator.generateReport(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.executiveSummary).toContain('緊急')
      }
    })
  })
})

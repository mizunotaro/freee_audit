import { Result, createAppError } from '@/types/result'
import type {
  DDChecklistType,
  DDCategory,
  DDFinding,
  DDReportSection,
  DDChecklistRunResult,
} from '../types'
import { DD_CATEGORY_NAMES_JA, DD_CHECKLIST_TYPE_NAMES_JA } from '../types'

export interface ReportGenerationContext {
  companyId: string
  companyName: string
  fiscalYears: number[]
  checklistType: DDChecklistType
  checklistResults: DDChecklistRunResult[]
  findings: DDFinding[]
  overallScore: number
  materiality?: number
  accountingStandard?: 'JGAAP' | 'IFRS' | 'US_GAAP'
  generatedBy?: string
}

export interface GeneratedReport {
  title: string
  titleEn: string
  executiveSummary: string
  sections: DDReportSection[]
  appendices: DDReportSection[]
  metadata: {
    generatedAt: Date
    generatedBy: string
    version: string
    overallScore: number
    totalFindings: number
    criticalFindings: number
    highFindings: number
  }
}

export class DDReportGenerator {
  async generateReport(context: ReportGenerationContext): Promise<Result<GeneratedReport>> {
    try {
      const sections = await this.buildSections(context)
      const executiveSummary = this.generateExecutiveSummary(context)
      const appendices = this.buildAppendices(context)

      const report: GeneratedReport = {
        title: `${DD_CHECKLIST_TYPE_NAMES_JA[context.checklistType]}報告書`,
        titleEn: this.getEnglishTitle(context.checklistType),
        executiveSummary,
        sections,
        appendices,
        metadata: {
          generatedAt: new Date(),
          generatedBy: context.generatedBy || 'system',
          version: '1.0.0',
          overallScore: context.overallScore,
          totalFindings: context.findings.length,
          criticalFindings: context.findings.filter((f) => f.severity === 'CRITICAL').length,
          highFindings: context.findings.filter((f) => f.severity === 'HIGH').length,
        },
      }

      return { success: true, data: report }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'REPORT_GENERATION_FAILED',
          error instanceof Error ? error.message : 'Failed to generate report',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  async generateMarkdown(report: GeneratedReport): Promise<string> {
    const lines: string[] = []

    lines.push(`# ${report.title}`)
    lines.push(`## ${report.titleEn}`)
    lines.push('')
    lines.push(`生成日時: ${report.metadata.generatedAt.toLocaleString('ja-JP')}`)
    lines.push(`総合スコア: ${report.metadata.overallScore}/100`)
    lines.push('')

    lines.push('## エグゼクティブサマリー')
    lines.push('')
    lines.push(report.executiveSummary)
    lines.push('')

    for (const section of report.sections) {
      lines.push(`## ${section.title}`)
      lines.push('')
      lines.push(this.formatSectionContent(section))
      lines.push('')

      if (section.subsections) {
        for (const sub of section.subsections) {
          lines.push(`### ${sub.title}`)
          lines.push('')
          lines.push(this.formatSectionContent(sub))
          lines.push('')
        }
      }
    }

    if (report.appendices.length > 0) {
      lines.push('## 付録')
      lines.push('')
      for (const appendix of report.appendices) {
        lines.push(`### ${appendix.title}`)
        lines.push('')
        lines.push(this.formatSectionContent(appendix))
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  private async buildSections(context: ReportGenerationContext): Promise<DDReportSection[]> {
    const sections: DDReportSection[] = []

    sections.push(this.buildOverviewSection(context))
    sections.push(this.buildFindingsSummarySection(context))
    sections.push(this.buildCategoryAnalysisSection(context))
    sections.push(this.buildRecommendationsSection(context))

    return sections
  }

  private buildOverviewSection(context: ReportGenerationContext): DDReportSection {
    return {
      id: 'overview',
      title: '調査概要',
      titleEn: 'Overview',
      type: 'TEXT',
      content: {
        companyName: context.companyName,
        checklistType: DD_CHECKLIST_TYPE_NAMES_JA[context.checklistType],
        fiscalYears: context.fiscalYears,
        accountingStandard: context.accountingStandard || 'JGAAP',
        materiality: context.materiality,
        overallScore: context.overallScore,
        summary: `本報告書は、${context.companyName}の${context.fiscalYears.join('年度、')}年度における${DD_CHECKLIST_TYPE_NAMES_JA[context.checklistType]}の結果をまとめたものです。`,
      },
    }
  }

  private buildFindingsSummarySection(context: ReportGenerationContext): DDReportSection {
    const findingsByCategory = this.groupFindingsByCategory(context.findings)
    const findingsBySeverity = this.groupFindingsBySeverity(context.findings)

    return {
      id: 'findings-summary',
      title: '指摘事項サマリー',
      titleEn: 'Findings Summary',
      type: 'TABLE_CHART',
      content: {
        totalFindings: context.findings.length,
        byCategory: findingsByCategory,
        bySeverity: findingsBySeverity,
        criticalFindings: context.findings.filter((f) => f.severity === 'CRITICAL'),
        highFindings: context.findings.filter((f) => f.severity === 'HIGH'),
      },
    }
  }

  private buildCategoryAnalysisSection(context: ReportGenerationContext): DDReportSection {
    const categories = [...new Set(context.findings.map((f) => f.category))] as DDCategory[]
    const subsections: DDReportSection[] = categories.map((category) => ({
      id: `category-${category}`,
      title: DD_CATEGORY_NAMES_JA[category],
      titleEn: category,
      type: 'TEXT' as const,
      content: {
        findings: context.findings.filter((f) => f.category === category),
        analysis: this.generateCategoryAnalysis(category, context),
      },
    }))

    return {
      id: 'category-analysis',
      title: 'カテゴリ別分析',
      titleEn: 'Analysis by Category',
      type: 'TEXT',
      content: {},
      subsections,
    }
  }

  private buildRecommendationsSection(context: ReportGenerationContext): DDReportSection {
    const allRecommendations = context.findings
      .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      .map((f) => ({
        category: f.category,
        title: f.title,
        recommendation: f.recommendation,
        priority: f.severity,
      }))

    return {
      id: 'recommendations',
      title: '推奨事項',
      titleEn: 'Recommendations',
      type: 'TABLE',
      content: {
        recommendations: allRecommendations,
        summary: this.generateRecommendationsSummary(allRecommendations),
      },
    }
  }

  private buildAppendices(context: ReportGenerationContext): DDReportSection[] {
    return [
      {
        id: 'appendix-methodology',
        title: '調査手法',
        titleEn: 'Methodology',
        type: 'TEXT',
        content: {
          description: '本調査は、自動検証ルールおよびAI分析に基づき実施されました。',
          standards: this.getReferencedStandards(context),
        },
      },
      {
        id: 'appendix-scoring',
        title: 'スコアリング基準',
        titleEn: 'Scoring Criteria',
        type: 'TABLE',
        content: {
          criteria: [
            { range: '90-100', rating: '優秀', description: '重要な指摘事項なし' },
            { range: '70-89', rating: '良好', description: '軽微な指摘事項のみ' },
            { range: '50-69', rating: '要注意', description: '改善推奨事項あり' },
            { range: '30-49', rating: '重要', description: '重要な指摘事項あり' },
            { range: '0-29', rating: '緊急', description: '緊急対応が必要' },
          ],
        },
      },
    ]
  }

  private generateExecutiveSummary(context: ReportGenerationContext): string {
    const criticalCount = context.findings.filter((f) => f.severity === 'CRITICAL').length
    const highCount = context.findings.filter((f) => f.severity === 'HIGH').length
    const scoreRating = this.getScoreRating(context.overallScore)

    let summary = `${context.companyName}の${DD_CHECKLIST_TYPE_NAMES_JA[context.checklistType]}を実施いたしました。\n\n`
    summary += `【総合評価】${scoreRating}（スコア: ${context.overallScore}/100）\n\n`

    if (criticalCount > 0) {
      summary += `⚠️ **重要**: ${criticalCount}件の緊急対応が必要な指摘事項がございます。\n\n`
    }

    if (highCount > 0) {
      summary += `⚡ **要注意**: ${highCount}件の優先度の高い指摘事項がございます。\n\n`
    }

    if (criticalCount === 0 && highCount === 0) {
      summary += `✅ 重大な指摘事項はございません。引き続き現在の管理体制を維持してください。\n\n`
    }

    summary += `詳細な分析結果と推奨事項については、本報告書の各セクションをご参照ください。`

    return summary
  }

  private groupFindingsByCategory(findings: DDFinding[]): Record<string, number> {
    const grouped: Record<string, number> = {}
    for (const finding of findings) {
      const categoryName = DD_CATEGORY_NAMES_JA[finding.category as DDCategory] || finding.category
      grouped[categoryName] = (grouped[categoryName] || 0) + 1
    }
    return grouped
  }

  private groupFindingsBySeverity(findings: DDFinding[]): Record<string, number> {
    const grouped: Record<string, number> = {}
    for (const finding of findings) {
      grouped[finding.severity] = (grouped[finding.severity] || 0) + 1
    }
    return grouped
  }

  private generateCategoryAnalysis(category: DDCategory, context: ReportGenerationContext): string {
    const categoryFindings = context.findings.filter((f) => f.category === category)
    const categoryName = DD_CATEGORY_NAMES_JA[category]

    if (categoryFindings.length === 0) {
      return `${categoryName}に関する重要な指摘事項はございません。`
    }

    const criticalCount = categoryFindings.filter((f) => f.severity === 'CRITICAL').length
    const highCount = categoryFindings.filter((f) => f.severity === 'HIGH').length

    let analysis = `${categoryName}において${categoryFindings.length}件の指摘事項がございます。`

    if (criticalCount > 0) {
      analysis += ` そのうち${criticalCount}件は緊急対応が必要です。`
    }
    if (highCount > 0) {
      analysis += ` ${highCount}件は優先度が高く早期対応が推奨されます。`
    }

    return analysis
  }

  private generateRecommendationsSummary(
    recommendations: Array<{
      category: string
      title: string
      recommendation: string
      priority: string
    }>
  ): string {
    if (recommendations.length === 0) {
      return '現在、優先度の高い推奨事項はございません。'
    }

    return `以下の${recommendations.length}件の推奨事項について、優先度に基づき順次ご対応ください。`
  }

  private getReferencedStandards(context: ReportGenerationContext): string[] {
    const standards = new Set<string>()
    for (const finding of context.findings) {
      if (finding.relatedStandard) {
        standards.add(finding.relatedStandard)
      }
    }
    return Array.from(standards)
  }

  private getScoreRating(score: number): string {
    if (score >= 90) return '優秀'
    if (score >= 70) return '良好'
    if (score >= 50) return '要注意'
    if (score >= 30) return '重要'
    return '緊急'
  }

  private getEnglishTitle(type: DDChecklistType): string {
    const titles: Record<DDChecklistType, string> = {
      IPO_SHORT_REVIEW: 'IPO Short Review Report',
      MA_FINANCIAL_DD: 'M&A Financial Due Diligence Report',
      TAX_DD: 'Tax Due Diligence Report',
      COMPREHENSIVE: 'Comprehensive Due Diligence Report',
    }
    return titles[type]
  }

  private formatSectionContent(section: DDReportSection): string {
    const content = section.content as Record<string, unknown>
    const lines: string[] = []

    if (content.summary) {
      lines.push(String(content.summary))
    }

    if (content.description) {
      lines.push(String(content.description))
    }

    if (content.findings && Array.isArray(content.findings)) {
      for (const finding of content.findings) {
        const f = finding as DDFinding
        lines.push(`- **${f.title}** [${f.severity}]`)
        lines.push(`  ${f.description}`)
        if (f.recommendation) {
          lines.push(`  推奨: ${f.recommendation}`)
        }
      }
    }

    return lines.join('\n')
  }
}

export const ddReportGenerator = new DDReportGenerator()

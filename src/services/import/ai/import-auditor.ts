import {
  type ImportAuditIssue,
  type ImportAuditResult,
  type ImportAuditSummary,
  type ImportAuditContext,
  type ImportAuditOptions,
  type ImportRecommendation,
  DEFAULT_AUDIT_OPTIONS,
} from './types'
import { IssueDetector, issueDetector } from './issue-detector'
import { success, failure, type Result } from '@/types/result'

interface DataRow {
  row: number
  data: Record<string, unknown>
}

export class ImportAuditor {
  private readonly detector: IssueDetector

  constructor(detector: IssueDetector = issueDetector) {
    this.detector = detector
  }

  async audit(
    rows: Record<string, unknown>[],
    context: ImportAuditContext,
    options: Partial<ImportAuditOptions> = {}
  ): Promise<Result<ImportAuditResult, Error>> {
    const startTime = Date.now()
    const mergedOptions: ImportAuditOptions = { ...DEFAULT_AUDIT_OPTIONS, ...options }
    const issues: ImportAuditIssue[] = []

    try {
      const dataRows: DataRow[] = rows.map((data, index) => ({
        row: index + 2,
        data,
      }))

      const rowsToAnalyze = dataRows.slice(0, mergedOptions.maxIssuesToReport)

      if (mergedOptions.checkDuplicates) {
        issues.push(...this.detector.detectDuplicates(rowsToAnalyze))
      }

      if (mergedOptions.checkAmountAnomalies && context.importType === 'journal') {
        issues.push(...this.detector.detectAmountAnomalies(rowsToAnalyze, 'amount'))
      }

      if (mergedOptions.checkDateValidity && context.importType === 'journal') {
        issues.push(...this.detector.detectDateIssues(rowsToAnalyze, 'entryDate'))
      }

      if (mergedOptions.checkTaxCalculations && context.importType === 'journal') {
        issues.push(
          ...this.detector.detectTaxIssues(rowsToAnalyze, 'amount', 'taxAmount', 'taxType')
        )
      }

      if (mergedOptions.checkBalanceConsistency && context.importType === 'journal') {
        issues.push(
          ...this.detector.detectBalanceIssues(
            rowsToAnalyze,
            'debitAccount',
            'creditAccount',
            'amount'
          )
        )
      }

      if (mergedOptions.checkBusinessRules) {
        issues.push(...this.checkBusinessRules(rowsToAnalyze, context))
      }

      const limitedIssues = issues.slice(0, mergedOptions.maxIssuesToReport)
      const summary = this.generateSummary(rows.length, limitedIssues)
      const recommendations = this.generateRecommendations(limitedIssues, summary, context)
      const riskScore = this.calculateRiskScore(summary)
      const confidence = this.calculateConfidence(rows.length, limitedIssues.length)

      return success({
        success: summary.criticalIssues === 0,
        summary,
        issues: limitedIssues,
        recommendations,
        riskScore,
        confidence,
        processingTimeMs: Date.now() - startTime,
      })
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Unknown audit error'))
    }
  }

  private checkBusinessRules(rows: DataRow[], _context: ImportAuditContext): ImportAuditIssue[] {
    const issues: ImportAuditIssue[] = []

    for (const row of rows) {
      const description = String(row.data.description || '')
      if (description.length > 200) {
        issues.push({
          id: `long-desc-${row.row}`,
          row: row.row,
          type: 'format_error',
          severity: 'low',
          category: 'accuracy',
          message: 'Description is unusually long',
          messageJa: '摘要が非常に長いです',
          field: 'description',
          value: description.slice(0, 50) + '...',
          suggestion: 'Consider shortening the description',
          suggestionJa: '摘要を短くすることを検討してください',
        })
      }
    }

    return issues
  }

  private generateSummary(totalRows: number, issues: ImportAuditIssue[]): ImportAuditSummary {
    const issueRows = new Set(issues.map((i) => i.row))

    return {
      totalRows,
      validRows: totalRows - issueRows.size,
      issueRows: issueRows.size,
      criticalIssues: issues.filter((i) => i.severity === 'critical').length,
      highIssues: issues.filter((i) => i.severity === 'high').length,
      mediumIssues: issues.filter((i) => i.severity === 'medium').length,
      lowIssues: issues.filter((i) => i.severity === 'low').length,
      infoIssues: issues.filter((i) => i.severity === 'info').length,
    }
  }

  private generateRecommendations(
    issues: ImportAuditIssue[],
    _summary: ImportAuditSummary,
    _context: ImportAuditContext
  ): ImportRecommendation[] {
    const recommendations: ImportRecommendation[] = []
    const { criticalIssues, highIssues, duplicateEntries, taxIssues } =
      this.categorizeIssues(issues)

    if (criticalIssues > 0) {
      recommendations.push({
        id: 'rec-critical',
        priority: 'critical',
        category: 'completeness',
        title: 'Fix Critical Errors Before Import',
        titleJa: 'インポート前に重大なエラーを修正してください',
        description: `${criticalIssues} critical errors were found. These must be resolved before importing.`,
        descriptionJa: `${criticalIssues}件の重大なエラーが見つかりました。インポート前にこれらを解決する必要があります。`,
        action: 'Review and fix all critical errors in the source file',
        actionJa: 'ソースファイル内のすべての重大なエラーを確認して修正してください',
        affectedRows: issues.filter((i) => i.severity === 'critical').map((i) => i.row),
        autoFixAvailable: false,
      })
    }

    if (duplicateEntries > 0) {
      recommendations.push({
        id: 'rec-duplicates',
        priority: 'high',
        category: 'accuracy',
        title: 'Review Duplicate Entries',
        titleJa: '重複エントリを確認してください',
        description: `${duplicateEntries} potential duplicate entries were detected.`,
        descriptionJa: `${duplicateEntries}件の重複エントリ候補が検出されました。`,
        action: 'Enable "Skip Duplicates" option or remove duplicates from source',
        actionJa: '「重複をスキップ」オプションを有効にするか、ソースから重複を削除してください',
        affectedRows: issues.filter((i) => i.type === 'duplicate_entry').map((i) => i.row),
        autoFixAvailable: true,
      })
    }

    if (taxIssues > 0) {
      recommendations.push({
        id: 'rec-tax',
        priority: 'medium',
        category: 'accuracy',
        title: 'Verify Tax Calculations',
        titleJa: '税額計算を確認してください',
        description: `${taxIssues} entries have tax amount discrepancies.`,
        descriptionJa: `${taxIssues}件のエントリで税額に不一致があります。`,
        action: 'Verify tax rates and recalculate tax amounts',
        actionJa: '税率を確認し、税額を再計算してください',
        affectedRows: issues.filter((i) => i.type === 'tax_calculation_error').map((i) => i.row),
        autoFixAvailable: false,
      })
    }

    if (highIssues > 0 && criticalIssues === 0) {
      recommendations.push({
        id: 'rec-review',
        priority: 'medium',
        category: 'validity',
        title: 'Review High-Priority Issues',
        titleJa: '優先度の高い問題を確認してください',
        description: `${highIssues} high-priority issues need attention before import.`,
        descriptionJa: `${highIssues}件の優先度の高い問題がインポート前に確認が必要です。`,
        action: 'Review each issue and determine if it can be imported',
        actionJa: '各問題を確認し、インポート可能かどうか判断してください',
        autoFixAvailable: false,
      })
    }

    return recommendations
  }

  private categorizeIssues(issues: ImportAuditIssue[]): {
    criticalIssues: number
    highIssues: number
    duplicateEntries: number
    taxIssues: number
  } {
    return {
      criticalIssues: issues.filter((i) => i.severity === 'critical').length,
      highIssues: issues.filter((i) => i.severity === 'high').length,
      duplicateEntries: issues.filter((i) => i.type === 'duplicate_entry').length,
      taxIssues: issues.filter((i) => i.type === 'tax_calculation_error').length,
    }
  }

  private calculateRiskScore(summary: ImportAuditSummary): number {
    if (summary.totalRows === 0) return 0

    const weights = { critical: 10, high: 5, medium: 2, low: 1, info: 0.1 }
    const weightedScore =
      summary.criticalIssues * weights.critical +
      summary.highIssues * weights.high +
      summary.mediumIssues * weights.medium +
      summary.lowIssues * weights.low +
      summary.infoIssues * weights.info

    const maxPossibleScore = summary.totalRows * weights.critical
    return maxPossibleScore > 0
      ? Math.min(100, Math.round((weightedScore / maxPossibleScore) * 100))
      : 0
  }

  private calculateConfidence(totalRows: number, issueCount: number): number {
    if (totalRows === 0) return 0
    const sampleRatio = Math.min(1, totalRows / 1000)
    const issueRatio = 1 - Math.min(1, issueCount / totalRows)
    return Math.round((sampleRatio * 0.3 + issueRatio * 0.7) * 100)
  }
}

export const importAuditor = new ImportAuditor()

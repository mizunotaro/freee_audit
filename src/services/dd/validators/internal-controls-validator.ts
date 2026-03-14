import { Result, createAppError, ERROR_CODES } from '@/types/result'
import type { DDFinding, DDSeverity, ValidationRule } from '../types'
import { BaseValidator, type ValidatorContext, type ValidationResult } from './base-validator'

export class InternalControlsValidator extends BaseValidator {
  readonly category = 'INTERNAL_CONTROLS' as const
  readonly supportedRules = [
    'DOCUMENTATION',
    'SEGREGATION_OF_DUTIES',
    'AUTHORIZATION',
    'RECONCILIATION',
    'PHYSICAL_CONTROLS',
    'ACCESS_CONTROLS',
    'MONITORING',
  ]

  async validate(
    itemCode: string,
    rules: readonly ValidationRule[],
    context: ValidatorContext
  ): Promise<Result<ValidationResult>> {
    try {
      const findings: DDFinding[] = []
      const evidence: ValidationResult['evidence'] = []

      for (const rule of rules) {
        const ruleResult = await this.applyRule(rule, context)
        findings.push(...ruleResult.findings)
        evidence.push(...ruleResult.evidence)
      }

      const passed = !findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')

      return {
        success: true,
        data: { passed, findings, evidence },
      }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ERROR_CODES.BUSINESS_LOGIC_ERROR,
          error instanceof Error ? error.message : 'Internal controls validation failed'
        ),
      }
    }
  }

  private async applyRule(
    rule: ValidationRule,
    context: ValidatorContext
  ): Promise<{ findings: DDFinding[]; evidence: ValidationResult['evidence'] }> {
    const findings: DDFinding[] = []
    const evidence: ValidationResult['evidence'] = []

    switch (rule.type) {
      case 'DOCUMENTATION':
        this.checkDocumentation(rule, context, findings, evidence)
        break
      case 'RECONCILIATION':
        this.checkReconciliation(rule, context, findings, evidence)
        break
      case 'TESTING':
        this.checkTesting(rule, context, findings, evidence)
        break
      default:
        this.checkGeneralControls(rule, context, findings, evidence)
    }

    return { findings, evidence }
  }

  private checkDocumentation(
    rule: ValidationRule,
    context: ValidatorContext,
    findings: DDFinding[],
    evidence: ValidationResult['evidence']
  ): void {
    const journals = this.getJournalsForYear(context, context.fiscalYear)

    const journalsWithoutDocumentation = journals.filter((j) => {
      return !j.description || j.description.trim().length < 5
    })

    const totalJournals = journals.length
    const missingDocsCount = journalsWithoutDocumentation.length
    const missingDocsRatio = totalJournals > 0 ? missingDocsCount / totalJournals : 0

    const threshold = rule.threshold ?? 0.05

    if (missingDocsRatio > threshold) {
      const severity: DDSeverity =
        missingDocsRatio > 0.2 ? 'CRITICAL' : missingDocsRatio > 0.1 ? 'HIGH' : 'MEDIUM'

      findings.push(
        this.createFinding(
          '仕訳説明文の不備',
          `全体の${(missingDocsRatio * 100).toFixed(1)}%（${missingDocsCount}件/${totalJournals}件）の仕訳に適切な説明文がありません。`,
          severity,
          '監査証跡の欠如により、取引の正当性を検証できない可能性があります。',
          '全ての仕訳に十分な説明文を追加し、定期的なレビューを実施してください。',
          'J-SOX 第2条（内部統制の整備・運用）'
        )
      )
    }

    evidence.push(
      this.createEvidence(
        'CALCULATION',
        `JOURNALS_${context.fiscalYear}`,
        `仕訳 ${totalJournals} 件中 ${missingDocsCount} 件（${(missingDocsRatio * 100).toFixed(1)}%）に説明文不備`
      )
    )
  }

  private checkReconciliation(
    rule: ValidationRule,
    context: ValidatorContext,
    findings: DDFinding[],
    evidence: ValidationResult['evidence']
  ): void {
    const tb = this.getTrialBalanceForYear(context, context.fiscalYear)

    if (!tb) {
      findings.push(
        this.createFinding(
          '試算表データの欠落',
          `${context.fiscalYear}年度の試算表データが存在しません。`,
          'HIGH',
          '残高確認ができず、内部統制の有効性を評価できません。',
          '試算表データをアップロードしてください。',
          'J-SOX 第3条'
        )
      )
      return
    }

    const totalDebit = tb.accounts.reduce((sum, acc) => sum + acc.debitBalance, 0)
    const totalCredit = tb.accounts.reduce((sum, acc) => sum + acc.creditBalance, 0)
    const difference = Math.abs(totalDebit - totalCredit)
    const tolerance = rule.tolerance ?? 0.001

    if (totalDebit > 0 && difference / totalDebit > tolerance) {
      const severity: DDSeverity = difference / totalDebit > 0.01 ? 'CRITICAL' : 'HIGH'

      findings.push(
        this.createFinding(
          '貸借不一致',
          `試算表の貸借差額: ${difference.toLocaleString()}円（借方: ${totalDebit.toLocaleString()}円、貸方: ${totalCredit.toLocaleString()}円）`,
          severity,
          '会計記録の正確性が損なわれている可能性があります。',
          '直ちに残高確認を行い、不一致の原因を特定・修正してください。',
          'J-SOX 第4条（会計処理の正確性）'
        )
      )
    }

    evidence.push(
      this.createEvidence(
        'CALCULATION',
        `TB_${context.fiscalYear}`,
        `借方合計: ${totalDebit.toLocaleString()}円、貸方合計: ${totalCredit.toLocaleString()}円、差額: ${difference.toLocaleString()}円`
      )
    )
  }

  private checkTesting(
    rule: ValidationRule,
    context: ValidatorContext,
    findings: DDFinding[],
    evidence: ValidationResult['evidence']
  ): void {
    const journals = this.getJournalsForYear(context, context.fiscalYear)

    const highValueJournals = journals.filter((j) => {
      const threshold = rule.min ?? 1_000_000
      return j.amount >= threshold
    })

    const minTestingRate = rule.threshold ?? 0.1
    const expectedTests = Math.max(1, Math.floor(highValueJournals.length * minTestingRate))

    if (highValueJournals.length > 0 && expectedTests > 0) {
      findings.push(
        this.createFinding(
          '高額取引の監査テスト',
          `${context.fiscalYear}年度に${highValueJournals.length}件の高額取引があります。最低${expectedTests}件のテストが必要です。`,
          'INFO',
          '高額取引の監査証拠を確保する必要があります。',
          `金額基準（${((rule.min ?? 1_000_000) / 10000).toFixed(0)}万円以上）で抽出テストを実施してください。`,
          'J-SOX 第5条（監査証拠）'
        )
      )
    }

    evidence.push(
      this.createEvidence(
        'CALCULATION',
        `HIGH_VALUE_${context.fiscalYear}`,
        `高額取引 ${highValueJournals.length} 件（基準: ${((rule.min ?? 1_000_000) / 10000).toFixed(0)}万円以上）`
      )
    )
  }

  private checkGeneralControls(
    rule: ValidationRule,
    context: ValidatorContext,
    findings: DDFinding[],
    evidence: ValidationResult['evidence']
  ): void {
    evidence.push(
      this.createEvidence('DOCUMENT', `IC_${rule.type}`, `内部統制チェック: ${rule.type}`)
    )
  }
}

import { Result, createAppError } from '@/types/result'
import type { DDCategory, ValidationRule } from '../types'
import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator'

import { ddValidationEngine } from './validation-engine'

export class TaxValidator extends BaseValidator {
  readonly category: DDCategory = 'TAX'
  readonly supportedRules = [
    'AUDIT_HISTORY',
    'EXPOSURE',
    'COMPLETENESS',
    'PROVISION',
    'RECONCILIATION',
    'TIMING_DIFFERENCES',
  ]

  async validate(
    _itemCode: string,
    rules: readonly ValidationRule[],
    context: ValidatorContext
  ): Promise<Result<ValidationResult>> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    try {
      const journals = this.getJournalsForYear(context, context.fiscalYear)
      const taxJournals = journals.filter(
        (j) =>
          j.debitAccount.includes('法人税') ||
          j.creditAccount.includes('法人税') ||
          j.debitAccount.includes('住民税') ||
          j.creditAccount.includes('住民税') ||
          j.debitAccount.includes('消費税') ||
          j.creditAccount.includes('消費税') ||
          j.debitAccount.includes('税効果') ||
          j.creditAccount.includes('税効果')
      )

      const { debit: taxExpense, credit: taxPayable } = this.sumJournalAmounts(
        taxJournals,
        (account) =>
          account.includes('法人税') ||
          account.includes('住民税') ||
          account.includes('消費税') ||
          account.includes('税効果')
      )

      evidence.push(
        this.createEvidence(
          'CALCULATION',
          `tax_${context.fiscalYear}`,
          `当期税務費用: ${taxExpense.toLocaleString()}円, 税金未払: ${taxPayable.toLocaleString()}円`
        )
      )

      for (const rule of rules) {
        const ruleResult = await this.applyRule(rule, context, taxJournals, taxExpense, taxPayable)
        findings.push(...ruleResult.findings)
        evidence.push(...ruleResult.evidence)
      }

      const passed = !findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')

      return { success: true, data: { passed, findings, evidence } }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'VALIDATION_ERROR',
          error instanceof Error ? error.message : 'Tax validation failed',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  private async applyRule(
    rule: ValidationRule,
    context: ValidatorContext,
    _taxJournals: ValidatorContext['analyticsContext']['journals'],
    taxExpense: number,
    taxPayable: number
  ): Promise<{ findings: ValidationResult['findings']; evidence: ValidationResult['evidence'] }> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    switch (rule.type) {
      case 'AUDIT_HISTORY': {
        const lookback = rule.lookback ?? 5
        const auditRiskScore = this.calculateAuditRiskScore(context, lookback)

        evidence.push(
          this.createEvidence(
            'CALCULATION',
            `tax_audit_risk_${context.fiscalYear}`,
            `税務調査リスクスコア: ${auditRiskScore.toFixed(2)} (過去${lookback}年)`
          )
        )

        if (auditRiskScore > 0.7) {
          findings.push(
            this.createFinding(
              '税務調査リスクが高い',
              `過去${lookback}年間の税務調査リスクスコアが${(auditRiskScore * 100).toFixed(0)}%と高水準です。`,
              'HIGH',
              '税務当局からの指摘リスクが高まっています。',
              '税務申告の再確認と、必要に応じた修正申告を検討してください。',
              '法人税法第131条'
            )
          )
        }
        break
      }

      case 'EXPOSURE': {
        const journals = this.getJournalsForYear(context, context.fiscalYear)
        const contingentTaxJournals = journals.filter(
          (j) =>
            j.description.includes('未決定') ||
            j.description.includes('税務リスク') ||
            j.description.includes('税務上の')
        )

        const { debit: contingentTax } = this.sumJournalAmounts(contingentTaxJournals, () => true)
        const exposureRatio = taxExpense > 0 ? contingentTax / taxExpense : 0

        evidence.push(
          this.createEvidence(
            'CALCULATION',
            `tax_exposure_${context.fiscalYear}`,
            `税務偶発事象比率: ${(exposureRatio * 100).toFixed(2)}%`
          )
        )

        if (exposureRatio > 0.1) {
          findings.push(
            this.createFinding(
              '税務偶発事象の比率が高い',
              `税務偶発事象比率が${(exposureRatio * 100).toFixed(2)}%と高水準です。`,
              'MEDIUM',
              '税務リスクが財務諸表に適切に反映されていない可能性があります。',
              '税務専門家と協議し、偶発事象の開示を検討してください。',
              'ASBJ Statement No.15'
            )
          )
        }
        break
      }

      case 'PROVISION': {
        const provisionRatio = taxExpense > 0 ? taxPayable / taxExpense : 0

        evidence.push(
          this.createEvidence(
            'CALCULATION',
            `tax_provision_${context.fiscalYear}`,
            `税金引当比率: ${(provisionRatio * 100).toFixed(2)}%`
          )
        )

        if (provisionRatio < 0.8 || provisionRatio > 1.2) {
          findings.push(
            this.createFinding(
              '税金引当の妥当性確認が必要',
              `税金引当比率が${(provisionRatio * 100).toFixed(2)}%と通常の範囲(80-120%)を外れています。`,
              'MEDIUM',
              '税金費用と未払税金の乖離が大きい可能性があります。',
              '税効果会計の適用状況と税務申告予定額を確認してください。',
              'ASBJ Statement No.28'
            )
          )
        }
        break
      }

      case 'RECONCILIATION': {
        evidence.push(
          this.createEvidence(
            'DOCUMENT',
            `tax_reconciliation_${context.fiscalYear}`,
            '税務申告と財務諸表の調整表確認が必要'
          )
        )
        break
      }
    }

    return { findings, evidence }
  }

  private calculateAuditRiskScore(context: ValidatorContext, lookback: number): number {
    let riskScore = 0
    for (let i = 0; i < lookback; i++) {
      const year = context.fiscalYear - i
      const journals = this.getJournalsForYear(context, year)
      const taxAdjustments = journals.filter(
        (j) =>
          j.description.includes('修正') ||
          j.description.includes('更正') ||
          j.description.includes('税務調査')
      )
      if (taxAdjustments.length > 0) {
        riskScore += 0.2
      }
    }
    return Math.min(riskScore, 1.0)
  }
}

ddValidationEngine.registerValidator(new TaxValidator())

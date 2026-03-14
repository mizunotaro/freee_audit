import { Result, createAppError } from '@/types/result'
import type { DDCategory, ValidationRule } from '../types'
import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator'
import { ddValidationEngine } from './validation-engine'

export class RelatedPartyValidator extends BaseValidator {
  readonly category: DDCategory = 'RELATED_PARTY'
  readonly supportedRules = [
    'OWNERSHIP',
    'CONTROL',
    'KEY_MANAGEMENT',
    'COMPARABLE',
    'DISCLOSURE',
    'COMPLETENESS',
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
      const rpJournals = journals.filter(
        (j) =>
          j.description.includes('関連') ||
          j.description.includes('同族') ||
          j.description.includes('役員') ||
          j.description.includes('親族') ||
          j.description.includes('支配')
      )

      const { debit: totalRPDebit, credit: totalRPCredit } = this.sumJournalAmounts(
        rpJournals,
        () => true
      )

      const totalRPAmount = totalRPDebit + totalRPCredit

      const allJournals = this.getJournalsForYear(context, context.fiscalYear)
      const { debit: totalDebit } = this.sumJournalAmounts(allJournals, () => true)
      const rpRatio = totalDebit > 0 ? totalRPAmount / totalDebit : 0

      evidence.push(
        this.createEvidence(
          'CALCULATION',
          `related_party_${context.fiscalYear}`,
          `関連当事者取引比率: ${(rpRatio * 100).toFixed(2)}%`
        )
      )

      for (const rule of rules) {
        const ruleResult = await this.applyRule(rule, context, rpJournals, rpRatio)
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
          error instanceof Error ? error.message : 'Related party validation failed',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  private async applyRule(
    rule: ValidationRule,
    context: ValidatorContext,
    rpJournals: ValidatorContext['analyticsContext']['journals'],
    rpRatio: number
  ): Promise<{ findings: ValidationResult['findings']; evidence: ValidationResult['evidence'] }> {
    const findings: ValidationResult['findings'] = []
    const evidence: ValidationResult['evidence'] = []

    switch (rule.type) {
      case 'OWNERSHIP': {
        if (rule.threshold !== undefined && rpRatio > rule.threshold) {
          findings.push(
            this.createFinding(
              '関連当事者取引比率が高い',
              `関連当事者取引比率が${(rpRatio * 100).toFixed(2)}%と閾値${(rule.threshold * 100).toFixed(0)}%を超過しています。`,
              'HIGH',
              '利益操作のリスクが高まっています。',
              '取引価格の妥当性を確認し、開示を検討してください。',
              'ASBJ Statement No.11'
            )
          )
        }
        break
      }

      case 'DISCLOSURE': {
        if (rpRatio > 0.05) {
          evidence.push(
            this.createEvidence(
              'DOCUMENT',
              `related_party_disclosure_${context.fiscalYear}`,
              '関連当事者取引の開示が必要'
            )
          )

          if (rule.required && rpJournals.length > 0) {
            findings.push(
              this.createFinding(
                '関連当事者開示の確認',
                `関連当事者取引が${rpJournals.length}件存在します。開示の完全性を確認してください。`,
                'MEDIUM',
                '開示漏れのリスクがあります。',
                '財務諸表注記の関連当事者開示を確認してください。',
                'ASBJ Statement No.11'
              )
            )
          }
        }
        break
      }

      case 'KEY_MANAGEMENT': {
        const keyManagementJournals = rpJournals.filter(
          (j) =>
            j.debitAccount.includes('給与') ||
            j.debitAccount.includes('賞与') ||
            j.debitAccount.includes('退職給付')
        )

        if (keyManagementJournals.length > 0) {
          evidence.push(
            this.createEvidence(
              'CALCULATION',
              `key_management_${context.fiscalYear}`,
              `役員報酬関連取引: ${keyManagementJournals.length}件`
            )
          )
        }
        break
      }
    }

    return { findings, evidence }
  }
}

ddValidationEngine.registerValidator(new RelatedPartyValidator())

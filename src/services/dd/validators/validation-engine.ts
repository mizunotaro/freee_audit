import { Result, createAppError } from '@/types/result'
import type {
  DDAnalyticsContext,
  DDCheckResult,
  DDCategory,
  DDItemStatus,
  DDSeverity,
  DDChecklistItemDefinition,
} from '../types'
import { BaseValidator, ValidatorContext, ValidationResult } from './base-validator'

export interface ValidationEngineConfig {
  companyId: string
  fiscalYears: number[]
  analyticsContext: DDAnalyticsContext
}

export interface CategoryValidationResult {
  category: DDCategory
  items: DDCheckResult[]
  overallStatus: DDItemStatus
  categoryScore: number
}

export class DDValidationEngine {
  private validators: Map<DDCategory, BaseValidator> = new Map()

  registerValidator(validator: BaseValidator): void {
    this.validators.set(validator.category, validator)
  }

  async validateItem(
    item: DDChecklistItemDefinition,
    context: ValidatorContext
  ): Promise<Result<DDCheckResult>> {
    const validator = this.validators.get(item.category)

    if (!validator) {
      return {
        success: true,
        data: {
          itemCode: item.code,
          status: 'N_A' as DDItemStatus,
          severity: item.severity,
          findings: [
            {
              id: `${item.code}-NO-VALIDATOR`,
              category: item.category,
              title: 'バリデータ未実装',
              description: `カテゴリ「${item.category}」のバリデータが実装されていません。`,
              impact: '自動検証が実行できません。',
              recommendation: '手動での確認が必要です。',
              severity: 'INFO' as DDSeverity,
            },
          ],
          evidence: [],
          checkedAt: new Date(),
          checkedBy: 'system',
        },
      }
    }

    const result = await validator.validate(item.code, item.validationRules, context)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      }
    }

    const status = this.determineStatus(result.data)

    return {
      success: true,
      data: {
        itemCode: item.code,
        status,
        severity: item.severity,
        findings: result.data.findings,
        evidence: result.data.evidence,
        checkedAt: new Date(),
        checkedBy: 'system',
      },
    }
  }

  async validateCategory(
    items: DDChecklistItemDefinition[],
    context: ValidatorContext
  ): Promise<Result<CategoryValidationResult>> {
    const categoryItems = items.filter((item) => item.category === items[0]?.category)

    if (categoryItems.length === 0) {
      return {
        success: false,
        error: createAppError('VALIDATION_ERROR', 'No items found for category'),
      }
    }

    const results: DDCheckResult[] = []

    for (const item of categoryItems) {
      const result = await this.validateItem(item, context)
      if (result.success) {
        results.push(result.data)
      }
    }

    const overallStatus = this.determineOverallStatus(results)
    const categoryScore = this.calculateCategoryScore(results)

    return {
      success: true,
      data: {
        category: items[0].category,
        items: results,
        overallStatus,
        categoryScore,
      },
    }
  }

  async validateAll(
    items: DDChecklistItemDefinition[],
    config: ValidationEngineConfig
  ): Promise<Result<Map<DDCategory, CategoryValidationResult>>> {
    const results = new Map<DDCategory, CategoryValidationResult>()

    const categories = [...new Set(items.map((item) => item.category))]

    for (const category of categories) {
      const categoryItems = items.filter((item) => item.category === category)

      for (const fiscalYear of config.fiscalYears) {
        const context: ValidatorContext = {
          companyId: config.companyId,
          fiscalYear,
          analyticsContext: config.analyticsContext,
        }

        const result = await this.validateCategory(categoryItems, context)

        if (result.success) {
          results.set(category, result.data)
        }
      }
    }

    return { success: true, data: results }
  }

  private determineStatus(result: ValidationResult): DDItemStatus {
    if (result.passed && result.findings.length === 0) {
      return 'PASSED'
    }

    const hasCriticalFinding = result.findings.some(
      (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    )

    if (hasCriticalFinding) {
      return 'FAILED'
    }

    if (result.findings.length > 0) {
      return 'IN_PROGRESS'
    }

    return 'PASSED'
  }

  private determineOverallStatus(results: DDCheckResult[]): DDItemStatus {
    if (results.some((r) => r.status === 'FAILED')) {
      return 'FAILED'
    }

    if (results.some((r) => r.status === 'IN_PROGRESS')) {
      return 'IN_PROGRESS'
    }

    if (results.every((r) => r.status === 'PASSED')) {
      return 'PASSED'
    }

    if (results.every((r) => r.status === 'N_A')) {
      return 'N_A'
    }

    return 'PENDING'
  }

  private calculateCategoryScore(results: DDCheckResult[]): number {
    if (results.length === 0) return 0

    const weights: Record<DDItemStatus, number> = {
      PASSED: 100,
      FAILED: 0,
      PENDING: 50,
      N_A: 50,
      IN_PROGRESS: 50,
    }

    const totalWeight = results.length
    const score = results.reduce((acc, r) => acc + weights[r.status], 0)

    return Math.round(score / totalWeight)
  }
}

export const ddValidationEngine = new DDValidationEngine()

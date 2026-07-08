import { describe, it, expect, beforeEach } from 'vitest'
import { DDValidationEngine } from '@/services/dd/validators/validation-engine'
import {
  BaseValidator,
  type ValidatorContext,
  type ValidationResult,
} from '@/services/dd/validators/base-validator'
import { Result } from '@/types/result'
import type { DDChecklistItemDefinition, DDSeverity } from '@/services/dd/types'

import type { AppError } from '@/types/result'

class MockValidator extends BaseValidator {
  readonly category = 'REVENUE_RECOGNITION' as const
  readonly supportedRules = ['COMPLETENESS', 'RATIO']

  private shouldPass: boolean
  private hasFindings: boolean

  constructor(shouldPass = true, hasFindings = false) {
    super()
    this.shouldPass = shouldPass
    this.hasFindings = hasFindings
  }

  async validate(
    itemCode: string,
    _rules: readonly any[],
    _context: ValidatorContext
  ): Promise<Result<ValidationResult>> {
    if (!this.shouldPass) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          timestamp: new Date(),
        } as AppError,
      }
    }

    return {
      success: true as const,
      data: {
        passed: this.shouldPass && !this.hasFindings,
        findings: this.hasFindings
          ? [
              {
                id: `${itemCode}-finding-1`,
                category: this.category,
                title: 'Test Finding',
                description: 'A test finding',
                severity: 'MEDIUM' as DDSeverity,
                impact: 'Minor impact',
                recommendation: 'Review recommended',
              },
            ]
          : [],
        evidence: [],
      },
    }
  }
}

function makeContext(): ValidatorContext {
  return {
    companyId: 'co-1',
    fiscalYear: 2024,
    analyticsContext: {
      companyId: 'co-1',
      fiscalYears: [2024],
      trialBalances: [],
      journals: [],
      accountItems: [],
      partners: [],
    } as any,
  }
}

function makeItem(overrides: Record<string, any> = {}): DDChecklistItemDefinition {
  return {
    id: 'item-1',
    code: 'RR-001',
    category: 'REVENUE_RECOGNITION',
    title: 'Revenue Recognition Check',
    description: 'Check revenue recognition',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    validationRules: [{ type: 'COMPLETENESS' as const, field: 'test' }],
    ...overrides,
  } as any
}

describe('DDValidationEngine', () => {
  let engine: DDValidationEngine

  beforeEach(() => {
    engine = new DDValidationEngine()
  })

  describe('registerValidator', () => {
    it('should register a validator', function () {
      const validator = new MockValidator()
      engine.registerValidator(validator)
      expect(engine).toBeDefined()
    })
  })

  describe('validateItem', () => {
    it('should return N_A when no validator registered', async function () {
      const item = makeItem({ category: 'TAX' })
      const result = await engine.validateItem(item, makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('N_A')
        expect(result.data.findings[0].title).toBe('バリデータ未実装')
      }
    })

    it('should validate item with registered validator', async function () {
      const validator = new MockValidator(true, false)
      engine.registerValidator(validator)
      const item = makeItem()
      const result = await engine.validateItem(item, makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('PASSED')
      }
    })

    it('should return FAILED for critical findings', async function () {
      class CriticalValidator extends MockValidator {
        async validate() {
          return {
            success: true as const,
            data: {
              passed: false,
              findings: [
                {
                  id: 'f-1',
                  category: this.category,
                  title: 'Critical Issue',
                  description: 'Critical finding',
                  severity: 'CRITICAL' as DDSeverity,
                  impact: 'Major impact',
                  recommendation: 'Fix immediately',
                },
              ],
              evidence: [],
            },
          }
        }
      }

      engine.registerValidator(new CriticalValidator(true, true))
      const item = makeItem()
      const result = await engine.validateItem(item, makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('FAILED')
      }
    })

    it('should return IN_PROGRESS for medium findings', async function () {
      const validator = new MockValidator(true, true)
      engine.registerValidator(validator)
      const item = makeItem()
      const result = await engine.validateItem(item, makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('IN_PROGRESS')
      }
    })
  })

  describe('validateCategory', () => {
    it('should validate all items in a category', async function () {
      const validator = new MockValidator(true, false)
      engine.registerValidator(validator)
      const items = [makeItem(), makeItem({ id: 'item-2', code: 'RR-002' })]
      const result = await engine.validateCategory(items, makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(2)
        expect(result.data.overallStatus).toBe('PASSED')
      }
    })

    it('should return error for empty items', async function () {
      const result = await engine.validateCategory([], makeContext())
      expect(result.success).toBe(false)
    })
  })

  describe('validateAll', () => {
    it('should validate across multiple categories and fiscal years', async function () {
      engine.registerValidator(new MockValidator(true, false))
      const items = [makeItem(), makeItem({ id: 'item-2', code: 'RR-002' })]
      const result = await engine.validateAll(items, {
        companyId: 'co-1',
        fiscalYears: [2024],
        analyticsContext: {
          companyId: 'co-1',
          fiscalYears: [2024],
          trialBalances: [],
          journals: [],
          accountItems: [],
          partners: [],
        } as any,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.size).toBeGreaterThan(0)
      }
    })
  })

  describe('calculateCategoryScore', () => {
    it('should return 100 for all PASSED', async function () {
      engine.registerValidator(new MockValidator(true, false))
      const items = [makeItem(), makeItem({ id: 'item-2', code: 'RR-002' })]
      const result = await engine.validateCategory(items, makeContext())
      if (result.success) {
        expect(result.data.categoryScore).toBe(100)
      }
    })

    it('should return 0 for all FAILED', async function () {
      class FailValidator extends MockValidator {
        async validate() {
          return {
            success: true as const,
            data: {
              passed: false,
              findings: [
                {
                  id: 'f-1',
                  category: this.category,
                  title: 'Critical',
                  description: 'Critical',
                  severity: 'CRITICAL' as DDSeverity,
                  impact: 'Major',
                  recommendation: 'Fix',
                },
              ],
              evidence: [],
            },
          }
        }
      }

      engine.registerValidator(new FailValidator(true, true))
      const items = [makeItem()]
      const result = await engine.validateCategory(items, makeContext())
      if (result.success) {
        expect(result.data.categoryScore).toBe(0)
      }
    })
  })

  describe('validateItem error propagation', () => {
    it('should return error when registered validator fails', async function () {
      engine.registerValidator(new MockValidator(false, false))
      const result = await engine.validateItem(makeItem(), makeContext())
      expect(result.success).toBe(false)
    })
  })

  describe('validateCategory skip behaviour', () => {
    it('should skip items whose validator returns failure and keep the rest', async function () {
      class SelectiveFailValidator extends MockValidator {
        async validate(itemCode: string) {
          if (itemCode === 'RR-FAIL') {
            return {
              success: false as const,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'boom',
                timestamp: new Date(),
              } as AppError,
            }
          }
          return {
            success: true as const,
            data: { passed: true, findings: [], evidence: [] },
          }
        }
      }

      engine.registerValidator(new SelectiveFailValidator())
      const items = [
        makeItem({ id: 'item-1', code: 'RR-PASS' }),
        makeItem({ id: 'item-2', code: 'RR-FAIL' }),
      ]
      const result = await engine.validateCategory(items, makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(1)
        expect(result.data.items[0].itemCode).toBe('RR-PASS')
        expect(result.data.overallStatus).toBe('PASSED')
      }
    })

    it('should treat a fully-skipped category as PASSED with score 0', async function () {
      class AlwaysFailValidator extends MockValidator {
        async validate() {
          return {
            success: false as const,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'boom',
              timestamp: new Date(),
            } as AppError,
          }
        }
      }

      engine.registerValidator(new AlwaysFailValidator())
      const result = await engine.validateCategory([makeItem()], makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(0)
        expect(result.data.overallStatus).toBe('PASSED')
        expect(result.data.categoryScore).toBe(0)
      }
    })

    it('should report N_A overall status when no validator is registered', async function () {
      const items = [
        makeItem({ id: 'item-1', code: 'TAX-001', category: 'TAX' }),
        makeItem({ id: 'item-2', code: 'TAX-002', category: 'TAX' }),
      ]
      const result = await engine.validateCategory(items, makeContext())
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.overallStatus).toBe('N_A')
        expect(result.data.categoryScore).toBe(50)
        expect(result.data.items.every((i) => i.status === 'N_A')).toBe(true)
      }
    })
  })

  describe('calculateCategoryScore weighted mixes', () => {
    it('should score 50 when every item is IN_PROGRESS', async function () {
      engine.registerValidator(new MockValidator(true, true))
      const items = [
        makeItem({ id: 'item-1', code: 'RR-001' }),
        makeItem({ id: 'item-2', code: 'RR-002' }),
      ]
      const result = await engine.validateCategory(items, makeContext())
      if (result.success) {
        expect(result.data.items.every((i) => i.status === 'IN_PROGRESS')).toBe(true)
        expect(result.data.categoryScore).toBe(50)
      }
    })

    it('should average weights across a PASSED + IN_PROGRESS mix', async function () {
      class MixedValidator extends MockValidator {
        async validate(itemCode: string) {
          if (itemCode === 'RR-PASS') {
            return {
              success: true as const,
              data: { passed: true, findings: [], evidence: [] },
            }
          }
          return {
            success: true as const,
            data: {
              passed: false,
              findings: [
                {
                  id: 'f-1',
                  category: this.category,
                  title: 'Medium',
                  description: 'medium',
                  severity: 'MEDIUM' as DDSeverity,
                  impact: 'minor',
                  recommendation: 'review',
                },
              ],
              evidence: [],
            },
          }
        }
      }

      engine.registerValidator(new MixedValidator())
      const items = [
        makeItem({ id: 'item-1', code: 'RR-PASS' }),
        makeItem({ id: 'item-2', code: 'RR-FAIL' }),
      ]
      const result = await engine.validateCategory(items, makeContext())
      if (result.success) {
        expect(result.data.overallStatus).toBe('IN_PROGRESS')
        expect(result.data.categoryScore).toBe(75)
      }
    })
  })

  describe('validateAll multi-category and multi-year', () => {
    it('should aggregate across categories and exercise the fiscal-year loop', async function () {
      engine.registerValidator(new MockValidator(true, false))
      const items = [
        makeItem({ id: 'item-1', code: 'RR-001', category: 'REVENUE_RECOGNITION' }),
        makeItem({ id: 'item-2', code: 'TAX-001', category: 'TAX' }),
      ]
      const result = await engine.validateAll(items, {
        companyId: 'co-1',
        fiscalYears: [2024, 2023],
        analyticsContext: {
          companyId: 'co-1',
          fiscalYears: [2024, 2023],
          trialBalances: [],
          journals: [],
          accountItems: [],
          partners: [],
        } as any,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.size).toBe(2)
        expect(result.data.has('REVENUE_RECOGNITION')).toBe(true)
        expect(result.data.has('TAX')).toBe(true)
        expect(result.data.get('REVENUE_RECOGNITION')!.overallStatus).toBe('PASSED')
        expect(result.data.get('TAX')!.overallStatus).toBe('N_A')
      }
    })
  })
})

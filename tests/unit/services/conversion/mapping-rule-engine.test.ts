import { describe, it, expect, beforeEach } from 'vitest'
import { MappingRuleEngine, mappingRuleEngine } from '@/services/conversion/mapping-rule-engine'
import type { ConversionRule, MappingCondition } from '@/types/conversion'

describe('MappingRuleEngine', () => {
  let engine: MappingRuleEngine

  beforeEach(() => {
    engine = new MappingRuleEngine()
  })

  describe('calculateAmount', () => {
    it('should calculate direct mapping', () => {
      const rule: ConversionRule = { type: 'direct' }

      const result = engine.calculateAmount(rule, 1000)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(1000)
      }
    })

    it('should calculate percentage split', () => {
      const rule: ConversionRule = {
        type: 'percentage',
        percentage: 30,
      }

      const result = engine.calculateAmount(rule, 1000)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(300)
      }
    })

    it('should calculate formula', () => {
      const rule: ConversionRule = {
        type: 'formula',
        formula: 'amount * 0.5',
      }

      const result = engine.calculateAmount(rule, 1000)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(500)
      }
    })

    it('should calculate formula with context', () => {
      const rule: ConversionRule = {
        type: 'formula',
        formula: 'amount + contextAmount',
      }

      const result = engine.calculateAmount(rule, 1000, { amount: 500 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(1500)
      }
    })

    it('should return error for percentage rule without percentage', () => {
      const rule: ConversionRule = { type: 'percentage' }

      const result = engine.calculateAmount(rule, 1000)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Percentage rule requires percentage value')
      }
    })

    it('should return source amount for ai_suggested type', () => {
      const rule: ConversionRule = { type: 'ai_suggested' }

      const result = engine.calculateAmount(rule, 1000)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(1000)
      }
    })
  })

  describe('evaluateConditions', () => {
    const conditions: MappingCondition[] = [
      {
        field: 'description',
        operator: 'contains',
        value: 'rent',
        targetAccountId: 'target-1',
      },
      {
        field: 'amount',
        operator: 'gt',
        value: 10000,
        targetAccountId: 'target-2',
      },
    ]

    it('should return target account when condition matches', () => {
      const journalData = {
        entryDate: new Date(),
        description: 'Office rent payment',
        amount: 5000,
      }

      const result = engine.evaluateConditions(conditions, journalData)

      expect(result).toBe('target-1')
    })

    it('should return second target when first condition fails but second matches', () => {
      const journalData = {
        entryDate: new Date(),
        description: 'Large payment',
        amount: 15000,
      }

      const result = engine.evaluateConditions(conditions, journalData)

      expect(result).toBe('target-2')
    })

    it('should return null when no condition matches', () => {
      const journalData = {
        entryDate: new Date(),
        description: 'Small payment',
        amount: 5000,
      }

      const result = engine.evaluateConditions(conditions, journalData)

      expect(result).toBeNull()
    })

    it('should evaluate equals operator', () => {
      const condition: MappingCondition = {
        field: 'partnerName',
        operator: 'equals',
        value: 'ABC Corp',
        targetAccountId: 'target-1',
      }

      const result1 = engine.evaluateConditions([condition], {
        entryDate: new Date(),
        description: 'Payment',
        partnerName: 'ABC Corp',
        amount: 1000,
      })

      expect(result1).toBe('target-1')

      const result2 = engine.evaluateConditions([condition], {
        entryDate: new Date(),
        description: 'Payment',
        partnerName: 'XYZ Corp',
        amount: 1000,
      })

      expect(result2).toBeNull()
    })

    it('should evaluate lt operator', () => {
      const condition: MappingCondition = {
        field: 'amount',
        operator: 'lt',
        value: 1000,
        targetAccountId: 'target-1',
      }

      const result = engine.evaluateConditions([condition], {
        entryDate: new Date(),
        description: 'Payment',
        amount: 500,
      })

      expect(result).toBe('target-1')
    })

    it('should evaluate between operator', () => {
      const condition: MappingCondition = {
        field: 'amount',
        operator: 'between',
        value: '1000,5000',
        targetAccountId: 'target-1',
      }

      const result1 = engine.evaluateConditions([condition], {
        entryDate: new Date(),
        description: 'Payment',
        amount: 3000,
      })
      expect(result1).toBe('target-1')

      const result2 = engine.evaluateConditions([condition], {
        entryDate: new Date(),
        description: 'Payment',
        amount: 6000,
      })
      expect(result2).toBeNull()
    })
  })

  describe('validateRule', () => {
    it('should validate direct rule', () => {
      const rule: ConversionRule = { type: 'direct' }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate percentage rule with valid percentage', () => {
      const rule: ConversionRule = {
        type: 'percentage',
        percentage: 50,
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(true)
    })

    it('should fail percentage rule without percentage', () => {
      const rule: ConversionRule = { type: 'percentage' }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_PERCENTAGE')).toBe(true)
    })

    it('should fail percentage rule with invalid percentage', () => {
      const rule: ConversionRule = {
        type: 'percentage',
        percentage: 150,
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_PERCENTAGE')).toBe(true)
    })

    it('should validate formula rule with valid formula', () => {
      const rule: ConversionRule = {
        type: 'formula',
        formula: 'amount * 0.5',
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(true)
    })

    it('should fail formula rule without formula', () => {
      const rule: ConversionRule = { type: 'formula' }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_FORMULA')).toBe(true)
    })

    it('should fail formula rule with dangerous pattern', () => {
      const rule: ConversionRule = {
        type: 'formula',
        formula: 'eval(amount)',
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'DANGEROUS_PATTERN')).toBe(true)
    })

    it('should fail formula rule with unbalanced parentheses', () => {
      const rule: ConversionRule = {
        type: 'formula',
        formula: '(amount * 2',
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'UNBALANCED_PARENTHESES')).toBe(true)
    })

    it('should validate conditions', () => {
      const rule: ConversionRule = {
        type: 'direct',
        conditions: [
          {
            field: 'amount',
            operator: 'gt',
            value: 1000,
            targetAccountId: 'target-1',
          },
        ],
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(true)
    })

    it('should fail condition with empty field', () => {
      const rule: ConversionRule = {
        type: 'direct',
        conditions: [
          {
            field: '',
            operator: 'gt',
            value: 1000,
            targetAccountId: 'target-1',
          },
        ],
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'EMPTY_FIELD')).toBe(true)
    })

    it('should fail condition with invalid operator', () => {
      const rule: ConversionRule = {
        type: 'direct',
        conditions: [
          {
            field: 'amount',
            operator: 'invalid' as 'gt',
            value: 1000,
            targetAccountId: 'target-1',
          },
        ],
      }

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_OPERATOR')).toBe(true)
    })

    it('should fail for invalid rule type', () => {
      const rule = { type: 'invalid' } as unknown as ConversionRule

      const result = engine.validateRule(rule)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_TYPE')).toBe(true)
    })
  })

  describe('exported singleton instance', () => {
    it('should be exported as mappingRuleEngine', () => {
      expect(mappingRuleEngine).toBeInstanceOf(MappingRuleEngine)
    })
  })
})

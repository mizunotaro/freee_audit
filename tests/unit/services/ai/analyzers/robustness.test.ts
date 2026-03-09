import type { AnalysisCategory } from '@/services/ai/analyzers/types'
import { describe, it, expect } from 'vitest'
import { FinancialAnalyzer } from '@/services/ai/analyzers/financial-analyzer'
import {
  safeDivide,
  calculateSafeGrowthRate,
  toSafeNumber,
  isSafeNumber,
  clamp,
  approximatelyEqual,
} from '@/services/ai/analyzers/utils'
import {
  validateBalanceSheet,
  validateProfitLoss,
  validateFinancialStatementSet,
  validateAnalysisOptions,
  sanitizeNumericValue,
} from '@/services/ai/analyzers/validators'
import {
  createMockStatementSet,
  createMockBalanceSheet,
  createMockProfitLoss,
} from './helpers/fixtures'

describe('Robustness', () => {
  describe('Input validation - FinancialAnalyzer', () => {
    it('should reject null balanceSheet', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: null as any,
        profitLoss: {} as any,
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it('should reject null profitLoss', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: {} as any,
        profitLoss: null as any,
      })

      expect(result.success).toBe(false)
    })

    it('should reject undefined balanceSheet', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: undefined as any,
        profitLoss: createMockProfitLoss(),
      })

      expect(result.success).toBe(false)
    })

    it('should reject undefined profitLoss', () => {
      const analyzer = new FinancialAnalyzer()
      const result = analyzer.analyze({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: undefined as any,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Edge cases: Division by zero', () => {
    it('should return fallback for division by zero', () => {
      expect(safeDivide(100, 0, 0)).toBe(0)
      expect(safeDivide(100, 0, -1)).toBe(-1)
    })

    it('should handle zero numerator', () => {
      expect(safeDivide(0, 100, 0)).toBe(0)
    })

    it('should handle both zero', () => {
      expect(safeDivide(0, 0, 0)).toBe(0)
    })

    it('should handle negative numbers', () => {
      expect(safeDivide(-100, 50, 0)).toBe(-2)
      expect(safeDivide(100, -50, 0)).toBe(-2)
    })

    it('should handle infinity', () => {
      expect(safeDivide(Infinity, 100, 0)).toBe(0)
      expect(safeDivide(100, Infinity, 0)).toBe(0)
    })

    it('should handle NaN', () => {
      expect(safeDivide(NaN, 100, 0)).toBe(0)
      expect(safeDivide(100, NaN, 0)).toBe(0)
    })

    it('should support options object', () => {
      expect(safeDivide(100, 0, { fallback: -999 })).toBe(-999)
      expect(safeDivide(100, 0.001, { fallback: 0, epsilon: 0.01 })).toBe(0)
      expect(safeDivide(50, 100, { fallback: 0, percentage: true })).toBe(50)
    })
  })

  describe('Edge cases: Growth rate calculation', () => {
    it('should return null for both zero', () => {
      expect(calculateSafeGrowthRate(0, 0)).toBeNull()
    })

    it('should return 100 for growth from zero to positive', () => {
      expect(calculateSafeGrowthRate(100, 0)).toBe(100)
    })

    it('should return -100 for decline from zero to negative', () => {
      expect(calculateSafeGrowthRate(-100, 0)).toBe(-100)
    })

    it('should calculate normal growth', () => {
      expect(calculateSafeGrowthRate(150, 100)).toBe(50)
      expect(calculateSafeGrowthRate(50, 100)).toBe(-50)
    })

    it('should handle negative previous value', () => {
      const result = calculateSafeGrowthRate(100, -100)
      expect(result).toBe(200)
    })

    it('should return null for NaN/Infinity inputs', () => {
      expect(calculateSafeGrowthRate(NaN, 100)).toBeNull()
      expect(calculateSafeGrowthRate(100, Infinity)).toBeNull()
    })

    it('should return null for NaN result', () => {
      expect(calculateSafeGrowthRate(Infinity, 100)).toBeNull()
      expect(calculateSafeGrowthRate(100, NaN)).toBeNull()
    })
  })

  describe('Edge cases: Number conversion', () => {
    it('should convert string numbers', () => {
      expect(toSafeNumber('100', 0)).toBe(100)
      expect(toSafeNumber('1,000', 0)).toBe(1000)
      expect(toSafeNumber('１００', 0)).toBe(100)
    })

    it('should return fallback for invalid strings', () => {
      expect(toSafeNumber('abc', 0)).toBe(0)
      expect(toSafeNumber('', 0)).toBe(0)
      expect(toSafeNumber(null as any, 0)).toBe(0)
      expect(toSafeNumber(undefined as any, 0)).toBe(0)
    })

    it('should apply min/max constraints', () => {
      expect(toSafeNumber(150, 0, { min: 0, max: 100 })).toBe(100)
      expect(toSafeNumber(-50, 0, { min: 0, max: 100 })).toBe(0)
    })

    it('should reject negative when not allowed', () => {
      expect(toSafeNumber(-100, 0, { allowNegative: false })).toBe(0)
    })

    it('should handle numbers with commas', () => {
      expect(toSafeNumber('1,234,567', 0)).toBe(1234567)
    })

    it('should handle full-width commas', () => {
      expect(toSafeNumber('1，234，567', 0)).toBe(1234567)
    })

    it('should return fallback for objects', () => {
      expect(toSafeNumber({} as any, 42)).toBe(42)
      expect(toSafeNumber([] as any, 42)).toBe(42)
    })

    it('should handle boolean', () => {
      expect(toSafeNumber(true as any, 0)).toBe(0)
      expect(toSafeNumber(false as any, 0)).toBe(0)
    })
  })

  describe('Edge cases: isSafeNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isSafeNumber(0)).toBe(true)
      expect(isSafeNumber(100)).toBe(true)
      expect(isSafeNumber(-50)).toBe(true)
      expect(isSafeNumber(0.001)).toBe(true)
    })

    it('should return false for NaN', () => {
      expect(isSafeNumber(NaN)).toBe(false)
    })

    it('should return false for Infinity', () => {
      expect(isSafeNumber(Infinity)).toBe(false)
      expect(isSafeNumber(-Infinity)).toBe(false)
    })

    it('should return false for non-numbers', () => {
      expect(isSafeNumber('100')).toBe(false)
      expect(isSafeNumber(null)).toBe(false)
      expect(isSafeNumber(undefined)).toBe(false)
    })
  })

  describe('Edge cases: clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(50, 0, 100)).toBe(50)
    })

    it('should return min for value below range', () => {
      expect(clamp(-10, 0, 100)).toBe(0)
    })

    it('should return max for value above range', () => {
      expect(clamp(150, 0, 100)).toBe(100)
    })

    it('should return min for NaN', () => {
      expect(clamp(NaN, 0, 100)).toBe(0)
    })

    it('should handle equal min and max', () => {
      expect(clamp(50, 100, 100)).toBe(100)
    })
  })

  describe('Edge cases: approximatelyEqual', () => {
    it('should return true for equal values', () => {
      expect(approximatelyEqual(1.0, 1.0)).toBe(true)
    })

    it('should return true for values within epsilon', () => {
      expect(approximatelyEqual(1.0, 1.005, 0.01)).toBe(true)
    })

    it('should return false for values outside epsilon', () => {
      expect(approximatelyEqual(1.0, 1.02, 0.01)).toBe(false)
    })

    it('should return false for NaN', () => {
      expect(approximatelyEqual(NaN, 1.0)).toBe(false)
      expect(approximatelyEqual(1.0, NaN)).toBe(false)
    })

    it('should return false for Infinity', () => {
      expect(approximatelyEqual(Infinity, 1.0)).toBe(false)
    })
  })

  describe('Extreme values', () => {
    it('should handle very large numbers', () => {
      const analyzer = new FinancialAnalyzer()
      const statements = createMockStatementSet({
        balanceSheet: {
          totalAssets: Number.MAX_SAFE_INTEGER,
          totalLiabilities: 0,
          totalEquity: Number.MAX_SAFE_INTEGER,
        },
      })

      const result = analyzer.analyze(statements)
      expect(result.success).toBe(true)
    })

    it('should handle very small numbers', () => {
      expect(safeDivide(0.00001, 0.00001, 0)).toBeCloseTo(1, 5)
    })

    it('should handle negative total assets', () => {
      const analyzer = new FinancialAnalyzer()
      const statements = createMockStatementSet({
        balanceSheet: {
          totalAssets: -1000000,
        },
      })

      const result = analyzer.analyze(statements)
      expect(result.success).toBe(true)
    })

    it('should handle zero revenue', () => {
      const analyzer = new FinancialAnalyzer()
      const statements = createMockStatementSet({
        profitLoss: {
          revenue: [],
          grossProfit: 0,
          operatingIncome: 0,
          netIncome: 0,
        },
      })

      const result = analyzer.analyze(statements)
      expect(result.success).toBe(true)
    })
  })

  describe('validateBalanceSheet', () => {
    it('should pass valid balance sheet', () => {
      const bs = createMockBalanceSheet()
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(true)
    })

    it('should fail for unbalanced sheet', () => {
      const bs = createMockBalanceSheet({
        totalAssets: 10000000,
        totalLiabilities: 5000000,
        totalEquity: 6000000,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_balance_sheet')
      }
    })

    it('should allow small rounding differences', () => {
      const bs = createMockBalanceSheet({
        totalAssets: 10000000,
        totalLiabilities: 5000000,
        totalEquity: 5000001,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(true)
    })

    it('should fail for negative total assets', () => {
      const bs = createMockBalanceSheet({
        totalAssets: -1000000,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(false)
    })

    it('should fail for negative equity', () => {
      const bs = createMockBalanceSheet({
        totalEquity: -1000000,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(false)
    })
  })

  describe('validateProfitLoss', () => {
    it('should pass valid profit loss', () => {
      const pl = createMockProfitLoss()
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(true)
    })

    it('should fail for negative revenue', () => {
      const pl = createMockProfitLoss({
        revenue: [{ code: 'R001', name: '売上高', amount: -1000000 }],
      })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(false)
    })

    it('should fail for undefined net income', () => {
      const pl = createMockProfitLoss({ netIncome: undefined as any })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(false)
    })

    it('should fail for null net income', () => {
      const pl = createMockProfitLoss({ netIncome: null as any })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(false)
    })
  })

  describe('validateFinancialStatementSet', () => {
    it('should pass valid statement set', () => {
      const statements = createMockStatementSet()
      const result = validateFinancialStatementSet(statements)
      expect(result.success).toBe(true)
    })

    it('should fail for missing balance sheet', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: null as any,
        profitLoss: createMockProfitLoss(),
      })
      expect(result.success).toBe(false)
    })

    it('should fail for missing profit loss', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: null as any,
      })
      expect(result.success).toBe(false)
    })

    it('should fail for fiscal year mismatch', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
        profitLoss: createMockProfitLoss({ fiscalYear: 2023 }),
      })
      expect(result.success).toBe(false)
    })

    it('should fail when previous year is same or later', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
        profitLoss: createMockProfitLoss({ fiscalYear: 2024 }),
        previousBalanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('validateAnalysisOptions', () => {
    it('should pass valid options', () => {
      const result = validateAnalysisOptions({ category: 'liquidity' })
      expect(result.success).toBe(true)
    })

    it('should fail for invalid category', () => {
      const result = validateAnalysisOptions({ category: 'invalid' as any })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_category')
      }
    })

    it('should fail for invalid depth', () => {
      const result = validateAnalysisOptions({ depth: 'invalid' as any })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_depth')
      }
    })

    it('should fail for invalid language', () => {
      const result = validateAnalysisOptions({ language: 'invalid' as any })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_language')
      }
    })

    it('should pass for empty options', () => {
      const result = validateAnalysisOptions({})
      expect(result.success).toBe(true)
    })

    it('should accept all valid categories', () => {
      const categories: AnalysisCategory[] = [
        'liquidity',
        'safety',
        'profitability',
        'efficiency',
        'growth',
        'cashflow',
        'comprehensive',
      ]
      for (const category of categories) {
        const result = validateAnalysisOptions({ category })
        expect(result.success).toBe(true)
      }
    })

    it('should accept all valid depths', () => {
      const depths: Array<'brief' | 'standard' | 'detailed' | 'comprehensive'> = [
        'brief',
        'standard',
        'detailed',
        'comprehensive',
      ]
      for (const depth of depths) {
        const result = validateAnalysisOptions({ depth })
        expect(result.success).toBe(true)
      }
    })

    it('should accept all valid languages', () => {
      const languages: Array<'ja' | 'en'> = ['ja', 'en']
      for (const language of languages) {
        const result = validateAnalysisOptions({ language })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('sanitizeNumericValue', () => {
    it('should return valid numbers unchanged', () => {
      expect(sanitizeNumericValue(100)).toBe(100)
      expect(sanitizeNumericValue(-50)).toBe(-50)
      expect(sanitizeNumericValue(0.5)).toBe(0.5)
    })

    it('should parse string numbers', () => {
      expect(sanitizeNumericValue('100')).toBe(100)
      expect(sanitizeNumericValue('1,000')).toBe(1000)
    })

    it('should return 0 for invalid values', () => {
      expect(sanitizeNumericValue('abc')).toBe(0)
      expect(sanitizeNumericValue(NaN)).toBe(0)
      expect(sanitizeNumericValue(Infinity)).toBe(0)
      expect(sanitizeNumericValue(null as any)).toBe(0)
      expect(sanitizeNumericValue(undefined as any)).toBe(0)
    })
  })
})

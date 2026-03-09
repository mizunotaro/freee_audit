import { describe, it, expect } from 'vitest'
import {
  validateBalanceSheet,
  validateProfitLoss,
  validateFinancialStatementSet,
  validateAnalysisOptions,
  sanitizeNumericValue,
  normalizeStatements,
} from '@/services/ai/analyzers/validators'
import {
  createMockBalanceSheet,
  createMockProfitLoss,
  createMockStatementSet,
  createEmptyMockBalanceSheet,
  createEmptyMockProfitLoss,
} from './helpers/fixtures'
import type { AnalysisCategory } from '@/services/ai/analyzers/types'

describe('Validators', () => {
  describe('validateBalanceSheet', () => {
    it('should pass valid balance sheet', () => {
      const bs = createMockBalanceSheet()
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(bs)
      }
    })

    it('should fail for unbalanced sheet (assets != liabilities + equity)', () => {
      const bs = createMockBalanceSheet({
        totalAssets: 10000000,
        totalLiabilities: 5000000,
        totalEquity: 6000000,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_balance_sheet')
        expect(result.error.message).toContain('貸借対照表')
      }
    })

    it('should allow small rounding differences (diff <= 1)', () => {
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
      if (!result.success) {
        expect(result.error.message).toContain('資産合計')
      }
    })

    it('should fail for negative total equity', () => {
      const bs = createMockBalanceSheet({
        totalEquity: -1000000,
        totalLiabilities: 11000000,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('純資産')
      }
    })

    it('should pass for negative liabilities (allowed)', () => {
      const bs = createMockBalanceSheet({
        totalLiabilities: -1000000,
        totalEquity: 11000000,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(true)
    })

    it('should handle zero values', () => {
      const bs = createEmptyMockBalanceSheet()
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(true)
    })

    it('should collect multiple errors', () => {
      const bs = createMockBalanceSheet({
        totalAssets: -1000000,
        totalEquity: -1000000,
        totalLiabilities: -1000000,
      })
      const result = validateBalanceSheet(bs)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain(';')
      }
    })
  })

  describe('validateProfitLoss', () => {
    it('should pass valid profit loss', () => {
      const pl = createMockProfitLoss()
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(pl)
      }
    })

    it('should fail for negative revenue', () => {
      const pl = createMockProfitLoss({
        revenue: [{ code: 'R001', name: '売上高', amount: -1000000 }],
      })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_profit_loss')
        expect(result.error.message).toContain('売上高')
      }
    })

    it('should fail for undefined net income', () => {
      const pl = createMockProfitLoss({ netIncome: undefined as any })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('当期純利益')
      }
    })

    it('should fail for null net income', () => {
      const pl = createMockProfitLoss({ netIncome: null as any })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(false)
    })

    it('should pass for negative net income (allowed - represents loss)', () => {
      const pl = createMockProfitLoss({ netIncome: -1000000 })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(true)
    })

    it('should pass for empty revenue array', () => {
      const pl = createMockProfitLoss({ revenue: [] })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(true)
    })

    it('should handle zero values', () => {
      const pl = createEmptyMockProfitLoss()
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(true)
    })

    it('should sum revenue amounts', () => {
      const pl = createMockProfitLoss({
        revenue: [
          { code: 'R001', name: '売上高1', amount: 1000000 },
          { code: 'R002', name: '売上高2', amount: -2000000 },
        ],
      })
      const result = validateProfitLoss(pl)
      expect(result.success).toBe(false)
    })
  })

  describe('validateFinancialStatementSet', () => {
    it('should pass valid statement set', () => {
      const statements = createMockStatementSet()
      const result = validateFinancialStatementSet(statements)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(statements)
      }
    })

    it('should fail for missing balance sheet', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: null as any,
        profitLoss: createMockProfitLoss(),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('貸借対照表')
      }
    })

    it('should fail for missing profit loss', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: null as any,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('損益計算書')
      }
    })

    it('should fail for fiscal year mismatch', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
        profitLoss: createMockProfitLoss({ fiscalYear: 2023 }),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('会計年度')
      }
    })

    it('should pass when fiscal years match', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
        profitLoss: createMockProfitLoss({ fiscalYear: 2024 }),
      })
      expect(result.success).toBe(true)
    })

    it('should fail when previous year is same or later', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
        profitLoss: createMockProfitLoss({ fiscalYear: 2024 }),
        previousBalanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('前期')
      }
    })

    it('should pass when previous year is earlier', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet({ fiscalYear: 2024 }),
        profitLoss: createMockProfitLoss({ fiscalYear: 2024 }),
        previousBalanceSheet: createMockBalanceSheet({ fiscalYear: 2023 }),
      })
      expect(result.success).toBe(true)
    })

    it('should pass without previous period data', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: createMockBalanceSheet(),
        profitLoss: createMockProfitLoss(),
      })
      expect(result.success).toBe(true)
    })

    it('should collect multiple errors', () => {
      const result = validateFinancialStatementSet({
        balanceSheet: null as any,
        profitLoss: null as any,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain(';')
      }
    })
  })

  describe('validateAnalysisOptions', () => {
    it('should pass empty options', () => {
      const result = validateAnalysisOptions({})
      expect(result.success).toBe(true)
    })

    it('should pass valid category', () => {
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

    it('should fail for invalid category', () => {
      const result = validateAnalysisOptions({ category: 'invalid' as any })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_category')
      }
    })

    it('should pass valid depth', () => {
      const depths = ['brief', 'standard', 'detailed', 'comprehensive'] as const
      for (const depth of depths) {
        const result = validateAnalysisOptions({ depth })
        expect(result.success).toBe(true)
      }
    })

    it('should fail for invalid depth', () => {
      const result = validateAnalysisOptions({ depth: 'invalid' as any })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_depth')
      }
    })

    it('should pass valid language', () => {
      const languages = ['ja', 'en'] as const
      for (const language of languages) {
        const result = validateAnalysisOptions({ language })
        expect(result.success).toBe(true)
      }
    })

    it('should fail for invalid language', () => {
      const result = validateAnalysisOptions({ language: 'fr' as any })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_language')
      }
    })

    it('should pass with all options', () => {
      const result = validateAnalysisOptions({
        category: 'liquidity',
        depth: 'detailed',
        language: 'en',
        includeAlerts: true,
        includeRecommendations: true,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('sanitizeNumericValue', () => {
    it('should return valid numbers unchanged', () => {
      expect(sanitizeNumericValue(100)).toBe(100)
      expect(sanitizeNumericValue(-50)).toBe(-50)
      expect(sanitizeNumericValue(0)).toBe(0)
      expect(sanitizeNumericValue(0.5)).toBe(0.5)
    })

    it('should parse string numbers', () => {
      expect(sanitizeNumericValue('100')).toBe(100)
      expect(sanitizeNumericValue('-50')).toBe(-50)
      expect(sanitizeNumericValue('0.5')).toBe(0.5)
    })

    it('should remove commas from strings', () => {
      expect(sanitizeNumericValue('1,000')).toBe(1000)
      expect(sanitizeNumericValue('1,000,000')).toBe(1000000)
    })

    it('should remove full-width commas', () => {
      expect(sanitizeNumericValue('1，000')).toBe(1000)
    })

    it('should return 0 for invalid strings', () => {
      expect(sanitizeNumericValue('abc')).toBe(0)
      expect(sanitizeNumericValue('')).toBe(0)
    })
  })

  describe('normalizeStatements', () => {
    it('should normalize balance sheet values', () => {
      const statements = createMockStatementSet({
        balanceSheet: {
          totalAssets: '10000000' as any,
          totalLiabilities: '5000000' as any,
          totalEquity: '5000000' as any,
        },
      })
      const normalized = normalizeStatements(statements)
      expect(typeof normalized.balanceSheet.totalAssets).toBe('number')
      expect(typeof normalized.balanceSheet.totalLiabilities).toBe('number')
      expect(typeof normalized.balanceSheet.totalEquity).toBe('number')
    })

    it('should normalize profit loss values', () => {
      const statements = createMockStatementSet({
        profitLoss: {
          grossProfit: '20000000' as any,
          operatingIncome: '5000000' as any,
          netIncome: '4000000' as any,
          depreciation: '500000' as any,
        },
      })
      const normalized = normalizeStatements(statements)
      expect(typeof normalized.profitLoss.grossProfit).toBe('number')
      expect(typeof normalized.profitLoss.operatingIncome).toBe('number')
      expect(typeof normalized.profitLoss.netIncome).toBe('number')
      expect(typeof normalized.profitLoss.depreciation).toBe('number')
    })

    it('should handle NaN values', () => {
      const statements = createMockStatementSet({
        balanceSheet: {
          totalAssets: NaN,
        },
      })
      const normalized = normalizeStatements(statements)
      expect(normalized.balanceSheet.totalAssets).toBe(0)
    })

    it('should preserve other properties', () => {
      const statements = createMockStatementSet()
      const normalized = normalizeStatements(statements)
      expect(normalized.balanceSheet.fiscalYear).toBe(statements.balanceSheet.fiscalYear)
      expect(normalized.profitLoss.fiscalYear).toBe(statements.profitLoss.fiscalYear)
    })
  })
})

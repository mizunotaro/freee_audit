import { describe, it, expect } from 'vitest'
import {
  isSafeNumber,
  toSafeNumber,
  safeDivide,
  calculateSafeGrowthRate,
  approximatelyEqual,
  clamp,
  checkTimeout,
  checkIterationLimit,
  formatCurrency,
  formatPercentage,
  formatRatio,
  formatDays,
  determineTrend,
  determineTrendFromSeries,
  extractTotalAssets,
  extractTotalLiabilities,
  extractTotalEquity,
  extractCurrentAssets,
  extractCurrentLiabilities,
  extractInventory,
  extractCashAndEquivalents,
  extractRetainedEarnings,
  extractRevenue,
  extractCostOfSales,
  extractGrossProfit,
  extractOperatingIncome,
  extractNetIncome,
  extractDepreciation,
  extractInterestExpense,
  calculateAverageTotalAssets,
  calculateAverageEquity,
  generateAlertId,
  generateRecommendationId,
  classifyFinancialHealth,
  AnalysisCache,
  processParallel,
} from '@/services/ai/analyzers/utils'
import { createMockBalanceSheet, createMockProfitLoss } from './helpers/fixtures'

describe('Utils', () => {
  describe('isSafeNumber', () => {
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
      expect(isSafeNumber({})).toBe(false)
    })
  })

  describe('toSafeNumber', () => {
    it('should return valid numbers unchanged', () => {
      expect(toSafeNumber(100)).toBe(100)
      expect(toSafeNumber(-50)).toBe(-50)
      expect(toSafeNumber(0)).toBe(0)
    })

    it('should parse string numbers', () => {
      expect(toSafeNumber('100')).toBe(100)
      expect(toSafeNumber('1,000')).toBe(1000)
      expect(toSafeNumber('１００')).toBe(100)
    })

    it('should return fallback for invalid values', () => {
      expect(toSafeNumber('abc', 42)).toBe(42)
      expect(toSafeNumber(NaN, 42)).toBe(42)
      expect(toSafeNumber(Infinity, 42)).toBe(42)
      expect(toSafeNumber(null, 42)).toBe(42)
      expect(toSafeNumber(undefined, 42)).toBe(42)
    })

    it('should apply min constraint', () => {
      expect(toSafeNumber(-50, 0, { min: 0 })).toBe(0)
      expect(toSafeNumber(50, 0, { min: 0 })).toBe(50)
    })

    it('should apply max constraint', () => {
      expect(toSafeNumber(150, 0, { max: 100 })).toBe(100)
      expect(toSafeNumber(50, 0, { max: 100 })).toBe(50)
    })

    it('should reject negative when not allowed', () => {
      expect(toSafeNumber(-100, 0, { allowNegative: false })).toBe(0)
      expect(toSafeNumber(100, 0, { allowNegative: false })).toBe(100)
    })
  })

  describe('safeDivide', () => {
    it('should divide correctly', () => {
      expect(safeDivide(100, 50)).toBe(2)
      expect(safeDivide(50, 100)).toBe(0.5)
    })

    it('should return fallback for division by zero', () => {
      expect(safeDivide(100, 0, 0)).toBe(0)
      expect(safeDivide(100, 0, -1)).toBe(-1)
    })

    it('should return fallback for NaN/Infinity', () => {
      expect(safeDivide(NaN, 100, 0)).toBe(0)
      expect(safeDivide(100, NaN, 0)).toBe(0)
      expect(safeDivide(Infinity, 100, 0)).toBe(0)
    })

    it('should support options object', () => {
      expect(safeDivide(50, 100, { percentage: true })).toBe(50)
      expect(safeDivide(100, 0.001, { epsilon: 0.01, fallback: 0 })).toBe(0)
    })
  })

  describe('calculateSafeGrowthRate', () => {
    it('should calculate positive growth', () => {
      expect(calculateSafeGrowthRate(150, 100)).toBe(50)
    })

    it('should calculate negative growth', () => {
      expect(calculateSafeGrowthRate(50, 100)).toBe(-50)
    })

    it('should return null for both zero', () => {
      expect(calculateSafeGrowthRate(0, 0)).toBeNull()
    })

    it('should handle growth from zero', () => {
      expect(calculateSafeGrowthRate(100, 0)).toBe(100)
      expect(calculateSafeGrowthRate(-100, 0)).toBe(-100)
    })

    it('should return null for invalid inputs', () => {
      expect(calculateSafeGrowthRate(NaN, 100)).toBeNull()
      expect(calculateSafeGrowthRate(100, NaN)).toBeNull()
    })
  })

  describe('approximatelyEqual', () => {
    it('should return true for equal values', () => {
      expect(approximatelyEqual(1.0, 1.0)).toBe(true)
    })

    it('should return true for values within epsilon', () => {
      expect(approximatelyEqual(1.0, 1.005, 0.01)).toBe(true)
    })

    it('should return false for values outside epsilon', () => {
      expect(approximatelyEqual(1.0, 1.02, 0.01)).toBe(false)
    })

    it('should return false for invalid inputs', () => {
      expect(approximatelyEqual(NaN, 1.0)).toBe(false)
      expect(approximatelyEqual(1.0, NaN)).toBe(false)
    })
  })

  describe('clamp', () => {
    it('should return value within range', () => {
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
  })

  describe('checkTimeout', () => {
    it('should not throw when within timeout', () => {
      expect(() => checkTimeout(Date.now() - 1000, 5000)).not.toThrow()
    })

    it('should throw when timeout exceeded', () => {
      expect(() => checkTimeout(Date.now() - 6000, 5000)).toThrow('timed out')
    })
  })

  describe('checkIterationLimit', () => {
    it('should not throw when within limit', () => {
      expect(() => checkIterationLimit(100, 1000)).not.toThrow()
    })

    it('should throw when limit exceeded', () => {
      expect(() => checkIterationLimit(1001, 1000)).toThrow('Iteration limit exceeded')
    })
  })

  describe('formatCurrency', () => {
    it('should format in yen', () => {
      expect(formatCurrency(1000, 'yen')).toBe('1,000円')
    })

    it('should format in thousand', () => {
      expect(formatCurrency(10000, 'thousand')).toBe('10千円')
    })

    it('should format in million', () => {
      expect(formatCurrency(1000000, 'million')).toBe('1百万円')
    })
  })

  describe('formatPercentage', () => {
    it('should format with default decimals', () => {
      expect(formatPercentage(50.5)).toBe('50.5%')
    })

    it('should format with custom decimals', () => {
      expect(formatPercentage(50.555, 2)).toBe('50.55%')
    })
  })

  describe('formatRatio', () => {
    it('should format with default decimals', () => {
      expect(formatRatio(1.234)).toBe('1.23')
    })

    it('should format with custom decimals', () => {
      expect(formatRatio(1.234, 3)).toBe('1.234')
    })
  })

  describe('formatDays', () => {
    it('should format days', () => {
      expect(formatDays(30)).toBe('30日')
    })

    it('should round decimal days', () => {
      expect(formatDays(30.5)).toBe('31日')
    })
  })

  describe('determineTrend', () => {
    it('should return improving for positive change', () => {
      expect(determineTrend(110, 100)).toBe('improving')
    })

    it('should return declining for negative change', () => {
      expect(determineTrend(90, 100)).toBe('declining')
    })

    it('should return stable for small change', () => {
      expect(determineTrend(102, 100)).toBe('stable')
    })

    it('should return stable when previous is zero', () => {
      expect(determineTrend(100, 0)).toBe('stable')
    })

    it('should use custom threshold', () => {
      expect(determineTrend(104, 100, 3)).toBe('improving')
      expect(determineTrend(104, 100, 10)).toBe('stable')
    })
  })

  describe('determineTrendFromSeries', () => {
    it('should return stable for less than 2 values', () => {
      expect(determineTrendFromSeries([100])).toBe('stable')
      expect(determineTrendFromSeries([])).toBe('stable')
    })

    it('should return improving for increasing values', () => {
      expect(determineTrendFromSeries([100, 110, 120, 130])).toBe('improving')
    })

    it('should return declining for decreasing values', () => {
      expect(determineTrendFromSeries([130, 120, 110, 100])).toBe('declining')
    })

    it('should return stable for flat values', () => {
      expect(determineTrendFromSeries([100, 100, 100, 100])).toBe('stable')
    })

    it('should return volatile for high variance', () => {
      expect(determineTrendFromSeries([100, 200, 50, 300, 10])).toBe('volatile')
    })

    it('should skip zero previous values', () => {
      expect(determineTrendFromSeries([0, 100, 110])).toBe('improving')
    })
  })

  describe('Extraction functions', () => {
    it('should extract total assets', () => {
      const bs = createMockBalanceSheet()
      expect(extractTotalAssets(bs)).toBe(bs.totalAssets)
    })

    it('should extract total liabilities', () => {
      const bs = createMockBalanceSheet()
      expect(extractTotalLiabilities(bs)).toBe(bs.totalLiabilities)
    })

    it('should extract total equity', () => {
      const bs = createMockBalanceSheet()
      expect(extractTotalEquity(bs)).toBe(bs.totalEquity)
    })

    it('should extract current assets', () => {
      const bs = createMockBalanceSheet()
      const currentAssets = extractCurrentAssets(bs)
      expect(currentAssets).toBeGreaterThan(0)
    })

    it('should extract current liabilities', () => {
      const bs = createMockBalanceSheet()
      const currentLiabilities = extractCurrentLiabilities(bs)
      expect(currentLiabilities).toBeGreaterThan(0)
    })

    it('should extract inventory', () => {
      const bs = createMockBalanceSheet()
      const inventory = extractInventory(bs)
      expect(inventory).toBeGreaterThanOrEqual(0)
    })

    it('should extract cash and equivalents', () => {
      const bs = createMockBalanceSheet()
      const cash = extractCashAndEquivalents(bs)
      expect(cash).toBeGreaterThan(0)
    })

    it('should extract retained earnings', () => {
      const bs = createMockBalanceSheet()
      const retained = extractRetainedEarnings(bs)
      expect(retained).toBeGreaterThanOrEqual(0)
    })

    it('should extract revenue', () => {
      const pl = createMockProfitLoss()
      const revenue = extractRevenue(pl)
      expect(revenue).toBeGreaterThan(0)
    })

    it('should extract cost of sales', () => {
      const pl = createMockProfitLoss()
      const cost = extractCostOfSales(pl)
      expect(cost).toBeGreaterThanOrEqual(0)
    })

    it('should extract gross profit', () => {
      const pl = createMockProfitLoss()
      expect(extractGrossProfit(pl)).toBe(pl.grossProfit)
    })

    it('should extract operating income', () => {
      const pl = createMockProfitLoss()
      expect(extractOperatingIncome(pl)).toBe(pl.operatingIncome)
    })

    it('should extract net income', () => {
      const pl = createMockProfitLoss()
      expect(extractNetIncome(pl)).toBe(pl.netIncome)
    })

    it('should extract depreciation', () => {
      const pl = createMockProfitLoss()
      expect(extractDepreciation(pl)).toBe(pl.depreciation)
    })

    it('should extract interest expense', () => {
      const pl = createMockProfitLoss()
      const interest = extractInterestExpense(pl)
      expect(interest).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateAverageTotalAssets', () => {
    it('should return current when no previous', () => {
      const bs = createMockBalanceSheet()
      expect(calculateAverageTotalAssets(bs)).toBe(bs.totalAssets)
    })

    it('should calculate average with previous', () => {
      const bs = createMockBalanceSheet({ totalAssets: 20000000 })
      const prevBs = createMockBalanceSheet({ totalAssets: 10000000 })
      expect(calculateAverageTotalAssets(bs, prevBs)).toBe(15000000)
    })
  })

  describe('calculateAverageEquity', () => {
    it('should return current when no previous', () => {
      const bs = createMockBalanceSheet()
      expect(calculateAverageEquity(bs)).toBe(bs.totalEquity)
    })

    it('should calculate average with previous', () => {
      const bs = createMockBalanceSheet({ totalEquity: 6000000 })
      const prevBs = createMockBalanceSheet({ totalEquity: 4000000 })
      expect(calculateAverageEquity(bs, prevBs)).toBe(5000000)
    })
  })

  describe('generateAlertId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateAlertId())
      }
      expect(ids.size).toBe(100)
    })

    it('should start with alert_', () => {
      expect(generateAlertId()).toMatch(/^alert_/)
    })
  })

  describe('generateRecommendationId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateRecommendationId())
      }
      expect(ids.size).toBe(100)
    })

    it('should start with rec_', () => {
      expect(generateRecommendationId()).toMatch(/^rec_/)
    })
  })

  describe('classifyFinancialHealth', () => {
    it('should classify insolvent for negative equity', () => {
      const bs = createMockBalanceSheet({ totalEquity: -1000000 })
      const pl = createMockProfitLoss()
      const result = classifyFinancialHealth(bs, pl)
      expect(result.type).toBe('insolvent')
    })

    it('should classify loss_making for negative income with revenue', () => {
      const bs = createMockBalanceSheet()
      const pl = createMockProfitLoss({ netIncome: -1000000 })
      const result = classifyFinancialHealth(bs, pl)
      expect(result.type).toBe('loss_making')
    })

    it('should classify pre_revenue for zero revenue', () => {
      const bs = createMockBalanceSheet()
      const pl = createMockProfitLoss({ revenue: [] })
      const result = classifyFinancialHealth(bs, pl)
      expect(result.type).toBe('pre_revenue')
    })

    it('should classify healthy for high equity ratio and positive income', () => {
      const bs = createMockBalanceSheet({ totalAssets: 10000000, totalEquity: 6000000 })
      const pl = createMockProfitLoss({ netIncome: 1000000 })
      const result = classifyFinancialHealth(bs, pl)
      expect(result.type).toBe('healthy')
    })

    it('should classify stable for moderate equity ratio', () => {
      const bs = createMockBalanceSheet({ totalAssets: 10000000, totalEquity: 4000000 })
      const pl = createMockProfitLoss({ netIncome: 100000 })
      const result = classifyFinancialHealth(bs, pl)
      expect(result.type).toBe('stable')
    })

    it('should classify leveraged for low equity ratio', () => {
      const bs = createMockBalanceSheet({ totalAssets: 10000000, totalEquity: 1500000 })
      const pl = createMockProfitLoss({ netIncome: 100000 })
      const result = classifyFinancialHealth(bs, pl)
      expect(result.type).toBe('leveraged')
    })
  })

  describe('AnalysisCache', () => {
    it('should store and retrieve values', () => {
      const cache = new AnalysisCache<string>()
      cache.set('key', 'value')
      expect(cache.get('key')).toBe('value')
    })

    it('should return undefined for missing keys', () => {
      const cache = new AnalysisCache<string>()
      expect(cache.get('missing')).toBeUndefined()
    })

    it('should expire entries after TTL', async () => {
      const cache = new AnalysisCache<string>(100, 50)
      cache.set('key', 'value')
      await new Promise((resolve) => setTimeout(resolve, 60))
      expect(cache.get('key')).toBeUndefined()
    })

    it('should evict oldest when max size reached', () => {
      const cache = new AnalysisCache<string>(2)
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      expect(cache.size()).toBe(2)
    })

    it('should clear all entries', () => {
      const cache = new AnalysisCache<string>()
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.invalidate()
      expect(cache.size()).toBe(0)
    })

    it('should invalidate by pattern', () => {
      const cache = new AnalysisCache<string>()
      cache.set('test_1', 'value1')
      cache.set('test_2', 'value2')
      cache.set('other', 'value3')
      cache.invalidate(/^test_/)
      expect(cache.get('test_1')).toBeUndefined()
      expect(cache.get('other')).toBe('value3')
    })

    it('should return correct size', () => {
      const cache = new AnalysisCache<string>()
      expect(cache.size()).toBe(0)
      cache.set('key1', 'value1')
      expect(cache.size()).toBe(1)
      cache.set('key2', 'value2')
      expect(cache.size()).toBe(2)
    })
  })

  describe('processParallel', () => {
    it('should process items in parallel', async () => {
      const items = [1, 2, 3, 4, 5]
      const processor = async (item: number) => item * 2
      const results = await processParallel(items, processor, 2)
      expect(results).toEqual([2, 4, 6, 8, 10])
    })

    it('should respect concurrency limit', async () => {
      let concurrent = 0
      let maxConcurrent = 0
      const items = [1, 2, 3, 4, 5]

      const processor = async (item: number) => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((resolve) => setTimeout(resolve, 10))
        concurrent--
        return item
      }

      await processParallel(items, processor, 2)
      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('should handle empty array', async () => {
      const results = await processParallel([], async (x) => x)
      expect(results).toEqual([])
    })
  })
})

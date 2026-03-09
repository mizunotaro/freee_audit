import { describe, it, expect } from 'vitest'
import type {
  RatioCategory,
  RatioStatus,
  RatioDefinition,
  CalculatedRatio,
  RatioGroup,
  RatioAnalysisResult,
  RatioResult,
} from '@/services/ai/analyzers/ratios/types'

describe('Ratio Types', () => {
  describe('RatioCategory', () => {
    it('should have correct category values', () => {
      const categories: RatioCategory[] = [
        'liquidity',
        'safety',
        'profitability',
        'efficiency',
        'growth',
      ]
      expect(categories).toHaveLength(5)
    })
  })

  describe('RatioStatus', () => {
    it('should have correct status values', () => {
      const statuses: RatioStatus[] = ['excellent', 'good', 'fair', 'poor', 'critical']
      expect(statuses).toHaveLength(5)
    })
  })

  describe('RatioDefinition', () => {
    it('should create valid ratio definition', () => {
      const definition: RatioDefinition = {
        id: 'test_ratio',
        name: 'テスト比率',
        nameEn: 'Test Ratio',
        category: 'liquidity',
        formula: 'A / B',
        description: 'テスト用の比率',
        unit: 'percentage',
        thresholds: {
          excellent: 100,
          good: 80,
          fair: 60,
          poor: 40,
        },
        higherIsBetter: true,
      }

      expect(definition.id).toBe('test_ratio')
      expect(definition.higherIsBetter).toBe(true)
    })
  })

  describe('CalculatedRatio', () => {
    it('should create valid calculated ratio', () => {
      const definition: RatioDefinition = {
        id: 'test',
        name: 'Test',
        nameEn: 'Test',
        category: 'liquidity',
        formula: 'A / B',
        description: 'Test',
        unit: 'percentage',
        thresholds: { excellent: 100, good: 80, fair: 60, poor: 40 },
        higherIsBetter: true,
      }

      const calculated: CalculatedRatio = {
        definition,
        value: 85,
        formattedValue: '85.0%',
        status: 'good',
        trend: {
          direction: 'improving',
          previousValue: 75,
          changePercent: 13.33,
        },
        percentile: 75,
      }

      expect(calculated.value).toBe(85)
      expect(calculated.status).toBe('good')
      expect(calculated.trend?.direction).toBe('improving')
    })

    it('should allow optional fields', () => {
      const definition: RatioDefinition = {
        id: 'test',
        name: 'Test',
        nameEn: 'Test',
        category: 'liquidity',
        formula: 'A / B',
        description: 'Test',
        unit: 'percentage',
        thresholds: { excellent: 100, good: 80, fair: 60, poor: 40 },
        higherIsBetter: true,
      }

      const calculated: CalculatedRatio = {
        definition,
        value: 85,
        formattedValue: '85.0%',
        status: 'good',
      }

      expect(calculated.trend).toBeUndefined()
      expect(calculated.percentile).toBeUndefined()
    })
  })

  describe('RatioGroup', () => {
    it('should create valid ratio group', () => {
      const definition: RatioDefinition = {
        id: 'test',
        name: 'Test',
        nameEn: 'Test',
        category: 'liquidity',
        formula: 'A / B',
        description: 'Test',
        unit: 'percentage',
        thresholds: { excellent: 100, good: 80, fair: 60, poor: 40 },
        higherIsBetter: true,
      }

      const ratio: CalculatedRatio = {
        definition,
        value: 85,
        formattedValue: '85.0%',
        status: 'good',
      }

      const group: RatioGroup = {
        category: 'liquidity',
        categoryName: '流動性',
        ratios: [ratio],
        averageScore: 75,
        overallStatus: 'good',
      }

      expect(group.category).toBe('liquidity')
      expect(group.ratios).toHaveLength(1)
    })
  })

  describe('RatioAnalysisResult', () => {
    it('should create successful result', () => {
      const result: RatioAnalysisResult = {
        success: true,
        data: {
          groups: [],
          allRatios: [],
          summary: {
            totalRatios: 0,
            excellentCount: 0,
            goodCount: 0,
            fairCount: 0,
            poorCount: 0,
            criticalCount: 0,
            overallScore: 0,
          },
          calculatedAt: new Date(),
        },
      }

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should create error result', () => {
      const result: RatioAnalysisResult = {
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'Invalid input data',
        },
      }

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
    })
  })

  describe('RatioResult', () => {
    it('should create successful generic result', () => {
      const result: RatioResult<string> = {
        success: true,
        data: 'test data',
      }

      expect(result.success).toBe(true)
      expect(result.data).toBe('test data')
    })

    it('should create error generic result', () => {
      const result: RatioResult<string> = {
        success: false,
        error: {
          code: 'ERROR',
          message: 'Something went wrong',
        },
      }

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('ERROR')
    })
  })
})

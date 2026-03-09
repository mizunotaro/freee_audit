import { describe, it, expect } from 'vitest'
import {
  THRESHOLDS,
  GROWTH_THRESHOLDS,
  CATEGORY_WEIGHTS,
  STATUS_SCORES,
  STATUS_DESCRIPTIONS_JA,
  CATEGORY_NAMES_JA,
  SEVERITY_ORDER,
  PRIORITY_ORDER,
} from '@/services/ai/analyzers/constants'

describe('constants', () => {
  describe('THRESHOLDS', () => {
    it('should have liquidity thresholds', () => {
      expect(THRESHOLDS.currentRatio).toBeDefined()
      expect(THRESHOLDS.currentRatio.excellent).toBe(200)
      expect(THRESHOLDS.currentRatio.good).toBe(150)
      expect(THRESHOLDS.currentRatio.fair).toBe(100)
      expect(THRESHOLDS.currentRatio.poor).toBe(80)
    })

    it('should have quick ratio thresholds', () => {
      expect(THRESHOLDS.quickRatio).toBeDefined()
      expect(THRESHOLDS.quickRatio.excellent).toBe(150)
    })

    it('should have debt to equity thresholds', () => {
      expect(THRESHOLDS.debtToEquity).toBeDefined()
      expect(THRESHOLDS.debtToEquity.excellent).toBe(0.5)
    })

    it('should have equity ratio thresholds', () => {
      expect(THRESHOLDS.equityRatio).toBeDefined()
      expect(THRESHOLDS.equityRatio.excellent).toBe(50)
    })

    it('should have gross margin thresholds', () => {
      expect(THRESHOLDS.grossMargin).toBeDefined()
      expect(THRESHOLDS.grossMargin.excellent).toBe(40)
    })

    it('should have operating margin thresholds', () => {
      expect(THRESHOLDS.operatingMargin).toBeDefined()
      expect(THRESHOLDS.operatingMargin.excellent).toBe(15)
    })

    it('should have net margin thresholds', () => {
      expect(THRESHOLDS.netMargin).toBeDefined()
      expect(THRESHOLDS.netMargin.excellent).toBe(10)
    })

    it('should have ROE thresholds', () => {
      expect(THRESHOLDS.roe).toBeDefined()
      expect(THRESHOLDS.roe.excellent).toBe(15)
    })

    it('should have ROA thresholds', () => {
      expect(THRESHOLDS.roa).toBeDefined()
      expect(THRESHOLDS.roa.excellent).toBe(10)
    })

    it('should have asset turnover thresholds', () => {
      expect(THRESHOLDS.assetTurnover).toBeDefined()
      expect(THRESHOLDS.assetTurnover.excellent).toBe(2.0)
    })
  })

  describe('GROWTH_THRESHOLDS', () => {
    it('should have growth thresholds', () => {
      expect(GROWTH_THRESHOLDS.excellent).toBe(20)
      expect(GROWTH_THRESHOLDS.good).toBe(10)
      expect(GROWTH_THRESHOLDS.fair).toBe(0)
      expect(GROWTH_THRESHOLDS.poor).toBe(-10)
    })
  })

  describe('CATEGORY_WEIGHTS', () => {
    it('should have weights for all categories', () => {
      expect(CATEGORY_WEIGHTS.liquidity).toBe(1.0)
      expect(CATEGORY_WEIGHTS.safety).toBe(1.2)
      expect(CATEGORY_WEIGHTS.profitability).toBe(1.3)
      expect(CATEGORY_WEIGHTS.efficiency).toBe(0.8)
      expect(CATEGORY_WEIGHTS.growth).toBe(1.0)
      expect(CATEGORY_WEIGHTS.cashflow).toBe(1.0)
      expect(CATEGORY_WEIGHTS.comprehensive).toBe(0.5)
    })

    it('should have positive weights for all categories', () => {
      const weights = Object.values(CATEGORY_WEIGHTS)
      expect(weights.every((w) => w > 0)).toBe(true)
    })
  })

  describe('STATUS_SCORES', () => {
    it('should have scores for all statuses', () => {
      expect(STATUS_SCORES.excellent).toBe(100)
      expect(STATUS_SCORES.good).toBe(75)
      expect(STATUS_SCORES.fair).toBe(50)
      expect(STATUS_SCORES.poor).toBe(25)
      expect(STATUS_SCORES.critical).toBe(0)
    })

    it('should have decreasing scores from excellent to critical', () => {
      expect(STATUS_SCORES.excellent).toBeGreaterThan(STATUS_SCORES.good)
      expect(STATUS_SCORES.good).toBeGreaterThan(STATUS_SCORES.fair)
      expect(STATUS_SCORES.fair).toBeGreaterThan(STATUS_SCORES.poor)
      expect(STATUS_SCORES.poor).toBeGreaterThan(STATUS_SCORES.critical)
    })
  })

  describe('STATUS_DESCRIPTIONS_JA', () => {
    it('should have Japanese descriptions for all statuses', () => {
      expect(STATUS_DESCRIPTIONS_JA.excellent).toBe('非常に良好')
      expect(STATUS_DESCRIPTIONS_JA.good).toBe('良好')
      expect(STATUS_DESCRIPTIONS_JA.fair).toBe('普通')
      expect(STATUS_DESCRIPTIONS_JA.poor).toBe('改善が必要')
      expect(STATUS_DESCRIPTIONS_JA.critical).toBe('早急な対応が必要')
    })

    it('should have all status descriptions as non-empty strings', () => {
      const descriptions = Object.values(STATUS_DESCRIPTIONS_JA)
      expect(descriptions.every((d) => typeof d === 'string' && d.length > 0)).toBe(true)
    })
  })

  describe('CATEGORY_NAMES_JA', () => {
    it('should have Japanese names for all categories', () => {
      expect(CATEGORY_NAMES_JA.liquidity).toBe('流動性')
      expect(CATEGORY_NAMES_JA.safety).toBe('安全性')
      expect(CATEGORY_NAMES_JA.profitability).toBe('収益性')
      expect(CATEGORY_NAMES_JA.efficiency).toBe('効率性')
      expect(CATEGORY_NAMES_JA.growth).toBe('成長性')
      expect(CATEGORY_NAMES_JA.cashflow).toBe('キャッシュフロー')
      expect(CATEGORY_NAMES_JA.comprehensive).toBe('総合')
    })

    it('should have all category names as non-empty strings', () => {
      const names = Object.values(CATEGORY_NAMES_JA)
      expect(names.every((n) => typeof n === 'string' && n.length > 0)).toBe(true)
    })
  })

  describe('SEVERITY_ORDER', () => {
    it('should have order for all severities', () => {
      expect(SEVERITY_ORDER.critical).toBe(0)
      expect(SEVERITY_ORDER.high).toBe(1)
      expect(SEVERITY_ORDER.medium).toBe(2)
      expect(SEVERITY_ORDER.low).toBe(3)
      expect(SEVERITY_ORDER.info).toBe(4)
    })

    it('should have increasing order from critical to info', () => {
      expect(SEVERITY_ORDER.critical).toBeLessThan(SEVERITY_ORDER.high)
      expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.medium)
      expect(SEVERITY_ORDER.medium).toBeLessThan(SEVERITY_ORDER.low)
      expect(SEVERITY_ORDER.low).toBeLessThan(SEVERITY_ORDER.info)
    })
  })

  describe('PRIORITY_ORDER', () => {
    it('should have order for all priorities', () => {
      expect(PRIORITY_ORDER.high).toBe(0)
      expect(PRIORITY_ORDER.medium).toBe(1)
      expect(PRIORITY_ORDER.low).toBe(2)
    })

    it('should have increasing order from high to low', () => {
      expect(PRIORITY_ORDER.high).toBeLessThan(PRIORITY_ORDER.medium)
      expect(PRIORITY_ORDER.medium).toBeLessThan(PRIORITY_ORDER.low)
    })
  })
})

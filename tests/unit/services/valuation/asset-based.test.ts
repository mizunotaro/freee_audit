import { describe, it, expect } from 'vitest'
import {
  calculateAssetBased,
  calculateAdjustedNetAssetValue,
  formatAssetBasedExplanation,
} from '@/services/valuation/asset-based'

describe('calculateAssetBased', () => {
  it('should calculate basic book value', function () {
    const result = calculateAssetBased({
      totalAssets: 1000,
      totalLiabilities: 400,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enterpriseValue).toBe(600)
      expect(result.data.metadata.bookValue).toBe(600)
      expect(result.data.steps.length).toBeGreaterThan(0)
    }
  })

  it('should subtract intangible assets', function () {
    const result = calculateAssetBased({
      totalAssets: 1000,
      totalLiabilities: 400,
      intangibleAssets: 100,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enterpriseValue).toBe(500)
      expect(result.data.metadata.adjustedBookValue).toBe(500)
    }
  })

  it('should apply adjustments', function () {
    const result = calculateAssetBased({
      totalAssets: 1000,
      totalLiabilities: 400,
      adjustments: [
        { name: 'Real estate revaluation', type: 'addition', amount: 200 },
        { name: 'Bad debt provision', type: 'deduction', amount: 50 },
      ],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enterpriseValue).toBe(750)
    }
  })

  it('should apply liquidation discount', function () {
    const result = calculateAssetBased({
      totalAssets: 1000,
      totalLiabilities: 400,
      liquidationDiscount: 20,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enterpriseValue).toBe(480)
      expect(result.data.metadata.liquidationValue).toBe(480)
    }
  })

  it('should handle all adjustments together', function () {
    const result = calculateAssetBased({
      totalAssets: 2000,
      totalLiabilities: 800,
      intangibleAssets: 200,
      adjustments: [
        { name: 'Asset revaluation', type: 'addition', amount: 300 },
        { name: 'Contingent liability', type: 'deduction', amount: 100 },
      ],
      liquidationDiscount: 10,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata.bookValue).toBe(1200)
      expect(result.data.metadata.adjustedBookValue).toBe(1200)
      expect(result.data.enterpriseValue).toBe(1080)
    }
  })

  it('should fail for zero or negative total assets', function () {
    const result = calculateAssetBased({
      totalAssets: 0,
      totalLiabilities: 100,
    })

    expect(result.success).toBe(false)
  })

  it('should fail for negative total assets', function () {
    const result = calculateAssetBased({
      totalAssets: -100,
      totalLiabilities: 50,
    })

    expect(result.success).toBe(false)
  })

  it('should fail for negative total liabilities', function () {
    const result = calculateAssetBased({
      totalAssets: 100,
      totalLiabilities: -50,
    })

    expect(result.success).toBe(false)
  })

  it('should fail for negative intangible assets', function () {
    const result = calculateAssetBased({
      totalAssets: 100,
      totalLiabilities: 50,
      intangibleAssets: -10,
    })

    expect(result.success).toBe(false)
  })

  it('should fail for invalid liquidation discount', function () {
    const result = calculateAssetBased({
      totalAssets: 100,
      totalLiabilities: 50,
      liquidationDiscount: 150,
    })

    expect(result.success).toBe(false)
  })

  it('should include calculation steps', function () {
    const result = calculateAssetBased({
      totalAssets: 1000,
      totalLiabilities: 400,
      intangibleAssets: 100,
      liquidationDiscount: 10,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.steps.length).toBeGreaterThanOrEqual(3)
      expect(result.data.steps[0].name).toContain('Book Value')
    }
  })

  it('should default currency to JPY', function () {
    const result = calculateAssetBased({
      totalAssets: 100,
      totalLiabilities: 50,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency).toBe('JPY')
    }
  })
})

describe('calculateAdjustedNetAssetValue', () => {
  it('should calculate from balance sheet components', function () {
    const result = calculateAdjustedNetAssetValue({
      currentAssets: 600,
      fixedAssets: 400,
      currentLiabilities: 200,
      longTermLiabilities: 200,
      assetRevaluations: [{ name: 'Land revaluation', type: 'addition', amount: 100 }],
      liabilityAdjustments: [],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata.bookValue).toBe(600)
      expect(result.data.enterpriseValue).toBe(700)
    }
  })

  it('should apply liability adjustments', function () {
    const result = calculateAdjustedNetAssetValue({
      currentAssets: 500,
      fixedAssets: 500,
      currentLiabilities: 200,
      longTermLiabilities: 200,
      assetRevaluations: [],
      liabilityAdjustments: [{ name: 'Hidden liability', type: 'deduction', amount: 50 }],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enterpriseValue).toBe(550)
    }
  })
})

describe('formatAssetBasedExplanation', () => {
  it('should format result as readable text', function () {
    const result = calculateAssetBased({
      totalAssets: 1000,
      totalLiabilities: 400,
      liquidationDiscount: 10,
    })

    if (result.success) {
      const text = formatAssetBasedExplanation(result.data)

      expect(text).toContain('Asset-Based Valuation Summary')
      expect(text).toContain('Enterprise Value')
      expect(text).toContain('Book Value')
      expect(text).toContain('Liquidation Value')
    }
  })
})

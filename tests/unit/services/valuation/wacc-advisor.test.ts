import { describe, it, expect } from 'vitest'
import { getWACCAdvice, formatWACCAdvice } from '@/services/valuation/wacc-advisor'

describe('getWACCAdvice', () => {
  it('returns advice for software industry', () => {
    const result = getWACCAdvice({ industry: 'software' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('software')
      expect(result.data.confidence).toBeDefined()
      expect(result.data.recommendedValues.riskFreeRate).toBeDefined()
      expect(result.data.recommendedValues.marketRiskPremium).toBeDefined()
      expect(result.data.recommendedValues.beta).toBeDefined()
      expect(result.data.recommendedValues.costOfDebt).toBeDefined()
      expect(result.data.recommendedValues.taxRate).toBeDefined()
      expect(result.data.recommendedValues.debtRatio).toBeDefined()
    }
  })

  it('returns advice for saas industry', () => {
    const result = getWACCAdvice({ industry: 'saas' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('saas')
      expect(result.data.beta.unleveredBeta).toBeDefined()
      expect(result.data.beta.comparableCompanies).toBeDefined()
    }
  })

  it('returns advice for manufacturing industry', () => {
    const result = getWACCAdvice({ industry: 'manufacturing' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('manufacturing')
    }
  })

  it('returns advice for retail industry', () => {
    const result = getWACCAdvice({ industry: 'retail' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('retail')
    }
  })

  it('returns advice for financial industry', () => {
    const result = getWACCAdvice({ industry: 'financial' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('financial')
    }
  })

  it('returns advice for healthcare industry', () => {
    const result = getWACCAdvice({ industry: 'healthcare' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('healthcare')
    }
  })

  it('returns advice for energy industry', () => {
    const result = getWACCAdvice({ industry: 'energy' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('energy')
    }
  })

  it('returns advice for real_estate industry', () => {
    const result = getWACCAdvice({ industry: 'real_estate' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('real_estate')
    }
  })

  it('uses default industry for unknown industry', () => {
    const result = getWACCAdvice({ industry: 'unknown_industry_xyz' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('default')
    }
  })

  it('normalizes Japanese industry names', () => {
    const result = getWACCAdvice({ industry: '情報通信' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('software')
    }
  })

  it('normalizes Japanese manufacturing name', () => {
    const result = getWACCAdvice({ industry: '製造' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('manufacturing')
    }
  })

  it('normalizes various IT aliases', () => {
    const itResult = getWACCAdvice({ industry: 'IT' })
    const techResult = getWACCAdvice({ industry: 'tech' })
    expect(itResult.success && itResult.data.industry).toBe('software')
    expect(techResult.success && techResult.data.industry).toBe('software')
  })

  it('normalizes pharma to healthcare', () => {
    const result = getWACCAdvice({ industry: 'pharma' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('healthcare')
    }
  })

  it('normalizes cloud to saas', () => {
    const result = getWACCAdvice({ industry: 'cloud' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBe('saas')
    }
  })

  it('rejects empty industry', () => {
    const result = getWACCAdvice({ industry: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('invalid_input')
      expect(result.error.message).toContain('Industry')
    }
  })

  it('rejects whitespace-only industry', () => {
    const result = getWACCAdvice({ industry: '   ' })
    expect(result.success).toBe(false)
  })

  it('applies size premium for small companies', () => {
    const smallResult = getWACCAdvice({ industry: 'software', companySize: 'small' })
    const midResult = getWACCAdvice({ industry: 'software', companySize: 'mid' })
    if (smallResult.success && midResult.success) {
      expect(smallResult.data.recommendedValues.marketRiskPremium).toBeGreaterThan(
        midResult.data.recommendedValues.marketRiskPremium
      )
    }
  })

  it('applies size discount for large companies', () => {
    const largeResult = getWACCAdvice({ industry: 'software', companySize: 'large' })
    const midResult = getWACCAdvice({ industry: 'software', companySize: 'mid' })
    if (largeResult.success && midResult.success) {
      expect(largeResult.data.recommendedValues.marketRiskPremium).toBeLessThan(
        midResult.data.recommendedValues.marketRiskPremium
      )
    }
  })

  it('applies rating adjustment', () => {
    const ratedResult = getWACCAdvice({ industry: 'software', hasRating: true })
    const unratedResult = getWACCAdvice({ industry: 'software', hasRating: false })
    if (ratedResult.success && unratedResult.success) {
      expect(ratedResult.data.recommendedValues.costOfDebt).toBeLessThan(
        unratedResult.data.recommendedValues.costOfDebt
      )
    }
  })

  it('uses custom D/E ratio', () => {
    const result = getWACCAdvice({ industry: 'software', debtEquityRatio: 0.5 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.beta.suggestedLeveredBeta).toBeDefined()
    }
  })

  it('uses custom tax rate', () => {
    const result = getWACCAdvice({ industry: 'software', taxRate: 25 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.taxRate.suggested).toBe(25)
    }
  })

  it('uses statutory tax rate when not provided', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.taxRate.suggested).toBeCloseTo(30.62, 1)
    }
  })

  it('returns high confidence with known industry, rating, and D/E', () => {
    const result = getWACCAdvice({
      industry: 'software',
      hasRating: true,
      debtEquityRatio: 0.3,
    })
    if (result.success) {
      expect(result.data.confidence).toBe('high')
    }
  })

  it('returns medium confidence with known industry only', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.confidence).toBe('medium')
    }
  })

  it('returns low confidence with unknown industry and no extras', () => {
    const result = getWACCAdvice({ industry: 'xyz_unknown' })
    if (result.success) {
      expect(result.data.confidence).toBe('low')
    }
  })

  it('includes advice array with 3 items', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.advice).toHaveLength(3)
      expect(result.data.advice.map((a) => a.parameter)).toEqual([
        'Risk-Free Rate',
        'Market Risk Premium',
        'Beta',
      ])
    }
  })

  it('includes comparable companies', () => {
    const result = getWACCAdvice({ industry: 'saas' })
    if (result.success) {
      expect(result.data.beta.comparableCompanies.length).toBeGreaterThan(0)
    }
  })

  it('includes optimal capital structure', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.optimalCapitalStructure.suggestedDERatio).toBeGreaterThan(0)
      expect(result.data.optimalCapitalStructure.rationale).toBeDefined()
    }
  })

  it('includes lastUpdated timestamp', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.lastUpdated).toBeDefined()
      expect(new Date(result.data.lastUpdated).getTime()).not.toBeNaN()
    }
  })

  it('risk-free rate within expected range', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.riskFreeRate.suggested).toBeGreaterThanOrEqual(0.5)
      expect(result.data.riskFreeRate.suggested).toBeLessThanOrEqual(1.2)
    }
  })

  it('cost of debt includes spread', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.costOfDebt.spreadOverRiskFree).toBeDefined()
      expect(result.data.costOfDebt.spreadOverRiskFree).toBeGreaterThan(0)
    }
  })

  it('tax rate includes statutory value', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(result.data.taxRate.statutory).toBeCloseTo(30.62, 1)
    }
  })

  it('warnings array is present', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      expect(Array.isArray(result.data.warnings)).toBe(true)
    }
  })
})

describe('formatWACCAdvice', () => {
  it('returns array of calculation steps', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      const steps = formatWACCAdvice(result.data)
      expect(steps).toHaveLength(5)
      expect(steps[0].name).toBe('Risk-Free Rate')
      expect(steps[1].name).toBe('Market Risk Premium')
      expect(steps[2].name).toBe('Beta (β)')
      expect(steps[3].name).toBe('Cost of Debt')
      expect(steps[4].name).toBe('Tax Rate')
    }
  })

  it('each step has required properties', () => {
    const result = getWACCAdvice({ industry: 'software' })
    if (result.success) {
      const steps = formatWACCAdvice(result.data)
      for (const step of steps) {
        expect(step).toHaveProperty('id')
        expect(step).toHaveProperty('name')
        expect(step).toHaveProperty('formula')
        expect(step).toHaveProperty('output')
        expect(step).toHaveProperty('unit')
      }
    }
  })
})

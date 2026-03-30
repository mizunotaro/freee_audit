import { describe, it, expect } from 'vitest'
import { calculateDCF, formatDCFExplanation, validateDCFInputs } from '@/services/valuation/dcf'

describe('calculateDCF', () => {
  const validInputs = {
    freeCashFlow: 1000,
    growthRate: 5,
    terminalGrowthRate: 2,
    discountRate: 10,
    projectionYears: 5,
  }

  it('calculates DCF with valid inputs', () => {
    const result = calculateDCF(validInputs)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enterpriseValue).toBeGreaterThan(0)
      expect(result.data.terminalValue).toBeGreaterThan(0)
      expect(result.data.terminalPV).toBeGreaterThan(0)
      expect(result.data.steps).toHaveLength(5)
      expect(result.data.metadata.method).toBe('dcf')
      expect(result.data.metadata.presentValues).toHaveLength(5)
      expect(result.data.currency).toBe('JPY')
      expect(result.data.unit).toBe('million')
    }
  })

  it('calculates correct enterprise value', () => {
    const result = calculateDCF(validInputs)
    if (result.success) {
      expect(result.data.enterpriseValue).toBeGreaterThan(10000)
      expect(result.data.enterpriseValue).toBeLessThan(20000)
    }
  })

  it('uses custom currency and unit', () => {
    const result = calculateDCF({ ...validInputs, currency: 'USD', unit: 'thousand' })
    if (result.success) {
      expect(result.data.currency).toBe('USD')
      expect(result.data.unit).toBe('thousand')
    }
  })

  it('rejects zero free cash flow', () => {
    const result = calculateDCF({ ...validInputs, freeCashFlow: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('invalid_input')
      expect(result.error.message).toContain('positive')
    }
  })

  it('rejects negative free cash flow', () => {
    const result = calculateDCF({ ...validInputs, freeCashFlow: -100 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('invalid_input')
    }
  })

  it('rejects growth rate <= -100%', () => {
    const result = calculateDCF({ ...validInputs, growthRate: -100 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('-100%')
    }
  })

  it('rejects terminal growth rate >= discount rate', () => {
    const result = calculateDCF({ ...validInputs, terminalGrowthRate: 10 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('Terminal growth rate')
    }
  })

  it('rejects projection years < 1', () => {
    const result = calculateDCF({ ...validInputs, projectionYears: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects projection years > 20', () => {
    const result = calculateDCF({ ...validInputs, projectionYears: 21 })
    expect(result.success).toBe(false)
  })

  it('rejects discount rate <= 0', () => {
    const result = calculateDCF({ ...validInputs, discountRate: 0 })
    expect(result.success).toBe(false)
  })

  it('works with single projection year', () => {
    const result = calculateDCF({ ...validInputs, projectionYears: 1 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.steps[0].children).toHaveLength(1)
    }
  })

  it('works with small negative growth rate', () => {
    const result = calculateDCF({ ...validInputs, growthRate: -0.5 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enterpriseValue).toBeGreaterThan(0)
    }
  })

  it('works with 20 projection years', () => {
    const result = calculateDCF({ ...validInputs, projectionYears: 20 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata.presentValues).toHaveLength(20)
    }
  })

  it('includes calculation steps with correct structure', () => {
    const result = calculateDCF(validInputs)
    if (result.success) {
      for (const step of result.data.steps) {
        expect(step).toHaveProperty('id')
        expect(step).toHaveProperty('name')
        expect(step).toHaveProperty('formula')
        expect(step).toHaveProperty('formulaWithValues')
        expect(step).toHaveProperty('output')
        expect(step).toHaveProperty('unit')
      }
    }
  })

  it('step 1 has children for each period', () => {
    const result = calculateDCF(validInputs)
    if (result.success) {
      expect(result.data.steps[0].children).toBeDefined()
      expect(result.data.steps[0].children).toHaveLength(5)
    }
  })
})

describe('formatDCFExplanation', () => {
  it('formats DCF result as string', () => {
    const result = calculateDCF({
      freeCashFlow: 1000,
      growthRate: 5,
      terminalGrowthRate: 2,
      discountRate: 10,
      projectionYears: 5,
    })
    if (result.success) {
      const explanation = formatDCFExplanation(result.data)
      expect(explanation).toContain('DCF Valuation Summary')
      expect(explanation).toContain('Enterprise Value')
      expect(explanation).toContain('Calculation Steps')
      expect(explanation).toContain('Terminal Value')
      expect(explanation).toContain('Present Values by Period')
    }
  })
})

describe('validateDCFInputs', () => {
  it('passes with valid inputs', () => {
    const result = validateDCFInputs({
      freeCashFlow: 1000,
      growthRate: 5,
      terminalGrowthRate: 2,
      discountRate: 10,
      projectionYears: 5,
    })
    expect(result.success).toBe(true)
  })

  it('fails with zero free cash flow', () => {
    const result = validateDCFInputs({
      freeCashFlow: 0,
      growthRate: 5,
      terminalGrowthRate: 2,
      discountRate: 10,
      projectionYears: 5,
    })
    expect(result.success).toBe(false)
  })

  it('fails with missing fields', () => {
    const result = validateDCFInputs({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('Free Cash Flow')
      expect(result.error.message).toContain('Growth rate')
      expect(result.error.message).toContain('Terminal growth rate')
      expect(result.error.message).toContain('Discount rate')
      expect(result.error.message).toContain('Projection years')
    }
  })

  it('fails when terminal growth rate >= discount rate', () => {
    const result = validateDCFInputs({
      freeCashFlow: 1000,
      growthRate: 5,
      terminalGrowthRate: 10,
      discountRate: 10,
      projectionYears: 5,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('Terminal growth rate must be less than discount rate')
    }
  })

  it('fails with growth rate at -100', () => {
    const result = validateDCFInputs({
      freeCashFlow: 1000,
      growthRate: -100,
      terminalGrowthRate: 2,
      discountRate: 10,
      projectionYears: 5,
    })
    expect(result.success).toBe(false)
  })

  it('fails with projection years out of range', () => {
    const result = validateDCFInputs({
      freeCashFlow: 1000,
      growthRate: 5,
      terminalGrowthRate: 2,
      discountRate: 10,
      projectionYears: 25,
    })
    expect(result.success).toBe(false)
  })

  it('returns multiple errors at once', () => {
    const result = validateDCFInputs({
      freeCashFlow: -1,
      discountRate: -1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain(';')
    }
  })
})

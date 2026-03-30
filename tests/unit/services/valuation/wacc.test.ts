import { describe, it, expect } from 'vitest'
import {
  calculateWACC,
  calculateLeveredBeta,
  calculateUnleveredBeta,
  formatWACCExplanation,
} from '@/services/valuation/wacc'

describe('calculateWACC', () => {
  describe('simple mode', () => {
    it('calculates WACC with simpleWACC input', () => {
      const result = calculateWACC({ simpleWACC: 8.5 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.wacc).toBeCloseTo(0.085, 3)
        expect(result.data.mode).toBe('simple')
        expect(result.data.steps).toHaveLength(1)
      }
    })

    it('calculates WACC with wacc input', () => {
      const result = calculateWACC({ wacc: 10 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.wacc).toBeCloseTo(0.1, 3)
      }
    })

    it('rejects missing WACC value', () => {
      const result = calculateWACC({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('required')
      }
    })

    it('rejects WACC <= 0', () => {
      const result = calculateWACC({ simpleWACC: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects WACC > 100', () => {
      const result = calculateWACC({ simpleWACC: 101 })
      expect(result.success).toBe(false)
    })

    it('accepts WACC at boundary 1', () => {
      const result = calculateWACC({ simpleWACC: 1 })
      expect(result.success).toBe(true)
    })

    it('accepts WACC at boundary 100', () => {
      const result = calculateWACC({ simpleWACC: 100 })
      expect(result.success).toBe(true)
    })
  })

  describe('detailed mode', () => {
    it('calculates detailed WACC with explicit detailed object', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: 1.0,
          marketRiskPremium: 6.0,
          beta: 1.2,
          costOfDebt: 3.0,
          taxRate: 30.0,
          debtRatio: 30.0,
          equityRatio: 70.0,
        },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.mode).toBe('detailed')
        expect(result.data.wacc).toBeGreaterThan(0)
        expect(result.data.wacc).toBeLessThan(1)
        expect(result.data.costOfEquity).toBeDefined()
        expect(result.data.costOfDebtAfterTax).toBeDefined()
        expect(result.data.components).toBeDefined()
        expect(result.data.steps).toHaveLength(5)
      }
    })

    it('calculates detailed WACC with flat inputs using defaults', () => {
      const result = calculateWACC({
        detailed: {
          riskFreeRate: 0.8,
          marketRiskPremium: 6.0,
          beta: 1.0,
          costOfDebt: 2.5,
          taxRate: 30.0,
          debtRatio: 25.0,
          equityRatio: 75.0,
        },
      })
      expect(result.success).toBe(true)
    })

    it('uses default values for flat inputs without detailed', () => {
      const result = calculateWACC({
        mode: 'detailed',
        riskFreeRate: 1.5,
        marketRiskPremium: 6.0,
        beta: 1.0,
        costOfDebt: 3.0,
        taxRate: 30.0,
        debtRatio: 30.0,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.mode).toBe('detailed')
      }
    })

    it('rejects negative risk-free rate', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: -1,
          marketRiskPremium: 6.0,
          beta: 1.0,
          costOfDebt: 3.0,
          taxRate: 30.0,
          debtRatio: 30.0,
          equityRatio: 70.0,
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-positive market risk premium', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: 1.0,
          marketRiskPremium: 0,
          beta: 1.0,
          costOfDebt: 3.0,
          taxRate: 30.0,
          debtRatio: 30.0,
          equityRatio: 70.0,
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-positive beta', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: 1.0,
          marketRiskPremium: 6.0,
          beta: 0,
          costOfDebt: 3.0,
          taxRate: 30.0,
          debtRatio: 30.0,
          equityRatio: 70.0,
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects tax rate out of range', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: 1.0,
          marketRiskPremium: 6.0,
          beta: 1.0,
          costOfDebt: 3.0,
          taxRate: 110,
          debtRatio: 30.0,
          equityRatio: 70.0,
        },
      })
      expect(result.success).toBe(false)
    })

    it('rejects debt + equity != 100', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: 1.0,
          marketRiskPremium: 6.0,
          beta: 1.0,
          costOfDebt: 3.0,
          taxRate: 30.0,
          debtRatio: 30.0,
          equityRatio: 60.0,
        },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('100%')
      }
    })

    it('verifies CAPM cost of equity calculation', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: 2.0,
          marketRiskPremium: 6.0,
          beta: 1.0,
          costOfDebt: 3.0,
          taxRate: 30.0,
          debtRatio: 0.0,
          equityRatio: 100.0,
        },
      })
      if (result.success) {
        expect(result.data.costOfEquity).toBeCloseTo(0.08, 3)
      }
    })

    it('verifies after-tax cost of debt', () => {
      const result = calculateWACC({
        mode: 'detailed',
        detailed: {
          riskFreeRate: 1.0,
          marketRiskPremium: 6.0,
          beta: 1.0,
          costOfDebt: 4.0,
          taxRate: 30.0,
          debtRatio: 50.0,
          equityRatio: 50.0,
        },
      })
      if (result.success) {
        expect(result.data.costOfDebtAfterTax).toBeCloseTo(0.028, 3)
      }
    })
  })
})

describe('calculateLeveredBeta', () => {
  it('calculates levered beta', () => {
    const result = calculateLeveredBeta({
      unleveredBeta: 1.0,
      debtEquityRatio: 0.5,
      taxRate: 30,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.leveredBeta).toBeCloseTo(1.35, 2)
      expect(result.data.steps).toHaveLength(1)
    }
  })

  it('returns unlevered beta when D/E is 0', () => {
    const result = calculateLeveredBeta({
      unleveredBeta: 1.2,
      debtEquityRatio: 0,
      taxRate: 30,
    })
    if (result.success) {
      expect(result.data.leveredBeta).toBeCloseTo(1.2, 2)
    }
  })

  it('rejects non-positive unlevered beta', () => {
    const result = calculateLeveredBeta({
      unleveredBeta: 0,
      debtEquityRatio: 0.5,
      taxRate: 30,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative D/E ratio', () => {
    const result = calculateLeveredBeta({
      unleveredBeta: 1.0,
      debtEquityRatio: -0.5,
      taxRate: 30,
    })
    expect(result.success).toBe(false)
  })

  it('rejects tax rate out of range', () => {
    const result = calculateLeveredBeta({
      unleveredBeta: 1.0,
      debtEquityRatio: 0.5,
      taxRate: 110,
    })
    expect(result.success).toBe(false)
  })
})

describe('calculateUnleveredBeta', () => {
  it('calculates unlevered beta', () => {
    const result = calculateUnleveredBeta({
      leveredBeta: 1.35,
      debtEquityRatio: 0.5,
      taxRate: 30,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unleveredBeta).toBeCloseTo(1.0, 2)
      expect(result.data.steps).toHaveLength(1)
    }
  })

  it('returns levered beta when D/E is 0', () => {
    const result = calculateUnleveredBeta({
      leveredBeta: 1.2,
      debtEquityRatio: 0,
      taxRate: 30,
    })
    if (result.success) {
      expect(result.data.unleveredBeta).toBeCloseTo(1.2, 2)
    }
  })

  it('rejects non-positive levered beta', () => {
    const result = calculateUnleveredBeta({
      leveredBeta: 0,
      debtEquityRatio: 0.5,
      taxRate: 30,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative D/E ratio', () => {
    const result = calculateUnleveredBeta({
      leveredBeta: 1.0,
      debtEquityRatio: -0.1,
      taxRate: 30,
    })
    expect(result.success).toBe(false)
  })

  it('round-trips with calculateLeveredBeta', () => {
    const original = { unleveredBeta: 1.15, debtEquityRatio: 0.4, taxRate: 25 }
    const levered = calculateLeveredBeta(original)
    if (levered.success) {
      const unlevered = calculateUnleveredBeta({
        leveredBeta: levered.data.leveredBeta,
        debtEquityRatio: 0.4,
        taxRate: 25,
      })
      if (unlevered.success) {
        expect(unlevered.data.unleveredBeta).toBeCloseTo(1.15, 5)
      }
    }
  })
})

describe('formatWACCExplanation', () => {
  it('formats simple WACC result', () => {
    const result = calculateWACC({ simpleWACC: 8.5 })
    if (result.success) {
      const explanation = formatWACCExplanation(result.data)
      expect(explanation).toContain('WACC Calculation Summary')
      expect(explanation).toContain('8.50%')
      expect(explanation).toContain('simple')
    }
  })

  it('formats detailed WACC result with components', () => {
    const result = calculateWACC({
      mode: 'detailed',
      detailed: {
        riskFreeRate: 1.0,
        marketRiskPremium: 6.0,
        beta: 1.2,
        costOfDebt: 3.0,
        taxRate: 30.0,
        debtRatio: 30.0,
        equityRatio: 70.0,
      },
    })
    if (result.success) {
      const explanation = formatWACCExplanation(result.data)
      expect(explanation).toContain('Components')
      expect(explanation).toContain('Cost of Equity')
      expect(explanation).toContain('Cost of Debt')
    }
  })
})

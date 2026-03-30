import { describe, it, expect } from 'vitest'
import {
  calculateBlackScholes,
  impliedVolatility,
  formatBlackScholesExplanation,
} from '@/services/valuation/black-scholes'

describe('calculateBlackScholes', () => {
  const callInputs = {
    spotPrice: 100,
    strikePrice: 100,
    timeToMaturity: 1,
    riskFreeRate: 5,
    volatility: 20,
    optionType: 'call' as const,
  }

  const putInputs = {
    ...callInputs,
    optionType: 'put' as const,
  }

  it('calculates call option value', () => {
    const result = calculateBlackScholes(callInputs)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.optionValue).toBeGreaterThan(0)
      expect(result.data.optionType).toBe('call')
      expect(result.data.steps).toHaveLength(4)
      expect(result.data.greeks.delta).toBeGreaterThan(0)
      expect(result.data.greeks.delta).toBeLessThan(1)
      expect(result.data.greeks.gamma).toBeGreaterThan(0)
      expect(result.data.greeks.vega).toBeGreaterThan(0)
      expect(result.data.greeks.rho).toBeGreaterThan(0)
    }
  })

  it('calculates put option value', () => {
    const result = calculateBlackScholes(putInputs)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.optionValue).toBeGreaterThan(0)
      expect(result.data.optionType).toBe('put')
      expect(result.data.greeks.delta).toBeLessThan(0)
      expect(result.data.greeks.rho).toBeLessThan(0)
    }
  })

  it('satisfies put-call parity (approximately)', () => {
    const callResult = calculateBlackScholes(callInputs)
    const putResult = calculateBlackScholes(putInputs)
    if (callResult.success && putResult.success) {
      const S = 100
      const K = 100
      const r = 0.05
      const T = 1
      const parityDiff =
        callResult.data.optionValue - putResult.data.optionValue - S + K * Math.exp(-r * T)
      expect(Math.abs(parityDiff)).toBeLessThan(0.5)
    }
  })

  it('handles dividend yield', () => {
    const result = calculateBlackScholes({ ...callInputs, dividendYield: 3 })
    expect(result.success).toBe(true)
    if (result.success) {
      const noDivResult = calculateBlackScholes(callInputs)
      if (noDivResult.success) {
        expect(result.data.optionValue).toBeLessThan(noDivResult.data.optionValue)
      }
    }
  })

  it('rejects zero spot price', () => {
    const result = calculateBlackScholes({ ...callInputs, spotPrice: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('Spot price')
    }
  })

  it('rejects negative spot price', () => {
    const result = calculateBlackScholes({ ...callInputs, spotPrice: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects zero strike price', () => {
    const result = calculateBlackScholes({ ...callInputs, strikePrice: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects zero time to maturity', () => {
    const result = calculateBlackScholes({ ...callInputs, timeToMaturity: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative time to maturity', () => {
    const result = calculateBlackScholes({ ...callInputs, timeToMaturity: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects zero volatility', () => {
    const result = calculateBlackScholes({ ...callInputs, volatility: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative risk-free rate', () => {
    const result = calculateBlackScholes({ ...callInputs, riskFreeRate: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects negative dividend yield', () => {
    const result = calculateBlackScholes({ ...callInputs, dividendYield: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts zero risk-free rate', () => {
    const result = calculateBlackScholes({ ...callInputs, riskFreeRate: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts zero dividend yield (default)', () => {
    const result = calculateBlackScholes({ ...callInputs, dividendYield: 0 })
    expect(result.success).toBe(true)
  })

  it('deep ITM call has value close to intrinsic', () => {
    const result = calculateBlackScholes({ ...callInputs, spotPrice: 200, strikePrice: 100 })
    if (result.success) {
      expect(result.data.optionValue).toBeGreaterThan(90)
    }
  })

  it('deep OTM call has small value', () => {
    const result = calculateBlackScholes({ ...callInputs, spotPrice: 50, strikePrice: 200 })
    if (result.success) {
      expect(result.data.optionValue).toBeLessThan(1)
    }
  })

  it('includes d1 and d2 in result', () => {
    const result = calculateBlackScholes(callInputs)
    if (result.success) {
      expect(typeof result.data.d1).toBe('number')
      expect(typeof result.data.d2).toBe('number')
      expect(result.data.d1).toBeGreaterThan(result.data.d2)
    }
  })

  it('calculates with short time to maturity', () => {
    const result = calculateBlackScholes({ ...callInputs, timeToMaturity: 0.01 })
    expect(result.success).toBe(true)
  })

  it('calculates with high volatility', () => {
    const result = calculateBlackScholes({ ...callInputs, volatility: 100 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.optionValue).toBeGreaterThan(0)
    }
  })
})

describe('impliedVolatility', () => {
  const baseInputs = {
    spotPrice: 100,
    strikePrice: 100,
    timeToMaturity: 1,
    riskFreeRate: 5,
    optionType: 'call' as const,
  }

  it('recovers known volatility', () => {
    const vol = 25
    const bsResult = calculateBlackScholes({ ...baseInputs, volatility: vol })
    if (bsResult.success) {
      const ivResult = impliedVolatility(bsResult.data.optionValue, baseInputs)
      expect(ivResult.success).toBe(true)
      if (ivResult.success) {
        expect(ivResult.data.impliedVol).toBeCloseTo(vol, 0)
      }
    }
  })

  it('returns iterations count', () => {
    const vol = 20
    const bsResult = calculateBlackScholes({ ...baseInputs, volatility: vol })
    if (bsResult.success) {
      const ivResult = impliedVolatility(bsResult.data.optionValue, baseInputs)
      if (ivResult.success) {
        expect(ivResult.data.iterations).toBeGreaterThan(0)
      }
    }
  })

  it('fails with invalid base inputs', () => {
    const ivResult = impliedVolatility(10, { ...baseInputs, spotPrice: 0 })
    expect(ivResult.success).toBe(false)
  })
})

describe('formatBlackScholesExplanation', () => {
  it('formats call option result', () => {
    const result = calculateBlackScholes({
      spotPrice: 100,
      strikePrice: 100,
      timeToMaturity: 1,
      riskFreeRate: 5,
      volatility: 20,
      optionType: 'call',
    })
    if (result.success) {
      const explanation = formatBlackScholesExplanation(result.data)
      expect(explanation).toContain('Black-Scholes')
      expect(explanation).toContain('CALL')
      expect(explanation).toContain('Greeks')
      expect(explanation).toContain('Delta')
      expect(explanation).toContain('Gamma')
      expect(explanation).toContain('Theta')
      expect(explanation).toContain('Vega')
      expect(explanation).toContain('Rho')
    }
  })

  it('formats put option result', () => {
    const result = calculateBlackScholes({
      spotPrice: 100,
      strikePrice: 100,
      timeToMaturity: 1,
      riskFreeRate: 5,
      volatility: 20,
      optionType: 'put',
    })
    if (result.success) {
      const explanation = formatBlackScholesExplanation(result.data)
      expect(explanation).toContain('PUT')
    }
  })
})

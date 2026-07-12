import { describe, it, expect } from 'vitest'
import { parseSafeNumber, safeDivide, clampNumber } from '@/lib/utils/safe-numbers'

describe('parseSafeNumber', () => {
  describe('number passthrough', () => {
    it('should return finite numbers unchanged', () => {
      expect(parseSafeNumber(100)).toEqual({ success: true, data: 100 })
      expect(parseSafeNumber(-50)).toEqual({ success: true, data: -50 })
      expect(parseSafeNumber(0)).toEqual({ success: true, data: 0 })
      expect(parseSafeNumber(0.001)).toEqual({ success: true, data: 0.001 })
    })
  })

  describe('string coercion', () => {
    it('should parse plain numeric strings', () => {
      expect(parseSafeNumber('100')).toEqual({ success: true, data: 100 })
      expect(parseSafeNumber('3.14')).toEqual({ success: true, data: 3.14 })
    })

    it('should strip halfwidth and fullwidth comma separators', () => {
      expect(parseSafeNumber('1,000')).toEqual({ success: true, data: 1000 })
      expect(parseSafeNumber('1，000')).toEqual({ success: true, data: 1000 })
      expect(parseSafeNumber('1,000,000')).toEqual({ success: true, data: 1000000 })
    })

    it('should convert fullwidth digits to halfwidth', () => {
      expect(parseSafeNumber('１００')).toEqual({ success: true, data: 100 })
      expect(parseSafeNumber('１，０００')).toEqual({ success: true, data: 1000 })
    })

    it('should use parseFloat leading-numeric semantics', () => {
      expect(parseSafeNumber('100abc')).toEqual({ success: true, data: 100 })
    })
  })

  describe('invalid inputs', () => {
    it('should fail for non-numeric strings', () => {
      expect(parseSafeNumber('abc').success).toBe(false)
      expect(parseSafeNumber('').success).toBe(false)
    })

    it('should fail for NaN and Infinity', () => {
      expect(parseSafeNumber(NaN).success).toBe(false)
      expect(parseSafeNumber(Infinity).success).toBe(false)
      expect(parseSafeNumber(-Infinity).success).toBe(false)
    })

    it('should fail for null, undefined, and objects', () => {
      expect(parseSafeNumber(null).success).toBe(false)
      expect(parseSafeNumber(undefined).success).toBe(false)
      expect(parseSafeNumber({}).success).toBe(false)
      expect(parseSafeNumber([100]).success).toBe(false)
    })

    it('should return an AppError with VALIDATION_ERROR code on failure', () => {
      const result = parseSafeNumber('abc')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBeTruthy()
        expect(result.error.timestamp).toBeInstanceOf(Date)
      }
    })
  })
})

describe('safeDivide', () => {
  it('should divide correctly', () => {
    expect(safeDivide(100, 50)).toEqual({ success: true, data: 2 })
    expect(safeDivide(50, 100)).toEqual({ success: true, data: 0.5 })
  })

  it('should handle negative and decimal results', () => {
    expect(safeDivide(-10, 2)).toEqual({ success: true, data: -5 })
    expect(safeDivide(7, 2)).toEqual({ success: true, data: 3.5 })
  })

  it('should fail for division by zero (epsilon=0)', () => {
    expect(safeDivide(100, 0).success).toBe(false)
    expect(safeDivide(100, -0).success).toBe(false)
  })

  it('should fail when denominator magnitude is within epsilon', () => {
    expect(safeDivide(100, 0.001, { epsilon: 0.01 }).success).toBe(false)
    expect(safeDivide(100, 0.01, { epsilon: 0.01 }).success).toBe(false)
  })

  it('should succeed when denominator magnitude exceeds epsilon', () => {
    expect(safeDivide(100, 0.02, { epsilon: 0.01 })).toEqual({ success: true, data: 5000 })
  })

  it('should fail for NaN or Infinity operands', () => {
    expect(safeDivide(NaN, 100).success).toBe(false)
    expect(safeDivide(100, NaN).success).toBe(false)
    expect(safeDivide(Infinity, 100).success).toBe(false)
  })

  it('should support percentage scaling', () => {
    expect(safeDivide(50, 100, { percentage: true })).toEqual({ success: true, data: 50 })
    expect(safeDivide(3, 4, { percentage: true })).toEqual({ success: true, data: 75 })
  })
})

describe('clampNumber', () => {
  it('should return value when within range', () => {
    expect(clampNumber(50, 0, 100)).toEqual({ success: true, data: 50 })
  })

  it('should clamp to min when below range', () => {
    expect(clampNumber(-10, 0, 100)).toEqual({ success: true, data: 0 })
  })

  it('should clamp to max when above range', () => {
    expect(clampNumber(150, 0, 100)).toEqual({ success: true, data: 100 })
  })

  it('should handle exact boundaries', () => {
    expect(clampNumber(0, 0, 100)).toEqual({ success: true, data: 0 })
    expect(clampNumber(100, 0, 100)).toEqual({ success: true, data: 100 })
  })

  it('should fail for NaN value', () => {
    expect(clampNumber(NaN, 0, 100).success).toBe(false)
    expect(clampNumber(Infinity, 0, 100).success).toBe(false)
  })

  it('should propagate NaN bounds (matches legacy clamp semantics)', () => {
    const result = clampNumber(5, NaN, 10)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Number.isNaN(result.data)).toBe(true)
    }
  })
})

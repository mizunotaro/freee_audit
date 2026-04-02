import { describe, it, expect, vi } from 'vitest'
import {
  sanitizeString,
  validateNumber,
  clamp,
  formatCurrency,
  safeDivide,
  generateCacheKey,
} from '@/lib/ai/input-suggestion/utils'

describe('sanitizeString', () => {
  it('should return empty string for falsy input', () => {
    expect(sanitizeString('')).toBe('')
  })

  it('should normalize to NFC', () => {
    const input = 'e\u0301'
    const result = sanitizeString(input)
    expect(result).toBe('\u00E9')
  })

  it('should remove control characters', () => {
    const input = 'hello\x00world\x07test'
    expect(sanitizeString(input)).toBe('helloworldtest')
  })

  it('should truncate to maxLength', () => {
    const input = 'a'.repeat(100)
    expect(sanitizeString(input, 50).length).toBe(50)
  })

  it('should use default maxLength of 10000', () => {
    const input = 'a'.repeat(11000)
    expect(sanitizeString(input).length).toBe(10000)
  })

  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })
})

describe('validateNumber', () => {
  it('should return undefined for undefined input', () => {
    expect(validateNumber(undefined)).toBeUndefined()
  })

  it('should return undefined for null input', () => {
    expect(validateNumber(null)).toBeUndefined()
  })

  it('should return undefined for non-finite numbers', () => {
    expect(validateNumber(Infinity)).toBeUndefined()
    expect(validateNumber(-Infinity)).toBeUndefined()
    expect(validateNumber(NaN)).toBeUndefined()
  })

  it('should convert string to number', () => {
    expect(validateNumber('42')).toBe(42)
  })

  it('should return valid number unchanged', () => {
    expect(validateNumber(42)).toBe(42)
    expect(validateNumber(3.14)).toBe(3.14)
  })

  it('should validate min constraint', () => {
    expect(validateNumber(3, { min: 5 })).toBeUndefined()
    expect(validateNumber(5, { min: 5 })).toBe(5)
    expect(validateNumber(10, { min: 5 })).toBe(10)
  })

  it('should validate max constraint', () => {
    expect(validateNumber(15, { max: 10 })).toBeUndefined()
    expect(validateNumber(10, { max: 10 })).toBe(10)
    expect(validateNumber(5, { max: 10 })).toBe(5)
  })

  it('should validate both min and max constraints', () => {
    expect(validateNumber(3, { min: 5, max: 10 })).toBeUndefined()
    expect(validateNumber(7, { min: 5, max: 10 })).toBe(7)
    expect(validateNumber(15, { min: 5, max: 10 })).toBeUndefined()
  })
})

describe('clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('should clamp to minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('should clamp to maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('should handle edge cases', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('formatCurrency', () => {
  it('should format large Japanese amounts in oku', () => {
    const result = formatCurrency(500000000, 'ja')
    expect(result).toContain('億')
  })

  it('should format medium Japanese amounts in man', () => {
    const result = formatCurrency(1000000, 'ja')
    expect(result).toContain('万円')
  })

  it('should format English amounts with dollar sign', () => {
    const result = formatCurrency(1000, 'en')
    expect(result).toContain('$')
  })

  it('should format exact 1 oku boundary', () => {
    const result = formatCurrency(100000000, 'ja')
    expect(result).toContain('億')
    expect(result).not.toContain('万')
  })

  it('should format just below 1 oku', () => {
    const result = formatCurrency(99999999, 'ja')
    expect(result).toContain('万')
  })
})

describe('safeDivide', () => {
  it('should divide normally', () => {
    expect(safeDivide(10, 2)).toBe(5)
  })

  it('should return 0 for division by zero', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(safeDivide(10, 0)).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith('Division by zero, returning 0')
    warnSpy.mockRestore()
  })

  it('should handle negative numbers', () => {
    expect(safeDivide(-10, 2)).toBe(-5)
  })

  it('should handle decimal results', () => {
    expect(safeDivide(7, 2)).toBe(3.5)
  })
})

describe('generateCacheKey', () => {
  it('should generate consistent keys for same data', () => {
    const data = { a: 1, b: 'test' }
    const key1 = generateCacheKey(data)
    const key2 = generateCacheKey(data)
    expect(key1).toBe(key2)
  })

  it('should generate different keys for different data', () => {
    const key1 = generateCacheKey({ a: 1 })
    const key2 = generateCacheKey({ a: 2 })
    expect(key1).not.toBe(key2)
  })

  it('should return a hex string', () => {
    const key = generateCacheKey({ test: 'data' })
    expect(key).toMatch(/^-?[0-9a-f]+$/)
  })

  it('should handle empty object', () => {
    const key = generateCacheKey({})
    expect(key).toBeTruthy()
  })

  it('should handle complex nested data', () => {
    const key = generateCacheKey({
      nested: { deep: { value: 123 } },
      arr: [1, 2, 3],
    })
    expect(key).toBeTruthy()
  })
})

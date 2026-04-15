import { describe, it, expect } from 'vitest'
import {
  validateString,
  validateNumber,
  validateDate,
  validateJsonObject,
  validateArray,
  sanitizeInput,
  DEFAULT_CONSTRAINTS,
} from '@/lib/ai/validation/input-validator'

describe('Input Validator', () => {
  describe('validateString', () => {
    it('should accept valid strings', () => {
      const result = validateString('hello world')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('hello world')
      }
    })

    it('should reject non-string input', () => {
      expect(validateString(123).success).toBe(false)
      expect(validateString(null).success).toBe(false)
      expect(validateString(undefined).success).toBe(false)
      expect(validateString({}).success).toBe(false)
    })

    it('should reject strings exceeding max length', () => {
      const longString = 'a'.repeat(101)
      const result = validateString(longString, 100)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('STRING_TOO_LONG')
      }
    })

    it('should reject empty/whitespace-only strings', () => {
      expect(validateString('').success).toBe(false)
      expect(validateString('   ').success).toBe(false)
      expect(validateString('\t\n').success).toBe(false)
    })

    it('should normalize unicode to NFC', () => {
      const nfd = '\u0041\u030A' // Å in NFD
      const result = validateString(nfd)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('\u00C5') // Å in NFC
      }
    })

    it('should strip control characters', () => {
      const result = validateString('hello\x00\x01world')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('helloworld')
      }
    })
  })

  describe('validateNumber', () => {
    it('should accept valid numbers', () => {
      const result = validateNumber(42.567)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(42.57)
      }
    })

    it('should reject non-numbers', () => {
      expect(validateNumber('42').success).toBe(false)
      expect(validateNumber(null).success).toBe(false)
      expect(validateNumber(NaN).success).toBe(false)
    })

    it('should reject Infinity', () => {
      expect(validateNumber(Infinity).success).toBe(false)
      expect(validateNumber(-Infinity).success).toBe(false)
    })

    it('should enforce min/max bounds', () => {
      const tooSmall = validateNumber(5, { min: 10 })
      expect(tooSmall.success).toBe(false)
      if (!tooSmall.success) expect(tooSmall.error.code).toBe('NUMBER_TOO_SMALL')

      const tooLarge = validateNumber(100, { max: 50 })
      expect(tooLarge.success).toBe(false)
      if (!tooLarge.success) expect(tooLarge.error.code).toBe('NUMBER_TOO_LARGE')
    })

    it('should round to specified precision', () => {
      const result = validateNumber(3.14159, { precision: 4 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(3.1416)
      }
    })

    it('should handle zero and negative numbers', () => {
      expect(validateNumber(0).success).toBe(true)
      expect(validateNumber(-42).success).toBe(true)
    })
  })

  describe('validateDate', () => {
    it('should accept valid date strings', () => {
      const result = validateDate('2024-06-15')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('2024-06-15')
      }
    })

    it('should accept Date objects', () => {
      const result = validateDate(new Date('2024-01-01'))
      expect(result.success).toBe(true)
    })

    it('should reject invalid date formats', () => {
      expect(validateDate('not-a-date').success).toBe(false)
    })

    it('should reject non-string/non-Date input', () => {
      expect(validateDate(123).success).toBe(false)
      expect(validateDate(null).success).toBe(false)
    })

    it('should enforce date range', () => {
      const tooOld = validateDate('1800-01-01')
      expect(tooOld.success).toBe(false)
      if (!tooOld.success) expect(tooOld.error.code).toBe('DATE_OUT_OF_RANGE')

      const tooFuture = validateDate('2200-01-01')
      expect(tooFuture.success).toBe(false)
    })

    it('should respect custom date range', () => {
      const result = validateDate('2023-06-15', {
        minDate: new Date('2024-01-01'),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('validateJsonObject', () => {
    it('should accept valid objects', () => {
      const result = validateJsonObject({ key: 'value' })
      expect(result.success).toBe(true)
    })

    it('should reject non-objects', () => {
      expect(validateJsonObject(null).success).toBe(false)
      expect(validateJsonObject('string').success).toBe(false)
      expect(validateJsonObject(42).success).toBe(false)
    })

    it('should reject arrays', () => {
      expect(validateJsonObject([1, 2, 3]).success).toBe(false)
    })

    it('should reject objects with too many keys', () => {
      const bigObj: Record<string, number> = {}
      for (let i = 0; i < 1001; i++) {
        bigObj[`key_${i}`] = i
      }
      const result = validateJsonObject(bigObj)
      expect(result.success).toBe(false)
    })

    it('should reject prohibited keys', () => {
      const obj = Object.create(null)
      obj['constructor'] = 'malicious'
      const result = validateJsonObject(obj)
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('PROHIBITED_KEY')
    })

    it('should enforce max depth', () => {
      const result = validateJsonObject({}, DEFAULT_CONSTRAINTS, 11)
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('MAX_DEPTH_EXCEEDED')
    })
  })

  describe('validateArray', () => {
    it('should accept valid arrays', () => {
      const result = validateArray([1, 2, 3])
      expect(result.success).toBe(true)
    })

    it('should reject non-arrays', () => {
      expect(validateArray('not array').success).toBe(false)
      expect(validateArray({}).success).toBe(false)
    })

    it('should reject arrays exceeding max length', () => {
      const bigArray = new Array(10001).fill(0)
      const result = validateArray(bigArray)
      expect(result.success).toBe(false)
    })

    it('should accept empty arrays', () => {
      expect(validateArray([]).success).toBe(true)
    })
  })

  describe('sanitizeInput', () => {
    it('should remove control characters', () => {
      expect(sanitizeInput('hello\x00world')).toBe('helloworld')
    })

    it('should truncate to max length', () => {
      expect(sanitizeInput('abcdef', 3)).toBe('abc')
    })

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello')
    })
  })
})

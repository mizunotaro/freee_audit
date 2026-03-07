import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeObject,
  validateEmail,
  validateUUID,
  validateNumericString,
  validateDateString,
  truncateString,
  sanitizeFileName,
  sanitizeHtml,
  escapeRegex,
  createValidator,
  commonSchemas,
} from '@/lib/security/input-sanitizer'
import { z } from 'zod'

describe('Input Sanitizer', () => {
  describe('sanitizeString', () => {
    it('should detect and remove script tags', () => {
      const result = sanitizeString('<script>alert("xss")</script>')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect javascript: protocol', () => {
      const result = sanitizeString('javascript:alert(1)')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect event handlers', () => {
      const result = sanitizeString('<img onerror="alert(1)">')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect vbscript: protocol', () => {
      const result = sanitizeString('vbscript:msgbox(1)')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect data:text/html', () => {
      const result = sanitizeString('data:text/html,<script>alert(1)</script>')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect expression() CSS injection', () => {
      const result = sanitizeString('width: expression(alert(1))')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect SQL injection patterns', () => {
      const result = sanitizeString("SELECT * FROM users WHERE '1'='1'")
      expect(result.threats.some((t) => t.includes('SQL'))).toBe(true)
    })

    it('should detect DROP TABLE keyword', () => {
      const result = sanitizeString("'; DROP TABLE users; --")
      expect(result.threats.length).toBeGreaterThan(0)
    })

    it('should detect UNION injection', () => {
      const result = sanitizeString('1 UNION SELECT * FROM users--')
      expect(result.threats.some((t) => t.includes('SQL'))).toBe(true)
    })

    it('should detect SQL comment patterns in context', () => {
      const result = sanitizeString('1 OR 1=1--')
      expect(result.isValid).toBe(false)
    })

    it('should detect OR 1=1 injection', () => {
      const result = sanitizeString("' OR 1=1--")
      expect(result.threats.some((t) => t.includes('SQL'))).toBe(true)
    })

    it('should detect path traversal', () => {
      const result = sanitizeString('../../../etc/passwd')
      expect(result.threats.some((t) => t.includes('traversal'))).toBe(true)
    })

    it('should detect URL encoded path traversal', () => {
      const result = sanitizeString('%2e%2e%2fetc%2fpasswd')
      expect(result.threats.some((t) => t.includes('traversal'))).toBe(true)
    })

    it('should return valid for clean input', () => {
      const result = sanitizeString('Normal text input')
      expect(result.isValid).toBe(true)
      expect(result.threats).toHaveLength(0)
    })

    it('should escape HTML entities in sanitized output', () => {
      const result = sanitizeString('<div>content</div>')
      expect(result.sanitized).toContain('&lt;')
      expect(result.sanitized).toContain('&gt;')
    })

    it('should escape quotes', () => {
      const result = sanitizeString('test"value')
      expect(result.sanitized).toContain('&quot;')
    })

    it('should escape single quotes', () => {
      const result = sanitizeString("test'value")
      expect(result.sanitized).toContain('&#x27;')
    })

    it('should escape forward slashes', () => {
      const result = sanitizeString('test/value')
      expect(result.sanitized).toContain('&#x2F;')
    })

    it('should handle empty string', () => {
      const result = sanitizeString('')
      expect(result.isValid).toBe(true)
      expect(result.sanitized).toBe('')
    })

    it('should handle multiple threats', () => {
      const result = sanitizeString("<script>alert(1)</script> OR '1'='1' ../../../etc/passwd")
      expect(result.threats.length).toBeGreaterThan(1)
    })
  })

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const obj = { name: '<script>alert(1)</script>' }
      const result = sanitizeObject(obj)
      expect(result.name).not.toContain('<script>')
    })

    it('should preserve non-string values', () => {
      const obj = { count: 42, active: true, name: 'test' }
      const result = sanitizeObject(obj)
      expect(result.count).toBe(42)
      expect(result.active).toBe(true)
      expect(result.name).toBe('test')
    })

    it('should sanitize nested objects', () => {
      const obj = {
        user: {
          name: '<script>alert(1)</script>',
          email: 'test@test.com',
        },
      }
      const result = sanitizeObject(obj)
      expect(result.user.name).not.toContain('<script>')
    })

    it('should handle null values', () => {
      const obj = { value: null }
      const result = sanitizeObject(obj)
      expect(result.value).toBeNull()
    })

    it('should handle arrays in objects (converts to object)', () => {
      const obj = { items: ['a', 'b', 'c'] }
      const result = sanitizeObject(obj)
      expect(result.items).toEqual({ '0': 'a', '1': 'b', '2': 'c' })
    })
  })

  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.jp')).toBe(true)
      expect(validateEmail('user+tag@example.org')).toBe(true)
    })

    it('should reject invalid email format', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('user @domain.com')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(validateEmail('')).toBe(false)
    })
  })

  describe('validateUUID', () => {
    it('should validate correct UUID format', () => {
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
      expect(validateUUID('00000000-0000-0000-0000-000000000000')).toBe(true)
    })

    it('should reject invalid UUID format', () => {
      expect(validateUUID('not-a-uuid')).toBe(false)
      expect(validateUUID('12345')).toBe(false)
      expect(validateUUID('123e4567-e89b-12d3-a456')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(validateUUID('')).toBe(false)
    })
  })

  describe('validateNumericString', () => {
    it('should validate numeric strings', () => {
      expect(validateNumericString('123')).toBe(true)
      expect(validateNumericString('123.45')).toBe(true)
      expect(validateNumericString('0')).toBe(true)
    })

    it('should reject non-numeric strings', () => {
      expect(validateNumericString('abc')).toBe(false)
      expect(validateNumericString('12abc34')).toBe(false)
      expect(validateNumericString('')).toBe(false)
    })

    it('should reject negative numbers', () => {
      expect(validateNumericString('-123')).toBe(false)
    })
  })

  describe('validateDateString', () => {
    it('should validate ISO date string', () => {
      expect(validateDateString('2024-01-15T00:00:00.000Z')).toBe(true)
      expect(validateDateString('2024-01-15T12:30:45.123Z')).toBe(true)
    })

    it('should validate YYYY-MM-DD format', () => {
      expect(validateDateString('2024-01-15')).toBe(true)
      expect(validateDateString('2024-12-31')).toBe(true)
    })

    it('should reject invalid date format', () => {
      expect(validateDateString('15/01/2024')).toBe(false)
      expect(validateDateString('2024-13-01')).toBe(false)
      expect(validateDateString('2024-01-32')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(validateDateString('')).toBe(false)
    })
  })

  describe('truncateString', () => {
    it('should truncate long strings', () => {
      const result = truncateString('This is a very long string', 10)
      expect(result).toBe('This is a ')
    })

    it('should not modify short strings', () => {
      const result = truncateString('Short', 10)
      expect(result).toBe('Short')
    })

    it('should handle exact length strings', () => {
      const result = truncateString('Exactly10', 8)
      expect(result).toBe('Exactly1')
    })

    it('should handle empty string', () => {
      const result = truncateString('', 10)
      expect(result).toBe('')
    })
  })

  describe('sanitizeFileName', () => {
    it('should remove special characters', () => {
      const result = sanitizeFileName('file<>:"/\\|?*.txt')
      expect(result).not.toMatch(/[<>:"/\\|?*]/)
    })

    it('should limit length to 255 characters', () => {
      const longName = 'a'.repeat(300)
      const result = sanitizeFileName(longName)
      expect(result.length).toBeLessThanOrEqual(255)
    })

    it('should replace multiple dots', () => {
      const result = sanitizeFileName('file....txt')
      expect(result).not.toContain('....')
    })

    it('should preserve alphanumeric characters, dots, underscores, and hyphens', () => {
      const result = sanitizeFileName('file-name_123.txt')
      expect(result).toBe('file-name_123.txt')
    })

    it('should handle empty string', () => {
      const result = sanitizeFileName('')
      expect(result).toBe('')
    })
  })

  describe('sanitizeHtml', () => {
    it('should escape all HTML special characters', () => {
      const result = sanitizeHtml('<script>"alert"&\'test\'</script>')
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
      expect(result).toContain('&quot;')
      expect(result).toContain('&amp;')
    })

    it('should escape ampersand first', () => {
      const result = sanitizeHtml('test & data')
      expect(result).toBe('test &amp; data')
    })

    it('should handle string with no special characters', () => {
      const result = sanitizeHtml('normal text')
      expect(result).toBe('normal text')
    })

    it('should handle empty string', () => {
      const result = sanitizeHtml('')
      expect(result).toBe('')
    })
  })

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const result = escapeRegex('test.*+?^${}()|[]\\')
      expect(result).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
    })

    it('should handle string with no special characters', () => {
      const result = escapeRegex('normal text')
      expect(result).toBe('normal text')
    })

    it('should escape dots', () => {
      const result = escapeRegex('file.txt')
      expect(result).toBe('file\\.txt')
    })

    it('should handle empty string', () => {
      const result = escapeRegex('')
      expect(result).toBe('')
    })
  })

  describe('createValidator', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    })

    it('should validate correct data', () => {
      const validator = createValidator(schema)
      const result = validator.validate({ name: 'Test', age: 25 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'Test', age: 25 })
      }
    })

    it('should return errors for invalid data', () => {
      const validator = createValidator(schema)
      const result = validator.validate({ name: '', age: -1 })
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should throw on parse with invalid data', () => {
      const validator = createValidator(schema)
      expect(() => validator.parse({ name: '', age: -1 })).toThrow()
    })

    it('should parse valid data', () => {
      const validator = createValidator(schema)
      const result = validator.parse({ name: 'Test', age: 25 })
      expect(result).toEqual({ name: 'Test', age: 25 })
    })

    it('should safeParse return success for valid data', () => {
      const validator = createValidator(schema)
      const result = validator.safeParse({ name: 'Test', age: 25 })
      expect(result.success).toBe(true)
    })

    it('should safeParse return error for invalid data', () => {
      const validator = createValidator(schema)
      const result = validator.safeParse({ name: '', age: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('commonSchemas', () => {
    it('should validate email schema', () => {
      expect(commonSchemas.email.safeParse('test@example.com').success).toBe(true)
      expect(commonSchemas.email.safeParse('invalid').success).toBe(false)
    })

    it('should validate password schema', () => {
      expect(commonSchemas.password.safeParse('password123').success).toBe(true)
      expect(commonSchemas.password.safeParse('short').success).toBe(false)
    })

    it('should validate uuid schema', () => {
      expect(commonSchemas.uuid.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(
        true
      )
      expect(commonSchemas.uuid.safeParse('invalid').success).toBe(false)
    })

    it('should validate positiveNumber schema', () => {
      expect(commonSchemas.positiveNumber.safeParse(1).success).toBe(true)
      expect(commonSchemas.positiveNumber.safeParse(0).success).toBe(false)
      expect(commonSchemas.positiveNumber.safeParse(-1).success).toBe(false)
    })

    it('should validate nonNegativeNumber schema', () => {
      expect(commonSchemas.nonNegativeNumber.safeParse(1).success).toBe(true)
      expect(commonSchemas.nonNegativeNumber.safeParse(0).success).toBe(true)
      expect(commonSchemas.nonNegativeNumber.safeParse(-1).success).toBe(false)
    })

    it('should validate dateString schema', () => {
      expect(commonSchemas.dateString.safeParse('2024-01-15').success).toBe(true)
      expect(commonSchemas.dateString.safeParse('2024/01/15').success).toBe(false)
    })

    it('should validate companyName schema', () => {
      expect(commonSchemas.companyName.safeParse('Test Company').success).toBe(true)
      expect(commonSchemas.companyName.safeParse('').success).toBe(false)
    })

    it('should validate currencyCode schema', () => {
      expect(commonSchemas.currencyCode.safeParse('JPY').success).toBe(true)
      expect(commonSchemas.currencyCode.safeParse('CAD').success).toBe(false)
    })
  })
})

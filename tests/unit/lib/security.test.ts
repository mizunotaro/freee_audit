import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  validateEmail,
  validateUUID,
  validateDateString,
  truncateString,
  sanitizeFileName,
  sanitizeHtml,
  escapeRegex,
  createValidator,
} from '@/lib/security/input-sanitizer'
import { z } from 'zod'

describe('Security Module', () => {
  describe('sanitizeString', () => {
    it('should detect XSS patterns', () => {
      const result = sanitizeString('<script>alert("xss")</script>')
      expect(result.threats.length).toBeGreaterThan(0)
    })

    it('should detect javascript: protocol', () => {
      const result = sanitizeString('javascript:alert(1)')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect event handlers', () => {
      const result = sanitizeString('<img onerror="alert(1)">')
      expect(result.threats.some((t) => t.includes('XSS'))).toBe(true)
    })

    it('should detect SQL injection patterns', () => {
      const result = sanitizeString("SELECT * FROM users WHERE '1'='1'")
      expect(result.threats.some((t) => t.includes('SQL'))).toBe(true)
    })

    it('should detect path traversal', () => {
      const result = sanitizeString('../../../etc/passwd')
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
  })

  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.jp')).toBe(true)
    })

    it('should reject invalid email format', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
    })
  })

  describe('validateUUID', () => {
    it('should validate correct UUID format', () => {
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    })

    it('should reject invalid UUID format', () => {
      expect(validateUUID('not-a-uuid')).toBe(false)
      expect(validateUUID('12345')).toBe(false)
    })
  })

  describe('validateDateString', () => {
    it('should validate ISO date string', () => {
      expect(validateDateString('2024-01-15T00:00:00.000Z')).toBe(true)
    })

    it('should validate YYYY-MM-DD format', () => {
      expect(validateDateString('2024-01-15')).toBe(true)
    })

    it('should reject invalid date format', () => {
      expect(validateDateString('15/01/2024')).toBe(false)
      expect(validateDateString('2024-13-01')).toBe(false)
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
  })

  describe('sanitizeHtml', () => {
    it('should escape all HTML special characters', () => {
      const result = sanitizeHtml('<script>"alert"&\'test\'</script>')
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
      expect(result).toContain('&quot;')
      expect(result).toContain('&amp;')
    })
  })

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const result = escapeRegex('test.*+?^${}()|[]\\')
      expect(result).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
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
    })

    it('should return errors for invalid data', () => {
      const validator = createValidator(schema)
      const result = validator.validate({ name: '', age: -1 })
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })
})

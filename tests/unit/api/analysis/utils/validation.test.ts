import { validateWithSchema, parseJsonSafely } from '@/app/api/analysis/utils/validation'
import { z } from 'zod'

describe('Validation Utility', () => {
  describe('parseJsonSafely', () => {
    it('should parse valid JSON', () => {
      const result = parseJsonSafely('{"name": "test", "value": 123}')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'test', value: 123 })
      }
    })

    it('should return error for invalid JSON', () => {
      const result = parseJsonSafely('{"invalid": json}')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('JSON')
      }
    })

    it('should handle empty string', () => {
      const result = parseJsonSafely('')

      expect(result.success).toBe(false)
    })

    it('should handle null input', () => {
      const result = parseJsonSafely('null')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeNull()
      }
    })

    it('should handle array input', () => {
      const result = parseJsonSafely('[1, 2, 3]')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3])
      }
    })
  })

  describe('validateWithSchema', () => {
    const TestSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
      email: z.string().email().optional(),
    })

    it('should validate valid input', () => {
      const input = { name: 'John', age: 30 }

      const result = validateWithSchema(input, TestSchema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('John')
        expect(result.data.age).toBe(30)
      }
    })

    it('should validate input with optional fields', () => {
      const input = { name: 'Jane', age: 25, email: 'jane@example.com' }

      const result = validateWithSchema(input, TestSchema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('jane@example.com')
      }
    })

    it('should return error for missing required fields', () => {
      const input = { age: 30 }

      const result = validateWithSchema(input, TestSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return error for invalid field type', () => {
      const input = { name: 'John', age: 'thirty' }

      const result = validateWithSchema(input, TestSchema)

      expect(result.success).toBe(false)
    })

    it('should return error for invalid email format', () => {
      const input = { name: 'John', age: 30, email: 'invalid-email' }

      const result = validateWithSchema(input, TestSchema)

      expect(result.success).toBe(false)
    })

    it('should return error for negative age', () => {
      const input = { name: 'John', age: -5 }

      const result = validateWithSchema(input, TestSchema)

      expect(result.success).toBe(false)
    })

    it('should handle extra fields', () => {
      const input = { name: 'John', age: 30, extra: 'field' }

      const result = validateWithSchema(input, TestSchema)

      expect(result.success).toBe(true)
    })
  })
})

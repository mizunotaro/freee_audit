import { sanitizeInput, sanitizeForLog, maskSensitive } from '@/app/api/analysis/utils/sanitizer'

describe('Sanitizer Utility', () => {
  describe('sanitizeInput', () => {
    it('should remove control characters', () => {
      const input = 'hello\x00world\x1Ftest\x7F'

      const result = sanitizeInput(input)

      expect(result).toBe('helloworldtest')
    })

    it('should trim whitespace', () => {
      const input = '  hello world  '

      const result = sanitizeInput(input)

      expect(result).toBe('hello world')
    })

    it('should truncate to maxLength', () => {
      const input = 'hello world'

      const result = sanitizeInput(input, 5)

      expect(result).toBe('hello')
    })

    it('should handle empty string', () => {
      const result = sanitizeInput('')

      expect(result).toBe('')
    })

    it('should preserve normal characters', () => {
      const input = 'Hello, World! 123 @#$%^&*()'

      const result = sanitizeInput(input)

      expect(result).toBe(input)
    })
  })

  describe('sanitizeForLog', () => {
    it('should mask sensitive keys', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      }

      const result = sanitizeForLog(input)

      expect(result.username).toBe('john')
      expect(result.password).toBe('[REDACTED]')
      expect(result.email).toBe('john@example.com')
    })

    it('should mask apiKey', () => {
      const input = {
        apiKey: 'sk-1234567890',
      }

      const result = sanitizeForLog(input)

      expect(result.apiKey).toBe('[REDACTED]')
    })

    it('should mask token', () => {
      const input = {
        accessToken: 'bearer-token',
        refreshToken: 'refresh-token',
      }

      const result = sanitizeForLog(input)

      expect(result.accessToken).toBe('[REDACTED]')
      expect(result.refreshToken).toBe('[REDACTED]')
    })

    it('should mask secret', () => {
      const input = {
        clientSecret: 'my-secret',
      }

      const result = sanitizeForLog(input)

      expect(result.clientSecret).toBe('[REDACTED]')
    })

    it('should preserve non-sensitive values', () => {
      const input = {
        name: 'John',
        age: 30,
        active: true,
      }

      const result = sanitizeForLog(input)

      expect(result).toEqual(input)
    })

    it('should handle empty object', () => {
      const result = sanitizeForLog({})

      expect(result).toEqual({})
    })
  })

  describe('maskSensitive', () => {
    it('should mask middle of string', () => {
      const result = maskSensitive('1234567890abcdef')

      expect(result).toBe('1234****cdef')
    })

    it('should mask short strings completely', () => {
      const result = maskSensitive('ab')

      expect(result).toBe('****')
    })

    it('should handle custom visibleChars', () => {
      const result = maskSensitive('1234567890', 2)

      expect(result).toBe('12****90')
    })

    it('should handle empty string', () => {
      const result = maskSensitive('')

      expect(result).toBe('')
    })

    it('should handle string with length equal to visibleChars * 2', () => {
      const result = maskSensitive('abcd', 2)

      expect(result).toBe('********')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SecureLogger,
  createSecureLogger,
  getSecureLogger,
  resetSecureLogger,
  secureLogger,
  sanitizeObject,
  isSensitiveKey,
  MASK_VALUE,
} from '@/lib/utils/secure-logger'

describe('SecureLogger', () => {
  beforeEach(function () {
    resetSecureLogger()
    vi.clearAllMocks()
  })

  describe('isSensitiveKey', function () {
    it('should detect api_key as sensitive', function () {
      expect(isSensitiveKey('api_key')).toBe(true)
    })

    it('should detect password as sensitive', function () {
      expect(isSensitiveKey('password')).toBe(true)
    })

    it('should detect token as sensitive', function () {
      expect(isSensitiveKey('token')).toBe(true)
    })

    it('should detect OPENAI_API_KEY env var', function () {
      expect(isSensitiveKey('OPENAI_API_KEY')).toBe(true)
    })

    it('should not detect normal keys', function () {
      expect(isSensitiveKey('name')).toBe(false)
    })

    it('should not detect normal keys like email', function () {
      expect(isSensitiveKey('email')).toBe(false)
    })
  })

  describe('sanitizeObject', function () {
    it('should mask sensitive values', function () {
      const result = sanitizeObject({ api_key: 'secret123', name: 'test' })
      expect(result['***key']).toBe(MASK_VALUE)
      expect(result.name).toBe('test')
    })

    it('should mask password fields', function () {
      const result = sanitizeObject({ password: 'mypass' })
      expect(result['***ord']).toBe(MASK_VALUE)
    })

    it('should handle nested objects', function () {
      const result = sanitizeObject({ config: { secret: 'hidden', visible: 'shown' } })
      const config = result.config as Record<string, unknown>
      expect(config['***ret']).toBe(MASK_VALUE)
      expect(config.visible).toBe('shown')
    })

    it('should handle arrays', function () {
      const result = sanitizeObject({ items: ['a', 'b'] })
      expect(result.items).toEqual(['a', 'b'])
    })

    it('should handle null values', function () {
      const result = sanitizeObject({ key: null })
      expect(result.key).toBeNull()
    })

    it('should handle Date objects', function () {
      const date = new Date()
      const result = sanitizeObject({ date })
      expect(result.date).toEqual({})
    })

    it('should handle Error objects', function () {
      const error = new Error('test error')
      const result = sanitizeObject({ error })
      expect(result.error).toEqual({})
    })

    it('should truncate long strings', function () {
      const longString = 'a'.repeat(2000)
      const result = sanitizeObject({ text: longString })
      expect((result.text as string).length).toBeLessThan(longString.length)
    })

    it('should handle circular references', function () {
      const obj: Record<string, unknown> = { a: 1 }
      obj.self = obj
      const result = sanitizeObject(obj)
      expect(result.self).toEqual({ '[CIRCULAR_REFERENCE]': true })
    })

    it('should handle max depth', function () {
      const deep = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: { level7: { level8: { level9: { level10: { level11: 'deep' } } } } },
                },
              },
            },
          },
        },
      }
      const result = sanitizeObject(deep)
      expect(result).toBeDefined()
    })

    it('should mask env var names as keys', function () {
      const result = sanitizeObject({ OPENAI_API_KEY: 'sk-xxx' })
      expect(result['***KEY']).toBe(MASK_VALUE)
    })
  })

  describe('SecureLogger class', function () {
    it('should create logger with default settings', function () {
      const logger = new SecureLogger()
      expect(logger).toBeDefined()
    })

    it('should create logger with custom min level', function () {
      const logger = new SecureLogger({ minLevel: 'error' })
      expect(logger).toBeDefined()
    })

    it('should log info messages', function () {
      const spy = vi.spyOn(console, 'log').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.info('test message')
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should not log debug when min level is info', function () {
      const spy = vi.spyOn(console, 'log').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'info' })
      logger.debug('debug msg')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should log warn messages', function () {
      const spy = vi.spyOn(console, 'warn').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.warn('warning')
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should log error messages', function () {
      const spy = vi.spyOn(console, 'error').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.error('error')
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should log fatal messages', function () {
      const spy = vi.spyOn(console, 'error').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.fatal('fatal')
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should set and get correlation id', function () {
      const logger = new SecureLogger()
      logger.setCorrelationId('corr-123')
      expect(logger.getCorrelationId()).toBe('corr-123')
    })

    it('should generate new correlation id', function () {
      const logger = new SecureLogger()
      const id = logger.newCorrelationId()
      expect(id).toBeDefined()
      expect(logger.getCorrelationId()).toBe(id)
    })

    it('should set context', function () {
      const spy = vi.spyOn(console, 'log').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.setContext({ requestId: 'req-1' })
      logger.info('with context')
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should clear context', function () {
      const logger = new SecureLogger()
      logger.setContext({ key: 'value' })
      logger.clearContext()
      expect(logger).toBeDefined()
    })

    it('should log security events', function () {
      const spy = vi.spyOn(console, 'warn').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.security('LOGIN_ATTEMPT', { ip: '1.2.3.4' })
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should log audit events', function () {
      const spy = vi.spyOn(console, 'log').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.audit('DATA_EXPORT', { userId: 'u1' })
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should create child logger', function () {
      const logger = new SecureLogger({ minLevel: 'debug', context: { a: 1 } })
      const child = logger.child({ context: { b: 2 } })
      expect(child).toBeDefined()
    })

    it('should mask sensitive data in log output', function () {
      const spy = vi.spyOn(console, 'log').mockImplementation(function () {})
      const logger = new SecureLogger({ minLevel: 'debug' })
      logger.info('login', { password: 'secret', email: 'test@test.com' })
      const call = spy.mock.calls[0][0]
      expect(call).not.toContain('secret')
      spy.mockRestore()
    })
  })

  describe('createSecureLogger', function () {
    it('should create a new logger', function () {
      const logger = createSecureLogger({ minLevel: 'warn' })
      expect(logger).toBeInstanceOf(SecureLogger)
    })
  })

  describe('getSecureLogger and resetSecureLogger', function () {
    it('should return singleton logger', function () {
      const logger1 = getSecureLogger()
      const logger2 = getSecureLogger()
      expect(logger1).toBe(logger2)
    })

    it('should reset singleton', function () {
      const logger1 = getSecureLogger()
      resetSecureLogger()
      const logger2 = getSecureLogger()
      expect(logger1).not.toBe(logger2)
    })
  })

  describe('secureLogger proxy', function () {
    it('should proxy to default logger', function () {
      expect(typeof secureLogger.info).toBe('function')
      expect(typeof secureLogger.warn).toBe('function')
      expect(typeof secureLogger.error).toBe('function')
    })
  })
})

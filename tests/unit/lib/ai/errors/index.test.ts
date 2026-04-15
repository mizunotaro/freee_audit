import { describe, it, expect } from 'vitest'
import {
  createAIError,
  isRecoverableError,
  getHttpStatus,
  ERROR_CODES,
  type AIError,
  type ErrorCode,
} from '@/lib/ai/errors'

describe('AI Errors Module', () => {
  describe('createAIError', () => {
    it('should create error with correct code and message', () => {
      const error = createAIError('INVALID_INPUT')
      expect(error.code).toBe('INVALID_INPUT')
      expect(error.message).toBe('入力データが無効です')
      expect(error.recoverable).toBe(false)
      expect(error.details).toBeUndefined()
    })

    it('should include details when provided', () => {
      const details = { field: 'name', reason: 'too long' }
      const error = createAIError('VALIDATION_ERROR', details)
      expect(error.details).toEqual(details)
    })

    it('should preserve retryAfter from base error', () => {
      const error = createAIError('MODEL_UNAVAILABLE')
      expect(error.retryAfter).toBe(5000)
    })

    it('should create all error codes without throwing', () => {
      const codes = Object.keys(ERROR_CODES) as ErrorCode[]
      for (const code of codes) {
        const error = createAIError(code)
        expect(error.code).toBe(code)
        expect(error.message).toBeTruthy()
      }
    })
  })

  describe('isRecoverableError', () => {
    it('should return true for recoverable errors', () => {
      const recoverableCodes: ErrorCode[] = [
        'TOKEN_LIMIT_EXCEEDED',
        'MODEL_UNAVAILABLE',
        'ANALYSIS_FAILED',
        'TIMEOUT',
        'PARSE_ERROR',
      ]
      for (const code of recoverableCodes) {
        const error = createAIError(code)
        expect(isRecoverableError(error)).toBe(true)
      }
    })

    it('should return false for non-recoverable errors', () => {
      const nonRecoverableCodes: ErrorCode[] = [
        'INVALID_INPUT',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'VALIDATION_ERROR',
      ]
      for (const code of nonRecoverableCodes) {
        const error = createAIError(code)
        expect(isRecoverableError(error)).toBe(false)
      }
    })
  })

  describe('getHttpStatus', () => {
    it('should return correct status codes', () => {
      expect(getHttpStatus('INVALID_INPUT')).toBe(400)
      expect(getHttpStatus('TOKEN_LIMIT_EXCEEDED')).toBe(400)
      expect(getHttpStatus('VALIDATION_ERROR')).toBe(400)
      expect(getHttpStatus('UNAUTHORIZED')).toBe(401)
      expect(getHttpStatus('FORBIDDEN')).toBe(403)
      expect(getHttpStatus('NOT_FOUND')).toBe(404)
      expect(getHttpStatus('ANALYSIS_FAILED')).toBe(500)
      expect(getHttpStatus('PARSE_ERROR')).toBe(500)
      expect(getHttpStatus('MODEL_UNAVAILABLE')).toBe(503)
      expect(getHttpStatus('TIMEOUT')).toBe(504)
    })
  })

  describe('ERROR_CODES', () => {
    it('should have consistent structure', () => {
      for (const [key, value] of Object.entries(ERROR_CODES)) {
        expect(value.code).toBe(key)
        expect(typeof value.message).toBe('string')
        expect(value.message.length).toBeGreaterThan(0)
        expect(typeof value.recoverable).toBe('boolean')
      }
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  Result,
  AppError,
  success,
  failure,
  isSuccess,
  isFailure,
  createAppError,
  tryCatch,
  tryCatchSync,
  ERROR_CODES,
} from '@/types/result'

describe('result', () => {
  describe('ERROR_CODES', () => {
    it('should have all required error codes', () => {
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND')
      expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(ERROR_CODES.TIMEOUT).toBe('TIMEOUT')
      expect(ERROR_CODES.DATABASE_ERROR).toBe('DATABASE_ERROR')
      expect(ERROR_CODES.EXTERNAL_SERVICE_ERROR).toBe('EXTERNAL_SERVICE_ERROR')
      expect(ERROR_CODES.BUSINESS_LOGIC_ERROR).toBe('BUSINESS_LOGIC_ERROR')
    })

    it('should have exactly 7 error codes', () => {
      expect(Object.keys(ERROR_CODES)).toHaveLength(7)
    })
  })

  describe('success', () => {
    it('should create a success result with data', () => {
      const data = { id: 1, name: 'test' }
      const result = success(data)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
    })

    it('should work with primitive types', () => {
      expect(success(42).data).toBe(42)
      expect(success('hello').data).toBe('hello')
      expect(success(true).data).toBe(true)
      expect(success(null).data).toBe(null)
      expect(success(undefined).data).toBe(undefined)
    })

    it('should work with array types', () => {
      const arr = [1, 2, 3]
      const result = success(arr)
      expect(result.data).toEqual(arr)
    })
  })

  describe('failure', () => {
    it('should create a failure result with error', () => {
      const error: AppError = {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid input',
        timestamp: new Date(),
      }
      const result = failure(error)

      expect(result.success).toBe(false)
      expect(result.error).toEqual(error)
    })

    it('should work with custom error types', () => {
      const customError = { reason: 'custom', severity: 'high' }
      const result = failure(customError)

      expect(result.success).toBe(false)
      expect(result.error).toEqual(customError)
    })
  })

  describe('isSuccess', () => {
    it('should return true for success results', () => {
      const result = success('data')
      expect(isSuccess(result)).toBe(true)
    })

    it('should return false for failure results', () => {
      const result = failure({ code: 'ERROR', message: 'error', timestamp: new Date() })
      expect(isSuccess(result)).toBe(false)
    })

    it('should narrow type correctly', () => {
      const result: Result<string> = success('data')

      if (isSuccess(result)) {
        expectTypeOf(result.data).toBeString()
      }
    })
  })

  describe('isFailure', () => {
    it('should return true for failure results', () => {
      const result = failure({ code: 'ERROR', message: 'error', timestamp: new Date() })
      expect(isFailure(result)).toBe(true)
    })

    it('should return false for success results', () => {
      const result = success('data')
      expect(isFailure(result)).toBe(false)
    })

    it('should narrow type correctly', () => {
      const result: Result<string> = failure({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'error',
        timestamp: new Date(),
      })

      if (isFailure(result)) {
        expectTypeOf(result.error.code).toBeString()
      }
    })
  })

  describe('createAppError', () => {
    it('should create AppError with required fields', () => {
      const error = createAppError(ERROR_CODES.NOT_FOUND, 'Resource not found')

      expect(error.code).toBe(ERROR_CODES.NOT_FOUND)
      expect(error.message).toBe('Resource not found')
      expect(error.timestamp).toBeInstanceOf(Date)
      expect(error.details).toBeUndefined()
      expect(error.cause).toBeUndefined()
    })

    it('should create AppError with details', () => {
      const details = { field: 'email', value: 'invalid' }
      const error = createAppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid email', { details })

      expect(error.details).toEqual(details)
    })

    it('should create AppError with cause', () => {
      const cause = new Error('Original error')
      const error = createAppError(ERROR_CODES.DATABASE_ERROR, 'Query failed', { cause })

      expect(error.cause).toBe(cause)
    })

    it('should create AppError with custom error code', () => {
      const error = createAppError('CUSTOM_ERROR', 'Custom message')

      expect(error.code).toBe('CUSTOM_ERROR')
    })
  })

  describe('tryCatch', () => {
    it('should return success result when function succeeds', async () => {
      const result = await tryCatch(async () => 'success')

      expect(result.success).toBe(true)
      if (isSuccess(result)) {
        expect(result.data).toBe('success')
      }
    })

    it('should return failure result when function throws', async () => {
      const result = await tryCatch(async () => {
        throw new Error('Async error')
      })

      expect(result.success).toBe(false)
      if (isFailure(result)) {
        expect(result.error.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR)
        expect(result.error.message).toBe('Async error')
        expect(result.error.cause).toBeInstanceOf(Error)
      }
    })

    it('should use custom error code', async () => {
      const result = await tryCatch(async () => {
        throw new Error('Custom error')
      }, ERROR_CODES.DATABASE_ERROR)

      expect(result.success).toBe(false)
      if (isFailure(result)) {
        expect(result.error.code).toBe(ERROR_CODES.DATABASE_ERROR)
      }
    })

    it('should handle non-Error throws', async () => {
      const result = await tryCatch(async () => {
        throw 'string error'
      })

      expect(result.success).toBe(false)
      if (isFailure(result)) {
        expect(result.error.message).toBe('string error')
        expect(result.error.cause).toBeInstanceOf(Error)
      }
    })

    it('should work with object return type', async () => {
      const data = { id: 1, items: ['a', 'b'] }
      const result = await tryCatch(async () => data)

      expect(result.success).toBe(true)
      if (isSuccess(result)) {
        expect(result.data).toEqual(data)
      }
    })
  })

  describe('tryCatchSync', () => {
    it('should return success result when function succeeds', () => {
      const result = tryCatchSync(() => 'sync success')

      expect(result.success).toBe(true)
      if (isSuccess(result)) {
        expect(result.data).toBe('sync success')
      }
    })

    it('should return failure result when function throws', () => {
      const result = tryCatchSync(() => {
        throw new Error('Sync error')
      })

      expect(result.success).toBe(false)
      if (isFailure(result)) {
        expect(result.error.code).toBe(ERROR_CODES.BUSINESS_LOGIC_ERROR)
        expect(result.error.message).toBe('Sync error')
        expect(result.error.cause).toBeInstanceOf(Error)
      }
    })

    it('should use custom error code', () => {
      const result = tryCatchSync(() => {
        throw new Error('Custom sync error')
      }, ERROR_CODES.VALIDATION_ERROR)

      expect(result.success).toBe(false)
      if (isFailure(result)) {
        expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
      }
    })

    it('should handle JSON parsing', () => {
      const validJson = '{"key": "value"}'
      const result = tryCatchSync(() => JSON.parse(validJson))

      expect(result.success).toBe(true)
      if (isSuccess(result)) {
        expect(result.data).toEqual({ key: 'value' })
      }
    })

    it('should handle JSON parse error', () => {
      const invalidJson = 'not json'
      const result = tryCatchSync(() => JSON.parse(invalidJson))

      expect(result.success).toBe(false)
      if (isFailure(result)) {
        expect(result.error.cause).toBeInstanceOf(SyntaxError)
      }
    })
  })

  describe('Result type integration', () => {
    it('should work with generic error types', () => {
      type CustomError = { reason: string }
      const result: Result<string, CustomError> = failure({ reason: 'custom' })

      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.reason).toBe('custom')
      }
    })

    it('should default error type to AppError', () => {
      const result: Result<string> = success('data')
      expect(result.success).toBe(true)
    })

    it('should work in real-world scenario', async () => {
      interface User {
        id: number
        name: string
      }

      async function fetchUser(id: number): Promise<Result<User, AppError>> {
        return tryCatch(async () => {
          if (id <= 0) {
            throw new Error('Invalid user ID')
          }
          return { id, name: `User ${id}` }
        }, ERROR_CODES.NOT_FOUND)
      }

      const successResult = await fetchUser(1)
      expect(isSuccess(successResult)).toBe(true)
      if (isSuccess(successResult)) {
        expect(successResult.data.name).toBe('User 1')
      }

      const failureResult = await fetchUser(0)
      expect(isFailure(failureResult)).toBe(true)
      if (isFailure(failureResult)) {
        expect(failureResult.error.code).toBe(ERROR_CODES.NOT_FOUND)
      }
    })
  })
})

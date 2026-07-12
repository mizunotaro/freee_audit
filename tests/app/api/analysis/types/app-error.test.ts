import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  createError,
  createValidationError,
  createMissingFieldsError,
  createInternalError,
  createTimeoutError,
  createCircuitBreakerError,
} from '@/app/api/analysis/types/app-error'
import type { ErrorCode, AppError } from '@/app/api/analysis/types/app-error'

const FIXED_DATE = new Date('2026-07-12T03:30:00.000Z')
const FIXED_ISO = FIXED_DATE.toISOString()

const ERROR_CODES: ErrorCode[] = [
  'VALIDATION_ERROR',
  'MISSING_REQUIRED_FIELDS',
  'INVALID_DATA',
  'ANALYSIS_FAILED',
  'BENCHMARK_UNAVAILABLE',
  'INTERNAL_ERROR',
  'RATE_LIMIT_EXCEEDED',
  'UNAUTHORIZED',
  'TIMEOUT',
  'CIRCUIT_BREAKER_OPEN',
]

describe('src/app/api/analysis/types/app-error', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  describe('module resolution', () => {
    it('should be importable as an ESM module', async () => {
      const mod = await import('@/app/api/analysis/types/app-error')
      expect(mod).toBeDefined()
      expect(typeof mod).toBe('object')
    })

    it('should export exactly the six public creator functions at runtime', async () => {
      const mod = await import('@/app/api/analysis/types/app-error')
      expect(Object.keys(mod).sort()).toEqual([
        'createCircuitBreakerError',
        'createError',
        'createInternalError',
        'createMissingFieldsError',
        'createTimeoutError',
        'createValidationError',
      ])
      for (const fn of Object.values(mod)) {
        expect(typeof fn).toBe('function')
      }
    })
  })

  describe('ErrorCode', () => {
    it('should expose exactly the ten members at runtime', () => {
      expect(ERROR_CODES).toHaveLength(10)
      expect(new Set(ERROR_CODES).size).toBe(10)
    })

    it('should type the alias as exactly those ten literals', () => {
      expectTypeOf<ErrorCode>().toEqualTypeOf<
        | 'VALIDATION_ERROR'
        | 'MISSING_REQUIRED_FIELDS'
        | 'INVALID_DATA'
        | 'ANALYSIS_FAILED'
        | 'BENCHMARK_UNAVAILABLE'
        | 'INTERNAL_ERROR'
        | 'RATE_LIMIT_EXCEEDED'
        | 'UNAUTHORIZED'
        | 'TIMEOUT'
        | 'CIRCUIT_BREAKER_OPEN'
      >()
    })

    it('should be a closed union — an arbitrary string is not assignable to ErrorCode', () => {
      expectTypeOf<string>().not.toMatchTypeOf<ErrorCode>()
      expectTypeOf<'NOT_A_CODE'>().not.toMatchTypeOf<ErrorCode>()
    })
  })

  describe('AppError', () => {
    it('should construct minimally with the required triplet', () => {
      const err: AppError = { code: 'TIMEOUT', message: 'slow', timestamp: FIXED_ISO }
      expect(err.code).toBe('TIMEOUT')
      expect(err.message).toBe('slow')
      expect(err.timestamp).toBe(FIXED_ISO)
      expect(err.details).toBeUndefined()
      expect(err.requestId).toBeUndefined()
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should construct fully with details and requestId', () => {
      const err: AppError = {
        code: 'INVALID_DATA',
        message: 'bad',
        details: { k: 'v', n: 3 },
        timestamp: FIXED_ISO,
        requestId: 'req-x',
      }
      expect(err.details).toEqual({ k: 'v', n: 3 })
      expect(err.requestId).toBe('req-x')
      expect(Object.keys(err).sort()).toEqual([
        'code',
        'details',
        'message',
        'requestId',
        'timestamp',
      ])
    })

    it('should type each field correctly', () => {
      expectTypeOf<AppError['code']>().toEqualTypeOf<ErrorCode>()
      expectTypeOf<AppError['message']>().toEqualTypeOf<string>()
      expectTypeOf<AppError['timestamp']>().toEqualTypeOf<string>()
      expectTypeOf<AppError['details']>().toEqualTypeOf<Record<string, unknown> | undefined>()
      expectTypeOf<AppError['requestId']>().toEqualTypeOf<string | undefined>()
    })

    it('should type code/message/timestamp as required and details/requestId as optional', () => {
      expectTypeOf<AppError['code']>().toEqualTypeOf<ErrorCode>()
      expectTypeOf<AppError['details']>().toEqualTypeOf<Record<string, unknown> | undefined>()
      expectTypeOf<AppError['requestId']>().toEqualTypeOf<string | undefined>()
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const err: AppError = { code: 'TIMEOUT', message: 'm', timestamp: FIXED_ISO }
      const tryMutate = () => {
        // @ts-expect-error AppError.code is readonly (TS2540)
        err.code = 'INTERNAL_ERROR'
        // @ts-expect-error AppError.message is readonly (TS2540)
        err.message = 'mutated'
        // @ts-expect-error AppError.timestamp is readonly (TS2540)
        err.timestamp = '2025-01-01T00:00:00.000Z'
      }
      expect(typeof tryMutate).toBe('function')
      expect(err.code).toBe('TIMEOUT')
      expect(err.message).toBe('m')
      expect(err.timestamp).toBe(FIXED_ISO)
    })

    it('should fail-safe at compile time: an out-of-union code does not satisfy AppError', () => {
      type BadCode = { code: 'NOPE'; message: string; timestamp: string }
      expectTypeOf<BadCode>().not.toMatchTypeOf<AppError>()
    })

    it('should fail-safe at compile time: a payload missing code does not satisfy AppError', () => {
      type NoCode = { message: string; timestamp: string }
      expectTypeOf<NoCode>().not.toMatchTypeOf<AppError>()
    })

    it('should fail-safe at compile time: a payload missing message does not satisfy AppError', () => {
      type NoMessage = { code: ErrorCode; timestamp: string }
      expectTypeOf<NoMessage>().not.toMatchTypeOf<AppError>()
    })

    it('should fail-safe at compile time: a payload missing timestamp does not satisfy AppError', () => {
      type NoTimestamp = { code: ErrorCode; message: string }
      expectTypeOf<NoTimestamp>().not.toMatchTypeOf<AppError>()
    })
  })

  describe('createError', () => {
    it('should return the base shape when no options are given', () => {
      const err = createError('INTERNAL_ERROR', 'boom')
      expect(err.code).toBe('INTERNAL_ERROR')
      expect(err.message).toBe('boom')
      expect(err.timestamp).toBe(FIXED_ISO)
      expect(err.details).toBeUndefined()
      expect(err.requestId).toBeUndefined()
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should return the base shape when options is undefined', () => {
      const err = createError('TIMEOUT', 't', undefined)
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should return the base shape when options is an empty object', () => {
      const err = createError('UNAUTHORIZED', 'u', {})
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should attach details only when only details is provided', () => {
      const details = { field: 'x', reason: 'bad' }
      const err = createError('INVALID_DATA', 'bad', { details })
      expect(err.details).toBe(details)
      expect(err.requestId).toBeUndefined()
      expect(Object.keys(err).sort()).toEqual(['code', 'details', 'message', 'timestamp'])
    })

    it('should attach requestId only when only requestId is provided', () => {
      const err = createError('UNAUTHORIZED', 'no', { requestId: 'req-7' })
      expect(err.requestId).toBe('req-7')
      expect(err.details).toBeUndefined()
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'requestId', 'timestamp'])
    })

    it('should attach both details and requestId when both are provided', () => {
      const details = { hint: 1 }
      const err = createError('RATE_LIMIT_EXCEEDED', 'slow down', {
        details,
        requestId: 'req-9',
      })
      expect(err.details).toBe(details)
      expect(err.requestId).toBe('req-9')
      expect(Object.keys(err).sort()).toEqual([
        'code',
        'details',
        'message',
        'requestId',
        'timestamp',
      ])
    })

    it('should include an empty details object (truthiness semantics)', () => {
      const err = createError('ANALYSIS_FAILED', 'f', { details: {} })
      expect(err.details).toEqual({})
      expect(Object.keys(err).sort()).toEqual(['code', 'details', 'message', 'timestamp'])
    })

    it('should treat an empty-string requestId as absent (truthiness semantics)', () => {
      const err = createError('TIMEOUT', 't', { requestId: '' })
      expect(err.requestId).toBeUndefined()
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should preserve the details object by identity', () => {
      const details = { a: 1 }
      const err = createError('INVALID_DATA', 'x', { details })
      expect(err.details).toBe(details)
    })

    it('should accept every ErrorCode value', () => {
      for (const code of ERROR_CODES) {
        const err = createError(code, `msg-${code}`)
        expect(err.code).toBe(code)
      }
    })

    it('should accept an empty message as a boundary input', () => {
      const err = createError('INTERNAL_ERROR', '')
      expect(err.message).toBe('')
    })

    it('should produce a valid ISO-8601 timestamp pinned to the clock', () => {
      const err = createError('INTERNAL_ERROR', 'x')
      expect(err.timestamp).toBe(FIXED_ISO)
      expect(Number.isNaN(Date.parse(err.timestamp))).toBe(false)
    })

    it('should conform to the AppError contract', () => {
      const err: AppError = createError('TIMEOUT', 't', { details: { k: 1 }, requestId: 'r' })
      expectTypeOf(err.code).toEqualTypeOf<ErrorCode>()
      expectTypeOf(err.message).toEqualTypeOf<string>()
      expectTypeOf(err.timestamp).toEqualTypeOf<string>()
      expectTypeOf(err.details).toEqualTypeOf<Record<string, unknown> | undefined>()
      expectTypeOf(err.requestId).toEqualTypeOf<string | undefined>()
    })
  })

  describe('createValidationError', () => {
    it('should use the VALIDATION_ERROR code', () => {
      expect(createValidationError('bad').code).toBe('VALIDATION_ERROR')
    })

    it('should return the base shape with just a message', () => {
      const err = createValidationError('bad input')
      expect(err.message).toBe('bad input')
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should attach details when provided', () => {
      const details = { field: 'email' }
      const err = createValidationError('bad', details)
      expect(err.details).toBe(details)
    })

    it('should attach requestId when provided without details', () => {
      const err = createValidationError('bad', undefined, 'req-1')
      expect(err.requestId).toBe('req-1')
      expect(err.details).toBeUndefined()
    })

    it('should attach both details and requestId', () => {
      const details = { n: 1 }
      const err = createValidationError('bad', details, 'req-2')
      expect(err.details).toBe(details)
      expect(err.requestId).toBe('req-2')
    })

    it('should accept an empty message as a boundary input', () => {
      const err = createValidationError('')
      expect(err.message).toBe('')
    })
  })

  describe('createMissingFieldsError', () => {
    it('should use the MISSING_REQUIRED_FIELDS code', () => {
      expect(createMissingFieldsError(['a']).code).toBe('MISSING_REQUIRED_FIELDS')
    })

    it('should join a single field into the message', () => {
      expect(createMissingFieldsError(['company_id']).message).toBe('company_id are required')
    })

    it('should join multiple fields with commas', () => {
      expect(createMissingFieldsError(['a', 'b', 'c']).message).toBe('a, b, c are required')
    })

    it('should produce an empty join for an empty field list (boundary)', () => {
      const err = createMissingFieldsError([])
      expect(err.message).toBe(' are required')
      expect(err.details).toEqual({ fields: [] })
    })

    it('should store the fields under details.fields by identity', () => {
      const fields = ['x', 'y']
      const err = createMissingFieldsError(fields)
      expect(err.details).toEqual({ fields })
      expect((err.details as { fields: readonly string[] }).fields).toBe(fields)
    })

    it('should attach requestId when provided', () => {
      const err = createMissingFieldsError(['a'], 'req-3')
      expect(err.requestId).toBe('req-3')
    })

    it('should accept a readonly tuple (as produced by `as const`)', () => {
      const fields = ['a', 'b'] as const
      const err = createMissingFieldsError(fields)
      expect(err.message).toBe('a, b are required')
    })
  })

  describe('createInternalError', () => {
    it('should use the INTERNAL_ERROR code', () => {
      expect(createInternalError('boom').code).toBe('INTERNAL_ERROR')
    })

    it('should return the base shape and never attach details', () => {
      const err = createInternalError('unexpected')
      expect(err.message).toBe('unexpected')
      expect(err.details).toBeUndefined()
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should attach requestId when provided', () => {
      const err = createInternalError('x', 'req-4')
      expect(err.requestId).toBe('req-4')
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'requestId', 'timestamp'])
    })

    it('should accept an empty message as a boundary input', () => {
      const err = createInternalError('')
      expect(err.message).toBe('')
    })
  })

  describe('createTimeoutError', () => {
    it('should use the TIMEOUT code', () => {
      expect(createTimeoutError('fetch', 1000).code).toBe('TIMEOUT')
    })

    it('should format the message from operation and timeoutMs', () => {
      expect(createTimeoutError('fetchJournals', 5000).message).toBe(
        'Operation fetchJournals timed out after 5000ms'
      )
    })

    it('should store operation and timeoutMs under details', () => {
      const err = createTimeoutError('fetch', 250)
      expect(err.details).toEqual({ operation: 'fetch', timeoutMs: 250 })
    })

    it('should attach requestId when provided', () => {
      const err = createTimeoutError('fetch', 100, 'req-5')
      expect(err.requestId).toBe('req-5')
    })

    it('should accept a zero timeoutMs (boundary)', () => {
      const err = createTimeoutError('op', 0)
      expect(err.message).toBe('Operation op timed out after 0ms')
      expect((err.details as { timeoutMs: number }).timeoutMs).toBe(0)
    })

    it('should accept a negative timeoutMs (boundary, interpolated verbatim)', () => {
      const err = createTimeoutError('op', -1)
      expect(err.message).toBe('Operation op timed out after -1ms')
      expect((err.details as { timeoutMs: number }).timeoutMs).toBe(-1)
    })

    it('should accept the max safe integer (boundary)', () => {
      const err = createTimeoutError('op', Number.MAX_SAFE_INTEGER)
      expect((err.details as { timeoutMs: number }).timeoutMs).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should accept an empty operation string (boundary)', () => {
      const err = createTimeoutError('', 100)
      expect(err.message).toBe('Operation  timed out after 100ms')
      expect((err.details as { operation: string }).operation).toBe('')
    })
  })

  describe('createCircuitBreakerError', () => {
    it('should use the CIRCUIT_BREAKER_OPEN code', () => {
      expect(createCircuitBreakerError().code).toBe('CIRCUIT_BREAKER_OPEN')
    })

    it('should emit the fixed unavailable message', () => {
      expect(createCircuitBreakerError().message).toBe(
        'Service temporarily unavailable due to repeated failures'
      )
    })

    it('should return the base shape with no details when called with no args', () => {
      const err = createCircuitBreakerError()
      expect(err.details).toBeUndefined()
      expect(err.requestId).toBeUndefined()
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
    })

    it('should attach requestId when provided', () => {
      const err = createCircuitBreakerError('req-6')
      expect(err.requestId).toBe('req-6')
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'requestId', 'timestamp'])
    })
  })

  describe('fail-safe invariants', () => {
    const allCreators = (): AppError[] => [
      createError('INTERNAL_ERROR', 'x'),
      createValidationError('x'),
      createMissingFieldsError(['x']),
      createInternalError('x'),
      createTimeoutError('x', 1),
      createCircuitBreakerError(),
    ]

    it('every creator should return a code that is a member of ErrorCode', () => {
      for (const err of allCreators()) {
        expect(ERROR_CODES).toContain(err.code)
      }
    })

    it('every creator should return a string message and never throw', () => {
      const makers: Array<() => AppError> = [
        () => createError('INTERNAL_ERROR', ''),
        () => createValidationError(''),
        () => createMissingFieldsError([]),
        () => createInternalError(''),
        () => createTimeoutError('', 0),
        () => createCircuitBreakerError(),
      ]
      for (const make of makers) {
        expect(() => make()).not.toThrow()
        expect(typeof make().message).toBe('string')
      }
    })

    it('every creator should stamp a valid ISO-8601 timestamp', () => {
      for (const err of allCreators()) {
        expect(err.timestamp).toBe(FIXED_ISO)
        expect(Number.isNaN(Date.parse(err.timestamp))).toBe(false)
      }
    })

    it('should degrade to the safe base shape when no optional context is supplied', () => {
      const err = createInternalError('safe fallback')
      expect(Object.keys(err).sort()).toEqual(['code', 'message', 'timestamp'])
      expect(err.code).toBe('INTERNAL_ERROR')
    })
  })
})

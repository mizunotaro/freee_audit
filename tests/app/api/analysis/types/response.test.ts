import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createSuccessResponse, createErrorResponse } from '@/app/api/analysis/types/response'
import type { ApiResponse, ResponseMetadata } from '@/app/api/analysis/types/response'
import type { AppError } from '@/app/api/analysis/types/app-error'

const FIXED_DATE = new Date('2026-07-12T03:30:00.000Z')
const FIXED_ISO = FIXED_DATE.toISOString()

const METADATA_KEYS = ['cached', 'processingTimeMs', 'requestId', 'timestamp', 'version'] as const

function makeError(overrides: Partial<AppError> = {}): AppError {
  return {
    code: 'INTERNAL_ERROR',
    message: 'something went wrong',
    timestamp: FIXED_ISO,
    ...overrides,
  }
}

describe('src/app/api/analysis/types/response', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  describe('createSuccessResponse', () => {
    it('returns success=true and carries the data payload by identity', () => {
      const data = { count: 3, items: ['a', 'b'] }
      const res = createSuccessResponse(data, { requestId: 'req-1' })

      expect(res.success).toBe(true)
      expect(res.data).toBe(data)
    })

    it('applies every provided metadata field verbatim', () => {
      const res = createSuccessResponse('ok', {
        requestId: 'req-full',
        processingTimeMs: 42,
        cached: true,
        version: '2.3.4',
        timestamp: '2026-01-01T00:00:00.000Z',
      })

      expect(res).toEqual({
        success: true,
        data: 'ok',
        metadata: {
          requestId: 'req-full',
          processingTimeMs: 42,
          cached: true,
          version: '2.3.4',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      })
    })

    it('fills every metadata default when given an empty object', () => {
      const res = createSuccessResponse(1, {})

      expect(res.metadata).toEqual({
        requestId: 'unknown',
        processingTimeMs: 0,
        cached: false,
        version: '1.0.0',
        timestamp: FIXED_ISO,
      })
    })

    it('defaults only the omitted metadata fields on partial input', () => {
      const res = createSuccessResponse(1, { requestId: 'partial', cached: true })

      expect(res.metadata.requestId).toBe('partial')
      expect(res.metadata.cached).toBe(true)
      expect(res.metadata.processingTimeMs).toBe(0)
      expect(res.metadata.version).toBe('1.0.0')
      expect(res.metadata.timestamp).toBe(FIXED_ISO)
    })

    it('honors cached=true for success responses', () => {
      const res = createSuccessResponse(null, { cached: true })
      expect(res.metadata.cached).toBe(true)
    })

    it('does not attach an error field on success', () => {
      const res = createSuccessResponse('x', {})
      expect(res.error).toBeUndefined()
    })

    it('supports primitive, array, object, and null payloads', () => {
      expect(createSuccessResponse(42, {}).data).toBe(42)
      expect(createSuccessResponse('hello', {}).data).toBe('hello')
      expect(createSuccessResponse(true, {}).data).toBe(true)
      expect(createSuccessResponse(null, {}).data).toBeNull()

      const arr = [1, 2, 3]
      expect(createSuccessResponse(arr, {}).data).toBe(arr)

      const obj = { deep: { nested: true } }
      expect(createSuccessResponse(obj, {}).data).toBe(obj)
    })

    it('produces a valid ISO-8601 default timestamp pinned to the clock', () => {
      const res = createSuccessResponse(0, {})
      expect(res.metadata.timestamp).toBe(FIXED_ISO)
      expect(Number.isNaN(Date.parse(res.metadata.timestamp))).toBe(false)
    })

    it('exposes exactly the five metadata keys', () => {
      const res = createSuccessResponse(0, {})
      expect(Object.keys(res.metadata).sort()).toEqual([...METADATA_KEYS])
    })

    it('conforms to the ApiResponse<number> contract', () => {
      const res: ApiResponse<number> = createSuccessResponse(7, { requestId: 't' })

      expectTypeOf(res.success).toBeBoolean()
      expectTypeOf(res.data).toEqualTypeOf<number | undefined>()
      expectTypeOf(res.metadata).toMatchTypeOf<ResponseMetadata>()
    })
  })

  describe('createErrorResponse', () => {
    it('returns success=false and carries the error by identity', () => {
      const error = makeError()
      const res = createErrorResponse(error, { requestId: 'req-err' })

      expect(res.success).toBe(false)
      expect(res.error).toBe(error)
    })

    it('applies every provided metadata field verbatim', () => {
      const error = makeError({ requestId: 'err-src' })
      const res = createErrorResponse(error, {
        requestId: 'req-full',
        processingTimeMs: 99,
        version: '3.0.0',
        timestamp: '2026-02-02T00:00:00.000Z',
      })

      expect(res).toEqual({
        success: false,
        error,
        metadata: {
          requestId: 'req-full',
          processingTimeMs: 99,
          cached: false,
          version: '3.0.0',
          timestamp: '2026-02-02T00:00:00.000Z',
        },
      })
    })

    it('fills every metadata default when given an empty object and no error.requestId', () => {
      const res = createErrorResponse(makeError(), {})

      expect(res.metadata).toEqual({
        requestId: 'unknown',
        processingTimeMs: 0,
        cached: false,
        version: '1.0.0',
        timestamp: FIXED_ISO,
      })
    })

    it('uses metadata.requestId when provided', () => {
      const res = createErrorResponse(makeError({ requestId: 'err-src' }), {
        requestId: 'from-meta',
      })
      expect(res.metadata.requestId).toBe('from-meta')
    })

    it('falls back to error.requestId when metadata omits it', () => {
      const res = createErrorResponse(makeError({ requestId: 'err-src' }), {})
      expect(res.metadata.requestId).toBe('err-src')
    })

    it('prefers metadata.requestId over error.requestId', () => {
      const res = createErrorResponse(makeError({ requestId: 'err-src' }), {
        requestId: 'from-meta',
      })
      expect(res.metadata.requestId).toBe('from-meta')
    })

    it('falls back to "unknown" when neither source provides a requestId', () => {
      const res = createErrorResponse(makeError(), {})
      expect(res.metadata.requestId).toBe('unknown')
    })

    it('forces cached=false even when metadata.cached is true (fail-safe)', () => {
      const res = createErrorResponse(makeError(), { cached: true })
      expect(res.success).toBe(false)
      expect(res.metadata.cached).toBe(false)
    })

    it('does not attach a data field on error', () => {
      const res = createErrorResponse(makeError(), {})
      expect(res.data).toBeUndefined()
    })

    it('produces a valid ISO-8601 default timestamp pinned to the clock', () => {
      const res = createErrorResponse(makeError(), {})
      expect(res.metadata.timestamp).toBe(FIXED_ISO)
      expect(Number.isNaN(Date.parse(res.metadata.timestamp))).toBe(false)
    })

    it('exposes exactly the five metadata keys', () => {
      const res = createErrorResponse(makeError(), {})
      expect(Object.keys(res.metadata).sort()).toEqual([...METADATA_KEYS])
    })

    it('conforms to the ApiResponse<never> contract', () => {
      const res = createErrorResponse(makeError(), {})

      expectTypeOf(res.success).toBeBoolean()
      expectTypeOf(res.error).toEqualTypeOf<AppError | undefined>()
      expectTypeOf(res.metadata).toMatchTypeOf<ResponseMetadata>()
    })
  })

  describe('response shape invariants', () => {
    it('success and error responses are mutually exclusive on the data/error channels', () => {
      const ok = createSuccessResponse('payload', { requestId: 'r' })
      const err = createErrorResponse(makeError(), { requestId: 'r' })

      expect(ok.success).toBe(true)
      expect(ok.data).toBe('payload')
      expect(ok.error).toBeUndefined()

      expect(err.success).toBe(false)
      expect(err.error).toBeDefined()
      expect(err.data).toBeUndefined()
    })

    it('both responses share the same metadata shape regardless of outcome', () => {
      const ok = createSuccessResponse(0, { requestId: 'shared' })
      const err = createErrorResponse(makeError(), { requestId: 'shared' })

      expect(Object.keys(ok.metadata).sort()).toEqual([...METADATA_KEYS])
      expect(Object.keys(err.metadata).sort()).toEqual([...METADATA_KEYS])
      expect(ok.metadata.version).toBe(err.metadata.version)
      expect(ok.metadata.cached).toBe(false)
      expect(err.metadata.cached).toBe(false)
    })
  })
})

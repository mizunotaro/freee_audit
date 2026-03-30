import { BaseOCREngine } from '@/services/ocr/base-ocr'
import type { OCRConfig } from '@/types/ocr'

const mockConfig: OCRConfig = {
  engine: 'ndlocr',
  ndlocr: { enabled: true, dockerEndpoint: 'http://localhost:8002', timeout: 60000 },
  yomitoku: { enabled: false, apiUrl: 'http://localhost:8001', liteMode: false, timeout: 60000 },
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['image/png', 'image/jpeg', 'application/pdf'],
}

class TestableOCREngine extends BaseOCREngine {
  readonly name = 'ndlocr' as const
  recognize = vi.fn()
}

describe('BaseOCREngine', () => {
  let engine: TestableOCREngine

  beforeEach(() => {
    engine = new TestableOCREngine(mockConfig)
  })

  describe('validateFile', () => {
    it('returns invalid for empty buffer', () => {
      const result = engine['validateFile'](Buffer.alloc(0), 'image/png')
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe('FILE_NOT_FOUND')
    })

    it('returns invalid for file exceeding max size', () => {
      const bigBuf = Buffer.alloc(11 * 1024 * 1024)
      const result = engine['validateFile'](bigBuf, 'image/png')
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe('FILE_TOO_LARGE')
    })

    it('returns invalid for disallowed mime type', () => {
      const buf = Buffer.alloc(100)
      const result = engine['validateFile'](buf, 'text/plain')
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe('INVALID_FILE_TYPE')
    })

    it('returns valid for acceptable file', () => {
      const buf = Buffer.alloc(100)
      const result = engine['validateFile'](buf, 'image/png')
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns valid for exact max file size', () => {
      const buf = Buffer.alloc(10 * 1024 * 1024)
      const result = engine['validateFile'](buf, 'image/png')
      expect(result.valid).toBe(true)
    })
  })

  describe('createSuccess', () => {
    it('creates success result with data and confidence', () => {
      const data = { rawText: 'test', confidence: 0.9 }
      const result = engine['createSuccess'](data, 0.9)
      expect(result).toEqual({
        success: true,
        data,
        confidence: 0.9,
        engine: 'ndlocr',
      })
    })
  })

  describe('createFailure', () => {
    it('creates failure result with error', () => {
      const error = { code: 'OCR_FAILED' as const, message: 'test error' }
      const result = engine['createFailure'](error)
      expect(result).toEqual({ success: false, error })
    })
  })

  describe('withTimeout', () => {
    it('resolves when promise completes in time', async () => {
      const result = await engine['withTimeout'](Promise.resolve('ok'), 5000)
      expect(result).toBe('ok')
    })

    it('rejects with OCR timeout when promise takes too long', async () => {
      vi.useFakeTimers()
      const slowPromise = new Promise<never>(() => {})
      const timeoutPromise = engine['withTimeout'](slowPromise, 100)

      vi.advanceTimersByTime(200)

      await expect(timeoutPromise).rejects.toThrow('OCR timeout')
      vi.useRealTimers()
    })
  })
})

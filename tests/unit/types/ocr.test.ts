import { describe, it, expect, vi, afterEach } from 'vitest'
import { DEFAULT_OCR_CONFIG, OCRStructuredDataSchema, OCRResultSchema } from '@/types/ocr'
import type {
  OCREngineType,
  OCRResult,
  OCRError,
  OCRErrorCode,
  OCROptions,
  OCRStructuredData,
  OCRItem,
  OCRConfig,
} from '@/types/ocr'

describe('src/types/ocr', () => {
  describe('DEFAULT_OCR_CONFIG', () => {
    it('defaults the engine to ndlocr', () => {
      expect(DEFAULT_OCR_CONFIG.engine).toBe('ndlocr')
    })

    it('enables ndlocr with default endpoint and timeout', () => {
      expect(DEFAULT_OCR_CONFIG.ndlocr.enabled).toBe(true)
      expect(DEFAULT_OCR_CONFIG.ndlocr.dockerEndpoint).toBe('http://localhost:8002')
      expect(DEFAULT_OCR_CONFIG.ndlocr.timeout).toBe(60000)
    })

    it('disables yomitoku by default with fallback url and lite mode off', () => {
      expect(DEFAULT_OCR_CONFIG.yomitoku.enabled).toBe(false)
      expect(DEFAULT_OCR_CONFIG.yomitoku.apiUrl).toBe('http://localhost:8001')
      expect(DEFAULT_OCR_CONFIG.yomitoku.liteMode).toBe(false)
      expect(DEFAULT_OCR_CONFIG.yomitoku.timeout).toBe(60000)
    })

    it('caps maxFileSize at 10 MiB', () => {
      expect(DEFAULT_OCR_CONFIG.maxFileSize).toBe(10 * 1024 * 1024)
      expect(DEFAULT_OCR_CONFIG.maxFileSize).toBe(10485760)
    })

    it('allows pdf and the image mime types', () => {
      expect(DEFAULT_OCR_CONFIG.allowedTypes).toEqual([
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
      ])
    })

    it('satisfies the OCRConfig type', () => {
      expectTypeOf(DEFAULT_OCR_CONFIG).toMatchTypeOf<OCRConfig>()
    })
  })

  describe('DEFAULT_OCR_CONFIG env resolution', () => {
    const ENV_KEYS = [
      'NDLOCR_DOCKER_ENDPOINT',
      'YOMITOKU_ENABLED',
      'YOMITOKU_API_URL',
      'YOMITOKU_LITE_MODE',
    ] as const

    afterEach(() => {
      for (const key of ENV_KEYS) delete process.env[key]
      vi.resetModules()
    })

    it('uses NDLOCR_DOCKER_ENDPOINT when set', async () => {
      process.env.NDLOCR_DOCKER_ENDPOINT = 'http://ocr-custom:9000'
      vi.resetModules()
      const mod = await import('@/types/ocr')
      expect(mod.DEFAULT_OCR_CONFIG.ndlocr.dockerEndpoint).toBe('http://ocr-custom:9000')
    })

    it('falls back to localhost when NDLOCR_DOCKER_ENDPOINT is unset', async () => {
      vi.resetModules()
      const mod = await import('@/types/ocr')
      expect(mod.DEFAULT_OCR_CONFIG.ndlocr.dockerEndpoint).toBe('http://localhost:8002')
    })

    it('enables yomitoku only when YOMITOKU_ENABLED is exactly "true"', async () => {
      process.env.YOMITOKU_ENABLED = 'true'
      vi.resetModules()
      const mod = await import('@/types/ocr')
      expect(mod.DEFAULT_OCR_CONFIG.yomitoku.enabled).toBe(true)
    })

    it('does not enable yomitoku for truthy-but-not-"true" values', async () => {
      process.env.YOMITOKU_ENABLED = 'false'
      vi.resetModules()
      const mod = await import('@/types/ocr')
      expect(mod.DEFAULT_OCR_CONFIG.yomitoku.enabled).toBe(false)
    })

    it('uses YOMITOKU_API_URL when set', async () => {
      process.env.YOMITOKU_API_URL = 'http://yomi-custom:7000'
      vi.resetModules()
      const mod = await import('@/types/ocr')
      expect(mod.DEFAULT_OCR_CONFIG.yomitoku.apiUrl).toBe('http://yomi-custom:7000')
    })

    it('enables lite mode only when YOMITOKU_LITE_MODE is exactly "true"', async () => {
      process.env.YOMITOKU_LITE_MODE = 'true'
      vi.resetModules()
      const mod = await import('@/types/ocr')
      expect(mod.DEFAULT_OCR_CONFIG.yomitoku.liteMode).toBe(true)
    })
  })

  describe('OCRStructuredDataSchema', () => {
    it('parses a fully-populated structured document', () => {
      const full = {
        rawText: 'レシート本文',
        date: '2024-01-15',
        totalAmount: 1100,
        taxAmount: 100,
        taxRate: 0.1,
        vendor: 'サンプル商店',
        items: [
          { name: '商品A', quantity: 2, unitPrice: 500, amount: 1000 },
          { name: '商品B', quantity: 1, unitPrice: 0, amount: 0 },
        ],
        confidence: 0.95,
      }
      const parsed = OCRStructuredDataSchema.parse(full)
      expect(parsed.rawText).toBe('レシート本文')
      expect(parsed.vendor).toBe('サンプル商店')
      expect(parsed.totalAmount).toBe(1100)
      expect(parsed.items).toHaveLength(2)
      expect(parsed.items?.[0].amount).toBe(1000)
      expect(parsed.confidence).toBe(0.95)
    })

    it('parses with only the required fields', () => {
      const parsed = OCRStructuredDataSchema.parse({ rawText: 'text', confidence: 0 })
      expect(parsed.rawText).toBe('text')
      expect(parsed.confidence).toBe(0)
      expect(parsed.items).toBeUndefined()
      expect(parsed.date).toBeUndefined()
    })

    it('accepts an empty rawText string (boundary)', () => {
      const parsed = OCRStructuredDataSchema.parse({ rawText: '', confidence: 0 })
      expect(parsed.rawText).toBe('')
    })

    it('accepts confidence of 0 and negative values (no range clamping)', () => {
      const zero = OCRStructuredDataSchema.parse({ rawText: 'x', confidence: 0 })
      const negative = OCRStructuredDataSchema.parse({ rawText: 'x', confidence: -1 })
      expect(zero.confidence).toBe(0)
      expect(negative.confidence).toBe(-1)
    })

    it('strips unknown keys (non-strict object)', () => {
      const input: Record<string, unknown> = {
        rawText: 'x',
        confidence: 1,
        bogus: 'drop me',
      }
      const parsed = OCRStructuredDataSchema.parse(input)
      expect(parsed).not.toHaveProperty('bogus')
    })

    it('rejects when rawText is missing', () => {
      const r = OCRStructuredDataSchema.safeParse({ confidence: 0.5 })
      expect(r.success).toBe(false)
    })

    it('rejects when confidence is missing', () => {
      const r = OCRStructuredDataSchema.safeParse({ rawText: 'x' })
      expect(r.success).toBe(false)
    })

    it('rejects when rawText is the wrong type', () => {
      const bad: Record<string, unknown> = { rawText: 123, confidence: 0.5 }
      const r = OCRStructuredDataSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('rejects when confidence is the wrong type', () => {
      const bad: Record<string, unknown> = { rawText: 'x', confidence: 'high' }
      const r = OCRStructuredDataSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('rejects an item missing its required name', () => {
      const bad: Record<string, unknown> = {
        rawText: 'x',
        confidence: 0.5,
        items: [{ quantity: 1 }],
      }
      const r = OCRStructuredDataSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('accepts items with only the required name field', () => {
      const parsed = OCRStructuredDataSchema.parse({
        rawText: 'x',
        confidence: 0.5,
        items: [{ name: 'name-only' }],
      })
      expect(parsed.items?.[0].name).toBe('name-only')
      expect(parsed.items?.[0].quantity).toBeUndefined()
    })

    it('exposes parse errors via safeParse on invalid input', () => {
      const r = OCRStructuredDataSchema.safeParse({ rawText: 'x', confidence: 'bad' })
      if (!r.success) {
        expect(r.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('OCRResultSchema', () => {
    it('parses a success result for either engine', () => {
      for (const engine of ['ndlocr', 'yomitoku'] as const) {
        const r = OCRResultSchema.safeParse({
          success: true,
          data: { rawText: 'text', confidence: 0.9 },
          confidence: 0.9,
          engine,
        })
        expect(r.success).toBe(true)
      }
    })

    it('narrows a parsed success result to its data', () => {
      const parsed = OCRResultSchema.parse({
        success: true as const,
        data: { rawText: 'text', confidence: 0.9 },
        confidence: 0.9,
        engine: 'ndlocr' as const,
      })
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.engine).toBe('ndlocr')
        expect(parsed.data.rawText).toBe('text')
        expect(parsed.confidence).toBe(0.9)
      }
    })

    it('parses a failure result for every error code', () => {
      const codes = [
        'FILE_NOT_FOUND',
        'FILE_TOO_LARGE',
        'INVALID_FILE_TYPE',
        'OCR_FAILED',
        'OCR_UNAVAILABLE',
        'TIMEOUT',
        'UNKNOWN_ERROR',
      ] as const
      for (const code of codes) {
        const r = OCRResultSchema.safeParse({
          success: false,
          error: { code, message: `msg:${code}` },
        })
        expect(r.success).toBe(true)
      }
    })

    it('narrows a parsed failure result to its error', () => {
      const parsed = OCRResultSchema.parse({
        success: false as const,
        error: { code: 'OCR_FAILED', message: 'engine down' },
      })
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.code).toBe('OCR_FAILED')
        expect(parsed.error.message).toBe('engine down')
        expect(parsed.error.cause).toBeUndefined()
      }
    })

    it('accepts an optional Error cause on the failure branch', () => {
      const cause = new Error('inner failure')
      const parsed = OCRResultSchema.parse({
        success: false as const,
        error: { code: 'TIMEOUT', message: 'timed out', cause },
      })
      if (!parsed.success) {
        expect(parsed.error.cause).toBeInstanceOf(Error)
        expect(parsed.error.cause).toBe(cause)
      }
    })

    it('rejects a non-Error cause on the failure branch', () => {
      const bad: Record<string, unknown> = {
        success: false,
        error: { code: 'TIMEOUT', message: 'm', cause: 'not-an-error' },
      }
      const r = OCRResultSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('rejects when the discriminator is missing', () => {
      const r = OCRResultSchema.safeParse({ data: { rawText: 'x', confidence: 1 } })
      expect(r.success).toBe(false)
    })

    it('rejects an invalid discriminator value', () => {
      const bad: Record<string, unknown> = { success: 'maybe' }
      const r = OCRResultSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('rejects a success branch missing required data', () => {
      const bad: Record<string, unknown> = {
        success: true,
        confidence: 0.9,
        engine: 'ndlocr',
      }
      const r = OCRResultSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('rejects a success branch with an invalid engine', () => {
      const bad: Record<string, unknown> = {
        success: true,
        data: { rawText: 'x', confidence: 0.9 },
        confidence: 0.9,
        engine: 'tesseract',
      }
      const r = OCRResultSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('rejects a failure branch missing error.code', () => {
      const bad: Record<string, unknown> = {
        success: false,
        error: { message: 'm' },
      }
      const r = OCRResultSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })

    it('rejects a failure branch with an invalid error code', () => {
      const bad: Record<string, unknown> = {
        success: false,
        error: { code: 'NOT_A_REAL_CODE', message: 'm' },
      }
      const r = OCRResultSchema.safeParse(bad)
      expect(r.success).toBe(false)
    })
  })

  describe('types', () => {
    it('OCREngineType is exactly the engine union', () => {
      const ndlocr: OCREngineType = 'ndlocr'
      const yomitoku: OCREngineType = 'yomitoku'
      expect(ndlocr).toBe('ndlocr')
      expect(yomitoku).toBe('yomitoku')
      expectTypeOf<OCREngineType>().toEqualTypeOf<'ndlocr' | 'yomitoku'>()
    })

    it('OCRErrorCode is exactly the seven-code union', () => {
      const code: OCRErrorCode = 'TIMEOUT'
      expect(code).toBe('TIMEOUT')
      expectTypeOf<OCRErrorCode>().toEqualTypeOf<
        | 'FILE_NOT_FOUND'
        | 'FILE_TOO_LARGE'
        | 'INVALID_FILE_TYPE'
        | 'OCR_FAILED'
        | 'OCR_UNAVAILABLE'
        | 'TIMEOUT'
        | 'UNKNOWN_ERROR'
      >()
    })

    it('OCRResult narrows on the success flag', () => {
      const ok: OCRResult = {
        success: true,
        data: { rawText: 'x', confidence: 1 },
        confidence: 1,
        engine: 'ndlocr',
      }
      const fail: OCRResult = {
        success: false,
        error: { code: 'TIMEOUT', message: 'timed out' },
      }
      if (ok.success) {
        expectTypeOf(ok.data).toMatchTypeOf<OCRStructuredData>()
        expectTypeOf(ok.engine).toEqualTypeOf<'ndlocr' | 'yomitoku'>()
      }
      if (!fail.success) {
        expectTypeOf(fail.error).toMatchTypeOf<OCRError>()
      }
    })

    it('OCRResult<T> substitutes the success-data type', () => {
      const ok: OCRResult<string> = {
        success: true,
        data: 'plain-text-ocr',
        confidence: 0.5,
        engine: 'yomitoku',
      }
      expect(ok.success).toBe(true)
      if (ok.success) {
        expect(ok.data).toBe('plain-text-ocr')
        expectTypeOf(ok.data).toEqualTypeOf<string>()
      }
    })

    it('OCRError accepts an optional cause', () => {
      const withoutCause: OCRError = { code: 'UNKNOWN_ERROR', message: 'm' }
      const withCause: OCRError = {
        code: 'OCR_FAILED',
        message: 'm',
        cause: new Error('root'),
      }
      expect(withoutCause.cause).toBeUndefined()
      expect(withCause.cause).toBeInstanceOf(Error)
    })

    it('interfaces accept valid shapes', () => {
      const item: OCRItem = { name: 'Pen', quantity: 2, unitPrice: 100, amount: 200 }
      const data: OCRStructuredData = { rawText: 'r', confidence: 0.9 }
      const minimalItem: OCRItem = { name: 'name-only' }
      const opts: OCROptions = {
        language: 'ja',
        outputFormat: 'markdown',
        timeout: 5000,
      }
      const emptyOpts: OCROptions = {}
      const cfg: OCRConfig = {
        engine: 'yomitoku',
        ndlocr: { enabled: false, dockerEndpoint: 'http://x', timeout: 1 },
        yomitoku: { enabled: true, apiUrl: 'http://y', liteMode: true, timeout: 2 },
        maxFileSize: 1,
        allowedTypes: ['image/png'],
      }

      expect(item.amount).toBe(200)
      expect(minimalItem.quantity).toBeUndefined()
      expect(data.rawText).toBe('r')
      expect(opts.language).toBe('ja')
      expect(emptyOpts.timeout).toBeUndefined()
      expect(cfg.engine).toBe('yomitoku')
      expect(cfg.allowedTypes).toEqual(['image/png'])
    })
  })
})

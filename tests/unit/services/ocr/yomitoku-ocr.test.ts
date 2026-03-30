import { YomitokuOCREngine, createYomitokuOCREngine } from '@/services/ocr/yomitoku-ocr'
import type { OCRConfig } from '@/types/ocr'

const mockConfig: OCRConfig = {
  engine: 'yomitoku',
  ndlocr: { enabled: false, dockerEndpoint: '', timeout: 60000 },
  yomitoku: { enabled: true, apiUrl: 'http://localhost:8001', liteMode: true, timeout: 60000 },
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['image/png', 'image/jpeg'],
}

vi.stubGlobal('fetch', vi.fn())

describe('YomitokuOCREngine', () => {
  let engine: YomitokuOCREngine

  beforeEach(() => {
    engine = new YomitokuOCREngine(mockConfig)
    vi.mocked(fetch).mockReset()
  })

  it('has name yomitoku', () => {
    expect(engine.name).toBe('yomitoku')
  })

  it('returns failure for empty buffer', async () => {
    const result = await engine.recognize(Buffer.alloc(0))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('FILE_NOT_FOUND')
    }
  })

  it('returns success with valid response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: 'YomiToku OCR', confidence: 0.92 }),
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rawText).toBe('YomiToku OCR')
      expect(result.confidence).toBe(0.92)
    }
  })

  it('defaults confidence to 0.85 when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: 'text' }),
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.confidence).toBe(0.85)
    }
  })

  it('returns failure on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('OCR_FAILED')
      expect(result.error.message).toContain('403')
    }
  })

  it('returns OCR_UNAVAILABLE on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'))

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('OCR_UNAVAILABLE')
      expect(result.error.message).toContain('Connection refused')
    }
  })

  it('handles structured data from response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          text: 'structured',
          confidence: 0.88,
          structured: { vendor: 'Test Vendor', taxAmount: 100 },
        }),
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.vendor).toBe('Test Vendor')
      expect(result.data.taxAmount).toBe(100)
    }
  })

  describe('createYomitokuOCREngine', () => {
    it('creates YomitokuOCREngine instance', () => {
      const engine = createYomitokuOCREngine(mockConfig)
      expect(engine).toBeInstanceOf(YomitokuOCREngine)
    })
  })
})

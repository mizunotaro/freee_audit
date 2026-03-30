import { NDLOCREngine, createNDLOCREngine } from '@/services/ocr/ndlocr-ocr'
import type { OCRConfig } from '@/types/ocr'

const mockConfig: OCRConfig = {
  engine: 'ndlocr',
  ndlocr: { enabled: true, dockerEndpoint: 'http://localhost:8002', timeout: 60000 },
  yomitoku: { enabled: false, apiUrl: '', liteMode: false, timeout: 60000 },
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['image/png', 'image/jpeg'],
}

vi.stubGlobal('fetch', vi.fn())

describe('NDLOCREngine', () => {
  let engine: NDLOCREngine

  beforeEach(() => {
    engine = new NDLOCREngine(mockConfig)
    vi.mocked(fetch).mockReset()
  })

  it('has name ndlocr', () => {
    expect(engine.name).toBe('ndlocr')
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
      json: () => Promise.resolve({ text: 'Hello OCR', confidence: 0.95 }),
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rawText).toBe('Hello OCR')
      expect(result.confidence).toBe(0.95)
    }
  })

  it('defaults confidence to 0.8 when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: 'some text' }),
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.confidence).toBe(0.8)
    }
  })

  it('returns failure on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('OCR_FAILED')
      expect(result.error.message).toContain('500')
    }
  })

  it('returns timeout error on timeout', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))

    const result = await engine.recognize(Buffer.alloc(100), { timeout: 10 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('TIMEOUT')
    }
  })

  it('returns OCR_UNAVAILABLE on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network down'))

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('OCR_UNAVAILABLE')
      expect(result.error.message).toContain('Network down')
    }
  })

  it('handles structured data from response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          text: 'structured text',
          confidence: 0.9,
          structured: { date: '2024-01-01', totalAmount: 1000 },
        }),
    } as Response)

    const result = await engine.recognize(Buffer.alloc(100))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.date).toBe('2024-01-01')
      expect(result.data.totalAmount).toBe(1000)
    }
  })

  describe('createNDLOCREngine', () => {
    it('creates NDLOCREngine instance', () => {
      const engine = createNDLOCREngine(mockConfig)
      expect(engine).toBeInstanceOf(NDLOCREngine)
    })
  })
})

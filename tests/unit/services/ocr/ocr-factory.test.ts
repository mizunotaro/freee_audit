import { OCRFactory, getOCREngine, createOCRFactory } from '@/services/ocr/ocr-factory'
import { NDLOCREngine } from '@/services/ocr/ndlocr-ocr'
import { YomitokuOCREngine } from '@/services/ocr/yomitoku-ocr'
import type { OCRConfig } from '@/types/ocr'
import { DEFAULT_OCR_CONFIG } from '@/types/ocr'

vi.mock('@/lib/db', () => ({
  prisma: {
    companySettings: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

const config: OCRConfig = {
  ...DEFAULT_OCR_CONFIG,
  yomitoku: { ...DEFAULT_OCR_CONFIG.yomitoku, enabled: true },
}

describe('OCRFactory', () => {
  beforeEach(() => {
    OCRFactory.reset()
    vi.mocked(prisma.companySettings.findUnique).mockReset()
  })

  afterAll(() => {
    OCRFactory.reset()
  })

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const a = OCRFactory.getInstance(config)
      const b = OCRFactory.getInstance(config)
      expect(a).toBe(b)
    })

    it('creates new instance after reset', () => {
      const a = OCRFactory.getInstance(config)
      OCRFactory.reset()
      const b = OCRFactory.getInstance(config)
      expect(a).not.toBe(b)
    })
  })

  describe('getEngine', () => {
    it('returns default engine without companyId', async () => {
      const factory = OCRFactory.getInstance(config)
      const engine = await factory.getEngine()
      expect(engine).toBeInstanceOf(NDLOCREngine)
    })

    it('returns cached engine on second call', async () => {
      const factory = OCRFactory.getInstance(config)
      const first = await factory.getEngine('company1')
      const second = await factory.getEngine('company1')
      expect(first).toBe(second)
    })

    it('uses company-specific engine setting', async () => {
      vi.mocked(prisma.companySettings.findUnique).mockResolvedValueOnce({
        ocrEngine: 'yomitoku',
      } as any)

      const factory = OCRFactory.getInstance(config)
      const engine = await factory.getEngine('company-yomi')
      expect(engine).toBeInstanceOf(YomitokuOCREngine)
    })

    it('falls back to default engine when no company setting', async () => {
      vi.mocked(prisma.companySettings.findUnique).mockResolvedValueOnce(null)

      const factory = OCRFactory.getInstance(config)
      const engine = await factory.getEngine('company-default')
      expect(engine).toBeInstanceOf(NDLOCREngine)
    })
  })

  describe('createEngine', () => {
    it('throws for yomitoku when disabled', () => {
      const disabledConfig = { ...config, yomitoku: { ...config.yomitoku, enabled: false } }
      OCRFactory.reset()
      const factory = OCRFactory.getInstance(disabledConfig)
      expect(() => factory['createEngine']('yomitoku')).toThrow('YomiToku is not enabled')
    })

    it('throws for unknown engine type', () => {
      const factory = OCRFactory.getInstance(config)
      expect(() => factory['createEngine']('unknown' as any)).toThrow('Unknown OCR engine')
    })
  })

  describe('clearCache', () => {
    it('clears engine cache', async () => {
      const factory = OCRFactory.getInstance(config)
      await factory.getEngine('c1')
      expect(factory['engineCache'].size).toBeGreaterThanOrEqual(0)
      factory.clearCache()
      expect(factory['engineCache'].size).toBe(0)
    })
  })

  describe('getOCREngine', () => {
    it('delegates to factory', async () => {
      OCRFactory.reset()
      const engine = await getOCREngine()
      expect(engine).toBeDefined()
    })
  })

  describe('createOCRFactory', () => {
    it('returns factory instance', () => {
      OCRFactory.reset()
      const factory = createOCRFactory(config)
      expect(factory).toBeInstanceOf(OCRFactory)
    })
  })
})

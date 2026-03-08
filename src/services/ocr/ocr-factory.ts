import type { OCREngineType, OCRConfig } from '@/types/ocr'
import { DEFAULT_OCR_CONFIG } from '@/types/ocr'
import { BaseOCREngine } from './base-ocr'
import { createNDLOCREngine } from './ndlocr-ocr'
import { createYomitokuOCREngine } from './yomitoku-ocr'
import { prisma } from '@/lib/db'

export type { OCREngineType, OCRConfig }

export class OCRFactory {
  private static instance: OCRFactory | null = null
  private config: OCRConfig
  private engineCache: Map<string, BaseOCREngine> = new Map()

  private constructor(config: OCRConfig) {
    this.config = config
  }

  static getInstance(config: OCRConfig = DEFAULT_OCR_CONFIG): OCRFactory {
    if (!OCRFactory.instance) {
      OCRFactory.instance = new OCRFactory(config)
    }
    return OCRFactory.instance
  }

  static reset(): void {
    OCRFactory.instance = null
  }

  async getEngine(companyId?: string): Promise<BaseOCREngine> {
    let engineType: OCREngineType = this.config.engine

    if (companyId) {
      const settings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: { ocrEngine: true },
      })
      if (settings?.ocrEngine) {
        engineType = settings.ocrEngine as OCREngineType
      }
    }

    const cacheKey = `${engineType}:${companyId || 'default'}`
    const cached = this.engineCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const engine = this.createEngine(engineType)
    this.engineCache.set(cacheKey, engine)
    return engine
  }

  private createEngine(type: OCREngineType): BaseOCREngine {
    switch (type) {
      case 'ndlocr':
        return createNDLOCREngine(this.config)
      case 'yomitoku':
        if (!this.config.yomitoku.enabled) {
          throw new Error('YomiToku is not enabled')
        }
        return createYomitokuOCREngine(this.config)
      default:
        throw new Error(`Unknown OCR engine: ${type}`)
    }
  }

  clearCache(): void {
    this.engineCache.clear()
  }
}

export async function getOCREngine(companyId?: string): Promise<BaseOCREngine> {
  return OCRFactory.getInstance().getEngine(companyId)
}

export function createOCRFactory(config: OCRConfig): OCRFactory {
  return OCRFactory.getInstance(config)
}

import { BaseOCREngine } from './base-ocr'
import type { OCRResult, OCROptions, OCRStructuredData, OCRConfig } from '@/types/ocr'

interface NDLOCRResponse {
  text?: string
  confidence?: number
  structured?: Partial<OCRStructuredData>
}

export class NDLOCREngine extends BaseOCREngine {
  readonly name = 'ndlocr' as const
  private endpoint: string
  private timeout: number

  constructor(config: OCRConfig) {
    super(config)
    this.endpoint = config.ndlocr.dockerEndpoint
    this.timeout = config.ndlocr.timeout
  }

  async recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult> {
    const validation = this.validateFile(imageBuffer, 'image/png')
    if (!validation.valid) {
      return this.createFailure(validation.error!)
    }

    try {
      const formData = new FormData()
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' })
      formData.append('file', blob, 'image.png')

      if (options?.language) {
        formData.append('language', options.language)
      }

      const result = await this.withTimeout(
        fetch(`${this.endpoint}/ocr`, {
          method: 'POST',
          body: formData,
        }),
        options?.timeout || this.timeout
      )

      if (!result.ok) {
        return this.createFailure({
          code: 'OCR_FAILED',
          message: `NDLOCR returned ${result.status}: ${result.statusText}`,
        })
      }

      const data: NDLOCRResponse = await result.json()
      return this.parseResponse(data)
    } catch (error) {
      if (error instanceof Error && error.message === 'OCR timeout') {
        return this.createFailure({
          code: 'TIMEOUT',
          message: 'OCR request timed out',
          cause: error,
        })
      }
      return this.createFailure({
        code: 'OCR_UNAVAILABLE',
        message: `NDLOCR unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error instanceof Error ? error : undefined,
      })
    }
  }

  private parseResponse(data: NDLOCRResponse): OCRResult {
    const confidence = data.confidence ?? 0.8

    const structuredData: OCRStructuredData = {
      rawText: data.text || '',
      confidence,
      ...data.structured,
    }

    return this.createSuccess(structuredData, confidence)
  }
}

export function createNDLOCREngine(config: OCRConfig): NDLOCREngine {
  return new NDLOCREngine(config)
}

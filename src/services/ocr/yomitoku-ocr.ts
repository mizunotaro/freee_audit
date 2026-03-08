import { BaseOCREngine } from './base-ocr'
import type { OCRResult, OCROptions, OCRStructuredData, OCRConfig } from '@/types/ocr'

export class YomitokuOCREngine extends BaseOCREngine {
  readonly name = 'yomitoku' as const
  private apiUrl: string
  private liteMode: boolean
  private timeout: number

  constructor(config: OCRConfig) {
    super(config)
    this.apiUrl = config.yomitoku.apiUrl
    this.liteMode = config.yomitoku.liteMode
    this.timeout = config.yomitoku.timeout
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
      formData.append('lite', String(this.liteMode))

      if (options?.language) {
        formData.append('language', options.language)
      }
      if (options?.outputFormat) {
        formData.append('output_format', options.outputFormat)
      }

      const result = await this.withTimeout(
        fetch(`${this.apiUrl}/ocr`, {
          method: 'POST',
          body: formData,
        }),
        options?.timeout || this.timeout
      )

      if (!result.ok) {
        return this.createFailure({
          code: 'OCR_FAILED',
          message: `YomiToku returned ${result.status}: ${result.statusText}`,
        })
      }

      const data = await result.json()
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
        message: `YomiToku unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error instanceof Error ? error : undefined,
      })
    }
  }

  private parseResponse(data: {
    text?: string
    confidence?: number
    structured?: Partial<OCRStructuredData>
  }): OCRResult {
    const confidence = data.confidence ?? 0.85

    const structuredData: OCRStructuredData = {
      rawText: data.text || '',
      confidence,
      ...data.structured,
    }

    return this.createSuccess(structuredData, confidence)
  }
}

export function createYomitokuOCREngine(config: OCRConfig): YomitokuOCREngine {
  return new YomitokuOCREngine(config)
}

import type {
  OCREngineType,
  OCRResult,
  OCROptions,
  OCRStructuredData,
  OCRError,
  OCRConfig,
} from '@/types/ocr'

export abstract class BaseOCREngine {
  abstract readonly name: OCREngineType
  protected config: OCRConfig

  constructor(config: OCRConfig) {
    this.config = config
  }

  abstract recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult>

  protected validateFile(buffer: Buffer, mimeType: string): { valid: boolean; error?: OCRError } {
    if (buffer.length === 0) {
      return {
        valid: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File is empty',
        },
      }
    }

    if (buffer.length > this.config.maxFileSize) {
      return {
        valid: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum (${(this.config.maxFileSize / 1024 / 1024).toFixed(2)}MB)`,
        },
      }
    }

    if (!this.config.allowedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `File type "${mimeType}" is not allowed`,
        },
      }
    }

    return { valid: true }
  }

  protected createSuccess(data: OCRStructuredData, confidence: number): OCRResult {
    return {
      success: true,
      data,
      confidence,
      engine: this.name,
    }
  }

  protected createFailure(error: OCRError): OCRResult {
    return {
      success: false,
      error,
    }
  }

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), timeoutMs)
      ),
    ])
  }
}

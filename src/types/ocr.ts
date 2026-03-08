import { z } from 'zod'

export type OCREngineType = 'ndlocr' | 'yomitoku'

export type OCRResult<T = OCRStructuredData> =
  | { success: true; data: T; confidence: number; engine: OCREngineType }
  | { success: false; error: OCRError }

export interface OCRError {
  code: OCRErrorCode
  message: string
  cause?: Error
}

export type OCRErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'OCR_FAILED'
  | 'OCR_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR'

export interface OCROptions {
  language?: 'ja' | 'en' | 'auto'
  outputFormat?: 'text' | 'markdown' | 'structured'
  timeout?: number
}

export interface OCRStructuredData {
  rawText: string
  date?: string
  totalAmount?: number
  taxAmount?: number
  taxRate?: number
  vendor?: string
  items?: OCRItem[]
  confidence: number
}

export interface OCRItem {
  name: string
  quantity?: number
  unitPrice?: number
  amount?: number
}

export interface OCRConfig {
  engine: OCREngineType
  ndlocr: {
    enabled: boolean
    dockerEndpoint: string
    timeout: number
  }
  yomitoku: {
    enabled: boolean
    apiUrl: string
    liteMode: boolean
    timeout: number
  }
  maxFileSize: number
  allowedTypes: string[]
}

export const DEFAULT_OCR_CONFIG: OCRConfig = {
  engine: 'ndlocr',
  ndlocr: {
    enabled: true,
    dockerEndpoint: process.env.NDLOCR_DOCKER_ENDPOINT || 'http://localhost:8002',
    timeout: 60000,
  },
  yomitoku: {
    enabled: process.env.YOMITOKU_ENABLED === 'true',
    apiUrl: process.env.YOMITOKU_API_URL || 'http://localhost:8001',
    liteMode: process.env.YOMITOKU_LITE_MODE === 'true',
    timeout: 60000,
  },
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
}

export const OCRStructuredDataSchema = z.object({
  rawText: z.string(),
  date: z.string().optional(),
  totalAmount: z.number().optional(),
  taxAmount: z.number().optional(),
  taxRate: z.number().optional(),
  vendor: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
        amount: z.number().optional(),
      })
    )
    .optional(),
  confidence: z.number(),
})

export const OCRResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: OCRStructuredDataSchema,
    confidence: z.number(),
    engine: z.enum(['ndlocr', 'yomitoku']),
  }),
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.enum([
        'FILE_NOT_FOUND',
        'FILE_TOO_LARGE',
        'INVALID_FILE_TYPE',
        'OCR_FAILED',
        'OCR_UNAVAILABLE',
        'TIMEOUT',
        'UNKNOWN_ERROR',
      ]),
      message: z.string(),
      cause: z.instanceof(Error).optional(),
    }),
  }),
])

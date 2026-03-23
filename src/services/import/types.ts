import { z } from 'zod'
import type { Result, AppError } from '@/types/result'

export const IMPORT_CONFIG_VERSION = '1.0.0'

export const IMPORT_LIMITS = {
  MAX_FILE_SIZE_CSV: 10 * 1024 * 1024,
  MAX_FILE_SIZE_EXCEL: 10 * 1024 * 1024,
  MAX_ROWS: 10000,
  BATCH_SIZE: 500,
  TIMEOUT_MS: 30000,
  PREVIEW_ROWS: 10,
  MAX_ERRORS_DISPLAY: 100,
} as const

export type ImportType = 'journal' | 'monthly_balance' | 'account_item'

export type ImportStatus =
  | 'pending'
  | 'parsing'
  | 'validating'
  | 'previewing'
  | 'importing'
  | 'completed'
  | 'partial'
  | 'failed'

export interface ImportOptions {
  skipDuplicates?: boolean
  updateExisting?: boolean
  language?: 'ja' | 'en'
  dryRun?: boolean
}

export const DEFAULT_IMPORT_OPTIONS: Required<ImportOptions> = {
  skipDuplicates: true,
  updateExisting: false,
  language: 'ja',
  dryRun: false,
}

export interface ImportError {
  row: number
  code: ImportErrorCode
  message: string
  field?: string
  value?: unknown
  severity: 'error' | 'warning'
}

export type ImportErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'PARSE_ERROR'
  | 'PARSE_WARNING'
  | 'MISSING_HEADERS'
  | 'INVALID_HEADER'
  | 'VALIDATION_ERROR'
  | 'REQUIRED_FIELD'
  | 'INVALID_FORMAT'
  | 'INVALID_VALUE'
  | 'DUPLICATE'
  | 'REFERENCE_NOT_FOUND'
  | 'BUSINESS_RULE_VIOLATION'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR'

export interface ImportWarning {
  row: number
  code: string
  message: string
  field?: string
}

export interface ImportContext {
  companyId: string
  userId?: string
  jobId?: string
  fiscalYear?: number
  departmentId?: string
}

export interface BaseImporterConfig<T> {
  type: ImportType
  schema: z.ZodSchema<T>
  requiredHeaders: string[]
  headerMappings: Record<string, string>
  modelName: string
}

export interface ImportPreview {
  type: ImportType
  headers: string[]
  mappedHeaders: Record<string, string>
  rows: Record<string, unknown>[]
  totalRows: number
  detectedLanguage: 'ja' | 'en' | 'unknown'
  warnings: string[]
  sampleErrors: ImportError[]
}

export interface ImportResult<T = unknown> {
  success: boolean
  status: ImportStatus
  imported: number
  skipped: number
  failed: number
  errors: ImportError[]
  warnings: ImportWarning[]
  totalRows: number
  validRows: number
  data?: T[]
  jobId?: string
  timestamp: Date
  durationMs: number
}

export interface ParseResult<T = Record<string, unknown>> {
  headers: string[]
  mappedHeaders: Record<string, string>
  rows: T[]
  totalRows: number
  detectedLanguage: 'ja' | 'en' | 'unknown'
  warnings: string[]
  errors?: ImportError[]
}

export interface ValidationResult<T> {
  valid: T[]
  invalid: Array<{ row: number; data: unknown; errors: ImportError[] }>
}

export interface ImportJob {
  id: string
  type: ImportType
  status: ImportStatus
  companyId: string
  fileName: string
  fileSize: number
  totalRows: number
  processedRows: number
  progress: number
  errors: ImportError[]
  warnings: ImportWarning[]
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface HeaderMapping {
  source: string
  target: string
  confidence: number
  language: 'ja' | 'en'
}

export type ParserResult<T> = Result<ParseResult<T>, AppError>
export type ImporterResult = Result<ImportResult, AppError>

export interface FileValidation {
  valid: boolean
  error?: ImportError
}

export const SUPPORTED_FILE_TYPES = {
  csv: ['text/csv', 'application/csv', '.csv'],
  excel: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    '.xlsx',
    '.xls',
  ],
} as const

export const IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, Record<'ja' | 'en', string>> = {
  FILE_TOO_LARGE: {
    ja: 'ファイルサイズが上限を超えています',
    en: 'File size exceeds the limit',
  },
  INVALID_FILE_TYPE: {
    ja: 'サポートされていないファイル形式です',
    en: 'Unsupported file type',
  },
  PARSE_ERROR: {
    ja: 'ファイルの解析に失敗しました',
    en: 'Failed to parse file',
  },
  PARSE_WARNING: {
    ja: 'パース中に警告が発生しました',
    en: 'Warning occurred during parsing',
  },
  MISSING_HEADERS: {
    ja: '必須ヘッダーが不足しています',
    en: 'Required headers are missing',
  },
  INVALID_HEADER: {
    ja: '無効なヘッダーです',
    en: 'Invalid header',
  },
  VALIDATION_ERROR: {
    ja: 'バリデーションエラー',
    en: 'Validation error',
  },
  REQUIRED_FIELD: {
    ja: '必須フィールドです',
    en: 'Required field',
  },
  INVALID_FORMAT: {
    ja: '形式が正しくありません',
    en: 'Invalid format',
  },
  INVALID_VALUE: {
    ja: '無効な値です',
    en: 'Invalid value',
  },
  DUPLICATE: {
    ja: '重複するデータが存在します',
    en: 'Duplicate data exists',
  },
  REFERENCE_NOT_FOUND: {
    ja: '参照先が見つかりません',
    en: 'Reference not found',
  },
  BUSINESS_RULE_VIOLATION: {
    ja: 'ビジネスルールに違反しています',
    en: 'Business rule violation',
  },
  DATABASE_ERROR: {
    ja: 'データベースエラー',
    en: 'Database error',
  },
  UNKNOWN_ERROR: {
    ja: '不明なエラー',
    en: 'Unknown error',
  },
}

export function getErrorMessage(code: ImportErrorCode, language: 'ja' | 'en'): string {
  return IMPORT_ERROR_MESSAGES[code]?.[language] ?? IMPORT_ERROR_MESSAGES.UNKNOWN_ERROR[language]
}

export interface ImporterOptions extends ImportOptions {
  skipDuplicates?: boolean
  updateExisting?: boolean
}

import type { ImportType, ImportStatus, ImportErrorCode } from '@/services/import/types'

export interface ImportErrorUI {
  row: number
  code: ImportErrorCode
  message: string
  field?: string
  value?: unknown
  severity: 'error' | 'warning'
}

export interface ImportPreviewData {
  type: ImportType
  headers: string[]
  mappedHeaders: Record<string, string>
  rows: Record<string, unknown>[]
  totalRows: number
  detectedLanguage: 'ja' | 'en' | 'unknown'
  warnings: string[]
  sampleErrors: ImportErrorUI[]
}

export interface ImportResultData {
  success: boolean
  status: ImportStatus
  imported: number
  skipped: number
  failed: number
  errors: ImportErrorUI[]
  warnings: string[]
  totalRows: number
  validRows: number
  durationMs?: number
}

export interface ImportState {
  step: 'upload' | 'preview' | 'importing' | 'result'
  file: File | null
  preview: ImportPreviewData | null
  result: ImportResultData | null
  error: string | null
}

export interface ImportOptions {
  skipDuplicates: boolean
  updateExisting: boolean
  dryRun: boolean
  language: 'ja' | 'en'
}

export const DEFAULT_UI_IMPORT_OPTIONS: ImportOptions = {
  skipDuplicates: true,
  updateExisting: false,
  dryRun: false,
  language: 'ja',
}

export const IMPORT_TYPE_LABELS: Record<ImportType, { ja: string; en: string }> = {
  journal: { ja: '仕訳データ', en: 'Journal Entries' },
  monthly_balance: { ja: '月次残高', en: 'Monthly Balances' },
  account_item: { ja: '勘定科目', en: 'Account Items' },
}

export const IMPORT_TYPE_DESCRIPTIONS: Record<ImportType, { ja: string; en: string }> = {
  journal: {
    ja: '仕訳伝票のデータをインポートします',
    en: 'Import journal entry data',
  },
  monthly_balance: {
    ja: '月次の勘定科目残高をインポートします',
    en: 'Import monthly account balances',
  },
  account_item: {
    ja: '勘定科目マスタをインポートします',
    en: 'Import account item master data',
  },
}

export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  csv: ['.csv'],
  excel: ['.xlsx', '.xls'],
}

export const MAX_FILE_SIZE_MB = 10

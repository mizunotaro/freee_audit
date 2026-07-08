import { describe, it, expect } from 'vitest'
import {
  IMPORT_CONFIG_VERSION,
  IMPORT_LIMITS,
  DEFAULT_IMPORT_OPTIONS,
  SUPPORTED_FILE_TYPES,
  IMPORT_ERROR_MESSAGES,
  getErrorMessage,
  type ImportErrorCode,
} from '@/services/import/types'

const IMPORT_ERROR_CODES: ImportErrorCode[] = [
  'FILE_TOO_LARGE',
  'INVALID_FILE_TYPE',
  'PARSE_ERROR',
  'PARSE_WARNING',
  'MISSING_HEADERS',
  'INVALID_HEADER',
  'VALIDATION_ERROR',
  'REQUIRED_FIELD',
  'INVALID_FORMAT',
  'INVALID_VALUE',
  'DUPLICATE',
  'REFERENCE_NOT_FOUND',
  'BUSINESS_RULE_VIOLATION',
  'DATABASE_ERROR',
  'UNKNOWN_ERROR',
]

describe('IMPORT_CONFIG_VERSION', () => {
  it('is a semver string', () => {
    expect(IMPORT_CONFIG_VERSION).toBe('1.0.0')
    expect(IMPORT_CONFIG_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('IMPORT_LIMITS', () => {
  it('caps CSV and Excel files at 10 MiB', () => {
    const tenMiB = 10 * 1024 * 1024
    expect(IMPORT_LIMITS.MAX_FILE_SIZE_CSV).toBe(tenMiB)
    expect(IMPORT_LIMITS.MAX_FILE_SIZE_EXCEL).toBe(tenMiB)
  })

  it('defines operational thresholds', () => {
    expect(IMPORT_LIMITS.MAX_ROWS).toBe(10000)
    expect(IMPORT_LIMITS.BATCH_SIZE).toBe(500)
    expect(IMPORT_LIMITS.TIMEOUT_MS).toBe(30000)
    expect(IMPORT_LIMITS.PREVIEW_ROWS).toBe(10)
    expect(IMPORT_LIMITS.MAX_ERRORS_DISPLAY).toBe(100)
  })

  it('keeps every limit strictly positive', () => {
    for (const value of Object.values(IMPORT_LIMITS)) {
      expect(value).toBeGreaterThan(0)
    }
  })
})

describe('DEFAULT_IMPORT_OPTIONS', () => {
  it('skips duplicates and does not overwrite by default', () => {
    expect(DEFAULT_IMPORT_OPTIONS.skipDuplicates).toBe(true)
    expect(DEFAULT_IMPORT_OPTIONS.updateExisting).toBe(false)
  })

  it('defaults to Japanese and non-dry-run', () => {
    expect(DEFAULT_IMPORT_OPTIONS.language).toBe('ja')
    expect(DEFAULT_IMPORT_OPTIONS.dryRun).toBe(false)
  })

  it('populates every ImportOptions field', () => {
    expect(Object.keys(DEFAULT_IMPORT_OPTIONS).sort()).toEqual(
      ['dryRun', 'language', 'skipDuplicates', 'updateExisting'].sort()
    )
  })
})

describe('SUPPORTED_FILE_TYPES', () => {
  it('accepts CSV by MIME type and extension', () => {
    expect(SUPPORTED_FILE_TYPES.csv).toContain('text/csv')
    expect(SUPPORTED_FILE_TYPES.csv).toContain('.csv')
  })

  it('accepts Excel by extension and MIME type', () => {
    expect(SUPPORTED_FILE_TYPES.excel).toContain('.xlsx')
    expect(SUPPORTED_FILE_TYPES.excel).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('does not cross-contaminate csv and excel types', () => {
    expect(SUPPORTED_FILE_TYPES.csv).not.toContain('.xlsx')
    expect(SUPPORTED_FILE_TYPES.excel).not.toContain('.csv')
  })
})

describe('IMPORT_ERROR_MESSAGES', () => {
  it('provides Japanese and English text for every error code', () => {
    for (const code of IMPORT_ERROR_CODES) {
      const messages = IMPORT_ERROR_MESSAGES[code]
      expect(typeof messages.ja).toBe('string')
      expect(messages.ja.length).toBeGreaterThan(0)
      expect(typeof messages.en).toBe('string')
      expect(messages.en.length).toBeGreaterThan(0)
    }
  })
})

describe('getErrorMessage', () => {
  it('returns the Japanese message for a known code', () => {
    expect(getErrorMessage('FILE_TOO_LARGE', 'ja')).toBe('ファイルサイズが上限を超えています')
  })

  it('returns the English message for a known code', () => {
    expect(getErrorMessage('DUPLICATE', 'en')).toBe('Duplicate data exists')
  })

  it('falls back to the UNKNOWN_ERROR message for an unrecognised code', () => {
    expect(getErrorMessage('NOPE' as ImportErrorCode, 'ja')).toBe(
      IMPORT_ERROR_MESSAGES.UNKNOWN_ERROR.ja
    )
    expect(getErrorMessage('NOPE' as ImportErrorCode, 'en')).toBe(
      IMPORT_ERROR_MESSAGES.UNKNOWN_ERROR.en
    )
  })
})

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_UI_IMPORT_OPTIONS,
  IMPORT_TYPE_LABELS,
  IMPORT_TYPE_DESCRIPTIONS,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_MB,
} from '@/components/import'

const IMPORT_TYPES = ['journal', 'monthly_balance', 'account_item'] as const

describe('import/types — exported contracts', () => {
  it('exposes safe default UI import options', () => {
    expect(DEFAULT_UI_IMPORT_OPTIONS).toEqual({
      skipDuplicates: true,
      updateExisting: false,
      dryRun: false,
      language: 'ja',
    })
  })

  it('provides ja + en labels for every import type', () => {
    for (const type of IMPORT_TYPES) {
      expect(IMPORT_TYPE_LABELS[type].ja).toBeTruthy()
      expect(IMPORT_TYPE_LABELS[type].en).toBeTruthy()
    }
    expect(Object.keys(IMPORT_TYPE_LABELS).sort()).toEqual([...IMPORT_TYPES].sort())
  })

  it('provides ja + en descriptions for every import type', () => {
    for (const type of IMPORT_TYPES) {
      expect(typeof IMPORT_TYPE_DESCRIPTIONS[type].ja).toBe('string')
      expect(IMPORT_TYPE_DESCRIPTIONS[type].ja.length).toBeGreaterThan(0)
      expect(typeof IMPORT_TYPE_DESCRIPTIONS[type].en).toBe('string')
      expect(IMPORT_TYPE_DESCRIPTIONS[type].en.length).toBeGreaterThan(0)
    }
  })

  it('declares accepted csv and excel extensions', () => {
    expect(ACCEPTED_FILE_TYPES.csv).toEqual(['.csv'])
    expect(ACCEPTED_FILE_TYPES.excel).toEqual(['.xlsx', '.xls'])
  })

  it('caps file size at 10MB (matches ImportCard / JournalImport limits)', () => {
    expect(MAX_FILE_SIZE_MB).toBe(10)
  })
})

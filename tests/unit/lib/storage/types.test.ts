import { describe, it, expect } from 'vitest'
import {
  DEFAULT_STORAGE_CONFIG,
  STORAGE_ERROR_MESSAGES,
  type StorageErrorCode,
} from '@/lib/storage/types'

const STORAGE_ERROR_CODES: readonly StorageErrorCode[] = [
  'FILE_NOT_FOUND',
  'FILE_TOO_LARGE',
  'INVALID_FILE_TYPE',
  'ENCRYPTION_FAILED',
  'DECRYPTION_FAILED',
  'STORAGE_UNAVAILABLE',
  'ACCESS_DENIED',
  'PATH_INVALID',
  'UNKNOWN_ERROR',
]

describe('DEFAULT_STORAGE_CONFIG', () => {
  it('enables AES-256-GCM encryption by default', () => {
    expect(DEFAULT_STORAGE_CONFIG.encryption?.enabled).toBe(true)
    expect(DEFAULT_STORAGE_CONFIG.encryption?.algorithm).toBe('AES-256-GCM')
  })

  it('caps maxFileSize at 10 MiB', () => {
    expect(DEFAULT_STORAGE_CONFIG.maxFileSize).toBe(10 * 1024 * 1024)
  })

  it('allows the expected document/image types', () => {
    expect(DEFAULT_STORAGE_CONFIG.allowedTypes).toEqual([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ])
  })

  it('defaults retention to 30 days', () => {
    expect(DEFAULT_STORAGE_CONFIG.retentionDays).toBe(30)
  })
})

describe('STORAGE_ERROR_MESSAGES', () => {
  it('has exactly one message per StorageErrorCode', () => {
    expect(Object.keys(STORAGE_ERROR_MESSAGES).sort()).toEqual([...STORAGE_ERROR_CODES].sort())
  })

  it('maps every code to a non-empty string', () => {
    for (const code of STORAGE_ERROR_CODES) {
      const message = STORAGE_ERROR_MESSAGES[code]
      expect(typeof message).toBe('string')
      expect(message.length).toBeGreaterThan(0)
    }
  })

  it('uses human-readable prose (no underscores leaked from the code key)', () => {
    expect(STORAGE_ERROR_MESSAGES.FILE_NOT_FOUND).toMatch(/not found/i)
    expect(STORAGE_ERROR_MESSAGES.FILE_TOO_LARGE).toMatch(/exceeds|maximum|too large/i)
    expect(STORAGE_ERROR_MESSAGES.INVALID_FILE_TYPE).toMatch(/not allowed|type/i)
    expect(STORAGE_ERROR_MESSAGES.UNKNOWN_ERROR).toMatch(/unknown/i)
  })
})

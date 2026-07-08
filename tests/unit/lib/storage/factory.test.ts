import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import { createStorageProvider } from '@/lib/storage/factory'
import { LocalStorageProvider } from '@/lib/storage/local-storage'
import type { StorageConfig } from '@/lib/storage/types'

const TMP_DIR = './tmp/cov-lib-02-factory'

function localConfig(overrides: Partial<StorageConfig> = {}): StorageConfig {
  return {
    provider: 'local',
    encryption: { enabled: true, algorithm: 'AES-256-GCM' },
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ['application/pdf', 'image/png', 'image/jpeg'],
    retentionDays: 30,
    local: {
      basePath: `${TMP_DIR}/data`,
      tempPath: `${TMP_DIR}/temp`,
    },
    ...overrides,
  }
}

describe('createStorageProvider', () => {
  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true })
  })

  it('returns a LocalStorageProvider for the local provider', () => {
    const provider = createStorageProvider(localConfig())
    expect(provider).toBeInstanceOf(LocalStorageProvider)
    expect(provider.name).toBe('local')
  })

  it('honours the supplied config (maxFileSize / allowedTypes)', () => {
    const provider = createStorageProvider(
      localConfig({ maxFileSize: 2048, allowedTypes: ['image/png'] })
    )
    expect(provider).toBeInstanceOf(LocalStorageProvider)
    expect((provider as unknown as { config: StorageConfig }).config.maxFileSize).toBe(2048)
  })

  it.each(['s3', 'gcs', 'azure', 'minio'] as const)(
    'throws for unsupported provider "%s"',
    (provider) => {
      expect(() => createStorageProvider(localConfig({ provider }))).toThrow(
        `Unsupported storage provider: ${provider}`
      )
    }
  )

  it('includes the offending provider name in the error message', () => {
    expect(() => createStorageProvider(localConfig({ provider: 's3' }))).toThrow(
      /Unsupported storage provider: s3/
    )
  })
})

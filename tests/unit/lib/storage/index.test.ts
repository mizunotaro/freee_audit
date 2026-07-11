import { describe, it, expect } from 'vitest'
import {
  LocalStorageProvider,
  createStorageProvider,
  type StorageConfig,
  type StorageProviderType,
  type Result,
} from '@/lib/storage'

describe('src/lib/storage public API', () => {
  it('re-exports the LocalStorageProvider class', () => {
    expect(LocalStorageProvider).toBeTypeOf('function')
  })

  it('re-exports the createStorageProvider factory', () => {
    expect(createStorageProvider).toBeTypeOf('function')
  })

  it('wires createStorageProvider to a LocalStorageProvider for "local"', () => {
    const provider = createStorageProvider({
      provider: 'local',
      encryption: { enabled: true, algorithm: 'AES-256-GCM' },
      maxFileSize: 10,
      allowedTypes: [],
      retentionDays: 1,
      local: { basePath: './tmp/cov-lib-02-index/data', tempPath: './tmp/cov-lib-02-index/temp' },
    })
    expect(provider).toBeInstanceOf(LocalStorageProvider)
    expect(provider.name).toBe('local')
  })

  it('exposes the StorageConfig / StorageProviderType / Result types (compile-time only)', () => {
    const config: StorageConfig = {
      provider: 'local' as StorageProviderType,
      encryption: { enabled: false, algorithm: 'AES-256-GCM' },
      maxFileSize: 0,
      allowedTypes: [],
      retentionDays: 0,
    }
    const ok: Result<number> = { success: true, data: 1 }
    expect(config.provider).toBe('local')
    expect(ok.success).toBe(true)
  })
})

import type { StorageConfig } from './types'
import { LocalStorageProvider } from './local-storage'

export type StorageFactoryConfig = StorageConfig

export function createStorageProvider(config: StorageConfig): LocalStorageProvider {
  if (config.provider === 'local') {
    return new LocalStorageProvider(config)
  }
  throw new Error(`Unsupported storage provider: ${config.provider}`)
}

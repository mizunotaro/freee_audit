import type { StorageConfig, FileMetadata, Result } from '@/lib/storage/types'
import { LocalStorageProvider } from '@/lib/storage/local-storage'

const DEFAULT_FILE_SERVICE_CONFIG: StorageConfig = {
  provider: 'local',
  encryption: { enabled: true, algorithm: 'AES-256-GCM' },
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
  retentionDays: 30,
}

export class FileService {
  private provider: LocalStorageProvider

  constructor(config: StorageConfig = DEFAULT_FILE_SERVICE_CONFIG) {
    this.provider = new LocalStorageProvider(config)
  }

  async putFile(
    data: Buffer,
    originalName: string,
    contentType: string,
    companyId: string,
    userId: string,
    metadata?: Record<string, string>
  ): Promise<Result<{ id: string; metadata: FileMetadata }>> {
    const result = await this.provider.putFile({
      data,
      originalName,
      contentType,
      companyId,
      userId,
      metadata,
    })

    if (!result.success) {
      return result
    }

    return {
      success: true,
      data: {
        id: result.data.id,
        metadata: result.data,
      },
    }
  }

  async getFile(
    id: string,
    companyId: string
  ): Promise<Result<{ id: string; metadata: FileMetadata; data: Buffer }>> {
    const result = await this.provider.getFile(id, { companyId })

    if (!result.success) {
      return result
    }

    const file = result.data
    return {
      success: true,
      data: {
        id,
        metadata: file.metadata,
        data: file.data,
      },
    }
  }

  async deleteFile(id: string, companyId: string): Promise<Result<void>> {
    return this.provider.deleteFile(id, { companyId })
  }

  async exists(id: string): Promise<boolean> {
    return this.provider.exists(id)
  }

  async getMetadata(id: string, companyId: string): Promise<Result<FileMetadata>> {
    return this.provider.getMetadata(id, { companyId })
  }
}

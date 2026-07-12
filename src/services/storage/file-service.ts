import type { StorageConfig, FileMetadata, Result } from '@/lib/storage/types'
import { LocalStorageProvider } from '@/lib/storage/local-storage'

const DEFAULT_FILE_SERVICE_CONFIG: StorageConfig = {
  provider: 'local',
  encryption: { enabled: true, algorithm: 'AES-256-GCM' },
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
  retentionDays: 30,
}

/**
 * High-level file service that delegates to a LocalStorageProvider, enforcing the
 * default size/type/retention config and company-scoped access on every call.
 */
export class FileService {
  private provider: LocalStorageProvider

  constructor(config: StorageConfig = DEFAULT_FILE_SERVICE_CONFIG) {
    this.provider = new LocalStorageProvider(config)
  }

  /**
   * Stores a file under the given company/user scope.
   *
   * @param data - File contents.
   * @param originalName - Original filename.
   * @param contentType - MIME type (must be in the allowed-types config).
   * @param companyId - Owning company.
   * @param userId - Uploading user.
   * @param metadata - Optional extra metadata to persist.
   * @returns success with the file id and metadata, or failure forwarding the
   *   provider error (e.g. size/type validation or write failure).
   */
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

  /**
   * Retrieves a file's contents and metadata, scoped to a company.
   *
   * @param id - File identifier.
   * @param companyId - Company that must own the file.
   * @returns success with id/metadata/data, or failure forwarding the provider error
   *   (e.g. not found or company mismatch).
   */
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

  /**
   * Deletes a file, scoped to a company.
   *
   * @param id - File identifier.
   * @param companyId - Company that must own the file.
   * @returns success on deletion, or failure forwarding the provider error.
   */
  async deleteFile(id: string, companyId: string): Promise<Result<void>> {
    return this.provider.deleteFile(id, { companyId })
  }

  /**
   * Checks whether a file exists (not company-scoped).
   *
   * @param id - File identifier.
   * @returns True if the file exists.
   */
  async exists(id: string): Promise<boolean> {
    return this.provider.exists(id)
  }

  /**
   * Retrieves a file's metadata only, scoped to a company.
   *
   * @param id - File identifier.
   * @param companyId - Company that must own the file.
   * @returns success with the metadata, or failure forwarding the provider error.
   */
  async getMetadata(id: string, companyId: string): Promise<Result<FileMetadata>> {
    return this.provider.getMetadata(id, { companyId })
  }
}

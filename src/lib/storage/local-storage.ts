import fs from 'fs'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { BaseStorageProvider } from './base-storage'
import {
  type StorageConfig,
  type PutFileOptions,
  type GetFileOptions,
  type GetFileResult,
  type DeleteFileOptions,
  type FileMetadata,
  type Result,
  type EncryptedFile,
} from './types'

export interface LocalStorageOptions extends StorageConfig {
  local: {
    basePath: string
    tempPath: string
  }
}

const DEFAULT_LOCAL_CONFIG: Partial<LocalStorageOptions> = {
  provider: 'local',
  local: {
    basePath: process.env.STORAGE_LOCAL_BASE_PATH || './data/storage',
    tempPath: process.env.STORAGE_LOCAL_TEMP_PATH || './data/temp',
  },
}

export class LocalStorageProvider extends BaseStorageProvider {
  readonly name = 'local' as const
  private basePath: string
  private tempPath: string

  constructor(config: Partial<LocalStorageOptions> = DEFAULT_LOCAL_CONFIG) {
    const fullConfig: LocalStorageOptions = {
      ...config,
      local: {
        basePath: config.local?.basePath || DEFAULT_LOCAL_CONFIG.local!.basePath,
        tempPath: config.local?.tempPath || DEFAULT_LOCAL_CONFIG.local!.tempPath,
      },
    } as LocalStorageOptions
    super(fullConfig)
    this.basePath = path.resolve(fullConfig.local.basePath)
    this.tempPath = path.resolve(fullConfig.local.tempPath)
    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    const dirs = [this.basePath, this.tempPath]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  async putFile(options: PutFileOptions): Promise<Result<FileMetadata>> {
    try {
      const validation = this.validateFile(options.data, options.contentType, options.originalName)
      if (!validation.valid) {
        return this.createFailure(
          this.createError('INVALID_FILE_TYPE', validation.errors.join('; '))
        )
      }

      const fileId = this.generateFileId()
      const securePath = this.generateSecurePath(options.companyId, fileId)
      const encryptedPathStr = this.encryptPath(securePath)
      const encryptedFile = await this.encryptFile(options.data)

      const fullPath = path.join(this.basePath, securePath)
      await fsPromises.mkdir(path.dirname(fullPath), { recursive: true })
      await fsPromises.writeFile(fullPath, encryptedFile.encryptedData)

      const metadata = this.buildMetadata(
        fileId,
        options,
        encryptedPathStr,
        encryptedFile.originalHash
      )

      const metadataPath = path.join(this.basePath, `${fileId}.meta.json`)
      await fsPromises.writeFile(
        metadataPath,
        JSON.stringify({
          ...metadata,
          encryption: {
            iv: encryptedFile.iv,
            authTag: encryptedFile.authTag,
            salt: encryptedFile.salt,
          },
        }),
        'utf8'
      )

      return this.createSuccess(metadata)
    } catch (error) {
      return this.createFailure(
        this.createError(
          'STORAGE_UNAVAILABLE',
          `Failed to store file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined
        )
      )
    }
  }

  async getFile(id: string, options: GetFileOptions): Promise<Result<GetFileResult>> {
    try {
      const metadataResult = await this.getMetadata(id, options)
      if (!metadataResult.success) {
        return this.createFailure(metadataResult.error)
      }

      const metadata = metadataResult.data
      const securePath = this.decryptPath(metadata.encryptedPath)
      const fullPath = path.join(this.basePath, securePath)

      if (!fs.existsSync(fullPath)) {
        return this.createFailure(this.createError('FILE_NOT_FOUND'))
      }

      const encryptedData = await fsPromises.readFile(fullPath)

      const metadataPath = path.join(this.basePath, `${id}.meta.json`)
      const metadataJson = await fsPromises.readFile(metadataPath, 'utf8')
      const storedMetadata = JSON.parse(metadataJson)

      const encryptedFile: EncryptedFile = {
        encryptedData,
        iv: storedMetadata.encryption.iv,
        authTag: storedMetadata.encryption.authTag,
        salt: storedMetadata.encryption.salt,
        originalHash: storedMetadata.hash,
      }

      const decryptedData = await this.decryptFile(encryptedFile)

      return this.createSuccess({
        data: decryptedData,
        metadata,
        decrypted: true,
      })
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return this.createFailure(this.createError('FILE_NOT_FOUND'))
      }
      return this.createFailure(
        this.createError(
          'STORAGE_UNAVAILABLE',
          `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined
        )
      )
    }
  }

  async deleteFile(id: string, options: DeleteFileOptions): Promise<Result<void>> {
    try {
      const metadataResult = await this.getMetadata(id, options)
      if (!metadataResult.success) {
        return this.createFailure(metadataResult.error)
      }

      const metadata = metadataResult.data
      const securePath = this.decryptPath(metadata.encryptedPath)
      const fullPath = path.join(this.basePath, securePath)
      const metadataPath = path.join(this.basePath, `${id}.meta.json`)

      if (fs.existsSync(fullPath)) {
        await fsPromises.unlink(fullPath)
      }

      if (fs.existsSync(metadataPath)) {
        await fsPromises.unlink(metadataPath)
      }

      return this.createSuccess(undefined)
    } catch (error) {
      return this.createFailure(
        this.createError(
          'STORAGE_UNAVAILABLE',
          `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined
        )
      )
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const metadataPath = path.join(this.basePath, `${id}.meta.json`)
      return fs.existsSync(metadataPath)
    } catch {
      return false
    }
  }

  async getMetadata(id: string, options: GetFileOptions): Promise<Result<FileMetadata>> {
    try {
      const metadataPath = path.join(this.basePath, `${id}.meta.json`)

      if (!fs.existsSync(metadataPath)) {
        return this.createFailure(this.createError('FILE_NOT_FOUND'))
      }

      const metadataJson = await fsPromises.readFile(metadataPath, 'utf8')
      const metadata: FileMetadata = JSON.parse(metadataJson)

      if (metadata.companyId !== options.companyId) {
        return this.createFailure(
          this.createError('ACCESS_DENIED', 'Access denied: file belongs to another company')
        )
      }

      return this.createSuccess(metadata)
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return this.createFailure(this.createError('FILE_NOT_FOUND'))
      }
      return this.createFailure(
        this.createError(
          'STORAGE_UNAVAILABLE',
          `Failed to read metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined
        )
      )
    }
  }
}

import crypto from 'crypto'
import type {
  StorageProviderType,
  StorageProvider,
  StorageConfig,
  PutFileOptions,
  GetFileOptions,
  GetFileResult,
  DeleteFileOptions,
  FileMetadata,
  Result,
  StorageError,
  EncryptedFile,
  FileValidationResult,
} from './types'
import { STORAGE_ERROR_MESSAGES, DEFAULT_STORAGE_CONFIG } from './types'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 32
const KEY_ITERATIONS = 100000

export abstract class BaseStorageProvider implements StorageProvider {
  abstract readonly name: StorageProviderType

  protected config: StorageConfig
  protected encryptionEnabled: boolean

  constructor(config: StorageConfig) {
    this.config = this.validateConfig(config)
    this.encryptionEnabled = config.encryption.enabled
  }

  abstract putFile(options: PutFileOptions): Promise<Result<FileMetadata>>
  abstract getFile(id: string, options: GetFileOptions): Promise<Result<GetFileResult>>
  abstract deleteFile(id: string, options: DeleteFileOptions): Promise<Result<void>>
  abstract exists(id: string): Promise<boolean>
  abstract getMetadata(id: string, options: GetFileOptions): Promise<Result<FileMetadata>>

  protected validateConfig(config: StorageConfig): StorageConfig {
    return {
      ...DEFAULT_STORAGE_CONFIG,
      ...config,
    } as StorageConfig
  }

  protected validateFile(
    data: Buffer,
    contentType: string,
    originalName: string
  ): FileValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (data.length === 0) {
      errors.push('File is empty')
    }

    if (data.length > this.config.maxFileSize) {
      errors.push(
        `File size (${(data.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(this.config.maxFileSize / 1024 / 1024).toFixed(2)}MB)`
      )
    }

    if (!this.config.allowedTypes.includes(contentType)) {
      errors.push(
        `File type "${contentType}" is not allowed. Allowed types: ${this.config.allowedTypes.join(', ')}`
      )
    }

    const extension = originalName.split('.').pop()?.toLowerCase()
    if (extension && !this.isAllowedExtension(extension)) {
      warnings.push(`File extension ".${extension}" may not match content type`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private isAllowedExtension(extension: string): boolean {
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg']
    return allowedExtensions.includes(extension)
  }

  protected generateFileId(): string {
    return crypto.randomUUID()
  }

  protected generateSecurePath(companyId: string, fileId: string): string {
    const randomBytes = crypto.randomBytes(16).toString('hex')
    const hash = crypto
      .createHash('sha256')
      .update(`${companyId}:${fileId}:${randomBytes}`)
      .digest('hex')
      .substring(0, 32)
    return `${companyId}/${hash.substring(0, 2)}/${hash.substring(2, 4)}/${fileId}`
  }

  protected hashFile(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  protected async encryptFile(data: Buffer): Promise<EncryptedFile> {
    const originalHash = this.hashFile(data)

    if (!this.encryptionEnabled) {
      return {
        encryptedData: data,
        iv: '',
        authTag: '',
        salt: '',
        originalHash,
      }
    }

    const encryptionKey = this.getEncryptionKey()
    const salt = crypto.randomBytes(SALT_LENGTH)
    const derivedKey = crypto.pbkdf2Sync(encryptionKey, salt, KEY_ITERATIONS, 32, 'sha256')
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const authTag = cipher.getAuthTag()

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: salt.toString('hex'),
      originalHash,
    }
  }

  protected async decryptFile(encryptedFile: EncryptedFile): Promise<Buffer> {
    if (!this.encryptionEnabled || !encryptedFile.iv) {
      return encryptedFile.encryptedData
    }

    const encryptionKey = this.getEncryptionKey()
    const salt = Buffer.from(encryptedFile.salt, 'hex')
    const derivedKey = crypto.pbkdf2Sync(encryptionKey, salt, KEY_ITERATIONS, 32, 'sha256')
    const iv = Buffer.from(encryptedFile.iv, 'hex')
    const authTag = Buffer.from(encryptedFile.authTag, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(authTag)

    try {
      const decrypted = Buffer.concat([
        decipher.update(encryptedFile.encryptedData),
        decipher.final(),
      ])

      const decryptedHash = this.hashFile(decrypted)
      if (decryptedHash !== encryptedFile.originalHash) {
        throw new Error('File integrity check failed')
      }

      return decrypted
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  protected encryptPath(path: string): string {
    const key = this.getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([cipher.update(path, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    const encryptedPath = Buffer.concat([iv, authTag, encrypted])
    return encryptedPath.toString('base64url')
  }

  protected decryptPath(encryptedPath: string): string {
    const key = this.getEncryptionKey()
    const buffer = Buffer.from(encryptedPath, 'base64url')

    const iv = buffer.subarray(0, IV_LENGTH)
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16)
    const encrypted = buffer.subarray(IV_LENGTH + 16)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  }

  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set')
    }
    if (key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)')
    }
    return Buffer.from(key, 'hex')
  }

  protected createError(code: StorageError['code'], message?: string, cause?: Error): StorageError {
    return {
      code,
      message: message || STORAGE_ERROR_MESSAGES[code],
      cause,
    }
  }

  protected createSuccess<T>(data: T): Result<T> {
    return { success: true, data }
  }

  protected createFailure<T>(error: StorageError): Result<T> {
    return { success: false, error }
  }

  protected calculateExpirationDate(expiresInDays?: number): Date | null {
    const days = expiresInDays ?? this.config.retentionDays
    if (days <= 0) return null
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + days)
    return expiresAt
  }

  protected buildMetadata(
    id: string,
    options: PutFileOptions,
    encryptedPath: string,
    hash: string
  ): FileMetadata {
    return {
      id,
      originalName: options.originalName,
      contentType: options.contentType,
      size: options.data.length,
      hash,
      encryptedPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: this.calculateExpirationDate(options.expiresInDays),
      createdBy: options.userId,
      companyId: options.companyId,
    }
  }
}

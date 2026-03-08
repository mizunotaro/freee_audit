export type StorageProviderType = 'local' | 's3' | 'gcs' | 'azure' | 'minio'

export type Result<T, E = StorageError> = { success: true; data: T } | { success: false; error: E }

export interface StorageError {
  code: StorageErrorCode
  message: string
  cause?: Error
}

export type StorageErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'STORAGE_UNAVAILABLE'
  | 'ACCESS_DENIED'
  | 'PATH_INVALID'
  | 'UNKNOWN_ERROR'

export interface FileMetadata {
  id: string
  originalName: string
  contentType: string
  size: number
  hash: string
  encryptedPath: string
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  createdBy: string
  companyId: string
}

export interface PutFileOptions {
  data: Buffer
  originalName: string
  contentType: string
  companyId: string
  userId: string
  metadata?: Record<string, string>
  encrypt?: boolean
  expiresInDays?: number
}

export interface GetFileOptions {
  companyId: string
  userId?: string
}

export interface GetFileResult {
  data: Buffer
  metadata: FileMetadata
  decrypted: boolean
}

export interface DeleteFileOptions {
  companyId: string
  userId?: string
}

export interface StorageConfig {
  provider: StorageProviderType
  encryption: {
    enabled: boolean
    algorithm: 'AES-256-GCM'
  }
  maxFileSize: number
  allowedTypes: string[]
  retentionDays: number
  local?: {
    basePath: string
    tempPath: string
  }
  s3?: {
    bucket: string
    region: string
    kmsKeyId?: string
    endpoint?: string
  }
  gcs?: {
    bucket: string
    kmsKeyName?: string
  }
  azure?: {
    connectionString: string
    containerName: string
  }
}

export interface StorageProvider {
  readonly name: StorageProviderType
  putFile(options: PutFileOptions): Promise<Result<FileMetadata>>
  getFile(id: string, options: GetFileOptions): Promise<Result<GetFileResult>>
  deleteFile(id: string, options: DeleteFileOptions): Promise<Result<void>>
  exists(id: string): Promise<boolean>
  getMetadata(id: string, options: GetFileOptions): Promise<Result<FileMetadata>>
}

export interface EncryptedFile {
  encryptedData: Buffer
  iv: string
  authTag: string
  salt: string
  originalHash: string
}

export interface FileValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export const DEFAULT_STORAGE_CONFIG: Partial<StorageConfig> = {
  encryption: {
    enabled: true,
    algorithm: 'AES-256-GCM',
  },
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
  retentionDays: 30,
}

export const STORAGE_ERROR_MESSAGES: Record<StorageErrorCode, string> = {
  FILE_NOT_FOUND: 'The requested file was not found',
  FILE_TOO_LARGE: 'The file exceeds the maximum allowed size',
  INVALID_FILE_TYPE: 'The file type is not allowed',
  ENCRYPTION_FAILED: 'Failed to encrypt the file',
  DECRYPTION_FAILED: 'Failed to decrypt the file',
  STORAGE_UNAVAILABLE: 'The storage service is unavailable',
  ACCESS_DENIED: 'Access to the file is denied',
  PATH_INVALID: 'The file path is invalid',
  UNKNOWN_ERROR: 'An unknown error occurred',
}

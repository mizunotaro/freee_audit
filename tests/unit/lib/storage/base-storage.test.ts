import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseStorageProvider } from '@/lib/storage/base-storage'
import type {
  StorageConfig,
  PutFileOptions,
  GetFileOptions,
  GetFileResult,
  DeleteFileOptions,
  FileMetadata,
  Result,
  EncryptedFile,
} from '@/lib/storage/types'

const VALID_ENCRYPTION_KEY = 'a'.repeat(64)

class TestStorageProvider extends BaseStorageProvider {
  readonly name = 'local' as const
  public validationResults: any

  async putFile(options: PutFileOptions): Promise<Result<FileMetadata>> {
    return this.createSuccess({
      id: this.generateFileId(),
      originalName: options.originalName,
      contentType: options.contentType,
      size: options.data.length,
      hash: this.hashFile(options.data),
      encryptedPath: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
      createdBy: options.userId,
      companyId: options.companyId,
    })
  }

  async getFile(id: string, options: GetFileOptions): Promise<Result<GetFileResult>> {
    return this.createFailure(this.createError('FILE_NOT_FOUND'))
  }

  async deleteFile(id: string, options: DeleteFileOptions): Promise<Result<void>> {
    return this.createSuccess(undefined)
  }

  async exists(id: string): Promise<boolean> {
    return false
  }

  async getMetadata(id: string, options: GetFileOptions): Promise<Result<FileMetadata>> {
    return this.createFailure(this.createError('FILE_NOT_FOUND'))
  }

  public testValidateFile(data: Buffer, contentType: string, name: string) {
    return this.validateFile(data, contentType, name)
  }

  public testGenerateFileId() {
    return this.generateFileId()
  }

  public testGenerateSecurePath(companyId: string, fileId: string) {
    return this.generateSecurePath(companyId, fileId)
  }

  public testHashFile(data: Buffer) {
    return this.hashFile(data)
  }

  public async testEncryptFile(data: Buffer) {
    return this.encryptFile(data)
  }

  public async testDecryptFile(encrypted: EncryptedFile) {
    return this.decryptFile(encrypted)
  }

  public testEncryptPath(path: string) {
    return this.encryptPath(path)
  }

  public testDecryptPath(encrypted: string) {
    return this.decryptPath(encrypted)
  }

  public testBuildMetadata(id: string, options: PutFileOptions, path: string, hash: string) {
    return this.buildMetadata(id, options, path, hash)
  }
}

function createTestConfig(overrides: Partial<StorageConfig> = {}): StorageConfig {
  return {
    provider: 'local' as const,
    encryption: { enabled: true, algorithm: 'AES-256-GCM' },
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ['application/pdf', 'image/png', 'image/jpeg'],
    retentionDays: 30,
    ...overrides,
  }
}

describe('BaseStorageProvider', () => {
  let provider: TestStorageProvider

  beforeEach(function () {
    process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY
    provider = new TestStorageProvider(createTestConfig())
  })

  describe('validateFile', function () {
    it('should reject empty files', function () {
      const result = provider.testValidateFile(Buffer.alloc(0), 'application/pdf', 'test.pdf')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('File is empty')
    })

    it('should reject oversized files', function () {
      const bigConfig = createTestConfig({ maxFileSize: 100 })
      const p = new TestStorageProvider(bigConfig)
      const result = p.testValidateFile(Buffer.alloc(200), 'application/pdf', 'test.pdf')
      expect(result.valid).toBe(false)
      expect(
        result.errors.some(function (e) {
          return e.includes('exceeds maximum')
        })
      ).toBe(true)
    })

    it('should reject disallowed content types', function () {
      const result = provider.testValidateFile(Buffer.from('data'), 'application/exe', 'test.exe')
      expect(result.valid).toBe(false)
      expect(
        result.errors.some(function (e) {
          return e.includes('not allowed')
        })
      ).toBe(true)
    })

    it('should accept valid files', function () {
      const result = provider.testValidateFile(Buffer.from('data'), 'application/pdf', 'test.pdf')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should warn on suspicious extension', function () {
      const result = provider.testValidateFile(Buffer.from('data'), 'application/pdf', 'test.exe')
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('generateFileId', function () {
    it('should generate unique UUIDs', function () {
      const id1 = provider.testGenerateFileId()
      const id2 = provider.testGenerateFileId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateSecurePath', function () {
    it('should include company id', function () {
      const path = provider.testGenerateSecurePath('company123', 'file456')
      expect(path).toContain('company123')
    })

    it('should include file id', function () {
      const path = provider.testGenerateSecurePath('company123', 'file456')
      expect(path).toContain('file456')
    })
  })

  describe('hashFile', function () {
    it('should produce consistent hashes', function () {
      const data = Buffer.from('test data')
      const hash1 = provider.testHashFile(data)
      const hash2 = provider.testHashFile(data)
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different data', function () {
      const hash1 = provider.testHashFile(Buffer.from('data1'))
      const hash2 = provider.testHashFile(Buffer.from('data2'))
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('encryptFile and decryptFile', function () {
    it('should encrypt and decrypt data', async function () {
      const data = Buffer.from('secret file content')
      const encrypted = await provider.testEncryptFile(data)
      expect(encrypted.encryptedData).toBeDefined()
      expect(encrypted.iv).toBeDefined()
      expect(encrypted.authTag).toBeDefined()
      expect(encrypted.salt).toBeDefined()

      const decrypted = await provider.testDecryptFile(encrypted)
      expect(decrypted.toString()).toBe('secret file content')
    })

    it('should pass through when encryption disabled', async function () {
      const noEncConfig = createTestConfig({
        encryption: { enabled: false, algorithm: 'AES-256-GCM' },
      })
      const p = new TestStorageProvider(noEncConfig)
      const data = Buffer.from('plaintext')
      const encrypted = await p.testEncryptFile(data)
      expect(encrypted.encryptedData).toBe(data)
      expect(encrypted.iv).toBe('')
    })

    it('should fail on integrity mismatch', async function () {
      const data = Buffer.from('original')
      const encrypted = await provider.testEncryptFile(data)
      encrypted.originalHash = 'tampered'
      await expect(provider.testDecryptFile(encrypted)).rejects.toThrow()
    })
  })

  describe('encryptPath and decryptPath', function () {
    it('should encrypt and decrypt paths', function () {
      const original = 'company1/ab/cd/file123'
      const encrypted = provider.testEncryptPath(original)
      expect(encrypted).not.toBe(original)
      const decrypted = provider.testDecryptPath(encrypted)
      expect(decrypted).toBe(original)
    })
  })

  describe('buildMetadata', function () {
    it('should build correct metadata', function () {
      const opts: PutFileOptions = {
        data: Buffer.from('x'),
        originalName: 'test.pdf',
        contentType: 'application/pdf',
        companyId: 'co1',
        userId: 'u1',
      }
      const meta = provider.testBuildMetadata('id1', opts, 'path', 'hash')
      expect(meta.id).toBe('id1')
      expect(meta.originalName).toBe('test.pdf')
      expect(meta.companyId).toBe('co1')
    })
  })
})

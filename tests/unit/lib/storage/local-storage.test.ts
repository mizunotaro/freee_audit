import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalStorageProvider } from '@/lib/storage/local-storage'

const VALID_ENCRYPTION_KEY = 'a'.repeat(64)

describe('LocalStorageProvider', () => {
  let storage: LocalStorageProvider

  beforeEach(function () {
    process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY
    const ts = Date.now()
    storage = new LocalStorageProvider({
      provider: 'local',
      encryption: { enabled: true, algorithm: 'AES-256-GCM' },
      maxFileSize: 10 * 1024 * 1024,
      allowedTypes: ['application/pdf', 'image/png', 'image/jpeg'],
      retentionDays: 30,
      local: {
        basePath: `./tmp-test-ls/${ts}/data`,
        tempPath: `./tmp-test-ls/${ts}/temp`,
      },
    })
  })

  describe('constructor', function () {
    it('should create instance with name local', function () {
      expect(storage.name).toBe('local')
    })
  })

  describe('putFile', function () {
    it('should store a valid file and return metadata', async function () {
      const result = await storage.putFile({
        data: Buffer.from('test file content'),
        originalName: 'test.pdf',
        contentType: 'application/pdf',
        companyId: 'co-1',
        userId: 'u-1',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBeDefined()
        expect(result.data.originalName).toBe('test.pdf')
        expect(result.data.size).toBe(17)
        expect(result.data.companyId).toBe('co-1')
      }
    })

    it('should reject invalid file type', async function () {
      const result = await storage.putFile({
        data: Buffer.from('data'),
        originalName: 'test.exe',
        contentType: 'application/exe',
        companyId: 'co-1',
        userId: 'u-1',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty file', async function () {
      const result = await storage.putFile({
        data: Buffer.alloc(0),
        originalName: 'empty.pdf',
        contentType: 'application/pdf',
        companyId: 'co-1',
        userId: 'u-1',
      })
      expect(result.success).toBe(false)
    })

    it('should handle file with expiration', async function () {
      const result = await storage.putFile({
        data: Buffer.from('expiring'),
        originalName: 'exp.pdf',
        contentType: 'application/pdf',
        companyId: 'co-1',
        userId: 'u-1',
        expiresInDays: 7,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.expiresAt).not.toBeNull()
      }
    })
  })

  describe('getFile', function () {
    it('should retrieve stored file', async function () {
      const putResult = await storage.putFile({
        data: Buffer.from('retrieve me'),
        originalName: 'get.pdf',
        contentType: 'application/pdf',
        companyId: 'co-g',
        userId: 'u-g',
      })
      if (!putResult.success) return
      const id = putResult.data.id

      const result = await storage.getFile(id, { companyId: 'co-g' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.data.toString()).toBe('retrieve me')
        expect(result.data.decrypted).toBe(true)
      }
    })

    it('should return error for nonexistent file', async function () {
      const result = await storage.getFile('nonexistent', { companyId: 'co-x' })
      expect(result.success).toBe(false)
    })

    it('should deny access from different company', async function () {
      const putResult = await storage.putFile({
        data: Buffer.from('secret'),
        originalName: 'sec.pdf',
        contentType: 'application/pdf',
        companyId: 'co-owner',
        userId: 'u-owner',
      })
      if (!putResult.success) return

      const result = await storage.getFile(putResult.data.id, { companyId: 'co-other' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('ACCESS_DENIED')
      }
    })
  })

  describe('deleteFile', function () {
    it('should delete stored file', async function () {
      const putResult = await storage.putFile({
        data: Buffer.from('to delete'),
        originalName: 'del.pdf',
        contentType: 'application/pdf',
        companyId: 'co-del',
        userId: 'u-del',
      })
      if (!putResult.success) return
      const id = putResult.data.id

      const delResult = await storage.deleteFile(id, { companyId: 'co-del' })
      expect(delResult.success).toBe(true)

      const exists = await storage.exists(id)
      expect(exists).toBe(false)
    })

    it('should return error for nonexistent file', async function () {
      const result = await storage.deleteFile('nonexistent', { companyId: 'co-x' })
      expect(result.success).toBe(false)
    })
  })

  describe('exists', function () {
    it('should return true for stored file', async function () {
      const putResult = await storage.putFile({
        data: Buffer.from('exists test'),
        originalName: 'exists.pdf',
        contentType: 'application/pdf',
        companyId: 'co-ex',
        userId: 'u-ex',
      })
      if (!putResult.success) return
      expect(await storage.exists(putResult.data.id)).toBe(true)
    })

    it('should return false for missing file', async function () {
      expect(await storage.exists('missing-id')).toBe(false)
    })
  })

  describe('getMetadata', function () {
    it('should return metadata for stored file', async function () {
      const putResult = await storage.putFile({
        data: Buffer.from('meta test'),
        originalName: 'meta.pdf',
        contentType: 'application/pdf',
        companyId: 'co-meta',
        userId: 'u-meta',
      })
      if (!putResult.success) return

      const result = await storage.getMetadata(putResult.data.id, { companyId: 'co-meta' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.originalName).toBe('meta.pdf')
      }
    })

    it('should deny access from wrong company', async function () {
      const putResult = await storage.putFile({
        data: Buffer.from('private'),
        originalName: 'priv.pdf',
        contentType: 'application/pdf',
        companyId: 'co-priv',
        userId: 'u-priv',
      })
      if (!putResult.success) return

      const result = await storage.getMetadata(putResult.data.id, { companyId: 'co-wrong' })
      expect(result.success).toBe(false)
    })
  })
})

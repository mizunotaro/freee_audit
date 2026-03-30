import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileService } from '@/services/storage/file-service'
import type { FileMetadata } from '@/lib/storage/types'

const mockProvider = {
  putFile: vi.fn(),
  getFile: vi.fn(),
  deleteFile: vi.fn(),
  exists: vi.fn(),
  getMetadata: vi.fn(),
}

vi.mock('@/lib/storage/local-storage', () => ({
  LocalStorageProvider: vi.fn(function () {
    return mockProvider
  }),
}))

const sampleMetadata: FileMetadata = {
  id: 'file-123',
  originalName: 'test.pdf',
  contentType: 'application/pdf',
  size: 1024,
  hash: 'abc123',
  encryptedPath: '/data/storage/file-123.enc',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  expiresAt: null,
  createdBy: 'user1',
  companyId: 'company1',
}

describe('FileService', () => {
  let service: FileService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new FileService()
  })

  describe('putFile', () => {
    it('returns id and metadata on success', async () => {
      mockProvider.putFile.mockResolvedValue({
        success: true,
        data: sampleMetadata,
      })

      const result = await service.putFile(
        Buffer.from('test'),
        'test.pdf',
        'application/pdf',
        'company1',
        'user1'
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('file-123')
        expect(result.data.metadata.originalName).toBe('test.pdf')
      }
    })

    it('returns error when provider fails', async () => {
      mockProvider.putFile.mockResolvedValue({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File too large' },
      })

      const result = await service.putFile(
        Buffer.from('test'),
        'test.pdf',
        'application/pdf',
        'company1',
        'user1'
      )

      expect(result.success).toBe(false)
    })

    it('passes metadata to provider', async () => {
      mockProvider.putFile.mockResolvedValue({
        success: true,
        data: sampleMetadata,
      })

      await service.putFile(
        Buffer.from('test'),
        'test.pdf',
        'application/pdf',
        'company1',
        'user1',
        { department: 'finance' }
      )

      expect(mockProvider.putFile).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { department: 'finance' },
        })
      )
    })
  })

  describe('getFile', () => {
    it('returns file data on success', async () => {
      const fileData = Buffer.from('file content')
      mockProvider.getFile.mockResolvedValue({
        success: true,
        data: {
          data: fileData,
          metadata: sampleMetadata,
          decrypted: true,
        },
      })

      const result = await service.getFile('file-123', 'company1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('file-123')
        expect(result.data.data).toBe(fileData)
        expect(result.data.metadata).toBe(sampleMetadata)
      }
    })

    it('returns error when provider fails', async () => {
      mockProvider.getFile.mockResolvedValue({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Not found' },
      })

      const result = await service.getFile('nonexistent', 'company1')

      expect(result.success).toBe(false)
    })
  })

  describe('deleteFile', () => {
    it('delegates to provider', async () => {
      mockProvider.deleteFile.mockResolvedValue({ success: true, data: undefined })

      const result = await service.deleteFile('file-123', 'company1')

      expect(result.success).toBe(true)
      expect(mockProvider.deleteFile).toHaveBeenCalledWith('file-123', { companyId: 'company1' })
    })

    it('returns error when provider fails', async () => {
      mockProvider.deleteFile.mockResolvedValue({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Denied' },
      })

      const result = await service.deleteFile('file-123', 'company1')

      expect(result.success).toBe(false)
    })
  })

  describe('exists', () => {
    it('returns true when file exists', async () => {
      mockProvider.exists.mockResolvedValue(true)

      const result = await service.exists('file-123')
      expect(result).toBe(true)
    })

    it('returns false when file does not exist', async () => {
      mockProvider.exists.mockResolvedValue(false)

      const result = await service.exists('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('getMetadata', () => {
    it('returns metadata on success', async () => {
      mockProvider.getMetadata.mockResolvedValue({
        success: true,
        data: sampleMetadata,
      })

      const result = await service.getMetadata('file-123', 'company1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(sampleMetadata)
      }
    })

    it('returns error when provider fails', async () => {
      mockProvider.getMetadata.mockResolvedValue({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Not found' },
      })

      const result = await service.getMetadata('nonexistent', 'company1')

      expect(result.success).toBe(false)
    })
  })
})

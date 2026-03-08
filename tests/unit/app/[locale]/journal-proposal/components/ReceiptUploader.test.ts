import { describe, it, expect } from 'vitest'
import { validateFile } from '@/app/[locale]/journal-proposal/components/ReceiptUploader'
import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'

describe('ReceiptUploader', () => {
  describe('validateFile', () => {
    const { maxFileSize, acceptedTypes } = JOURNAL_PROPOSAL_CONFIG.upload

    it('should accept valid PDF file', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const result = validateFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept valid PNG file', () => {
      const file = new File(['content'], 'test.png', { type: 'image/png' })
      const result = validateFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept valid JPEG file', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const result = validateFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid file type', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const result = validateFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid file type')
    })

    it('should reject file exceeding size limit', () => {
      const largeContent = 'x'.repeat(maxFileSize + 1)
      const file = new File([largeContent], 'test.pdf', { type: 'application/pdf' })
      const result = validateFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('File size exceeds')
    })

    it('should accept file at exact size limit', () => {
      const exactContent = 'x'.repeat(maxFileSize)
      const file = new File([exactContent], 'test.pdf', { type: 'application/pdf' })
      const result = validateFile(file)

      expect(result.valid).toBe(true)
    })

    it('should accept file just under size limit', () => {
      const content = 'x'.repeat(maxFileSize - 1)
      const file = new File([content], 'test.pdf', { type: 'application/pdf' })
      const result = validateFile(file)

      expect(result.valid).toBe(true)
    })

    it('should reject unsupported image format', () => {
      const file = new File(['content'], 'test.gif', { type: 'image/gif' })
      const result = validateFile(file)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid file type')
    })
  })
})

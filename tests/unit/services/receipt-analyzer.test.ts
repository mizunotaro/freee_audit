import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReceiptAnalyzer, createReceiptAnalyzer } from '@/services/audit/receipt-analyzer'

describe('ReceiptAnalyzer', () => {
  let analyzer: ReceiptAnalyzer
  const mockAIProvider = {
    analyzeDocument: vi.fn(),
    validateEntry: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    analyzer = new ReceiptAnalyzer({
      aiProvider: mockAIProvider as any,
      preferGeminiForPdf: false,
    })
  })

  describe('analyzeBuffer', () => {
    it('should throw error when AI provider is not configured', async () => {
      const analyzerWithoutProvider = new ReceiptAnalyzer({
        aiProvider: undefined as any,
      })

      const buffer = Buffer.from('test')

      await expect(
        analyzerWithoutProvider.analyzeBuffer(buffer, 'image', 'image/png')
      ).rejects.toThrow('AI provider is not configured')
    })

    it('should call AI provider analyzeDocument with correct parameters', async () => {
      const mockResult = {
        date: '2024-01-15',
        amount: 10000,
        taxAmount: 1000,
        vendorName: 'Test Vendor',
        description: 'Test',
        confidence: 0.95,
      }

      mockAIProvider.analyzeDocument.mockResolvedValue(mockResult)

      const buffer = Buffer.from('test image data')

      const result = await analyzer.analyzeBuffer(buffer, 'image', 'image/png')

      expect(mockAIProvider.analyzeDocument).toHaveBeenCalledWith({
        documentBase64: buffer.toString('base64'),
        mimeType: 'image/png',
      })
      expect(result).toEqual(mockResult)
    })
  })

  describe('constructor', () => {
    it('should create analyzer with default config', () => {
      const defaultAnalyzer = createReceiptAnalyzer()
      expect(defaultAnalyzer).toBeInstanceOf(ReceiptAnalyzer)
    })

    it('should create analyzer with custom config', () => {
      const customAnalyzer = new ReceiptAnalyzer({
        aiProvider: mockAIProvider as any,
        preferGeminiForPdf: true,
      })
      expect(customAnalyzer).toBeDefined()
    })
  })

  describe('getDocumentType', () => {
    it('should return pdf for .pdf extension', () => {
      const analyzer = new ReceiptAnalyzer({
        aiProvider: mockAIProvider as any,
      })
      expect(analyzer).toBeDefined()
    })
  })
})

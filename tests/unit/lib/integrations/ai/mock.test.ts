import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MockAIProvider, createMockAIProvider } from '@/lib/integrations/ai/mock'
import type { AIConfig } from '@/lib/integrations/ai/provider'

vi.useFakeTimers({ shouldAdvanceTime: true })

describe('MockAIProvider', () => {
  let provider: MockAIProvider

  beforeEach(() => {
    const config: AIConfig = {
      provider: 'openai',
      apiKey: 'test-key',
    }
    provider = new MockAIProvider(config)
  })

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(provider).toBeDefined()
      expect(provider.name).toBe('openai')
    })
  })

  describe('createMockAIProvider', () => {
    it('should create MockAIProvider instance', () => {
      const p = createMockAIProvider({ provider: 'openai', apiKey: 'key' })
      expect(p).toBeInstanceOf(MockAIProvider)
    })
  })

  describe('analyzeDocument', () => {
    it('should return a DocumentAnalysisResult', async () => {
      const result = await provider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(result).toBeDefined()
      expect(result.date).toBeDefined()
      expect(typeof result.amount).toBe('number')
      expect(typeof result.taxAmount).toBe('number')
      expect(typeof result.confidence).toBe('number')
      expect(result.confidence).toBeGreaterThanOrEqual(0.75)
      expect(result.confidence).toBeLessThanOrEqual(1)
      expect(result.rawText).toContain('[MOCK]')
    })

    it('should return a valid date string', async () => {
      const result = await provider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'image',
        mimeType: 'image/jpeg',
      })

      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return amount in expected range', async () => {
      const result = await provider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(result.amount).toBeGreaterThanOrEqual(10000)
      expect(result.amount).toBeLessThanOrEqual(1010000)
    })

    it('should return vendor from mock list', async () => {
      const result = await provider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(result.vendorName).toBeTruthy()
      expect(typeof result.vendorName).toBe('string')
    })

    it('should return description from mock list', async () => {
      const result = await provider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(result.description).toBeTruthy()
      expect(typeof result.description).toBe('string')
    })
  })

  describe('validateEntry', () => {
    const mockRequest = {
      journalEntry: {
        date: '2024-01-15',
        debitAccount: 'Cash',
        creditAccount: 'Revenue',
        amount: 10000,
        taxAmount: 1000,
        description: 'Test entry',
      },
      documentData: {
        date: '2024-01-15',
        amount: 10000,
        taxAmount: 1000,
        description: 'Test entry',
        vendorName: 'Test Vendor',
        confidence: 0.95,
      } as import('@/types/audit').DocumentAnalysisResult,
    }

    it('should return an EntryValidationResult', async () => {
      const result = await provider.validateEntry(mockRequest)

      expect(result).toBeDefined()
      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.issues)).toBe(true)
    })

    it('should return valid result with suggestions when random < 0.7', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      const result = await provider.validateEntry(mockRequest)

      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions!.length).toBeGreaterThan(0)
    })

    it('should return warning for amount when 0.7 <= random < 0.85', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.75)

      const result = await provider.validateEntry(mockRequest)

      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].field).toBe('amount')
      expect(result.issues[0].severity).toBe('warning')
    })

    it('should return warning for date when 0.85 <= random < 0.95', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9)

      const result = await provider.validateEntry(mockRequest)

      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].field).toBe('date')
      expect(result.issues[0].severity).toBe('warning')
    })

    it('should return error for taxAmount when random >= 0.95', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.97)

      const result = await provider.validateEntry(mockRequest)

      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].field).toBe('taxAmount')
      expect(result.issues[0].severity).toBe('error')
      expect(result.isValid).toBe(false)
    })
  })

  describe('generate', () => {
    it('should return a GenerateResult with mock content', async () => {
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'Analyze this journal entry' }],
      })

      expect(result).toBeDefined()
      expect(result.content).toBeTruthy()
      expect(result.model).toBe('mock-model')
      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      })
    })

    it('should include query preview in response', async () => {
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'Test query content here' }],
      })

      const parsed = JSON.parse(result.content)
      expect(parsed.conclusion).toContain('Test query content here')
    })

    it('should use custom model when provided', async () => {
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
        model: 'custom-model',
      })

      expect(result.model).toBe('custom-model')
    })

    it('should find last user message', async () => {
      const result = await provider.generate({
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'first user message' },
          { role: 'assistant', content: 'assistant reply' },
          { role: 'user', content: 'last user message' },
        ],
      })

      const parsed = JSON.parse(result.content)
      expect(parsed.conclusion).toContain('last user message')
    })

    it('should handle no user messages', async () => {
      const result = await provider.generate({
        messages: [{ role: 'system', content: 'system only' }],
      })

      const parsed = JSON.parse(result.content)
      expect(parsed.conclusion).toContain('[MOCK] Analysis response for: ')
    })

    it('should return JSON with expected structure', async () => {
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
      })

      const parsed = JSON.parse(result.content)
      expect(parsed).toHaveProperty('persona')
      expect(parsed).toHaveProperty('conclusion')
      expect(parsed).toHaveProperty('confidence')
      expect(parsed).toHaveProperty('reasoning')
      expect(parsed).toHaveProperty('risks')
      expect(Array.isArray(parsed.reasoning)).toBe(true)
      expect(Array.isArray(parsed.risks)).toBe(true)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  OpenAICompatibleProvider,
  createOpenAICompatibleProvider,
} from '@/lib/integrations/ai/openai-compatible'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    }
  },
}))

vi.mock('@/lib/utils/timeout', () => ({
  API_TIMEOUTS: { AI_API: 60000 },
}))

describe('OpenAICompatibleProvider', () => {
  let provider: OpenAICompatibleProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OpenAICompatibleProvider({
      apiKey: 'test-key',
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    })
  })

  describe('constructor', () => {
    it('should create instance with required config', () => {
      expect(provider).toBeDefined()
      expect(provider.name).toBe('deepseek')
    })

    it('should use custom model when provided', () => {
      const p = new OpenAICompatibleProvider({
        apiKey: 'key',
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        model: 'deepseek-coder',
      })
      expect(p).toBeDefined()
    })

    it('should use default model when custom model not provided', () => {
      const p = new OpenAICompatibleProvider({
        apiKey: 'key',
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
      })
      expect(p).toBeDefined()
    })

    it('should accept custom headers', () => {
      const p = new OpenAICompatibleProvider({
        apiKey: 'key',
        provider: 'custom',
        baseUrl: 'http://localhost:11434/v1',
        defaultModel: 'custom-model',
        headers: { 'X-Custom': 'value' },
      })
      expect(p).toBeDefined()
    })

    it('should accept maxRetries', () => {
      const p = new OpenAICompatibleProvider({
        apiKey: 'key',
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        maxRetries: 5,
      })
      expect(p).toBeDefined()
    })
  })

  describe('createOpenAICompatibleProvider', () => {
    it('should create OpenAICompatibleProvider instance', () => {
      const p = createOpenAICompatibleProvider({
        apiKey: 'key',
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
      })
      expect(p).toBeInstanceOf(OpenAICompatibleProvider)
    })
  })

  describe('analyzeDocument', () => {
    const mockAnalysisResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              date: '2024-01-15',
              amount: 50000,
              taxAmount: 5000,
              taxRate: 0.1,
              description: 'Test document',
              vendorName: 'Test Vendor',
              confidence: 0.95,
            }),
          },
        },
      ],
      model: 'deepseek-chat',
    }

    it('should analyze a PDF document', async () => {
      mockCreate.mockResolvedValueOnce(mockAnalysisResponse)

      const result = await provider.analyzeDocument({
        documentBase64: 'base64pdfdata',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(result.date).toBe('2024-01-15')
      expect(result.amount).toBe(50000)
      expect(result.taxAmount).toBe(5000)
      expect(result.vendorName).toBe('Test Vendor')
      expect(result.confidence).toBe(0.95)
    })

    it('should analyze an image document', async () => {
      mockCreate.mockResolvedValueOnce(mockAnalysisResponse)

      const result = await provider.analyzeDocument({
        documentBase64: 'base64imagedata',
        documentType: 'image',
        mimeType: 'image/jpeg',
      })

      expect(result).toBeDefined()
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image_url',
                  image_url: { url: 'data:image/jpeg;base64,base64imagedata' },
                }),
              ]),
            }),
          ]),
        })
      )
    })

    it('should use pdf mime type for pdf documents', async () => {
      mockCreate.mockResolvedValueOnce(mockAnalysisResponse)

      await provider.analyzeDocument({
        documentBase64: 'base64pdf',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image_url',
                  image_url: { url: 'data:application/pdf;base64,base64pdf' },
                }),
              ]),
            }),
          ]),
        })
      )
    })

    it('should handle partial response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ date: '2024-02-01' }) } }],
        model: 'deepseek-chat',
      })

      const result = await provider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(result.date).toBe('2024-02-01')
      expect(result.amount).toBe(0)
      expect(result.description).toBe('')
    })

    it('should handle empty response', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
        model: 'deepseek-chat',
      })

      const result = await provider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })

      expect(result.amount).toBe(0)
      expect(result.confidence).toBe(0.5)
    })
  })

  describe('validateEntry', () => {
    const mockValidationResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              isValid: true,
              issues: [],
              suggestions: ['Looks good'],
            }),
          },
        },
      ],
      model: 'deepseek-chat',
    }

    it('should validate entry successfully', async () => {
      mockCreate.mockResolvedValueOnce(mockValidationResponse)

      const result = await provider.validateEntry({
        journalEntry: {
          date: '2024-01-15',
          debitAccount: 'Cash',
          creditAccount: 'Revenue',
          amount: 10000,
          taxAmount: 1000,
          description: 'Test',
        },
        documentData: {
          date: '2024-01-15',
          amount: 10000,
          taxAmount: 1000,
          description: 'Test',
          vendorName: 'Vendor',
          confidence: 0.9,
        },
      })

      expect(result.isValid).toBe(true)
      expect(result.issues).toEqual([])
      expect(result.suggestions).toEqual(['Looks good'])
    })

    it('should handle validation with issues', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isValid: false,
                issues: [
                  {
                    field: 'amount',
                    severity: 'error',
                    message: 'Amount mismatch',
                    messageJa: '金額不一致',
                  },
                ],
              }),
            },
          },
        ],
        model: 'deepseek-chat',
      })

      const result = await provider.validateEntry({
        journalEntry: {
          date: '2024-01-15',
          debitAccount: 'Cash',
          creditAccount: 'Revenue',
          amount: 10000,
          taxAmount: 1000,
          description: 'Test',
        },
        documentData: {
          date: '2024-01-15',
          amount: 9000,
          taxAmount: 900,
          description: 'Test',
          vendorName: 'Vendor',
          confidence: 0.9,
        },
      })

      expect(result.isValid).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].field).toBe('amount')
      expect(result.issues[0].severity).toBe('error')
    })

    it('should handle missing response content', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
        model: 'deepseek-chat',
      })

      const result = await provider.validateEntry({
        journalEntry: {
          date: '2024-01-15',
          debitAccount: 'Cash',
          creditAccount: 'Revenue',
          amount: 10000,
          taxAmount: 1000,
          description: 'Test',
        },
        documentData: {
          date: '2024-01-15',
          amount: 10000,
          taxAmount: 1000,
          description: 'Test',
          vendorName: 'Vendor',
          confidence: 0.9,
        },
      })

      expect(result.isValid).toBe(false)
      expect(result.issues).toEqual([])
    })
  })

  describe('generate', () => {
    const mockGenerateResponse = {
      choices: [{ message: { content: 'Generated text' } }],
      model: 'deepseek-chat',
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }

    it('should generate text', async () => {
      mockCreate.mockResolvedValueOnce(mockGenerateResponse)

      const result = await provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(result.content).toBe('Generated text')
      expect(result.model).toBe('deepseek-chat')
      expect(result.usage?.promptTokens).toBe(10)
      expect(result.usage?.completionTokens).toBe(20)
      expect(result.usage?.totalTokens).toBe(30)
    })

    it('should use custom model from options', async () => {
      mockCreate.mockResolvedValueOnce(mockGenerateResponse)

      await provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'custom-model',
      })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'custom-model' }))
    })

    it('should use custom temperature from options', async () => {
      mockCreate.mockResolvedValueOnce(mockGenerateResponse)

      await provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.7 }))
    })

    it('should use custom maxTokens from options', async () => {
      mockCreate.mockResolvedValueOnce(mockGenerateResponse)

      await provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 4096,
      })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 4096 }))
    })

    it('should handle response without usage', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'test' } }],
        model: 'deepseek-chat',
      })

      const result = await provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(result.usage).toBeUndefined()
    })

    it('should handle empty response content', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
        model: 'deepseek-chat',
      })

      const result = await provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(result.content).toBe('')
    })
  })

  describe('retry logic', () => {
    it('should throw immediately on authentication error', async () => {
      const authError = new Error('Unauthorized')
      ;(authError as any).status = 401
      mockCreate.mockRejectedValue(authError)

      await expect(
        provider.generate({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('Unauthorized')

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should throw immediately on invalid request', async () => {
      const badRequestError = new Error('Bad request')
      ;(badRequestError as any).status = 400
      mockCreate.mockRejectedValue(badRequestError)

      await expect(
        provider.generate({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('Bad request')

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should retry on server error and eventually succeed', async () => {
      const serverError = new Error('Internal server error')
      ;(serverError as any).status = 500
      mockCreate.mockRejectedValueOnce(serverError)
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'success' } }],
        model: 'deepseek-chat',
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result.content).toBe('success')
      expect(mockCreate).toHaveBeenCalledTimes(2)
      consoleWarnSpy.mockRestore()
    })

    it('should retry on rate limit and eventually succeed', async () => {
      const rateLimitError = new Error('Rate limited')
      ;(rateLimitError as any).status = 429
      ;(rateLimitError as any).headers = { 'retry-after': '1' }
      mockCreate.mockRejectedValueOnce(rateLimitError)
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'success' } }],
        model: 'deepseek-chat',
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result.content).toBe('success')
      expect(mockCreate).toHaveBeenCalledTimes(2)
      consoleWarnSpy.mockRestore()
    })

    it('should throw after max retries exhausted', async () => {
      const serverError = new Error('Server error')
      ;(serverError as any).status = 500
      mockCreate.mockRejectedValue(serverError)

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(
        provider.generate({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('Server error')

      expect(mockCreate).toHaveBeenCalledTimes(4)
      consoleWarnSpy.mockRestore()
    })

    it('should handle non-Error throws', async () => {
      mockCreate.mockRejectedValueOnce('string error')
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' } }],
        model: 'deepseek-chat',
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result.content).toBe('ok')
      consoleWarnSpy.mockRestore()
    })
  })
})

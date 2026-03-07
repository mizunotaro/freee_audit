import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClaudeProvider, createClaudeProvider } from '@/lib/integrations/ai/claude'
import { DocumentAnalysisResult } from '@/types/audit'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = 'APIError'
    }
  }
  return {
    default: class {
      messages = {
        create: mockCreate,
      }
    },
    APIError: MockAPIError,
  }
})

vi.mock('@/lib/ai/config/model-config', () => ({
  getDefaultModel: vi.fn((provider: string) => {
    if (provider === 'claude') return 'claude-sonnet-4-20250514'
    return 'default-model'
  }),
}))

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider

  beforeEach(() => {
    vi.clearAllMocks()

    provider = new ClaudeProvider({
      provider: 'claude',
      apiKey: 'test-api-key',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const p = new ClaudeProvider({ provider: 'claude', apiKey: 'key' })
      expect(p).toBeDefined()
      expect(p.name).toBe('claude')
    })

    it('should create instance with optional config', () => {
      const p = new ClaudeProvider({
        provider: 'claude',
        apiKey: 'key',
        model: 'claude-opus-4',
        temperature: 0.5,
        maxTokens: 2048,
      })
      expect(p).toBeDefined()
    })
  })

  describe('createClaudeProvider', () => {
    it('should create ClaudeProvider instance', () => {
      const p = createClaudeProvider({ provider: 'claude', apiKey: 'test-key' })
      expect(p).toBeInstanceOf(ClaudeProvider)
    })
  })

  describe('analyzeDocument', () => {
    const mockPdfRequest = {
      documentBase64: 'base64pdfdata',
      documentType: 'pdf' as const,
      mimeType: 'application/pdf',
    }

    const mockImageRequest = {
      documentBase64: 'base64imagedata',
      documentType: 'image' as const,
      mimeType: 'image/jpeg',
    }

    const successfulResponse = {
      id: 'msg_123',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            date: '2024-01-15',
            amount: 10000,
            taxAmount: 1000,
            taxRate: 0.1,
            description: 'Test invoice',
            vendorName: 'Test Vendor',
            confidence: 0.95,
          }),
        },
      ],
      model: 'claude-sonnet-4-20250514',
      role: 'assistant',
      usage: { input_tokens: 100, output_tokens: 50 },
    }

    it('should analyze PDF document successfully', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'document' }),
                expect.objectContaining({ type: 'text' }),
              ]),
            }),
          ]),
        })
      )

      expect(result).toEqual({
        date: '2024-01-15',
        amount: 10000,
        taxAmount: 1000,
        taxRate: 0.1,
        description: 'Test invoice',
        vendorName: 'Test Vendor',
        confidence: 0.95,
        rawText: expect.any(String),
      })
    })

    it('should analyze image document successfully', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const result = await provider.analyzeDocument(mockImageRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([expect.objectContaining({ type: 'image' })]),
            }),
          ]),
        })
      )

      expect(result).toBeDefined()
      expect(result.confidence).toBe(0.95)
    })

    it('should handle PNG images', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const pngRequest = {
        documentBase64: 'base64pngdata',
        documentType: 'image' as const,
        mimeType: 'image/png',
      }

      const result = await provider.analyzeDocument(pngRequest)
      expect(result).toBeDefined()
    })

    it('should handle GIF images', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const gifRequest = {
        documentBase64: 'base64gifdata',
        documentType: 'image' as const,
        mimeType: 'image/gif',
      }

      const result = await provider.analyzeDocument(gifRequest)
      expect(result).toBeDefined()
    })

    it('should handle WebP images', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const webpRequest = {
        documentBase64: 'base64webpdata',
        documentType: 'image' as const,
        mimeType: 'image/webp',
      }

      const result = await provider.analyzeDocument(webpRequest)
      expect(result).toBeDefined()
    })

    it('should use custom model when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const customProvider = new ClaudeProvider({
        provider: 'claude',
        apiKey: 'test-key',
        model: 'claude-opus-4',
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus-4',
        })
      )
    })

    it('should use custom maxTokens when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const customProvider = new ClaudeProvider({
        provider: 'claude',
        apiKey: 'test-key',
        maxTokens: 2048,
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
        })
      )
    })

    it('should handle response with missing optional fields', async () => {
      const partialResponse = {
        id: 'msg_456',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              date: '2024-01-15',
              amount: 5000,
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(partialResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result).toEqual({
        date: '2024-01-15',
        amount: 5000,
        taxAmount: 0,
        taxRate: undefined,
        description: '',
        vendorName: '',
        confidence: 0.5,
        rawText: expect.any(String),
      })
    })

    it('should handle non-JSON text response', async () => {
      const nonJsonResponse = {
        id: 'msg_789',
        content: [
          {
            type: 'text',
            text: 'This is plain text, not JSON',
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(nonJsonResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result).toEqual({
        date: null,
        amount: 0,
        taxAmount: 0,
        taxRate: undefined,
        description: '',
        vendorName: '',
        confidence: 0.5,
        rawText: 'This is plain text, not JSON',
      })
    })

    it('should handle JSON embedded in text', async () => {
      const embeddedJsonResponse = {
        id: 'msg_101',
        content: [
          {
            type: 'text',
            text: 'Here is the result: {"date":"2024-02-20","amount":3000,"confidence":0.8} End of response',
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(embeddedJsonResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result.date).toBe('2024-02-20')
      expect(result.amount).toBe(3000)
      expect(result.confidence).toBe(0.8)
    })

    it('should handle malformed JSON', async () => {
      const malformedResponse = {
        id: 'msg_102',
        content: [
          {
            type: 'text',
            text: '{invalid json}',
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(malformedResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result).toEqual({
        date: null,
        amount: 0,
        taxAmount: 0,
        taxRate: undefined,
        description: '',
        vendorName: '',
        confidence: 0.5,
        rawText: '{invalid json}',
      })
    })

    it('should handle empty content array', async () => {
      const emptyResponse = {
        id: 'msg_103',
        content: [],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(emptyResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result.rawText).toBe('{}')
    })

    it('should handle API error', async () => {
      const apiError = new Error('API Error')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('API Error')
    })

    it('should handle rate limit error', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.name = 'RateLimitError'
      mockCreate.mockRejectedValueOnce(rateLimitError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle authentication error', async () => {
      const authError = new Error('Invalid API key')
      authError.name = 'AuthenticationError'
      mockCreate.mockRejectedValueOnce(authError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Invalid API key')
    })

    it('should handle network error', async () => {
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'
      mockCreate.mockRejectedValueOnce(networkError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Network error')
    })

    it('should retry on 529 overloaded error', async () => {
      const overloadedError = new Error('Overloaded')
      overloadedError.message = 'overloaded'
      mockCreate.mockRejectedValueOnce(overloadedError)
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledTimes(2)
      expect(result.confidence).toBe(0.95)
    })

    it('should retry up to 3 times on 529 error then fail', async () => {
      const overloadedError = new Error('529 overloaded')
      mockCreate.mockReset()
      mockCreate.mockRejectedValue(overloadedError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('529 overloaded')
      expect(mockCreate).toHaveBeenCalledTimes(3)
    })

    it('should use default model from config service when no model specified', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const defaultProvider = new ClaudeProvider({
        provider: 'claude',
        apiKey: 'test-key',
      })

      await defaultProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
        })
      )
    })

    it('should include extractionFields when provided', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const requestWithFields = {
        ...mockPdfRequest,
        extractionFields: ['date', 'amount'],
      }

      await provider.analyzeDocument(requestWithFields)

      expect(mockCreate).toHaveBeenCalled()
    })
  })

  describe('validateEntry', () => {
    const mockValidationRequest = {
      journalEntry: {
        date: '2024-01-15',
        debitAccount: 'Expenses',
        creditAccount: 'Cash',
        amount: 10000,
        taxAmount: 1000,
        description: 'Office supplies',
      },
      documentData: {
        date: '2024-01-15',
        amount: 10000,
        taxAmount: 1000,
        description: 'Office supplies',
        vendorName: 'Office Store',
        confidence: 0.95,
      } as DocumentAnalysisResult,
    }

    const successfulValidationResponse = {
      id: 'msg_val_123',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            isValid: true,
            issues: [],
            suggestions: ['Consider adding more details to description'],
          }),
        },
      ],
      model: 'claude-sonnet-4-20250514',
      role: 'assistant',
    }

    it('should validate entry successfully', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          system: expect.stringContaining('accounting expert'),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([expect.objectContaining({ type: 'text' })]),
            }),
          ]),
        })
      )

      expect(result).toEqual({
        isValid: true,
        issues: [],
        suggestions: ['Consider adding more details to description'],
      })
    })

    it('should detect validation issues', async () => {
      const issuesResponse = {
        id: 'msg_val_456',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isValid: false,
              issues: [
                {
                  field: 'amount',
                  severity: 'error',
                  message: 'Amount mismatch',
                  messageJa: '金額が一致しません',
                  expectedValue: 10000,
                  actualValue: 9000,
                },
                {
                  field: 'date',
                  severity: 'warning',
                  message: 'Date differs by more than 3 days',
                  messageJa: '日付が3日以上異なります',
                },
              ],
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(issuesResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toHaveLength(2)
      expect(result.issues[0]).toEqual({
        field: 'amount',
        severity: 'error',
        message: '金額が一致しません',
        messageEn: 'Amount mismatch',
        expectedValue: 10000,
        actualValue: 9000,
      })
      expect(result.issues[1]).toEqual({
        field: 'date',
        severity: 'warning',
        message: '日付が3日以上異なります',
        messageEn: 'Date differs by more than 3 days',
        expectedValue: undefined,
        actualValue: undefined,
      })
    })

    it('should handle info severity issues', async () => {
      const infoResponse = {
        id: 'msg_val_789',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isValid: true,
              issues: [
                {
                  field: 'description',
                  severity: 'info',
                  message: 'Minor discrepancy in description',
                  messageJa: '摘要に軽微な不一致',
                },
              ],
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(infoResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(true)
      expect(result.issues[0].severity).toBe('info')
    })

    it('should use custom model for validation', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const customProvider = new ClaudeProvider({
        provider: 'claude',
        apiKey: 'test-key',
        model: 'claude-opus-4',
      })

      await customProvider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus-4',
        })
      )
    })

    it('should handle validation with missing fields', async () => {
      const partialResponse = {
        id: 'msg_val_101',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isValid: false,
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(partialResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toEqual([])
    })

    it('should handle validation with non-JSON response', async () => {
      const nonJsonResponse = {
        id: 'msg_val_102',
        content: [
          {
            type: 'text',
            text: 'Validation result: the entry is valid',
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(nonJsonResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toEqual([])
    })

    it('should handle validation API error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Validation API error'))

      await expect(provider.validateEntry(mockValidationRequest)).rejects.toThrow(
        'Validation API error'
      )
    })

    it('should handle journal entry with taxType', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const requestWithTaxType = {
        ...mockValidationRequest,
        journalEntry: {
          ...mockValidationRequest.journalEntry,
          taxType: 'standard',
        },
      }

      const result = await provider.validateEntry(requestWithTaxType)

      expect(result).toBeDefined()
    })

    it('should handle issues without messageJa', async () => {
      const englishOnlyResponse = {
        id: 'msg_val_103',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isValid: false,
              issues: [
                {
                  field: 'amount',
                  severity: 'error',
                  message: 'Amount mismatch',
                },
              ],
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(englishOnlyResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.issues[0].message).toBe('Amount mismatch')
      expect(result.issues[0].messageEn).toBe('Amount mismatch')
    })

    it('should handle empty issues array', async () => {
      const emptyIssuesResponse = {
        id: 'msg_val_104',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isValid: true,
              issues: [],
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }

      mockCreate.mockResolvedValueOnce(emptyIssuesResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(true)
      expect(result.issues).toEqual([])
    })

    it('should retry on 529 overloaded error for validation', async () => {
      const overloadedError = new Error('overloaded')
      mockCreate.mockRejectedValueOnce(overloadedError)
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledTimes(2)
      expect(result.isValid).toBe(true)
    })

    it('should use default model from config service for validation', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const defaultProvider = new ClaudeProvider({
        provider: 'claude',
        apiKey: 'test-key',
      })

      await defaultProvider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
        })
      )
    })
  })
})

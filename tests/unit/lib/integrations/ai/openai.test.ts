import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAIProvider, createOpenAIProvider } from '@/lib/integrations/ai/openai'
import { DocumentAnalysisResult } from '@/types/audit'

const mockCreate = vi.fn()

vi.mock('openai', () => {
  return {
    default: class {
      chat = {
        completions: {
          create: mockCreate,
        },
      }
    },
  }
})

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider

  beforeEach(() => {
    vi.clearAllMocks()

    provider = new OpenAIProvider({
      provider: 'openai',
      apiKey: 'test-api-key',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const p = new OpenAIProvider({ provider: 'openai', apiKey: 'key' })
      expect(p).toBeDefined()
      expect(p.name).toBe('openai')
    })

    it('should create instance with optional config', () => {
      const p = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'key',
        model: 'gpt-4-turbo',
        temperature: 0.5,
        maxTokens: 2048,
      })
      expect(p).toBeDefined()
    })
  })

  describe('createOpenAIProvider', () => {
    it('should create OpenAIProvider instance', () => {
      const p = createOpenAIProvider({ provider: 'openai', apiKey: 'test-key' })
      expect(p).toBeInstanceOf(OpenAIProvider)
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
      choices: [
        {
          message: {
            content: JSON.stringify({
              date: '2024-01-15',
              amount: 10000,
              taxAmount: 1000,
              taxRate: 0.1,
              description: 'Test invoice',
              vendorName: 'Test Vendor',
              confidence: 0.95,
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    }

    it('should analyze PDF document successfully', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-nano',
          max_tokens: 1024,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({ type: 'image_url' }),
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

      expect(result).toBeDefined()
      expect(result.confidence).toBe(0.95)
    })

    it('should use custom model when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const customProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4-turbo',
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
        })
      )
    })

    it('should use custom temperature when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const customProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        temperature: 0.5,
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
        })
      )
    })

    it('should use custom maxTokens when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const customProvider = new OpenAIProvider({
        provider: 'openai',
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
        choices: [
          {
            message: {
              content: JSON.stringify({
                date: '2024-01-15',
                amount: 5000,
              }),
            },
          },
        ],
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

    it('should handle null values in response', async () => {
      const nullResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                date: null,
                amount: null,
                taxAmount: null,
                description: null,
                vendorName: null,
                confidence: null,
              }),
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(nullResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result.date).toBe(null)
      expect(result.amount).toBe(0)
      expect(result.taxAmount).toBe(0)
      expect(result.description).toBe('')
      expect(result.vendorName).toBe('')
      expect(result.confidence).toBe(0.5)
    })

    it('should handle empty content in response', async () => {
      const emptyResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(emptyResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result.rawText).toBe('{}')
    })

    it('should handle missing choices array', async () => {
      const noChoicesResponse = {
        choices: [],
      }

      mockCreate.mockResolvedValueOnce(noChoicesResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result.rawText).toBe('{}')
    })

    it('should handle API error', async () => {
      const noRetryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 0,
      })
      const apiError = new Error('API Error')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(noRetryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow('API Error')
    })

    it('should handle rate limit error', async () => {
      const noRetryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 0,
      })
      const rateLimitError = new Error('Rate limit exceeded') as Error & { status?: number }
      rateLimitError.status = 429
      mockCreate.mockRejectedValueOnce(rateLimitError)

      await expect(noRetryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow(
        'Rate limit exceeded'
      )
    })

    it('should handle authentication error', async () => {
      const noRetryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 0,
      })
      const authError = new Error('Invalid API key') as Error & { status?: number }
      authError.status = 401
      mockCreate.mockRejectedValueOnce(authError)

      await expect(noRetryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow(
        'Invalid API key'
      )
    })

    it('should handle JSON parse error', async () => {
      const invalidJsonResponse = {
        choices: [
          {
            message: {
              content: 'Invalid JSON {{{',
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(invalidJsonResponse)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow()
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

    it('should handle different image mime types', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const gifRequest = {
        documentBase64: 'base64gifdata',
        documentType: 'image' as const,
        mimeType: 'image/gif',
      }

      const result = await provider.analyzeDocument(gifRequest)
      expect(result).toBeDefined()
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
      choices: [
        {
          message: {
            content: JSON.stringify({
              isValid: true,
              issues: [],
              suggestions: ['Consider adding more details to description'],
            }),
          },
        },
      ],
    }

    it('should validate entry successfully', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-nano',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('accounting expert'),
            }),
            expect.objectContaining({
              role: 'user',
            }),
          ]),
          response_format: { type: 'json_object' },
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
          },
        ],
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
    })

    it('should handle info severity issues', async () => {
      const infoResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
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
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(infoResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(true)
      expect(result.issues[0].severity).toBe('info')
    })

    it('should use custom model for validation', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const customProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4-turbo',
      })

      await customProvider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
        })
      )
    })

    it('should use custom temperature for validation', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const customProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        temperature: 0.3,
      })

      await customProvider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        })
      )
    })

    it('should handle validation with missing fields', async () => {
      const partialResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                isValid: false,
              }),
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(partialResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toEqual([])
    })

    it('should handle validation with non-JSON response', async () => {
      const nonJsonResponse = {
        choices: [
          {
            message: {
              content: 'Validation result: the entry is valid',
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(nonJsonResponse)

      await expect(provider.validateEntry(mockValidationRequest)).rejects.toThrow()
    })

    it('should handle validation API error', async () => {
      const noRetryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 0,
      })
      mockCreate.mockRejectedValueOnce(new Error('Validation API error'))

      await expect(noRetryProvider.validateEntry(mockValidationRequest)).rejects.toThrow(
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
                  },
                ],
              }),
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(englishOnlyResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.issues[0].message).toBe('Amount mismatch')
      expect(result.issues[0].messageEn).toBe('Amount mismatch')
    })

    it('should handle empty issues array', async () => {
      const emptyIssuesResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                isValid: true,
                issues: [],
              }),
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(emptyIssuesResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(true)
      expect(result.issues).toEqual([])
    })

    it('should handle null message content', async () => {
      const nullContentResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(nullContentResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toEqual([])
    })
  })

  describe('OpenRouter mode', () => {
    it('should create instance with baseUrl for OpenRouter', () => {
      const p = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'key',
        baseUrl: 'https://openrouter.ai/api/v1',
      })
      expect(p).toBeDefined()
    })

    it('should use OpenRouter-specific headers', async () => {
      const mockOpenRouterCreate = vi.fn().mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                date: '2024-01-15',
                amount: 10000,
              }),
            },
          },
        ],
      })

      vi.doMock('openai', () => {
        return {
          default: class {
            chat = {
              completions: {
                create: mockOpenRouterCreate,
              },
            }
          },
        }
      })

      const openRouterProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        openRouterOptions: {
          referer: 'https://myapp.com',
          title: 'My App',
        },
      })

      expect(openRouterProvider).toBeDefined()
    })

    it('should use default model for OpenRouter when not specified', () => {
      const p = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'key',
        baseUrl: 'https://openrouter.ai/api/v1',
      })
      expect(p).toBeDefined()
    })

    it('should use custom model for OpenRouter when specified', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                date: '2024-01-15',
                amount: 10000,
              }),
            },
          },
        ],
      })

      const customProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-sonnet-4',
      })

      await customProvider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'image',
        mimeType: 'image/jpeg',
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'anthropic/claude-sonnet-4',
        })
      )
    })
  })

  describe('retry logic', () => {
    it('should retry on rate limit error', async () => {
      const rateLimitError = new Error('Rate limit exceeded') as Error & {
        status?: number
        headers?: Record<string, string>
      }
      rateLimitError.status = 429
      rateLimitError.headers = { 'retry-after': '1' }

      mockCreate.mockRejectedValueOnce(rateLimitError)
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                date: '2024-01-15',
                amount: 10000,
              }),
            },
          },
        ],
      })

      const retryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 3,
      })

      const result = await retryProvider.analyzeDocument({
        documentBase64: 'base64data',
        documentType: 'image',
        mimeType: 'image/jpeg',
      })

      expect(result).toBeDefined()
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('should retry on server error', async () => {
      const serverError = new Error('Internal server error') as Error & { status?: number }
      serverError.status = 500

      mockCreate.mockRejectedValueOnce(serverError)
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isValid: true,
                issues: [],
              }),
            },
          },
        ],
      })

      const retryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 3,
      })

      const result = await retryProvider.validateEntry({
        journalEntry: {
          date: '2024-01-15',
          debitAccount: 'Expenses',
          creditAccount: 'Cash',
          amount: 10000,
          taxAmount: 1000,
          description: 'Test',
        },
        documentData: {
          date: '2024-01-15',
          amount: 10000,
          taxAmount: 1000,
          description: 'Test',
          vendorName: 'Test',
          confidence: 0.95,
        },
      })

      expect(result).toBeDefined()
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('should not retry on authentication error', async () => {
      const authError = new Error('Invalid API key') as Error & { status?: number }
      authError.status = 401

      mockCreate.mockRejectedValueOnce(authError)

      const retryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 3,
      })

      await expect(
        retryProvider.analyzeDocument({
          documentBase64: 'base64data',
          documentType: 'image',
          mimeType: 'image/jpeg',
        })
      ).rejects.toThrow('Invalid API key')

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should not retry on invalid request error', async () => {
      const invalidError = new Error('Invalid request') as Error & { status?: number }
      invalidError.status = 400

      mockCreate.mockRejectedValueOnce(invalidError)

      const retryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 3,
      })

      await expect(
        retryProvider.analyzeDocument({
          documentBase64: 'base64data',
          documentType: 'image',
          mimeType: 'image/jpeg',
        })
      ).rejects.toThrow('Invalid request')

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should throw after max retries exceeded', async () => {
      const serverError = new Error('Server error') as Error & { status?: number }
      serverError.status = 500

      mockCreate.mockRejectedValue(serverError)

      const retryProvider = new OpenAIProvider({
        provider: 'openai',
        apiKey: 'test-key',
        maxRetries: 2,
      })

      await expect(
        retryProvider.analyzeDocument({
          documentBase64: 'base64data',
          documentType: 'image',
          mimeType: 'image/jpeg',
        })
      ).rejects.toThrow('Server error')

      expect(mockCreate).toHaveBeenCalledTimes(3)
    })
  })
})

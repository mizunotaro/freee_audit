import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  OpenRouterProvider,
  createOpenRouterProvider,
  OpenRouterProviderConfig,
} from '@/lib/integrations/ai/openrouter'
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

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider

  const defaultConfig: OpenRouterProviderConfig = {
    apiKey: 'test-api-key',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OpenRouterProvider(defaultConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const p = new OpenRouterProvider({ apiKey: 'key' })
      expect(p).toBeDefined()
      expect(p.name).toBe('openrouter')
    })

    it('should create instance with optional config', () => {
      const p = new OpenRouterProvider({
        apiKey: 'key',
        model: 'anthropic/claude-sonnet-4',
        temperature: 0.5,
        maxTokens: 2048,
        siteUrl: 'https://myapp.com',
        siteName: 'My App',
      })
      expect(p).toBeDefined()
    })

    it('should enable ZDR by default', () => {
      const p = new OpenRouterProvider({ apiKey: 'key' })
      expect(p).toBeDefined()
    })

    it('should allow disabling ZDR', () => {
      const p = new OpenRouterProvider({ apiKey: 'key', zdr: false })
      expect(p).toBeDefined()
    })

    it('should accept data residency setting', () => {
      const p = new OpenRouterProvider({ apiKey: 'key', dataResidency: 'EU' })
      expect(p).toBeDefined()
    })

    it('should accept provider routing config', () => {
      const p = new OpenRouterProvider({
        apiKey: 'key',
        providerRouting: {
          order: ['anthropic', 'openai'],
          allow_fallbacks: true,
          require_parameters: false,
        },
      })
      expect(p).toBeDefined()
    })

    it('should accept transforms config', () => {
      const p = new OpenRouterProvider({
        apiKey: 'key',
        transforms: ['middle-out'],
      })
      expect(p).toBeDefined()
    })
  })

  describe('createOpenRouterProvider', () => {
    it('should create OpenRouterProvider instance', () => {
      const p = createOpenRouterProvider({ apiKey: 'test-key' })
      expect(p).toBeInstanceOf(OpenRouterProvider)
    })
  })

  describe('analyzeDocument', () => {
    const mockPdfRequest = {
      documentBase64: 'base64pdfdata',
      documentType: 'pdf' as const,
      mimeType: 'application/pdf',
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
          model: 'openai/gpt-5-nano',
          max_tokens: 1024,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          provider: { zdr: true },
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

      const imageRequest = {
        documentBase64: 'base64imagedata',
        documentType: 'image' as const,
        mimeType: 'image/jpeg',
      }

      const result = await provider.analyzeDocument(imageRequest)
      expect(result).toBeDefined()
      expect(result.confidence).toBe(0.95)
    })

    it('should use custom model when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const customProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        model: 'anthropic/claude-sonnet-4',
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'anthropic/claude-sonnet-4',
        })
      )
    })

    it('should include ZDR in request when enabled', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const zdrProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        zdr: true,
      })

      await zdrProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: { zdr: true },
        })
      )
    })

    it('should not include ZDR in request when disabled', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const noZdrProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        zdr: false,
      })

      await noZdrProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ provider: { zdr: true } })
      )
    })

    it('should include data residency when set', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const euProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        dataResidency: 'EU',
      })

      await euProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            data_residency: 'EU',
          }),
        })
      )
    })

    it('should include provider order when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const orderedProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        providerRouting: {
          order: ['anthropic', 'openai'],
        },
      })

      await orderedProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            order: ['anthropic', 'openai'],
            zdr: true,
          }),
        })
      )
    })

    it('should include provider allow_fallbacks when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const fallbackProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        providerRouting: {
          allow_fallbacks: false,
        },
      })

      await fallbackProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            allow_fallbacks: false,
          }),
        })
      )
    })

    it('should include provider only when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const onlyProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        providerRouting: {
          only: ['anthropic'],
        },
      })

      await onlyProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            only: ['anthropic'],
          }),
        })
      )
    })

    it('should include provider ignore when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const ignoreProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        providerRouting: {
          ignore: ['replicate'],
        },
      })

      await ignoreProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.objectContaining({
            ignore: ['replicate'],
          }),
        })
      )
    })

    it('should include transforms when configured', async () => {
      mockCreate.mockResolvedValueOnce(successfulResponse)

      const transformsProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        transforms: ['middle-out'],
      })

      await transformsProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          transforms: ['middle-out'],
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

    it('should handle API error', async () => {
      const noRetryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 0,
      })
      const apiError = new Error('API Error')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(noRetryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow('API Error')
    })

    it('should handle rate limit error', async () => {
      const noRetryProvider = new OpenRouterProvider({
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
      const noRetryProvider = new OpenRouterProvider({
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

    it('should handle provider error (402)', async () => {
      const noRetryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 0,
      })
      const providerError = new Error('Insufficient credits') as Error & {
        status?: number
        error?: { code?: number; message?: string }
      }
      providerError.status = 402
      providerError.error = { code: 402, message: 'Insufficient credits' }
      mockCreate.mockRejectedValueOnce(providerError)

      await expect(noRetryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow()
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
          model: 'openai/gpt-5-nano',
          response_format: { type: 'json_object' },
          provider: { zdr: true },
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
                ],
              }),
            },
          },
        ],
      }

      mockCreate.mockResolvedValueOnce(issuesResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toEqual({
        field: 'amount',
        severity: 'error',
        message: '金額が一致しません',
        messageEn: 'Amount mismatch',
        expectedValue: 10000,
        actualValue: 9000,
      })
    })

    it('should use custom model for validation', async () => {
      mockCreate.mockResolvedValueOnce(successfulValidationResponse)

      const customProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        model: 'anthropic/claude-sonnet-4',
      })

      await customProvider.validateEntry(mockValidationRequest)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'anthropic/claude-sonnet-4',
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

  describe('getAvailableModels', () => {
    it('should fetch available models', async () => {
      const mockModels = {
        data: [
          {
            id: 'openai/gpt-5-nano',
            name: 'GPT-5 Nano',
            context_length: 1048576,
            pricing: {
              prompt: '0.0001',
              completion: '0.0004',
            },
          },
          {
            id: 'anthropic/claude-sonnet-4',
            name: 'Claude Sonnet 4',
            context_length: 200000,
            pricing: {
              prompt: '0.003',
              completion: '0.015',
            },
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels),
      })

      const models = await provider.getAvailableModels()

      expect(mockFetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: 'Bearer test-api-key',
        },
      })

      expect(models).toHaveLength(2)
      expect(models[0].id).toBe('openai/gpt-5-nano')
      expect(models[1].id).toBe('anthropic/claude-sonnet-4')
    })

    it('should throw error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(provider.getAvailableModels()).rejects.toThrow(
        'Failed to fetch models: 401 Unauthorized'
      )
    })
  })

  describe('getModelInfo', () => {
    it('should return specific model info', async () => {
      const mockModels = {
        data: [
          {
            id: 'openai/gpt-5-nano',
            name: 'GPT-5 Nano',
            context_length: 1048576,
            pricing: {
              prompt: '0.0001',
              completion: '0.0004',
            },
          },
          {
            id: 'anthropic/claude-sonnet-4',
            name: 'Claude Sonnet 4',
            context_length: 200000,
            pricing: {
              prompt: '0.003',
              completion: '0.015',
            },
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels),
      })

      const modelInfo = await provider.getModelInfo('anthropic/claude-sonnet-4')

      expect(modelInfo).toBeDefined()
      expect(modelInfo?.id).toBe('anthropic/claude-sonnet-4')
      expect(modelInfo?.name).toBe('Claude Sonnet 4')
    })

    it('should return undefined for non-existent model', async () => {
      const mockModels = {
        data: [
          {
            id: 'openai/gpt-5-nano',
            name: 'GPT-5 Nano',
            context_length: 1048576,
            pricing: {
              prompt: '0.0001',
              completion: '0.0004',
            },
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockModels),
      })

      const modelInfo = await provider.getModelInfo('non-existent-model')

      expect(modelInfo).toBeUndefined()
    })
  })

  describe('retry logic', () => {
    const mockPdfRequest = {
      documentBase64: 'base64data',
      documentType: 'image' as const,
      mimeType: 'image/jpeg',
    }

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

      const retryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 3,
      })

      const result = await retryProvider.analyzeDocument(mockPdfRequest)

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

      const retryProvider = new OpenRouterProvider({
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

      const retryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 3,
      })

      await expect(retryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Invalid API key')

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should not retry on invalid request error', async () => {
      const invalidError = new Error('Invalid request') as Error & { status?: number }
      invalidError.status = 400

      mockCreate.mockRejectedValueOnce(invalidError)

      const retryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 3,
      })

      await expect(retryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Invalid request')

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should not retry on provider error (402)', async () => {
      const providerError = new Error('Insufficient credits') as Error & { status?: number }
      providerError.status = 402

      mockCreate.mockRejectedValueOnce(providerError)

      const retryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 3,
      })

      await expect(retryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow()

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should throw after max retries exceeded', async () => {
      const serverError = new Error('Server error') as Error & { status?: number }
      serverError.status = 500

      mockCreate.mockRejectedValue(serverError)

      const retryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 2,
      })

      await expect(retryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Server error')

      expect(mockCreate).toHaveBeenCalledTimes(3)
    })
  })

  describe('error parsing', () => {
    const mockPdfRequest = {
      documentBase64: 'base64data',
      documentType: 'image' as const,
      mimeType: 'image/jpeg',
    }

    it('should handle 403 forbidden error', async () => {
      const noRetryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 0,
      })
      const forbiddenError = new Error('Forbidden') as Error & { status?: number }
      forbiddenError.status = 403
      mockCreate.mockRejectedValueOnce(forbiddenError)

      await expect(noRetryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Forbidden')
    })

    it('should handle unknown error types', async () => {
      const noRetryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 0,
      })
      const unknownError = { message: 'Something weird happened' }
      mockCreate.mockRejectedValueOnce(unknownError)

      await expect(noRetryProvider.analyzeDocument(mockPdfRequest)).rejects.toThrow()
    })

    it('should handle error with retry-after header', async () => {
      const rateLimitError = new Error('Rate limit') as Error & {
        status?: number
        headers?: Record<string, string>
      }
      rateLimitError.status = 429
      rateLimitError.headers = { 'retry-after': '5' }

      mockCreate.mockRejectedValueOnce(rateLimitError)
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{}' } }],
      })

      const retryProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        maxRetries: 1,
      })

      await retryProvider.analyzeDocument(mockPdfRequest)

      expect(mockCreate).toHaveBeenCalledTimes(2)
    })
  })
})

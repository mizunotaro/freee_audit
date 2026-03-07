import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GeminiProvider, createGeminiProvider, GeminiConfig } from '@/lib/integrations/ai/gemini'
import { DocumentAnalysisResult } from '@/types/audit'
import { TimeoutError } from '@/lib/utils/timeout'
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

const mockGenerateContent = vi.fn()

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      }
    }
  },
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
  },
}))

describe('GeminiProvider', () => {
  let provider: GeminiProvider

  beforeEach(() => {
    vi.clearAllMocks()

    provider = new GeminiProvider({
      provider: 'gemini',
      apiKey: 'test-api-key',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const p = new GeminiProvider({ provider: 'gemini', apiKey: 'key' })
      expect(p).toBeDefined()
      expect(p.name).toBe('gemini')
      expect(p.getModel()).toBe('gemini-2.0-flash')
    })

    it('should create instance with optional config', () => {
      const p = new GeminiProvider({
        provider: 'gemini',
        apiKey: 'key',
        model: 'gemini-1.5-flash',
        temperature: 0.7,
        maxTokens: 2048,
      })
      expect(p).toBeDefined()
      expect(p.getModel()).toBe('gemini-1.5-flash')
    })

    it('should use gemini-2.0-flash as default model', () => {
      const p = new GeminiProvider({ provider: 'gemini', apiKey: 'key' })
      expect(p.getModel()).toBe('gemini-2.0-flash')
    })

    it('should accept custom safety settings', () => {
      const p = new GeminiProvider({
        provider: 'gemini',
        apiKey: 'key',
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
        ],
      })
      expect(p).toBeDefined()
    })
  })

  describe('createGeminiProvider', () => {
    it('should create GeminiProvider instance', () => {
      const p = createGeminiProvider({ provider: 'gemini', apiKey: 'test-key' })
      expect(p).toBeInstanceOf(GeminiProvider)
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
      response: {
        text: () =>
          JSON.stringify({
            date: '2024-01-15',
            amount: 10000,
            taxAmount: 1000,
            taxRate: 0.1,
            description: 'Test invoice',
            vendorName: 'Test Vendor',
            confidence: 0.95,
          }),
        candidates: [
          {
            content: { parts: [{ text: 'Analysis' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
        },
      },
    }

    it('should analyze PDF document successfully', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              parts: expect.any(Array),
            }),
          ]),
          generationConfig: expect.objectContaining({
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          }),
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
      mockGenerateContent.mockResolvedValueOnce(successfulResponse)

      const result = await provider.analyzeDocument(mockImageRequest)

      expect(result).toBeDefined()
      expect(result.confidence).toBe(0.95)
    })

    it('should use custom model when configured', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulResponse)

      const customProvider = new GeminiProvider({
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash',
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockGenerateContent).toHaveBeenCalled()
    })

    it('should use custom temperature when configured', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulResponse)

      const customProvider = new GeminiProvider({
        provider: 'gemini',
        apiKey: 'test-key',
        temperature: 0.5,
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.5,
          }),
        })
      )
    })

    it('should use custom maxTokens when configured', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulResponse)

      const customProvider = new GeminiProvider({
        provider: 'gemini',
        apiKey: 'test-key',
        maxTokens: 2048,
      })

      await customProvider.analyzeDocument(mockPdfRequest)

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            maxOutputTokens: 2048,
          }),
        })
      )
    })

    it('should handle response with missing optional fields', async () => {
      const partialResponse = {
        response: {
          text: () =>
            JSON.stringify({
              date: '2024-01-15',
              amount: 5000,
            }),
        },
      }

      mockGenerateContent.mockResolvedValueOnce(partialResponse)

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
        response: {
          text: () => 'This is plain text, not JSON',
        },
      }

      mockGenerateContent.mockResolvedValueOnce(nonJsonResponse)

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
        response: {
          text: () =>
            'Here is the result: {"date":"2024-02-20","amount":3000,"confidence":0.8} End of response',
        },
      }

      mockGenerateContent.mockResolvedValueOnce(embeddedJsonResponse)

      const result = await provider.analyzeDocument(mockPdfRequest)

      expect(result.date).toBe('2024-02-20')
      expect(result.amount).toBe(3000)
      expect(result.confidence).toBe(0.8)
    })

    it('should handle malformed JSON', async () => {
      const malformedResponse = {
        response: {
          text: () => '{invalid json}',
        },
      }

      mockGenerateContent.mockResolvedValueOnce(malformedResponse)

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

    it('should handle API error', async () => {
      const apiError = new Error('API Error')
      mockGenerateContent.mockRejectedValueOnce(apiError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('API Error')
    })

    it('should handle timeout error', async () => {
      vi.useFakeTimers()

      mockGenerateContent.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(successfulResponse), 70000)
        })
      })

      const analyzePromise = provider.analyzeDocument(mockPdfRequest)

      vi.advanceTimersByTime(61000)

      await expect(analyzePromise).rejects.toThrow(TimeoutError)

      vi.useRealTimers()
    }, 10000)

    it('should handle rate limit error', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      mockGenerateContent.mockRejectedValueOnce(rateLimitError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle network error', async () => {
      const networkError = new Error('Network error')
      mockGenerateContent.mockRejectedValueOnce(networkError)

      await expect(provider.analyzeDocument(mockPdfRequest)).rejects.toThrow('Network error')
    })

    it('should include extractionFields when provided', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulResponse)

      const requestWithFields = {
        ...mockPdfRequest,
        extractionFields: ['date', 'amount'],
      }

      await provider.analyzeDocument(requestWithFields)

      expect(mockGenerateContent).toHaveBeenCalled()
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
      response: {
        text: () =>
          JSON.stringify({
            isValid: true,
            issues: [],
            suggestions: ['Consider adding more details to description'],
          }),
      },
    }

    it('should validate entry successfully', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulValidationResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              parts: expect.arrayContaining([
                expect.objectContaining({ text: expect.any(String) }),
              ]),
            }),
          ]),
          generationConfig: expect.objectContaining({
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          }),
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
        response: {
          text: () =>
            JSON.stringify({
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
      }

      mockGenerateContent.mockResolvedValueOnce(issuesResponse)

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
        response: {
          text: () =>
            JSON.stringify({
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
      }

      mockGenerateContent.mockResolvedValueOnce(infoResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(true)
      expect(result.issues[0].severity).toBe('info')
    })

    it('should use custom temperature for validation', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulValidationResponse)

      const customProvider = new GeminiProvider({
        provider: 'gemini',
        apiKey: 'test-key',
        temperature: 0.3,
      })

      await customProvider.validateEntry(mockValidationRequest)

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.3,
          }),
        })
      )
    })

    it('should handle validation with missing fields', async () => {
      const partialResponse = {
        response: {
          text: () =>
            JSON.stringify({
              isValid: false,
            }),
        },
      }

      mockGenerateContent.mockResolvedValueOnce(partialResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toEqual([])
    })

    it('should handle validation with non-JSON response', async () => {
      const nonJsonResponse = {
        response: {
          text: () => 'Validation result: the entry is valid',
        },
      }

      mockGenerateContent.mockResolvedValueOnce(nonJsonResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(false)
      expect(result.issues).toEqual([])
    })

    it('should handle validation timeout', async () => {
      vi.useFakeTimers()

      mockGenerateContent.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(successfulValidationResponse), 70000)
        })
      })

      const validatePromise = provider.validateEntry(mockValidationRequest)

      vi.advanceTimersByTime(61000)

      await expect(validatePromise).rejects.toThrow(TimeoutError)

      vi.useRealTimers()
    }, 10000)

    it('should handle validation API error', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Validation API error'))

      await expect(provider.validateEntry(mockValidationRequest)).rejects.toThrow(
        'Validation API error'
      )
    })

    it('should handle journal entry with taxType', async () => {
      mockGenerateContent.mockResolvedValueOnce(successfulValidationResponse)

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
        response: {
          text: () =>
            JSON.stringify({
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
      }

      mockGenerateContent.mockResolvedValueOnce(englishOnlyResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.issues[0].message).toBe('Amount mismatch')
      expect(result.issues[0].messageEn).toBe('Amount mismatch')
    })

    it('should handle empty issues array', async () => {
      const emptyIssuesResponse = {
        response: {
          text: () =>
            JSON.stringify({
              isValid: true,
              issues: [],
            }),
        },
      }

      mockGenerateContent.mockResolvedValueOnce(emptyIssuesResponse)

      const result = await provider.validateEntry(mockValidationRequest)

      expect(result.isValid).toBe(true)
      expect(result.issues).toEqual([])
    })
  })
})

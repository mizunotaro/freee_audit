import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseAIProvider } from '@/lib/integrations/ai/provider'
import type {
  AIConfig,
  AIProvider,
  GenerateOptions,
  GenerateResult,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from '@/lib/integrations/ai/provider'
import { DocumentAnalysisResult, EntryValidationResult } from '@/types/audit'

class TestableProvider extends BaseAIProvider {
  readonly name = 'openai' as const

  async analyzeDocument(_request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    return {
      date: '2024-01-01',
      amount: 1000,
      taxAmount: 100,
      taxRate: 0.1,
      description: 'test',
      vendorName: 'test vendor',
      confidence: 0.9,
      rawText: '{}',
    }
  }

  async validateEntry(_request: EntryValidationRequest): Promise<EntryValidationResult> {
    return {
      isValid: true,
      issues: [],
      suggestions: [],
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    return {
      content: 'test response',
      model: options.model || 'test-model',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    }
  }

  getSystemPromptPublic(): string {
    return this.getSystemPrompt()
  }

  getSystemPromptJaPublic(): string {
    return this.getSystemPromptJa()
  }

  getValidationPromptPublic(): string {
    return this.getValidationPrompt()
  }
}

describe('BaseAIProvider', () => {
  let provider: TestableProvider

  beforeEach(() => {
    const config: AIConfig = {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 2048,
    }
    provider = new TestableProvider(config)
  })

  describe('constructor', () => {
    it('should store config', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
      }
      const p = new TestableProvider(config)
      expect(p).toBeDefined()
      expect(p.name).toBe('openai')
    })
  })

  describe('getSystemPrompt', () => {
    it('should return English system prompt', () => {
      const prompt = provider.getSystemPromptPublic()
      expect(prompt).toContain('accounting document analysis')
      expect(prompt).toContain('JSON')
      expect(prompt).toContain('date')
      expect(prompt).toContain('amount')
      expect(prompt).toContain('taxAmount')
      expect(prompt).toContain('vendorName')
      expect(prompt).toContain('confidence')
    })
  })

  describe('getSystemPromptJa', () => {
    it('should return Japanese system prompt', () => {
      const prompt = provider.getSystemPromptJaPublic()
      expect(prompt).toContain('会計証憑分析')
      expect(prompt).toContain('JSON')
      expect(prompt).toContain('日付')
      expect(prompt).toContain('金額')
      expect(prompt).toContain('消費税額')
    })
  })

  describe('getValidationPrompt', () => {
    it('should return validation prompt', () => {
      const prompt = provider.getValidationPromptPublic()
      expect(prompt).toContain('accounting expert')
      expect(prompt).toContain('Date consistency')
      expect(prompt).toContain('Amount consistency')
      expect(prompt).toContain('isValid')
      expect(prompt).toContain('error')
      expect(prompt).toContain('warning')
      expect(prompt).toContain('info')
    })
  })

  describe('AIProvider interface', () => {
    it('should implement analyzeDocument', async () => {
      const result = await provider.analyzeDocument({
        documentBase64: 'base64',
        documentType: 'pdf',
        mimeType: 'application/pdf',
      })
      expect(result.date).toBe('2024-01-01')
      expect(result.amount).toBe(1000)
    })

    it('should implement validateEntry', async () => {
      const result = await provider.validateEntry({
        journalEntry: {
          date: '2024-01-01',
          debitAccount: 'Cash',
          creditAccount: 'Revenue',
          amount: 1000,
          taxAmount: 100,
          description: 'test',
        },
        documentData: {
          date: '2024-01-01',
          amount: 1000,
          taxAmount: 100,
          description: 'test',
          vendorName: 'vendor',
          confidence: 0.9,
        },
      })
      expect(result.isValid).toBe(true)
      expect(result.issues).toEqual([])
    })

    it('should implement generate', async () => {
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'hello' }],
      })
      expect(result.content).toBe('test response')
      expect(result.usage?.totalTokens).toBe(30)
    })
  })

  describe('AIConfig interface', () => {
    it('should accept minimal config', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'key',
      }
      expect(config.provider).toBe('openai')
      expect(config.apiKey).toBe('key')
      expect(config.model).toBeUndefined()
      expect(config.temperature).toBeUndefined()
      expect(config.maxTokens).toBeUndefined()
    })

    it('should accept full config', () => {
      const config: AIConfig = {
        provider: 'claude',
        apiKey: 'key',
        model: 'claude-3',
        temperature: 0.7,
        maxTokens: 4096,
      }
      expect(config.provider).toBe('claude')
      expect(config.model).toBe('claude-3')
      expect(config.temperature).toBe(0.7)
      expect(config.maxTokens).toBe(4096)
    })
  })

  describe('GenerateOptions interface', () => {
    it('should support messages with all roles', () => {
      const options: GenerateOptions = {
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user message' },
          { role: 'assistant', content: 'assistant reply' },
        ],
      }
      expect(options.messages).toHaveLength(3)
      expect(options.messages[0].role).toBe('system')
      expect(options.messages[1].role).toBe('user')
      expect(options.messages[2].role).toBe('assistant')
    })
  })

  describe('GenerateResult interface', () => {
    it('should include usage when present', async () => {
      const result = await provider.generate({
        messages: [{ role: 'user', content: 'test' }],
      })
      expect(result.usage).toBeDefined()
      expect(result.usage?.promptTokens).toBe(10)
      expect(result.usage?.completionTokens).toBe(20)
      expect(result.usage?.totalTokens).toBe(30)
    })
  })
})

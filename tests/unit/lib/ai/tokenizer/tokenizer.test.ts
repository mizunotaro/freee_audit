import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { tokenizerService, TokenizerService } from '@/lib/ai/tokenizer/tokenizer'

describe('TokenizerService', () => {
  let service: TokenizerService

  beforeEach(() => {
    service = new TokenizerService()
  })

  afterEach(() => {
    service.clearCache()
  })

  describe('countTokens', () => {
    it('should count tokens for simple English text', () => {
      const result = service.countTokens('Hello, world!')

      expect(result.tokens).toBeGreaterThan(0)
      expect(result.characterCount).toBe(13)
      expect(result.truncated).toBe(false)
    })

    it('should count tokens for Japanese text', () => {
      const result = service.countTokens('こんにちは世界')

      expect(result.tokens).toBeGreaterThan(0)
      expect(result.characterCount).toBe(7)
    })

    it('should count tokens for mixed language text', () => {
      const result = service.countTokens('Hello こんにちは World 世界')

      expect(result.tokens).toBeGreaterThan(0)
    })

    it('should handle empty string', () => {
      const result = service.countTokens('')

      expect(result.tokens).toBe(0)
      expect(result.characterCount).toBe(0)
    })

    it('should use cl100k_base encoding by default', () => {
      const result = service.countTokens('Test text')

      expect(result.encoding).toBe('cl100k_base')
    })

    it('should use o200k_base encoding for GPT-4o model', () => {
      const result = service.countTokens('Test text', { model: 'gpt-4o' })

      expect(result.encoding).toBe('o200k_base')
    })

    it('should use specified encoding over model default', () => {
      const result = service.countTokens('Test text', {
        model: 'gpt-4o',
        encoding: 'cl100k_base',
      })

      expect(result.encoding).toBe('cl100k_base')
    })

    it('should handle emojis', () => {
      const result = service.countTokens('Hello 👋 World 🌍')

      expect(result.tokens).toBeGreaterThan(0)
    })

    it('should sanitize control characters', () => {
      const result1 = service.countTokens('Hello\x00World')
      const result2 = service.countTokens('HelloWorld')

      expect(result1.characterCount).toBe(result2.characterCount)
    })

    it('should normalize line endings', () => {
      const result1 = service.countTokens('Hello\r\nWorld')
      const result2 = service.countTokens('Hello\nWorld')

      expect(result1.characterCount).toBe(result2.characterCount)
    })

    it('should mark as truncated when maxTokens exceeded and truncate option set', () => {
      const longText = 'This is a longer piece of text that should exceed the token limit.'
      const result = service.countTokens(longText, { maxTokens: 5, truncate: true })

      expect(result.truncated).toBe(true)
      expect(result.tokens).toBe(5)
    })

    it('should not truncate when truncate option not set', () => {
      const longText = 'This is a longer piece of text.'
      const result = service.countTokens(longText, { maxTokens: 2 })

      expect(result.truncated).toBe(false)
      expect(result.tokens).toBeGreaterThan(2)
    })
  })

  describe('estimateCost', () => {
    it('should estimate cost for input and output tokens', () => {
      const estimate = service.estimateCost('Hello world', 100, 'gpt-5-nano')

      expect(estimate.inputTokens).toBeGreaterThan(0)
      expect(estimate.outputTokens).toBe(100)
      expect(estimate.inputCost).toBeGreaterThanOrEqual(0)
      expect(estimate.outputCost).toBeGreaterThanOrEqual(0)
      expect(estimate.totalCost).toBe(estimate.inputCost + estimate.outputCost)
      expect(estimate.model).toBe('gpt-5-nano')
    })

    it('should handle empty input', () => {
      const estimate = service.estimateCost('', 50, 'gpt-4o')

      expect(estimate.inputTokens).toBe(0)
      expect(estimate.inputCost).toBe(0)
    })
  })

  describe('isWithinLimit', () => {
    it('should return true when tokens within limit', () => {
      const result = service.isWithinLimit('Hello', 100)

      expect(result).toBe(true)
    })

    it('should return false when tokens exceed limit', () => {
      const longText =
        'This is a much longer piece of text that will definitely exceed a small token limit.'
      const result = service.isWithinLimit(longText, 5)

      expect(result).toBe(false)
    })

    it('should use model-specific encoding', () => {
      const text = 'Test text'
      const result1 = service.isWithinLimit(text, 100, 'gpt-4o')
      const result2 = service.isWithinLimit(text, 100, 'gpt-4')

      expect(result1).toBe(true)
      expect(result2).toBe(true)
    })
  })

  describe('truncateToLimit', () => {
    it('should return original text when within limit', () => {
      const text = 'Hello world'
      const result = service.truncateToLimit(text, 100)

      expect(result).toBe(text)
    })

    it('should truncate text when exceeding limit', () => {
      const text = 'This is a longer piece of text that needs to be truncated.'
      const result = service.truncateToLimit(text, 5)

      expect(result.length).toBeLessThan(text.length)

      const tokenCount = service.countTokens(result)
      expect(tokenCount.tokens).toBeLessThanOrEqual(5)
    })

    it('should handle empty string', () => {
      const result = service.truncateToLimit('', 100)

      expect(result).toBe('')
    })
  })

  describe('estimateImageTokens', () => {
    it('should return 85 tokens for low detail', () => {
      const tokens = service.estimateImageTokens(1024, 1024, 'low')

      expect(tokens).toBe(85)
    })

    it('should calculate tokens for high detail small image', () => {
      const tokens = service.estimateImageTokens(500, 500, 'high')

      expect(tokens).toBeGreaterThan(85)
    })

    it('should calculate tokens for high detail large image', () => {
      const tokens = service.estimateImageTokens(2000, 2000, 'high')

      expect(tokens).toBeGreaterThan(85)
    })

    it('should use auto as default detail level', () => {
      const tokens = service.estimateImageTokens(1024, 1024)

      expect(tokens).toBeGreaterThan(0)
    })
  })

  describe('getContextLength', () => {
    it('should return context length for known models', () => {
      const contextLength = service.getContextLength('gpt-5-nano')

      expect(contextLength).toBe(1048576)
    })

    it('should return context length for Claude models', () => {
      const contextLength = service.getContextLength('claude-sonnet-4-20250514')

      expect(contextLength).toBe(200000)
    })
  })

  describe('cache management', () => {
    it('should cache encoders', () => {
      service.countTokens('Test 1', { encoding: 'cl100k_base' })
      service.countTokens('Test 2', { encoding: 'cl100k_base' })

      const stats = service.getCacheStats()
      expect(stats.size).toBe(1)
      expect(stats.encodings).toContain('cl100k_base')
    })

    it('should clear cache', () => {
      service.countTokens('Test', { encoding: 'cl100k_base' })

      service.clearCache()

      const stats = service.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should use multiple encoders', () => {
      service.countTokens('Test 1', { encoding: 'cl100k_base' })
      service.countTokens('Test 2', { encoding: 'o200k_base' })

      const stats = service.getCacheStats()
      expect(stats.size).toBe(2)
      expect(stats.encodings).toContain('cl100k_base')
      expect(stats.encodings).toContain('o200k_base')
    })
  })

  describe('error handling', () => {
    it('should return null initialization error when successful', () => {
      const error = service.getInitializationError()

      expect(error).toBeNull()
    })
  })
})

describe('tokenizerService singleton', () => {
  it('should be a TokenizerService instance', () => {
    expect(tokenizerService).toBeInstanceOf(TokenizerService)
  })

  it('should have all required methods', () => {
    expect(typeof tokenizerService.countTokens).toBe('function')
    expect(typeof tokenizerService.estimateCost).toBe('function')
    expect(typeof tokenizerService.isWithinLimit).toBe('function')
    expect(typeof tokenizerService.truncateToLimit).toBe('function')
    expect(typeof tokenizerService.estimateImageTokens).toBe('function')
    expect(typeof tokenizerService.getContextLength).toBe('function')
    expect(typeof tokenizerService.getCacheStats).toBe('function')
    expect(typeof tokenizerService.clearCache).toBe('function')
  })
})

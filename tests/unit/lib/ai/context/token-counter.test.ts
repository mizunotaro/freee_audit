import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/tokenizer/tokenizer', () => ({
  tokenizerService: {
    countTokens: vi.fn().mockReturnValue({ tokens: 10 }),
    truncateToLimit: vi.fn().mockReturnValue('truncated text'),
  },
}))

import {
  countTokens,
  countMessagesTokens,
  estimateTokenCost,
  fitTextToTokenLimit,
  estimateContextWindow,
} from '@/lib/ai/context/token-counter'

describe('countTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 0 for empty string', () => {
    expect(countTokens('')).toBe(0)
  })

  it('should return 0 for non-string input', () => {
    expect(countTokens(null as unknown as string)).toBe(0)
    expect(countTokens(undefined as unknown as string)).toBe(0)
  })

  it('should return token count from tokenizerService', () => {
    const result = countTokens('hello world')
    expect(result).toBe(10)
  })
})

describe('countMessagesTokens', () => {
  it('should return 2 for empty messages array', () => {
    expect(countMessagesTokens([])).toBe(2)
  })

  it('should count tokens for messages', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const result = countMessagesTokens(messages)
    expect(result).toBeGreaterThan(0)
  })
})

describe('estimateTokenCost', () => {
  it('should estimate cost correctly', () => {
    const result = estimateTokenCost(1000, 500, 'gpt-5-nano')
    expect(result.inputTokens).toBe(1000)
    expect(result.outputTokens).toBe(500)
    expect(result.totalTokens).toBe(1500)
    expect(result.model).toBe('gpt-5-nano')
    expect(result.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('should use default model when model not specified', () => {
    const result = estimateTokenCost(1000, 500)
    expect(result.model).toBe('gpt-5-nano')
  })

  it('should use default model pricing for unknown model', () => {
    const result = estimateTokenCost(1000, 500, 'unknown-model')
    expect(result.model).toBe('unknown-model')
    expect(result.estimatedCostUsd).toBeGreaterThan(0)
  })
})

describe('fitTextToTokenLimit', () => {
  it('should return empty for empty string', () => {
    const result = fitTextToTokenLimit('', 100)
    expect(result.text).toBe('')
    expect(result.tokens).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it('should handle non-string input', () => {
    const result = fitTextToTokenLimit(null as unknown as string, 100)
    expect(result.text).toBe('')
    expect(result.tokens).toBe(0)
  })
})

describe('estimateContextWindow', () => {
  it('should estimate context window usage', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const result = estimateContextWindow(messages, 'gpt-5-nano')
    expect(result.used).toBeGreaterThan(0)
    expect(result.available).toBeGreaterThan(0)
    expect(result.percentage).toBeGreaterThan(0)
    expect(result.percentage).toBeLessThanOrEqual(100)
  })

  it('should use default model when not specified', () => {
    const result = estimateContextWindow([])
    expect(result.used).toBe(2)
    expect(result.available).toBeGreaterThan(0)
  })

  it('should cap percentage at 100', () => {
    const messages = Array.from({ length: 100000 }, () => ({
      role: 'user',
      content: 'a'.repeat(100),
    }))
    const result = estimateContextWindow(messages, 'gpt-5-nano')
    expect(result.percentage).toBeLessThanOrEqual(100)
  })
})

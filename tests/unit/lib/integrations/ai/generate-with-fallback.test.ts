import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateWithFallback,
  createSeededRandom,
  seededRandomInRange,
} from '@/lib/integrations/ai/generate-with-fallback'
import type { AIProvider, GenerateOptions, GenerateResult } from '@/lib/integrations/ai/provider'

function createMockProvider(
  generateFn?: (options: GenerateOptions) => Promise<GenerateResult>
): AIProvider {
  return {
    name: 'openai',
    generate:
      generateFn ||
      vi.fn().mockResolvedValue({
        content: 'mock response',
        model: 'mock-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    analyzeDocument: vi.fn().mockResolvedValue({
      date: null,
      amount: 0,
      taxAmount: 0,
      description: '',
      vendorName: '',
      confidence: 0,
      rawText: '',
    }),
    validateEntry: vi.fn().mockResolvedValue({
      isValid: true,
      issues: [],
    }),
  }
}

describe('generateWithFallback', () => {
  let provider: AIProvider

  beforeEach(() => {
    provider = createMockProvider()
  })

  describe('successful generation', () => {
    it('should return result with temperatureUsed true when temperature is set', async () => {
      const result = await generateWithFallback(provider, {
        messages: [{ role: 'user', content: 'test' }],
        temperature: 0.5,
      })

      expect(result.content).toBe('mock response')
      expect(result.temperatureUsed).toBe(true)
      expect(result.fallbackUsed).toBe(false)
    })

    it('should return result with temperatureUsed false when temperature is not set', async () => {
      const result = await generateWithFallback(provider, {
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result.content).toBe('mock response')
      expect(result.temperatureUsed).toBe(false)
      expect(result.fallbackUsed).toBe(false)
    })

    it('should pass seed to generate options', async () => {
      const generateSpy = vi.fn().mockResolvedValue({
        content: 'response',
        model: 'test',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      })
      const p = createMockProvider(generateSpy)

      await generateWithFallback(p, {
        messages: [{ role: 'user', content: 'test' }],
        seed: 42,
      })

      expect(generateSpy).toHaveBeenCalledWith(expect.objectContaining({ seed: 42 }))
    })
  })

  describe('fallback on temperature error', () => {
    it('should retry without temperature on temperature error', async () => {
      const error = new Error('temperature is not supported for this model')
      let callCount = 0
      const generateSpy = vi.fn().mockImplementation(function (options: GenerateOptions) {
        callCount++
        if (callCount === 1) throw error
        return Promise.resolve({
          content: 'fallback response',
          model: 'test',
          usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        })
      })
      const p = createMockProvider(generateSpy)

      const result = await generateWithFallback(p, {
        messages: [{ role: 'user', content: 'test' }],
        temperature: 0.5,
      })

      expect(result.fallbackUsed).toBe(true)
      expect(result.temperatureUsed).toBe(false)
      expect(result.content).toBe('fallback response')
      expect(generateSpy).toHaveBeenCalledTimes(2)
      expect(generateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ temperature: undefined })
      )
    })

    it('should throw if retryWithoutTemperature is false', async () => {
      const error = new Error('temperature is not supported')
      const generateSpy = vi.fn().mockRejectedValue(error)
      const p = createMockProvider(generateSpy)

      await expect(
        generateWithFallback(p, {
          messages: [{ role: 'user', content: 'test' }],
          temperature: 0.5,
          retryWithoutTemperature: false,
        })
      ).rejects.toThrow('temperature is not supported')
    })

    it('should throw if temperature is not set and error occurs', async () => {
      const error = new Error('some error')
      const generateSpy = vi.fn().mockRejectedValue(error)
      const p = createMockProvider(generateSpy)

      await expect(
        generateWithFallback(p, {
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow('some error')
    })

    it('should throw non-temperature errors', async () => {
      const error = new Error('authentication failed')
      const generateSpy = vi.fn().mockRejectedValue(error)
      const p = createMockProvider(generateSpy)

      await expect(
        generateWithFallback(p, {
          messages: [{ role: 'user', content: 'test' }],
          temperature: 0.5,
        })
      ).rejects.toThrow('authentication failed')
    })
  })

  describe('temperature error patterns', () => {
    const patterns = [
      'Temperature parameter not supported',
      'Unsupported parameter: temperature',
      'Invalid parameter provided',
      'Model does not support temperature',
      'temperature is not supported',
    ]

    patterns.forEach(function (msg) {
      it(`should detect temperature error: "${msg}"`, async () => {
        const error = new Error(msg)
        let callCount = 0
        const generateSpy = vi.fn().mockImplementation(function () {
          callCount++
          if (callCount === 1) throw error
          return Promise.resolve({ content: 'ok', model: 'm' })
        })
        const p = createMockProvider(generateSpy)

        const result = await generateWithFallback(p, {
          messages: [{ role: 'user', content: 'test' }],
          temperature: 0.7,
        })

        expect(result.fallbackUsed).toBe(true)
      })
    })
  })

  describe('error with object message', () => {
    it('should handle error with object containing message property', async () => {
      const error = { message: 'temperature not supported for this model' }
      let callCount = 0
      const generateSpy = vi.fn().mockImplementation(function () {
        callCount++
        if (callCount === 1) throw error
        return Promise.resolve({ content: 'ok', model: 'm' })
      })
      const p = createMockProvider(generateSpy)

      const result = await generateWithFallback(p, {
        messages: [{ role: 'user', content: 'test' }],
        temperature: 0.3,
      })

      expect(result.fallbackUsed).toBe(true)
    })

    it('should handle non-error non-object throw', async () => {
      const generateSpy = vi.fn().mockRejectedValue('string error')
      const p = createMockProvider(generateSpy)

      await expect(
        generateWithFallback(p, {
          messages: [{ role: 'user', content: 'test' }],
          temperature: 0.5,
        })
      ).rejects.toBe('string error')
    })
  })
})

describe('createSeededRandom', () => {
  it('should return deterministic sequence for same seed', () => {
    const random1 = createSeededRandom(42)
    const random2 = createSeededRandom(42)

    const values1 = Array.from({ length: 10 }, () => random1())
    const values2 = Array.from({ length: 10 }, () => random2())

    expect(values1).toEqual(values2)
  })

  it('should return different sequences for different seeds', () => {
    const random1 = createSeededRandom(1)
    const random2 = createSeededRandom(2)

    const values1 = Array.from({ length: 5 }, () => random1())
    const values2 = Array.from({ length: 5 }, () => random2())

    expect(values1).not.toEqual(values2)
  })

  it('should return values between 0 and 1', () => {
    const random = createSeededRandom(12345)
    for (let i = 0; i < 100; i++) {
      const val = random()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })
})

describe('seededRandomInRange', () => {
  it('should return value within range', () => {
    for (let seed = 0; seed < 100; seed++) {
      const val = seededRandomInRange(seed, 5, 10)
      expect(val).toBeGreaterThanOrEqual(5)
      expect(val).toBeLessThanOrEqual(10)
    }
  })

  it('should return deterministic results for same seed', () => {
    const val1 = seededRandomInRange(42, 1, 100)
    const val2 = seededRandomInRange(42, 1, 100)
    expect(val1).toBe(val2)
  })

  it('should handle min equals max', () => {
    const val = seededRandomInRange(42, 7, 7)
    expect(val).toBe(7)
  })

  it('should return integer values', () => {
    for (let seed = 0; seed < 50; seed++) {
      const val = seededRandomInRange(seed, 0, 1000)
      expect(Number.isInteger(val)).toBe(true)
    }
  })
})

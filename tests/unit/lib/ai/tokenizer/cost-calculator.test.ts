import { describe, it, expect } from 'vitest'
import {
  calculateCost,
  getModelPricing,
  getModelContextLength,
  estimateOutputTokens,
  type ModelPricingInfo,
} from '@/lib/ai/tokenizer/cost-calculator'

describe('cost-calculator', () => {
  describe('getModelPricing', () => {
    describe('GPT models', () => {
      it('should return correct pricing for GPT-5-nano', () => {
        const pricing = getModelPricing('gpt-5-nano')
        expect(pricing.inputTokenCost).toBe(0.1)
        expect(pricing.outputTokenCost).toBe(0.4)
        expect(pricing.contextLength).toBe(1048576)
      })

      it('should return correct pricing for GPT-4.1-mini', () => {
        const pricing = getModelPricing('gpt-4.1-mini')
        expect(pricing.inputTokenCost).toBe(0.4)
        expect(pricing.outputTokenCost).toBe(1.6)
      })

      it('should return correct pricing for GPT-4.1', () => {
        const pricing = getModelPricing('gpt-4.1')
        expect(pricing.inputTokenCost).toBe(2.0)
        expect(pricing.outputTokenCost).toBe(8.0)
      })

      it('should return correct pricing for GPT-4o-mini', () => {
        const pricing = getModelPricing('gpt-4o-mini')
        expect(pricing.inputTokenCost).toBe(0.15)
        expect(pricing.outputTokenCost).toBe(0.6)
      })

      it('should return correct pricing for GPT-4o', () => {
        const pricing = getModelPricing('gpt-4o')
        expect(pricing.inputTokenCost).toBe(2.5)
        expect(pricing.outputTokenCost).toBe(10.0)
      })

      it('should return correct pricing for GPT-4 Turbo', () => {
        const pricing = getModelPricing('gpt-4-turbo')
        expect(pricing.inputTokenCost).toBe(10.0)
        expect(pricing.outputTokenCost).toBe(30.0)
      })

      it('should return correct pricing for GPT-4 base', () => {
        const pricing = getModelPricing('gpt-4')
        expect(pricing.inputTokenCost).toBe(30.0)
        expect(pricing.outputTokenCost).toBe(60.0)
      })
    })

    describe('Claude models', () => {
      it('should return correct pricing for Claude Sonnet 4', () => {
        const pricing = getModelPricing('claude-sonnet-4-20250514')
        expect(pricing.inputTokenCost).toBe(3.0)
        expect(pricing.outputTokenCost).toBe(15.0)
      })

      it('should return correct pricing for Claude 3.5 Sonnet', () => {
        const pricing = getModelPricing('claude-3-5-sonnet-20241022')
        expect(pricing.inputTokenCost).toBe(3.0)
        expect(pricing.outputTokenCost).toBe(15.0)
      })

      it('should return correct pricing for Claude 3.5 Haiku', () => {
        const pricing = getModelPricing('claude-3-5-haiku-20241022')
        expect(pricing.inputTokenCost).toBe(0.8)
        expect(pricing.outputTokenCost).toBe(4.0)
      })

      it('should return default Claude pricing for unknown Claude models', () => {
        const pricing = getModelPricing('claude-some-new-model')
        expect(pricing.inputTokenCost).toBe(3.0)
        expect(pricing.outputTokenCost).toBe(15.0)
      })
    })

    describe('Gemini models', () => {
      it('should return correct pricing for Gemini 2.0 Flash', () => {
        const pricing = getModelPricing('gemini-2.0-flash')
        expect(pricing.inputTokenCost).toBe(0.1)
        expect(pricing.outputTokenCost).toBe(0.4)
      })

      it('should return correct pricing for Gemini 1.5 Pro', () => {
        const pricing = getModelPricing('gemini-1.5-pro')
        expect(pricing.inputTokenCost).toBe(1.25)
        expect(pricing.outputTokenCost).toBe(5.0)
      })

      it('should return correct pricing for Gemini 1.5 Flash', () => {
        const pricing = getModelPricing('gemini-1.5-flash')
        expect(pricing.inputTokenCost).toBe(0.075)
        expect(pricing.outputTokenCost).toBe(0.3)
      })
    })

    describe('OpenRouter models', () => {
      it('should strip openrouter/ prefix and get correct pricing', () => {
        const pricing = getModelPricing('openrouter/gpt-5-nano')
        expect(pricing.inputTokenCost).toBe(0.1)
        expect(pricing.outputTokenCost).toBe(0.4)
      })
    })

    describe('Fallback', () => {
      it('should return fallback pricing for unknown models', () => {
        const pricing = getModelPricing('unknown-model')
        expect(pricing.inputTokenCost).toBe(0.5)
        expect(pricing.outputTokenCost).toBe(2.0)
      })
    })
  })

  describe('calculateCost', () => {
    it('should calculate cost correctly for GPT-5-nano', () => {
      const estimate = calculateCost(1000, 500, 'gpt-5-nano')

      expect(estimate.inputTokens).toBe(1000)
      expect(estimate.outputTokens).toBe(500)
      expect(estimate.model).toBe('gpt-5-nano')

      const expectedInputCost = (1000 / 1_000_000) * 0.1
      const expectedOutputCost = (500 / 1_000_000) * 0.4
      const expectedTotal = expectedInputCost + expectedOutputCost

      expect(estimate.inputCost).toBeCloseTo(expectedInputCost, 6)
      expect(estimate.outputCost).toBeCloseTo(expectedOutputCost, 6)
      expect(estimate.totalCost).toBeCloseTo(expectedTotal, 6)
    })

    it('should calculate cost correctly for Claude Sonnet', () => {
      const estimate = calculateCost(10000, 5000, 'claude-sonnet-4-20250514')

      const expectedInputCost = (10000 / 1_000_000) * 3.0
      const expectedOutputCost = (5000 / 1_000_000) * 15.0

      expect(estimate.inputCost).toBeCloseTo(expectedInputCost, 6)
      expect(estimate.outputCost).toBeCloseTo(expectedOutputCost, 6)
    })

    it('should handle zero tokens', () => {
      const estimate = calculateCost(0, 0, 'gpt-4o')

      expect(estimate.inputCost).toBe(0)
      expect(estimate.outputCost).toBe(0)
      expect(estimate.totalCost).toBe(0)
    })

    it('should handle large token counts', () => {
      const estimate = calculateCost(1_000_000, 500_000, 'gpt-5-nano')

      expect(estimate.inputCost).toBeCloseTo(0.1, 6)
      expect(estimate.outputCost).toBeCloseTo(0.2, 6)
      expect(estimate.totalCost).toBeCloseTo(0.3, 6)
    })

    it('should indicate pricing source as registry for known models', () => {
      const estimate = calculateCost(100, 100, 'gpt-5-nano')
      expect(estimate.pricingSource).toBe('registry')
    })

    it('should indicate pricing source as fallback for unknown models', () => {
      const estimate = calculateCost(100, 100, 'totally-unknown-model')
      expect(estimate.pricingSource).toBe('fallback')
    })
  })

  describe('getModelContextLength', () => {
    it('should return correct context length for GPT-5-nano', () => {
      expect(getModelContextLength('gpt-5-nano')).toBe(1048576)
    })

    it('should return correct context length for Claude', () => {
      expect(getModelContextLength('claude-sonnet-4-20250514')).toBe(200000)
    })

    it('should return correct context length for Gemini 1.5 Pro', () => {
      expect(getModelContextLength('gemini-1.5-pro')).toBe(2097152)
    })

    it('should return fallback context length for unknown models', () => {
      expect(getModelContextLength('unknown-model')).toBe(128000)
    })
  })

  describe('estimateOutputTokens', () => {
    it('should estimate output tokens based on input ratio', () => {
      const estimate = estimateOutputTokens(1000)
      expect(estimate).toBe(500)
    })

    it('should cap at maximum output tokens', () => {
      const estimate = estimateOutputTokens(10000)
      expect(estimate).toBe(4096)
    })

    it('should handle custom max output ratio', () => {
      const estimate = estimateOutputTokens(1000, 1.0)
      expect(estimate).toBe(1000)
    })

    it('should handle small input tokens', () => {
      const estimate = estimateOutputTokens(100)
      expect(estimate).toBe(50)
    })
  })
})

import { describe, it, expect, vi } from 'vitest'
import { PeerSelectorAI } from '@/services/peer-companies/peer-selector-ai'
import type { PeerSelectionCriteria } from '@/services/peer-companies/types'
import type { AIProvider } from '@/lib/integrations/ai/provider'

vi.mock('@/lib/integrations/ai/generate-with-fallback', () => ({
  generateWithFallback: vi.fn(),
  createSeededRandom: vi.fn(() => () => 0.5),
}))

import {
  generateWithFallback,
  createSeededRandom,
} from '@/lib/integrations/ai/generate-with-fallback'

function fakeAIProvider(): AIProvider {
  return {
    name: 'openai',
    analyzeDocument: vi.fn(),
    validateEntry: vi.fn(),
    generate: vi.fn(),
  }
}

const baseCriteria: PeerSelectionCriteria = {
  industry: 'software',
  minPeers: 1,
  maxPeers: 5,
}

describe('PeerSelectorAI — error/edge branches', () => {
  it('falls back to rule-based suggestions when the AI call throws', async () => {
    vi.mocked(generateWithFallback).mockRejectedValueOnce(new Error('provider down'))

    const selector = new PeerSelectorAI(fakeAIProvider())
    const result = await selector.suggestPeers({ industry: 'software' }, baseCriteria, {
      useAI: true,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data.map((c) => c.ticker)).toContain('4755')
    }
  })

  it('returns an empty list when the AI response JSON is malformed', async () => {
    vi.mocked(generateWithFallback).mockResolvedValueOnce({
      content: '{ "candidates": [ this is not valid json ] }',
      model: 'test',
    })

    const selector = new PeerSelectorAI(fakeAIProvider())
    const result = await selector.suggestPeers({ industry: 'software' }, baseCriteria, {
      useAI: true,
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toHaveLength(0)
  })

  it('maps a suggestion_failed result when the rule engine throws', async () => {
    vi.mocked(createSeededRandom).mockImplementationOnce(() => {
      throw new Error('seed broken')
    })

    // No AI provider ⇒ suggestWithRules path, which invokes createSeededRandom.
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers({ industry: 'software' }, baseCriteria)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('suggestion_failed')
      expect(result.error.message).toBe('seed broken')
    }
  })

  it('produces deterministic peer scores for a fixed seed', async () => {
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers({ industry: 'software' }, baseCriteria, {
      seed: 42,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // Index-decreasing similarity: 1.0, 0.9, 0.8, ...
      const scores = result.data.map((c) => c.similarityScore)
      expect(scores[0]).toBe(1)
      expect(scores[1]).toBe(0.9)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
      }
    }
  })
})

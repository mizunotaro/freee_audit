import { PeerSelectorAI } from '@/services/peer-companies/peer-selector-ai'
import type { PeerSelectionCriteria } from '@/services/peer-companies/types'
import type { AIProvider } from '@/lib/integrations/ai/provider'

vi.mock('@/lib/integrations/ai/generate-with-fallback', () => ({
  generateWithFallback: vi.fn(),
  createSeededRandom: vi.fn(() => () => 0.5),
}))

import { generateWithFallback } from '@/lib/integrations/ai/generate-with-fallback'

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

describe('PeerSelectorAI (extended)', () => {
  describe('suggestWithAI — parseAIResponse', () => {
    it('parses, clamps, and filters the AI candidate payload', async () => {
      const payload = {
        candidates: [
          {
            ticker: '4755',
            name: '楽天グループ',
            industry: '情報通信業',
            similarityScore: 0.9,
            keyMetrics: { per: 20, pbr: 2, evEbitda: 10 },
            matchReasons: ['同一業界', '類似規模'],
          },
          {
            ticker: '9984',
            name: 'ソフトバンクグループ',
            similarityScore: 1.5,
            keyMetrics: { per: 15 },
            matchReasons: ['x', 123, 'y'],
          },
          { ticker: '6758', industry: '製造業', similarityScore: 0.8 },
          { name: 'NoScore', similarityScore: 'high' },
        ],
      }
      vi.mocked(generateWithFallback).mockResolvedValueOnce({
        content: JSON.stringify(payload),
        model: 'test',
      })

      const selector = new PeerSelectorAI(fakeAIProvider())
      const result = await selector.suggestPeers({ industry: 'software' }, baseCriteria, {
        useAI: true,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        const [first, second] = result.data
        expect(result.data).toHaveLength(2)
        expect(first.name).toBe('楽天グループ')
        expect(first.similarityScore).toBe(0.9)
        expect(first.keyMetrics.pbr).toBe(2)
        // similarityScore clamped into [0, 1].
        expect(second.similarityScore).toBe(1)
        // non-string match reasons dropped.
        expect(second.matchReasons).toEqual(['x', 'y'])
        // missing keyMetrics become undefined.
        expect(second.keyMetrics.pbr).toBeUndefined()
      }
    })

    it('returns an empty list when the AI response has no JSON', async () => {
      vi.mocked(generateWithFallback).mockResolvedValueOnce({
        content: 'no json here',
        model: 'test',
      })

      const selector = new PeerSelectorAI(fakeAIProvider())
      const result = await selector.suggestPeers({ industry: 'software' }, baseCriteria, {
        useAI: true,
      })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toHaveLength(0)
    })

    it('returns an empty list when the JSON has no candidates array', async () => {
      vi.mocked(generateWithFallback).mockResolvedValueOnce({
        content: JSON.stringify({ foo: 'bar' }),
        model: 'test',
      })

      const selector = new PeerSelectorAI(fakeAIProvider())
      const result = await selector.suggestPeers({ industry: 'software' }, baseCriteria, {
        useAI: true,
      })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data).toHaveLength(0)
    })
  })

  describe('normalizeIndustry', () => {
    it('maps Japanese retail (小売) to e-commerce peers', async () => {
      const selector = new PeerSelectorAI()
      const result = await selector.suggestPeers(
        { industry: '小売' },
        { industry: '小売', minPeers: 1, maxPeers: 5 }
      )

      expect(result.success).toBe(true)
      if (result.success) {
        const tickers = result.data.map((c) => c.ticker)
        expect(tickers).toEqual(expect.arrayContaining(['4755', '9984', '4307']))
      }
    })

    it('maps finance (金融) to fintech peers', async () => {
      const selector = new PeerSelectorAI()
      const result = await selector.suggestPeers(
        { industry: '金融' },
        { industry: '金融', minPeers: 1, maxPeers: 5 }
      )

      expect(result.success).toBe(true)
      if (result.success) {
        const tickers = result.data.map((c) => c.ticker)
        expect(tickers).toEqual(expect.arrayContaining(['8473', '6541', '3923']))
      }
    })
  })

  describe('criteria.market filtering', () => {
    it('keeps Japanese peers when market is JPX', async () => {
      const selector = new PeerSelectorAI()
      const result = await selector.suggestPeers(
        { industry: 'software', geography: 'Japan' },
        { ...baseCriteria, market: 'JPX' }
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0)
        result.data.forEach((c) => expect(c.ticker).toHaveLength(4))
      }
    })

    it('filters out Japanese peers for NASDAQ and falls back to generic peers', async () => {
      const selector = new PeerSelectorAI()
      const result = await selector.suggestPeers(
        { industry: 'software', geography: 'US' },
        { industry: 'software', market: 'NASDAQ', minPeers: 2, maxPeers: 5 }
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
        result.data.forEach((c) => expect(c.similarityScore).toBe(0.2))
        const tickers = result.data.map((c) => c.ticker)
        expect(tickers).toEqual(['7203', '6758'])
      }
    })
  })

  describe('generateMatchReasons', () => {
    it('adds scale and geography reasons only when thresholds are met', async () => {
      const selector = new PeerSelectorAI()

      const largeJapan = await selector.suggestPeers(
        { industry: 'software', revenue: 5_000_000_000, geography: 'Japan' },
        baseCriteria
      )
      const smallUnknown = await selector.suggestPeers(
        { industry: 'software', revenue: 500_000_000 },
        baseCriteria
      )

      expect(largeJapan.success).toBe(true)
      expect(smallUnknown.success).toBe(true)
      if (largeJapan.success && smallUnknown.success) {
        expect(largeJapan.data[0].matchReasons).toContain('類似した収益規模')
        expect(largeJapan.data[0].matchReasons).toContain('同一地域（日本）')
        expect(smallUnknown.data[0].matchReasons).not.toContain('類似した収益規模')
        expect(smallUnknown.data[0].matchReasons).not.toContain('同一地域（日本）')
      }
    })
  })
})

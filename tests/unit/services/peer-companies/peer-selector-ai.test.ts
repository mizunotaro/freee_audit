import { PeerSelectorAI, createPeerSelectorAI } from '@/services/peer-companies/peer-selector-ai'
import type { PeerSelectionCriteria } from '@/services/peer-companies/types'

vi.mock('@/lib/integrations/ai/generate-with-fallback', () => ({
  generateWithFallback: vi.fn(),
  createSeededRandom: vi.fn(() => () => 0.5),
}))

const criteria: PeerSelectionCriteria = {
  industry: 'software',
  minPeers: 2,
  maxPeers: 5,
}

describe('PeerSelectorAI', () => {
  it('suggests peers using rules without AI provider', async () => {
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers(
      { industry: 'software', revenue: 5000000000 },
      criteria
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.length).toBeGreaterThanOrEqual(2)
      expect(result.data[0].similarityScore).toBeGreaterThan(0)
    }
  })

  it('returns peers for manufacturing industry', async () => {
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers(
      { industry: 'manufacturing' },
      { ...criteria, industry: 'manufacturing' }
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data[0].industry).toBe('製造業')
    }
  })

  it('fills up to minPeers with generic peers', async () => {
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers(
      { industry: 'fintech' },
      { industry: 'fintech', minPeers: 5, maxPeers: 10 }
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.length).toBeGreaterThanOrEqual(5)
  })

  it('falls back to rules when AI fails', async () => {
    const { generateWithFallback } = await import('@/lib/integrations/ai/generate-with-fallback')
    vi.mocked(generateWithFallback).mockRejectedValueOnce(new Error('AI unavailable'))

    const mockProvider = { generate: vi.fn() } as any
    const selector = new PeerSelectorAI(mockProvider)
    const result = await selector.suggestPeers({ industry: 'software' }, criteria, { useAI: true })
    expect(result.success).toBe(true)
  })

  it('respects useAI=false option', async () => {
    const selector = new PeerSelectorAI({ generate: vi.fn() } as any)
    const result = await selector.suggestPeers({ industry: 'software' }, criteria, { useAI: false })
    expect(result.success).toBe(true)
  })

  it('matches SaaS industry', async () => {
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers({ industry: 'SaaS' }, criteria)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.length).toBeGreaterThan(0)
  })

  it('handles Japanese industry names', async () => {
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers({ industry: 'ソフトウェア' }, criteria)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.length).toBeGreaterThan(0)
  })

  it('generates match reasons', async () => {
    const selector = new PeerSelectorAI()
    const result = await selector.suggestPeers(
      { industry: 'software', revenue: 5000000000, geography: 'Japan' },
      criteria
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0].matchReasons.length).toBeGreaterThan(0)
    }
  })

  describe('createPeerSelectorAI', () => {
    it('creates instance without provider', () => {
      expect(createPeerSelectorAI()).toBeInstanceOf(PeerSelectorAI)
    })

    it('creates instance with provider', () => {
      expect(createPeerSelectorAI({ generate: vi.fn() } as any)).toBeInstanceOf(PeerSelectorAI)
    })
  })
})

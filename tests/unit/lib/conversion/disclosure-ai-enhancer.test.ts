import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DisclosureAIEnhancer } from '@/lib/conversion/disclosure-ai-enhancer'
import type { DisclosureDocument, ConversionRationale } from '@/types/conversion'

vi.mock('@/lib/integrations/ai', function () {
  return {
    createAIProviderFromEnv: vi.fn().mockReturnValue(null),
  }
})

function makeDisclosure(overrides?: Partial<DisclosureDocument>): DisclosureDocument {
  return {
    id: 'disc-1',
    projectId: 'proj-1',
    category: 'significant_accounting_policies',
    title: '会計方針',
    titleEn: 'Accounting Policies',
    content: 'テスト内容',
    contentEn: 'Test content',
    sections: [],
    standardReferences: [
      {
        id: 'sr-1',
        referenceNumber: 'ASC 235',
        title: 'Notes to Financial Statements',
        source: 'USGAAP',
      },
    ],
    relatedRationaleIds: [],
    isGenerated: false,
    isAiEnhanced: false,
    generatedAt: new Date(),
    updatedAt: new Date(),
    sortOrder: 1,
    ...overrides,
  }
}

function makeRationale(summary: string): ConversionRationale {
  return {
    id: 'rat-1',
    projectId: 'proj-1',
    entityType: 'mapping',
    entityId: 'e-1',
    rationaleType: 'mapping_basis',
    summary,
    isAiGenerated: true,
    isReviewed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('DisclosureAIEnhancer', function () {
  let enhancer: DisclosureAIEnhancer

  beforeEach(function () {
    vi.stubEnv('AI_MOCK_MODE', 'true')
    enhancer = new DisclosureAIEnhancer()
  })

  describe('enhance (mock mode)', function () {
    it('should return mock enhanced disclosure in mock mode', async function () {
      const disclosure = makeDisclosure()
      const result = await enhancer.enhance(disclosure, [])
      expect(result.enhancedContent).toContain('テスト内容')
      expect(result.enhancedContent).toContain('AI改善')
      expect(result.enhancedContentEn).toContain('Test content')
      expect(result.improvements.length).toBeGreaterThan(0)
    })

    it('should include rationales in prompt but return mock', async function () {
      const disclosure = makeDisclosure()
      const rationales = [makeRationale('理由1'), makeRationale('理由2')]
      const result = await enhancer.enhance(disclosure, rationales)
      expect(result).toHaveProperty('enhancedContent')
      expect(result).toHaveProperty('enhancedContentEn')
    })

    it('should handle empty rationales', async function () {
      const disclosure = makeDisclosure()
      const result = await enhancer.enhance(disclosure, [])
      expect(result).toHaveProperty('enhancedContent')
    })

    it('should handle disclosure with no contentEn', async function () {
      const disclosure = makeDisclosure({ contentEn: undefined })
      const result = await enhancer.enhance(disclosure, [])
      expect(result.enhancedContentEn).toContain('テスト内容')
    })

    it('should handle disclosure with no standardReferences', async function () {
      const disclosure = makeDisclosure({ standardReferences: [] })
      const result = await enhancer.enhance(disclosure, [])
      expect(result).toHaveProperty('enhancedContent')
    })

    it('should return addedReferences as empty array in mock mode', async function () {
      const disclosure = makeDisclosure()
      const result = await enhancer.enhance(disclosure, [])
      expect(result.addedReferences).toEqual([])
    })
  })
})

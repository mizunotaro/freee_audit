import { InputSuggester, getInputSuggester } from '@/services/ai/input-suggester'
import type { InputFieldDefinition, InputSuggestionContext } from '@/lib/ai/input-suggestion/types'

const baseContext: InputSuggestionContext = {
  analysisType: 'valuation',
  companyInfo: {
    name: 'Test Corp',
    industry: 'Technology',
    sector: 'Software',
  },
}

describe('InputSuggester', () => {
  let suggester: InputSuggester

  beforeEach(() => {
    suggester = new InputSuggester()
  })

  describe('suggestInput', () => {
    it('suggests default value for known field', async () => {
      const field: InputFieldDefinition = {
        key: 'growthRate',
        type: 'percentage',
        label: '成長率',
        labelEn: 'Growth Rate',
        required: true,
      }

      const result = await suggester.suggestInput(field, baseContext)
      expect(result.fieldKey).toBe('growthRate')
      expect(result.suggestedValue).toBe(0.05)
      expect(result.confidence).toBe(60)
    })

    it('adjusts value based on peer data', async () => {
      const field: InputFieldDefinition = {
        key: 'per',
        type: 'number',
        label: 'PER',
        labelEn: 'PER',
        required: true,
      }

      const contextWithPeers: InputSuggestionContext = {
        ...baseContext,
        peerData: [
          { name: 'Peer A', per: 20 },
          { name: 'Peer B', per: 30 },
        ],
      }

      const result = await suggester.suggestInput(field, contextWithPeers)
      expect(result.fieldKey).toBe('per')
      expect(result.suggestedValue).toBe(25)
      expect(result.confidence).toBe(75)
    })

    it('adjusts value based on industry benchmark', async () => {
      const field: InputFieldDefinition = {
        key: 'per',
        type: 'number',
        label: 'PER',
        labelEn: 'PER',
        required: true,
      }

      const contextWithBenchmark: InputSuggestionContext = {
        ...baseContext,
        industryBenchmark: { avgPer: 18 },
      }

      const result = await suggester.suggestInput(field, contextWithBenchmark)
      expect(result.suggestedValue).toBe(18)
    })

    it('uses field default for unknown field key', async () => {
      const field: InputFieldDefinition = {
        key: 'customField',
        type: 'number',
        label: 'Custom',
        labelEn: 'Custom',
        required: false,
        defaultValue: 42,
      }

      const result = await suggester.suggestInput(field, baseContext)
      expect(result.fieldKey).toBe('customField')
      expect(result.suggestedValue).toBe(42)
      expect(result.confidence).toBe(30)
      expect(result.source).toBe('ai_estimate')
    })

    it('uses 0 for unknown field without default', async () => {
      const field: InputFieldDefinition = {
        key: 'unknownKey',
        type: 'number',
        label: 'Unknown',
        labelEn: 'Unknown',
        required: false,
      }

      const result = await suggester.suggestInput(field, baseContext)
      expect(result.suggestedValue).toBe(0)
    })
  })

  describe('suggestMultiple', () => {
    it('suggests for multiple fields', async () => {
      const fields: InputFieldDefinition[] = [
        {
          key: 'growthRate',
          type: 'percentage',
          label: '成長率',
          labelEn: 'Growth Rate',
          required: true,
        },
        {
          key: 'discountRate',
          type: 'percentage',
          label: '割引率',
          labelEn: 'Discount Rate',
          required: true,
        },
      ]

      const result = await suggester.suggestMultiple(fields, baseContext)
      expect(result.success).toBe(true)
      expect(result.suggestions.size).toBe(2)
      expect(result.suggestions.has('growthRate')).toBe(true)
      expect(result.suggestions.has('discountRate')).toBe(true)
      expect(result.modelUsed).toBe('rule-based')
    })

    it('returns success even with errors for individual fields', async () => {
      const fields: InputFieldDefinition[] = [
        {
          key: 'growthRate',
          type: 'percentage',
          label: '成長率',
          labelEn: 'Growth',
          required: true,
        },
      ]

      const result = await suggester.suggestMultiple(fields, baseContext)
      expect(result.success).toBe(true)
    })
  })

  describe('getInputSuggester', () => {
    it('returns singleton', () => {
      const a = getInputSuggester()
      const b = getInputSuggester()
      expect(a).toBe(b)
    })
  })
})

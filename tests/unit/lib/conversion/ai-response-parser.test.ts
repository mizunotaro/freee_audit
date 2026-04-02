import { describe, it, expect, beforeEach } from 'vitest'
import { AIResponseParser } from '@/lib/conversion/ai-response-parser'

describe('AIResponseParser', function () {
  let parser: AIResponseParser

  beforeEach(function () {
    parser = new AIResponseParser()
  })

  describe('extractJSON', function () {
    it('should extract JSON from response with surrounding text', function () {
      const response = 'Here is the result:\n{"key": "value"}\nEnd of response'
      const json = parser.extractJSON(response)
      expect(json).toBe('{"key": "value"}')
    })

    it('should extract nested JSON', function () {
      const response = '{"outer": {"inner": 1}}'
      const json = parser.extractJSON(response)
      expect(json).toBe('{"outer": {"inner": 1}}')
    })

    it('should return null for no JSON', function () {
      const response = 'No JSON here'
      const json = parser.extractJSON(response)
      expect(json).toBeNull()
    })

    it('should extract JSON from markdown code block', function () {
      const response = '```json\n{"key": "value"}\n```'
      const json = parser.extractJSON(response)
      expect(json).toBe('{"key": "value"}')
    })

    it('should handle empty string', function () {
      const json = parser.extractJSON('')
      expect(json).toBeNull()
    })
  })

  describe('parseJSON', function () {
    it('should parse valid JSON with matching schema', function () {
      const { z } = require('zod')
      const schema = z.object({ name: z.string() })
      const result = parser.parseJSON<{ name: string }>('{"name": "test"}', schema)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('test')
      }
    })

    it('should return error for invalid JSON', function () {
      const { z } = require('zod')
      const schema = z.object({ name: z.string() })
      const result = parser.parseJSON('not json', schema)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('No JSON object found')
      }
    })

    it('should return error for schema mismatch', function () {
      const { z } = require('zod')
      const schema = z.object({ name: z.string() })
      const result = parser.parseJSON('{"name": 123}', schema)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to parse JSON')
      }
    })
  })

  describe('parseMappingSuggestions', function () {
    it('should parse valid mapping suggestions', function () {
      const response = JSON.stringify({
        suggestions: [
          {
            sourceCode: '1100',
            sourceName: '現金',
            targetCode: '1100',
            targetName: 'Cash',
            confidence: 0.95,
            reasoning: 'Same account',
            alternatives: [{ code: '1200', name: 'AR', confidence: 0.5 }],
          },
        ],
      })
      const result = parser.parseMappingSuggestions(response)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBe(1)
        expect(result.value[0].sourceAccountCode).toBe('1100')
        expect(result.value[0].suggestedTargetCode).toBe('1100')
        expect(result.value[0].confidence).toBe(0.95)
        expect(result.value[0].alternatives.length).toBe(1)
      }
    })

    it('should parse suggestions without alternatives', function () {
      const response = JSON.stringify({
        suggestions: [
          {
            sourceCode: '1100',
            sourceName: '現金',
            targetCode: '1100',
            targetName: 'Cash',
            confidence: 0.95,
            reasoning: 'Same',
          },
        ],
      })
      const result = parser.parseMappingSuggestions(response)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value[0].alternatives).toEqual([])
      }
    })

    it('should return error for no JSON', function () {
      const result = parser.parseMappingSuggestions('no json')
      expect(result.ok).toBe(false)
    })

    it('should return error for invalid confidence', function () {
      const response = JSON.stringify({
        suggestions: [
          {
            sourceCode: '1100',
            sourceName: '現金',
            targetCode: '1100',
            targetName: 'Cash',
            confidence: 1.5,
            reasoning: 'Same',
          },
        ],
      })
      const result = parser.parseMappingSuggestions(response)
      expect(result.ok).toBe(false)
    })
  })

  describe('parseAdjustmentRecommendations', function () {
    it('should parse valid adjustments', function () {
      const response = JSON.stringify({
        adjustments: [
          {
            type: 'lease',
            priority: 'high',
            title: 'Lease Adjustment',
            description: 'Adjust for leases',
            estimatedImpact: { assetChange: 100000 },
            reasoning: 'IFRS 16 requires',
            references: ['IFRS 16', 'ASC 842'],
          },
        ],
      })
      const result = parser.parseAdjustmentRecommendations(response)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBe(1)
        expect(result.value[0].priority).toBe('high')
        expect(result.value[0].references.length).toBe(2)
      }
    })

    it('should return error for invalid priority', function () {
      const response = JSON.stringify({
        adjustments: [
          {
            type: 'lease',
            priority: 'critical',
            title: 'Test',
            description: 'Test',
            estimatedImpact: {},
            reasoning: 'Test',
            references: [],
          },
        ],
      })
      const result = parser.parseAdjustmentRecommendations(response)
      expect(result.ok).toBe(false)
    })
  })

  describe('parseRiskAssessments', function () {
    it('should parse valid risks', function () {
      const response = JSON.stringify({
        risks: [
          {
            category: 'completeness',
            riskLevel: 'medium',
            description: 'Some accounts unmapped',
            mitigationSuggestion: 'Review mappings',
          },
        ],
      })
      const result = parser.parseRiskAssessments(response)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBe(1)
        expect(result.value[0].riskLevel).toBe('medium')
        expect(result.value[0].mitigationSuggestion).toBe('Review mappings')
      }
    })

    it('should return error for invalid risk level', function () {
      const response = JSON.stringify({
        risks: [
          {
            category: 'test',
            riskLevel: 'extreme',
            description: 'Test',
            mitigationSuggestion: 'Test',
          },
        ],
      })
      const result = parser.parseRiskAssessments(response)
      expect(result.ok).toBe(false)
    })
  })

  describe('parseDisclosureNotes', function () {
    it('should parse valid disclosures', function () {
      const response = JSON.stringify({
        disclosures: [
          {
            category: 'significant_accounting_policies',
            title: '会計方針',
            titleEn: 'Policies',
            content: '内容',
            contentEn: 'Content',
            standardReference: 'ASC 235',
          },
        ],
      })
      const result = parser.parseDisclosureNotes(response)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBe(1)
        expect(result.value[0].title).toBe('会計方針')
      }
    })

    it('should parse disclosures without optional contentEn', function () {
      const response = JSON.stringify({
        disclosures: [
          {
            category: 'other',
            title: 'Other',
            titleEn: 'Other',
            content: '内容',
            standardReference: 'ASC 235',
          },
        ],
      })
      const result = parser.parseDisclosureNotes(response)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value[0].contentEn).toBeUndefined()
      }
    })
  })

  describe('parseQualityReview', function () {
    it('should parse valid quality review', function () {
      const response = JSON.stringify({
        overallScore: 85,
        categories: {
          completeness: 90,
          accuracy: 85,
          compliance: 80,
          documentation: 85,
        },
        issues: [
          {
            severity: 'medium',
            category: 'accuracy',
            description: 'Low confidence mapping',
            affectedItems: ['1100'],
            suggestedAction: 'Review mapping',
          },
        ],
        recommendations: ['Review all low confidence mappings'],
      })
      const result = parser.parseQualityReview(response)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.overallScore).toBe(85)
        expect(result.value.categories.completeness).toBe(90)
        expect(result.value.issues.length).toBe(1)
        expect(result.value.issues[0].severity).toBe('medium')
        expect(result.value.recommendations.length).toBe(1)
      }
    })

    it('should return error for score out of range', function () {
      const response = JSON.stringify({
        overallScore: 150,
        categories: { completeness: 90, accuracy: 85, compliance: 80, documentation: 85 },
        issues: [],
        recommendations: [],
      })
      const result = parser.parseQualityReview(response)
      expect(result.ok).toBe(false)
    })

    it('should return error for invalid severity', function () {
      const response = JSON.stringify({
        overallScore: 85,
        categories: { completeness: 90, accuracy: 85, compliance: 80, documentation: 85 },
        issues: [
          {
            severity: 'extreme',
            category: 'test',
            description: 'Test',
            affectedItems: [],
            suggestedAction: 'Test',
          },
        ],
        recommendations: [],
      })
      const result = parser.parseQualityReview(response)
      expect(result.ok).toBe(false)
    })
  })
})

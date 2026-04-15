import { describe, it, expect } from 'vitest'
import { validatePersonaResponse, sanitizeResponse } from '@/lib/ai/validation/output-validator'
import type { PersonaResponse } from '@/lib/ai/validation/schemas'

const validResponse: PersonaResponse = {
  conclusion: 'The company shows strong financial health',
  confidence: 0.85,
  reasoning: [
    {
      point: 'Revenue Growth',
      analysis: 'Revenue increased by 15% year-over-year',
      evidence: '2024 revenue: 500M, 2023 revenue: 435M',
      confidence: 0.9,
    },
  ],
  risks: [
    {
      category: 'Market',
      description: 'Increasing competition in core market segment',
      severity: 'medium',
      probability: 0.4,
      mitigation: 'Diversify product offerings',
    },
  ],
  recommendedAction: 'Continue current growth strategy with increased R&D investment',
}

describe('Output Validator', () => {
  describe('validatePersonaResponse', () => {
    it('should accept valid response', () => {
      const result = validatePersonaResponse(validResponse)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.conclusion).toBe(validResponse.conclusion)
      }
    })

    it('should reject null/undefined', () => {
      expect(validatePersonaResponse(null).success).toBe(false)
      expect(validatePersonaResponse(undefined).success).toBe(false)
    })

    it('should reject response missing conclusion', () => {
      const { conclusion: _, ...noConclusion } = validResponse
      expect(validatePersonaResponse(noConclusion).success).toBe(false)
    })

    it('should reject response missing reasoning', () => {
      const { reasoning: _, ...noReasoning } = validResponse
      expect(validatePersonaResponse(noReasoning).success).toBe(false)
    })

    it('should reject response with empty reasoning array', () => {
      expect(validatePersonaResponse({ ...validResponse, reasoning: [] }).success).toBe(false)
    })

    it('should reject response missing risks', () => {
      const { risks: _, ...noRisks } = validResponse
      expect(validatePersonaResponse(noRisks).success).toBe(false)
    })

    it('should reject confidence outside 0-1 range', () => {
      expect(validatePersonaResponse({ ...validResponse, confidence: 1.5 }).success).toBe(false)
      expect(validatePersonaResponse({ ...validResponse, confidence: -0.1 }).success).toBe(false)
    })

    it('should reject invalid severity values', () => {
      const badRisks = {
        ...validResponse,
        risks: [{ ...validResponse.risks[0], severity: 'extreme' }],
      }
      expect(validatePersonaResponse(badRisks).success).toBe(false)
    })

    it('should accept response with optional fields omitted', () => {
      const minimal = {
        conclusion: 'Test',
        confidence: 0.7,
        reasoning: [{ point: 'P', analysis: 'A', evidence: 'E', confidence: 0.5 }],
        risks: [{ category: 'C', description: 'D', severity: 'low' as const, probability: 0.1 }],
      }
      expect(validatePersonaResponse(minimal).success).toBe(true)
    })

    it('should accept response with alternatives', () => {
      const withAlts = {
        ...validResponse,
        alternatives: [
          {
            option: 'Option A',
            pros: ['Fast', 'Cheap'],
            cons: ['Risky'],
            riskLevel: 'low' as const,
          },
        ],
      }
      expect(validatePersonaResponse(withAlts).success).toBe(true)
    })
  })

  describe('sanitizeResponse', () => {
    it('should return valid response as-is', () => {
      const result = sanitizeResponse(validResponse)
      expect(result.conclusion).toBe(validResponse.conclusion)
      expect(result.confidence).toBe(validResponse.confidence)
    })

    it('should return default response for null input', () => {
      const result = sanitizeResponse(null)
      expect(result.conclusion).toBe('Analysis could not be completed')
      expect(result.confidence).toBe(0.5)
    })

    it('should return default response for non-object input', () => {
      const result = sanitizeResponse('not an object')
      expect(result.conclusion).toBe('Analysis could not be completed')
    })

    it('should truncate overly long conclusion', () => {
      const result = sanitizeResponse({
        ...validResponse,
        conclusion: 'x'.repeat(300),
      })
      expect(result.conclusion.length).toBeLessThanOrEqual(200)
    })

    it('should clamp confidence to 0-1', () => {
      const result = sanitizeResponse({
        ...validResponse,
        confidence: 5.0,
      })
      expect(result.confidence).toBe(1)
    })

    it('should handle partial reasoning items', () => {
      const result = sanitizeResponse({
        conclusion: 'Test',
        confidence: 0.5,
        reasoning: [{ point: 'P' }],
        risks: [{ category: 'C', description: 'D', severity: 'low', probability: 0.1 }],
      })
      expect(result.reasoning[0]?.analysis).toBe('N/A')
    })

    it('should handle missing reasoning array', () => {
      const result = sanitizeResponse({
        conclusion: 'Test',
        confidence: 0.5,
        risks: [{ category: 'C', description: 'D', severity: 'low', probability: 0.1 }],
      })
      expect(result.reasoning).toHaveLength(1)
      expect(result.reasoning[0]?.point).toBe('Validation Error')
    })

    it('should normalize invalid severity to medium', () => {
      const result = sanitizeResponse({
        ...validResponse,
        risks: [{ category: 'C', description: 'D', severity: 'extreme', probability: 0.5 }],
      })
      expect(result.risks[0]?.severity).toBe('medium')
    })

    it('should limit reasoning to 10 items', () => {
      const manyReasoning = Array.from({ length: 15 }, (_, i) => ({
        point: `Point ${i}`,
        analysis: `Analysis ${i}`,
        evidence: `Evidence ${i}`,
        confidence: 0.5,
      }))
      const result = sanitizeResponse({ ...validResponse, reasoning: manyReasoning })
      expect(result.reasoning.length).toBeLessThanOrEqual(10)
    })
  })
})

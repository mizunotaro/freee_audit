import { describe, it, expect } from 'vitest'
import { BasePersona } from '@/lib/ai/personas/base-persona'
import type { PersonaConfig, PersonaBuildContext } from '@/lib/ai/personas/types'

const testConfig: PersonaConfig = {
  type: 'cpa',
  name: 'Test CPA',
  nameJa: 'テスト公認会計士',
  version: '1.0.0',
  systemPrompt: 'You are a test CPA.',
  systemPromptJa: 'あなたはテスト公認会計士です。',
  expertise: ['Auditing', 'Tax'],
  analysisFocus: [{ category: 'compliance', weight: 0.5, metrics: ['regulatory_adherence'] }],
  outputStyle: 'formal',
  defaultModelComplexity: 'detailed_analysis',
  temperatureRange: { min: 0.0, max: 0.3, recommended: 0.1 },
}

class TestPersona extends BasePersona {
  constructor() {
    super(testConfig)
  }

  buildPrompt(context: PersonaBuildContext) {
    return {
      success: true as const,
      data: {
        systemPrompt: this.config.systemPrompt,
        userPrompt: context.query,
        estimatedTokens: 100,
        personaType: this.config.type,
        personaVersion: this.config.version,
      },
    }
  }
}

describe('BasePersona', () => {
  let persona: TestPersona

  beforeEach(() => {
    persona = new TestPersona()
  })

  describe('constructor', () => {
    it('should freeze the config', () => {
      expect(() => {
        ;(persona as any).config.type = 'modified'
      }).toThrow()
    })
  })

  describe('getters', () => {
    it('should return type from config', () => {
      expect(persona.type).toBe('cpa')
    })

    it('should return name from config', () => {
      expect(persona.name).toBe('Test CPA')
    })

    it('should return recommended temperature', () => {
      expect(persona.temperature).toBe(0.1)
    })
  })

  describe('validateResponse', () => {
    it('should validate correct response structure', () => {
      const response = {
        conclusion: 'Test conclusion',
        confidence: 0.9,
        reasoning: [{ point: 'test', analysis: 'analysis', evidence: 'evidence', confidence: 0.8 }],
        risks: [{ category: 'test', description: 'test risk', severity: 'low', probability: 0.1 }],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
    })

    it('should reject non-object response', () => {
      const result = persona.validateResponse('not an object')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('validation_error')
      }
    })

    it('should reject null response', () => {
      const result = persona.validateResponse(null)
      expect(result.success).toBe(false)
    })

    it('should reject response missing conclusion', () => {
      const response = {
        confidence: 0.9,
        reasoning: [],
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(false)
    })

    it('should reject response missing reasoning array', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.9,
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(false)
    })

    it('should reject response missing risks array', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.9,
        reasoning: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(false)
    })
  })

  describe('sanitizeResponse', () => {
    it('should clamp confidence to 0-1 range', () => {
      const response = {
        conclusion: 'test',
        confidence: 2.0,
        reasoning: [],
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence).toBe(1)
      }
    })

    it('should reject response when confidence is not a number', () => {
      const response = {
        conclusion: 'test',
        confidence: 'invalid',
        reasoning: [],
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(false)
    })

    it('should truncate conclusion to 2000 chars', () => {
      const response = {
        conclusion: 'a'.repeat(3000),
        confidence: 0.5,
        reasoning: [],
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.conclusion.length).toBe(2000)
      }
    })

    it('should sanitize reasoning items to max 10', () => {
      const reasoning = Array.from({ length: 20 }, (_, i) => ({
        point: `point ${i}`,
        analysis: `analysis ${i}`,
        evidence: `evidence ${i}`,
        confidence: 0.8,
      }))
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning,
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.reasoning).toHaveLength(10)
      }
    })

    it('should sanitize reasoning items truncating fields', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [
          {
            point: 'a'.repeat(300),
            analysis: 'b'.repeat(1100),
            evidence: 'c'.repeat(600),
            confidence: 2,
          },
        ],
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.reasoning[0].point.length).toBe(200)
        expect(result.data.reasoning[0].analysis.length).toBe(1000)
        expect(result.data.reasoning[0].evidence.length).toBe(500)
        expect(result.data.reasoning[0].confidence).toBe(1)
      }
    })

    it('should sanitize alternatives to max 5', () => {
      const alternatives = Array.from({ length: 10 }, (_, i) => ({
        option: `option ${i}`,
        pros: ['pro'],
        cons: ['con'],
        riskLevel: 'low',
      }))
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks: [],
        alternatives,
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.alternatives).toHaveLength(5)
      }
    })

    it('should sanitize alternatives with default riskLevel', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks: [],
        alternatives: [{ option: 'test', pros: [], cons: [], riskLevel: 'invalid' }],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.alternatives?.[0].riskLevel).toBe('medium')
      }
    })

    it('should sanitize risks items to max 10', () => {
      const risks = Array.from({ length: 20 }, (_, i) => ({
        category: `cat ${i}`,
        description: `desc ${i}`,
        severity: 'low',
        probability: 0.5,
      }))
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks,
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.risks).toHaveLength(10)
      }
    })

    it('should sanitize risks with default severity', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks: [{ category: 'test', description: 'desc', severity: 'invalid', probability: 0.5 }],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.risks[0].severity).toBe('medium')
      }
    })

    it('should set persona type in response', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.persona).toBe('cpa')
      }
    })

    it('should handle recommendedAction', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks: [],
        recommendedAction: 'Do something',
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.recommendedAction).toBe('Do something')
      }
    })

    it('should truncate recommendedAction to 1000 chars', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks: [],
        recommendedAction: 'a'.repeat(2000),
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.recommendedAction?.length).toBe(1000)
      }
    })

    it('should set metadata with templateVersion', () => {
      const response = {
        conclusion: 'test',
        confidence: 0.5,
        reasoning: [],
        risks: [],
      }
      const result = persona.validateResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.metadata.templateVersion).toBe('1.0.0')
        expect(result.data.metadata.modelUsed).toBe('')
        expect(result.data.metadata.tokensUsed).toBe(0)
        expect(result.data.metadata.processingTimeMs).toBe(0)
      }
    })
  })

  describe('buildPrompt', () => {
    it('should return compiled prompt', () => {
      const result = persona.buildPrompt({ query: 'Analyze financials' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.systemPrompt).toBe('You are a test CPA.')
        expect(result.data.userPrompt).toBe('Analyze financials')
        expect(result.data.personaType).toBe('cpa')
        expect(result.data.personaVersion).toBe('1.0.0')
      }
    })
  })
})

import { beforeEach } from 'vitest'

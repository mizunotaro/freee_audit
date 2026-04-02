import { describe, it, expect } from 'vitest'
import { Big4AuditorPersona, big4AuditorPersona } from '@/lib/ai/personas/big4-auditor'
import type { PersonaBuildContext } from '@/lib/ai/personas/types'

describe('Big4AuditorPersona', () => {
  let persona: Big4AuditorPersona

  beforeEach(() => {
    persona = new Big4AuditorPersona()
  })

  describe('constructor', () => {
    it('should have correct type', () => {
      expect(persona.type).toBe('big4_auditor')
    })

    it('should have correct name', () => {
      expect(persona.name).toBe('Big4 Auditor')
    })

    it('should have correct temperature', () => {
      expect(persona.temperature).toBe(0.05)
    })
  })

  describe('buildPrompt', () => {
    it('should build prompt successfully with valid context', () => {
      const context: PersonaBuildContext = { query: 'Analyze revenue recognition' }
      const result = persona.buildPrompt(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.systemPrompt).toBeTruthy()
        expect(result.data.userPrompt).toBeTruthy()
        expect(result.data.personaType).toBe('big4_auditor')
        expect(result.data.personaVersion).toBe('1.0.0')
        expect(result.data.estimatedTokens).toBeGreaterThan(0)
      }
    })

    it('should fail with empty query', () => {
      const context: PersonaBuildContext = { query: '' }
      const result = persona.buildPrompt(context)
      expect(result.success).toBe(false)
    })

    it('should fail with non-string query', () => {
      const context = { query: 123 as unknown as string }
      const result = persona.buildPrompt(context)
      expect(result.success).toBe(false)
    })

    it('should use Japanese system prompt for ja language', () => {
      const context: PersonaBuildContext = { query: 'test query', language: 'ja' }
      const result = persona.buildPrompt(context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.systemPrompt).toContain('Big4')
      }
    })

    it('should use English system prompt for en language', () => {
      const context: PersonaBuildContext = { query: 'test query', language: 'en' }
      const result = persona.buildPrompt(context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.systemPrompt).toContain('Big4')
        expect(result.data.systemPrompt).toContain('Senior Partner')
      }
    })
  })

  describe('buildDDCheckPrompt', () => {
    it('should build DD check prompt with valid params', () => {
      const result = persona.buildDDCheckPrompt({
        itemCode: 'DD-001',
        category: 'Revenue Recognition',
        description: 'Test description',
        aiCheckPrompt: 'Check revenue recognition compliance',
        dataContext: 'Financial data context',
        fiscalYear: 2024,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.systemPrompt).toBeTruthy()
        expect(result.data.userPrompt).toContain('DD-001')
        expect(result.data.userPrompt).toContain('Revenue Recognition')
        expect(result.data.personaType).toBe('big4_auditor')
      }
    })

    it('should build DD check prompt in Japanese', () => {
      const result = persona.buildDDCheckPrompt({
        itemCode: 'DD-001',
        category: '収益認識',
        description: 'テスト',
        aiCheckPrompt: 'チェック',
        dataContext: 'データ',
        fiscalYear: 2024,
        language: 'ja',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.userPrompt).toContain('DD-001')
        expect(result.data.userPrompt).toContain('2024年度')
      }
    })

    it('should build DD check prompt in English', () => {
      const result = persona.buildDDCheckPrompt({
        itemCode: 'DD-002',
        category: 'Revenue',
        description: 'Test',
        aiCheckPrompt: 'Check',
        dataContext: 'Data',
        fiscalYear: 2024,
        language: 'en',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.userPrompt).toContain('DD-002')
        expect(result.data.userPrompt).toContain('FY2024')
      }
    })
  })

  describe('validateDDCheckResponse', () => {
    it('should validate correct DD check response', () => {
      const response = {
        itemCode: 'DD-001',
        category: 'Revenue',
        status: 'PASSED',
        findings: [],
        evidence: [],
        conclusion: 'All checks passed',
        riskRating: 'low',
        recommendedActions: [],
        standardsReferenced: [],
        confidence: 0.95,
      }
      const result = persona.validateDDCheckResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('PASSED')
        expect(result.data.riskRating).toBe('low')
      }
    })

    it('should reject non-object response', () => {
      const result = persona.validateDDCheckResponse('not an object')
      expect(result.success).toBe(false)
    })

    it('should reject null response', () => {
      const result = persona.validateDDCheckResponse(null)
      expect(result.success).toBe(false)
    })

    it('should reject invalid status', () => {
      const response = {
        status: 'INVALID',
        riskRating: 'low',
      }
      const result = persona.validateDDCheckResponse(response)
      expect(result.success).toBe(false)
    })

    it('should reject invalid riskRating', () => {
      const response = {
        status: 'PASSED',
        riskRating: 'extreme',
      }
      const result = persona.validateDDCheckResponse(response)
      expect(result.success).toBe(false)
    })

    it('should sanitize findings with default severity', () => {
      const response = {
        status: 'FAILED',
        riskRating: 'high',
        findings: [
          {
            id: 'F-001',
            title: 'Issue',
            description: 'Desc',
            severity: 'INVALID',
            impact: 'High',
            recommendation: 'Fix',
          },
        ],
        evidence: [],
        conclusion: 'Issues found',
        recommendedActions: [],
        standardsReferenced: [],
        confidence: 0.8,
      }
      const result = persona.validateDDCheckResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings[0].severity).toBe('MEDIUM')
      }
    })

    it('should sanitize evidence with default type and reliability', () => {
      const response = {
        status: 'PASSED',
        riskRating: 'low',
        findings: [],
        evidence: [{ type: 'INVALID', reference: 'ref', summary: 'sum', reliability: 'invalid' }],
        conclusion: 'OK',
        recommendedActions: [],
        standardsReferenced: [],
        confidence: 0.9,
      }
      const result = persona.validateDDCheckResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence[0].type).toBe('DOCUMENT')
        expect(result.data.evidence[0].reliability).toBe('medium')
      }
    })

    it('should clamp confidence to 0-1 range', () => {
      const response = {
        status: 'PASSED',
        riskRating: 'low',
        findings: [],
        evidence: [],
        conclusion: 'OK',
        recommendedActions: [],
        standardsReferenced: [],
        confidence: 2.0,
      }
      const result = persona.validateDDCheckResponse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence).toBe(1)
      }
    })

    it('should sanitize all valid statuses', () => {
      const validStatuses = ['PASSED', 'FAILED', 'IN_PROGRESS', 'N_A', 'PENDING']
      for (const status of validStatuses) {
        const response = {
          status,
          riskRating: 'low',
          findings: [],
          evidence: [],
          conclusion: 'OK',
          recommendedActions: [],
          standardsReferenced: [],
          confidence: 0.5,
        }
        const result = persona.validateDDCheckResponse(response)
        expect(result.success).toBe(true)
      }
    })

    it('should sanitize all valid risk ratings', () => {
      const validRatings = ['low', 'medium', 'high', 'critical']
      for (const riskRating of validRatings) {
        const response = {
          status: 'PASSED',
          riskRating,
          findings: [],
          evidence: [],
          conclusion: 'OK',
          recommendedActions: [],
          standardsReferenced: [],
          confidence: 0.5,
        }
        const result = persona.validateDDCheckResponse(response)
        expect(result.success).toBe(true)
      }
    })
  })
})

describe('big4AuditorPersona singleton', () => {
  it('should be an instance of Big4AuditorPersona', () => {
    expect(big4AuditorPersona).toBeInstanceOf(Big4AuditorPersona)
  })
})

import { beforeEach } from 'vitest'

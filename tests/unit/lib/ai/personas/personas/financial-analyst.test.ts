import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/personas/prompts/templates/base', () => ({
  buildBasePrompt: vi.fn().mockReturnValue({
    systemPrompt: 'mocked system prompt',
    userPrompt: 'mocked user prompt',
  }),
}))

import { FinancialAnalystPersona } from '@/lib/ai/personas/personas/financial-analyst'
import type { PersonaBuildContext } from '@/lib/ai/personas/types'

const { buildBasePrompt } = vi.mocked(await import('@/lib/ai/personas/prompts/templates/base'))

describe('FinancialAnalystPersona', () => {
  let persona: FinancialAnalystPersona

  beforeEach(() => {
    persona = new FinancialAnalystPersona()
    vi.clearAllMocks()
    buildBasePrompt.mockReturnValue({
      systemPrompt: 'mocked system prompt',
      userPrompt: 'mocked user prompt',
    })
  })

  describe('constructor', () => {
    it('should have correct type', () => {
      expect(persona.type).toBe('financial_analyst')
    })

    it('should have correct name', () => {
      expect(persona.name).toBe('Financial Analyst')
    })

    it('should have correct temperature', () => {
      expect(persona.temperature).toBe(0.15)
    })
  })

  describe('buildPrompt', () => {
    it('should build prompt with valid context', () => {
      const context: PersonaBuildContext = { query: 'Analyze profitability' }
      const result = persona.buildPrompt(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.personaType).toBe('financial_analyst')
        expect(result.data.personaVersion).toBe('1.0.0')
      }
    })

    it('should fail with empty query', () => {
      const result = persona.buildPrompt({ query: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('validation_error')
      }
    })

    it('should fail with non-string query', () => {
      const result = persona.buildPrompt({ query: undefined as unknown as string })
      expect(result.success).toBe(false)
    })

    it('should handle compilation errors', () => {
      buildBasePrompt.mockImplementationOnce(function () {
        throw new Error('Build failed')
      })

      const result = persona.buildPrompt({ query: 'test' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('compilation_error')
      }
    })
  })
})

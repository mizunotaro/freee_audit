import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/personas/prompts/templates/base', () => ({
  buildBasePrompt: vi.fn().mockReturnValue({
    systemPrompt: 'mocked system prompt',
    userPrompt: 'mocked user prompt',
  }),
}))

import { CPAPersona } from '@/lib/ai/personas/personas/cpa'
import type { PersonaBuildContext } from '@/lib/ai/personas/types'

const { buildBasePrompt } = vi.mocked(await import('@/lib/ai/personas/prompts/templates/base'))

describe('CPAPersona', () => {
  let persona: CPAPersona

  beforeEach(() => {
    persona = new CPAPersona()
    vi.clearAllMocks()
    buildBasePrompt.mockReturnValue({
      systemPrompt: 'mocked system prompt',
      userPrompt: 'mocked user prompt',
    })
  })

  describe('constructor', () => {
    it('should have correct type', () => {
      expect(persona.type).toBe('cpa')
    })

    it('should have correct name', () => {
      expect(persona.name).toBe('Certified Public Accountant')
    })

    it('should have correct temperature', () => {
      expect(persona.temperature).toBe(0.1)
    })
  })

  describe('buildPrompt', () => {
    it('should build prompt with valid context', () => {
      const context: PersonaBuildContext = { query: 'Analyze financials' }
      const result = persona.buildPrompt(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.systemPrompt).toBe('mocked system prompt')
        expect(result.data.userPrompt).toBe('mocked user prompt')
        expect(result.data.personaType).toBe('cpa')
        expect(result.data.personaVersion).toBe('1.0.0')
        expect(result.data.estimatedTokens).toBeGreaterThan(0)
      }
    })

    it('should fail with empty query', () => {
      const context: PersonaBuildContext = { query: '' }
      const result = persona.buildPrompt(context)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('validation_error')
      }
    })

    it('should fail with non-string query', () => {
      const context = { query: 123 as unknown as string }
      const result = persona.buildPrompt(context)
      expect(result.success).toBe(false)
    })

    it('should pass language to buildBasePrompt', () => {
      const context: PersonaBuildContext = { query: 'test', language: 'en' }
      persona.buildPrompt(context)
      expect(buildBasePrompt).toHaveBeenCalled()
    })

    it('should handle compilation errors gracefully', () => {
      buildBasePrompt.mockImplementationOnce(function () {
        throw new Error('Template error')
      })

      const result = persona.buildPrompt({ query: 'test' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('compilation_error')
        expect(result.error.message).toBe('Template error')
      }
    })
  })
})

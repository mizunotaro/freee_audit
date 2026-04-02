import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/personas/prompts/templates/base', () => ({
  buildBasePrompt: vi.fn().mockReturnValue({
    systemPrompt: 'mocked system prompt',
    userPrompt: 'mocked user prompt',
  }),
}))

import { CFOPersona } from '@/lib/ai/personas/personas/cfo'
import type { PersonaBuildContext } from '@/lib/ai/personas/types'

const { buildBasePrompt } = vi.mocked(await import('@/lib/ai/personas/prompts/templates/base'))

describe('CFOPersona', () => {
  let persona: CFOPersona

  beforeEach(() => {
    persona = new CFOPersona()
    vi.clearAllMocks()
    buildBasePrompt.mockReturnValue({
      systemPrompt: 'mocked system prompt',
      userPrompt: 'mocked user prompt',
    })
  })

  describe('constructor', () => {
    it('should have correct type', () => {
      expect(persona.type).toBe('cfo')
    })

    it('should have correct name', () => {
      expect(persona.name).toBe('Chief Financial Officer')
    })

    it('should have correct temperature', () => {
      expect(persona.temperature).toBe(0.2)
    })
  })

  describe('buildPrompt', () => {
    it('should build prompt with valid context', () => {
      const context: PersonaBuildContext = { query: 'Strategic financial analysis' }
      const result = persona.buildPrompt(context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.personaType).toBe('cfo')
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
      const result = persona.buildPrompt({ query: null as unknown as string })
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

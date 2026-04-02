import { describe, it, expect, beforeEach } from 'vitest'
import {
  personaRegistry,
  getPersona,
  getPersonaOrThrow,
  getAllPersonas,
  getAllPersonaConfigs,
  registerPersona,
  hasPersona,
  getPersonaTypes,
} from '@/lib/ai/personas/registry'
import { BasePersona } from '@/lib/ai/personas/base-persona'
import type {
  PersonaType,
  PersonaConfig,
  PersonaBuildContext,
  PersonaResult,
  CompiledPrompt,
} from '@/lib/ai/personas/types'

class CustomTestPersona extends BasePersona {
  constructor() {
    super({
      type: 'cpa',
      name: 'Custom Test',
      nameJa: 'カスタムテスト',
      version: '1.0.0',
      systemPrompt: 'custom',
      systemPromptJa: 'カスタム',
      expertise: [],
      analysisFocus: [],
      outputStyle: 'formal',
      defaultModelComplexity: 'standard_analysis',
      temperatureRange: { min: 0, max: 1, recommended: 0.5 },
    })
  }
  buildPrompt(context: PersonaBuildContext): PersonaResult<CompiledPrompt> {
    return {
      success: true as const,
      data: {
        systemPrompt: 'custom',
        userPrompt: context.query,
        estimatedTokens: 10,
        personaType: this.config.type,
        personaVersion: this.config.version,
      },
    }
  }
}

describe('PersonaRegistry', () => {
  beforeEach(() => {
    personaRegistry.reset()
  })

  describe('default personas', () => {
    it('should register all default personas', () => {
      const types = getPersonaTypes()
      expect(types).toContain('cpa')
      expect(types).toContain('tax_accountant')
      expect(types).toContain('cfo')
      expect(types).toContain('financial_analyst')
      expect(types).toContain('big4_auditor')
    })

    it('should have exactly 5 default personas', () => {
      const personas = getAllPersonas()
      expect(personas).toHaveLength(5)
    })
  })

  describe('get', () => {
    it('should return persona by type', () => {
      const persona = getPersona('cpa')
      expect(persona).toBeDefined()
      expect(persona?.type).toBe('cpa')
    })

    it('should return undefined for unknown type', () => {
      const persona = getPersona('unknown' as PersonaType)
      expect(persona).toBeUndefined()
    })
  })

  describe('getOrThrow', () => {
    it('should return persona for known type', () => {
      const persona = getPersonaOrThrow('cfo')
      expect(persona.type).toBe('cfo')
    })

    it('should throw for unknown type', () => {
      expect(() => getPersonaOrThrow('unknown' as PersonaType)).toThrow(
        'Persona not found: unknown'
      )
    })
  })

  describe('getAll', () => {
    it('should return all registered personas', () => {
      const personas = getAllPersonas()
      expect(personas.length).toBe(5)
      const types = personas.map(function (p) {
        return p.type
      })
      expect(types).toContain('cpa')
      expect(types).toContain('big4_auditor')
    })
  })

  describe('getAllConfigs', () => {
    it('should return all persona configs', () => {
      const configs = getAllPersonaConfigs()
      expect(configs.length).toBe(5)
      for (const config of configs) {
        expect(config.type).toBeTruthy()
        expect(config.name).toBeTruthy()
      }
    })
  })

  describe('has', () => {
    it('should return true for registered persona', () => {
      expect(hasPersona('cpa')).toBe(true)
    })

    it('should return false for unregistered persona', () => {
      expect(hasPersona('unknown' as PersonaType)).toBe(false)
    })
  })

  describe('getTypes', () => {
    it('should return all registered types', () => {
      const types = getPersonaTypes()
      expect(types.length).toBe(5)
    })
  })

  describe('register', () => {
    it('should register a new persona overriding existing type', () => {
      const originalCount = getAllPersonas().length
      const customPersona = new CustomTestPersona()
      registerPersona(customPersona)
      expect(getAllPersonas().length).toBe(originalCount)
    })
  })

  describe('clear and reset', () => {
    it('should clear all personas', () => {
      personaRegistry.clear()
      expect(getAllPersonas()).toHaveLength(0)
      expect(getPersonaTypes()).toHaveLength(0)
    })

    it('should reset to default personas', () => {
      personaRegistry.clear()
      expect(getAllPersonas()).toHaveLength(0)
      personaRegistry.reset()
      expect(getAllPersonas()).toHaveLength(5)
    })
  })
})

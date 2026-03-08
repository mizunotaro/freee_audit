import type { PersonaType, PersonaConfig } from './types'
import { BasePersona } from './base-persona'
import { CPAPersona } from './personas/cpa'
import { TaxAccountantPersona } from './personas/tax-accountant'
import { CFOPersona } from './personas/cfo'
import { FinancialAnalystPersona } from './personas/financial-analyst'

class PersonaRegistry {
  private personas: Map<PersonaType, BasePersona>
  private static instance: PersonaRegistry | null = null

  private constructor() {
    this.personas = new Map()
    this.registerDefaultPersonas()
  }

  static getInstance(): PersonaRegistry {
    if (!PersonaRegistry.instance) {
      PersonaRegistry.instance = new PersonaRegistry()
    }
    return PersonaRegistry.instance
  }

  private registerDefaultPersonas(): void {
    this.register(new CPAPersona())
    this.register(new TaxAccountantPersona())
    this.register(new CFOPersona())
    this.register(new FinancialAnalystPersona())
  }

  register(persona: BasePersona): void {
    this.personas.set(persona.type, persona)
  }

  get(type: PersonaType): BasePersona | undefined {
    return this.personas.get(type)
  }

  getOrThrow(type: PersonaType): BasePersona {
    const persona = this.personas.get(type)
    if (!persona) {
      throw new Error(`Persona not found: ${type}`)
    }
    return persona
  }

  getAll(): BasePersona[] {
    return Array.from(this.personas.values())
  }

  getAllConfigs(): PersonaConfig[] {
    return this.getAll().map((persona) => {
      const config = (persona as unknown as { config: PersonaConfig }).config
      return config
    })
  }

  has(type: PersonaType): boolean {
    return this.personas.has(type)
  }

  getTypes(): PersonaType[] {
    return Array.from(this.personas.keys())
  }

  clear(): void {
    this.personas.clear()
  }

  reset(): void {
    this.clear()
    this.registerDefaultPersonas()
  }
}

export const personaRegistry = PersonaRegistry.getInstance()

export function getPersona(type: PersonaType): BasePersona | undefined {
  return personaRegistry.get(type)
}

export function getPersonaOrThrow(type: PersonaType): BasePersona {
  return personaRegistry.getOrThrow(type)
}

export function getAllPersonas(): BasePersona[] {
  return personaRegistry.getAll()
}

export function getAllPersonaConfigs(): PersonaConfig[] {
  return personaRegistry.getAllConfigs()
}

export function registerPersona(persona: BasePersona): void {
  personaRegistry.register(persona)
}

export function hasPersona(type: PersonaType): boolean {
  return personaRegistry.has(type)
}

export function getPersonaTypes(): PersonaType[] {
  return personaRegistry.getTypes()
}

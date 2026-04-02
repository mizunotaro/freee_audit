import { describe, it, expect } from 'vitest'
import { esgInfoTemplate, getESGInfoTemplate } from '@/lib/ai/prompts/templates/ir/esg-info'

describe('esgInfoTemplate', () => {
  it('should have correct id', () => {
    expect(esgInfoTemplate.id).toBe('ir-esg-info')
  })

  it('should have correct section type', () => {
    expect(esgInfoTemplate.sectionType).toBe('ESG_INFO')
  })

  it('should use cpa persona', () => {
    expect(esgInfoTemplate.persona).toBe('cpa')
  })

  it('should have Japanese and English system prompts', () => {
    expect(esgInfoTemplate.systemPrompt.ja).toBeTruthy()
    expect(esgInfoTemplate.systemPrompt.en).toBeTruthy()
  })

  it('should have Japanese and English user prompt templates', () => {
    expect(esgInfoTemplate.userPromptTemplate.ja).toBeTruthy()
    expect(esgInfoTemplate.userPromptTemplate.en).toBeTruthy()
  })

  it('should contain required variables', () => {
    expect(esgInfoTemplate.variables).toContain('companyName')
    expect(esgInfoTemplate.variables).toContain('environmentalData')
    expect(esgInfoTemplate.variables).toContain('socialData')
    expect(esgInfoTemplate.variables).toContain('governanceData')
  })

  it('should have markdown output format', () => {
    expect(esgInfoTemplate.outputFormat).toBe('markdown')
  })

  it('should have temperature of 0.2', () => {
    expect(esgInfoTemplate.temperature).toBe(0.2)
  })

  it('should have 4 variables', () => {
    expect(esgInfoTemplate.variables).toHaveLength(4)
  })

  it('should contain ESG-related content in system prompt', () => {
    expect(esgInfoTemplate.systemPrompt.ja).toContain('ESG')
    expect(esgInfoTemplate.systemPrompt.en).toContain('ESG')
  })

  it('should mention TCFD in system prompt', () => {
    expect(esgInfoTemplate.systemPrompt.ja).toContain('TCFD')
    expect(esgInfoTemplate.systemPrompt.en).toContain('TCFD')
  })

  it('should contain template variables in user prompt', () => {
    expect(esgInfoTemplate.userPromptTemplate.ja).toContain('{{companyName}}')
    expect(esgInfoTemplate.userPromptTemplate.ja).toContain('{{environmentalData}}')
    expect(esgInfoTemplate.userPromptTemplate.ja).toContain('{{socialData}}')
    expect(esgInfoTemplate.userPromptTemplate.ja).toContain('{{governanceData}}')
  })
})

describe('getESGInfoTemplate', () => {
  it('should return the esgInfoTemplate', () => {
    expect(getESGInfoTemplate()).toBe(esgInfoTemplate)
  })
})

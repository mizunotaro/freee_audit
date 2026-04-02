import { describe, it, expect } from 'vitest'
import {
  topMessageTemplate,
  getTopMessageTemplate,
} from '@/lib/ai/prompts/templates/ir/top-message'

describe('topMessageTemplate', () => {
  it('should have correct id', () => {
    expect(topMessageTemplate.id).toBe('ir-top-message')
  })

  it('should have correct section type', () => {
    expect(topMessageTemplate.sectionType).toBe('TOP_MESSAGE')
  })

  it('should use cfo persona', () => {
    expect(topMessageTemplate.persona).toBe('cfo')
  })

  it('should have Japanese and English system prompts', () => {
    expect(topMessageTemplate.systemPrompt.ja).toBeTruthy()
    expect(topMessageTemplate.systemPrompt.en).toBeTruthy()
  })

  it('should have Japanese and English user prompt templates', () => {
    expect(topMessageTemplate.userPromptTemplate.ja).toBeTruthy()
    expect(topMessageTemplate.userPromptTemplate.en).toBeTruthy()
  })

  it('should contain required variables', () => {
    expect(topMessageTemplate.variables).toContain('companyName')
    expect(topMessageTemplate.variables).toContain('fiscalYear')
    expect(topMessageTemplate.variables).toContain('highlights')
    expect(topMessageTemplate.variables).toContain('challenges')
  })

  it('should have markdown output format', () => {
    expect(topMessageTemplate.outputFormat).toBe('markdown')
  })

  it('should have temperature of 0.3', () => {
    expect(topMessageTemplate.temperature).toBe(0.3)
  })

  it('should contain template variables in user prompt', () => {
    expect(topMessageTemplate.userPromptTemplate.ja).toContain('{{companyName}}')
    expect(topMessageTemplate.userPromptTemplate.ja).toContain('{{fiscalYear}}')
    expect(topMessageTemplate.userPromptTemplate.ja).toContain('{{highlights}}')
    expect(topMessageTemplate.userPromptTemplate.ja).toContain('{{challenges}}')
  })
})

describe('getTopMessageTemplate', () => {
  it('should return the topMessageTemplate', () => {
    expect(getTopMessageTemplate()).toBe(topMessageTemplate)
  })
})

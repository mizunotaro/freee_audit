import { describe, it, expect } from 'vitest'
import {
  dividendPolicyTemplate,
  getDividendPolicyTemplate,
} from '@/lib/ai/prompts/templates/ir/dividend-policy'

describe('dividendPolicyTemplate', () => {
  it('should have correct id', () => {
    expect(dividendPolicyTemplate.id).toBe('ir-dividend-policy')
  })

  it('should have correct section type', () => {
    expect(dividendPolicyTemplate.sectionType).toBe('DIVIDEND_POLICY')
  })

  it('should use cfo persona', () => {
    expect(dividendPolicyTemplate.persona).toBe('cfo')
  })

  it('should have Japanese and English system prompts', () => {
    expect(dividendPolicyTemplate.systemPrompt.ja).toBeTruthy()
    expect(dividendPolicyTemplate.systemPrompt.en).toBeTruthy()
  })

  it('should have Japanese and English user prompt templates', () => {
    expect(dividendPolicyTemplate.userPromptTemplate.ja).toBeTruthy()
    expect(dividendPolicyTemplate.userPromptTemplate.en).toBeTruthy()
  })

  it('should contain required variables', () => {
    expect(dividendPolicyTemplate.variables).toContain('companyName')
    expect(dividendPolicyTemplate.variables).toContain('dividendHistory')
    expect(dividendPolicyTemplate.variables).toContain('payoutRatio')
    expect(dividendPolicyTemplate.variables).toContain('futurePolicy')
  })

  it('should have markdown output format', () => {
    expect(dividendPolicyTemplate.outputFormat).toBe('markdown')
  })

  it('should have temperature of 0.2', () => {
    expect(dividendPolicyTemplate.temperature).toBe(0.2)
  })

  it('should have 4 variables', () => {
    expect(dividendPolicyTemplate.variables).toHaveLength(4)
  })

  it('should contain template variables in user prompt', () => {
    expect(dividendPolicyTemplate.userPromptTemplate.ja).toContain('{{companyName}}')
    expect(dividendPolicyTemplate.userPromptTemplate.ja).toContain('{{dividendHistory}}')
    expect(dividendPolicyTemplate.userPromptTemplate.ja).toContain('{{payoutRatio}}')
    expect(dividendPolicyTemplate.userPromptTemplate.ja).toContain('{{futurePolicy}}')
  })

  it('should mention dividend policy in system prompt', () => {
    expect(dividendPolicyTemplate.systemPrompt.ja).toContain('配当')
    expect(dividendPolicyTemplate.systemPrompt.en).toContain('dividend')
  })

  it('should mention shareholder returns', () => {
    expect(dividendPolicyTemplate.systemPrompt.ja).toContain('株主還元')
    expect(dividendPolicyTemplate.systemPrompt.en).toContain('shareholder returns')
  })
})

describe('getDividendPolicyTemplate', () => {
  it('should return the dividendPolicyTemplate', () => {
    expect(getDividendPolicyTemplate()).toBe(dividendPolicyTemplate)
  })
})

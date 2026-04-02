import { describe, it, expect } from 'vitest'
import {
  riskFactorsTemplate,
  getRiskFactorsTemplate,
} from '@/lib/ai/prompts/templates/ir/risk-factors'

describe('riskFactorsTemplate', () => {
  it('should have correct id', () => {
    expect(riskFactorsTemplate.id).toBe('ir-risk-factors')
  })

  it('should have correct section type', () => {
    expect(riskFactorsTemplate.sectionType).toBe('RISK_FACTORS')
  })

  it('should use financial_analyst persona', () => {
    expect(riskFactorsTemplate.persona).toBe('financial_analyst')
  })

  it('should have Japanese and English system prompts', () => {
    expect(riskFactorsTemplate.systemPrompt.ja).toBeTruthy()
    expect(riskFactorsTemplate.systemPrompt.en).toBeTruthy()
  })

  it('should have Japanese and English user prompt templates', () => {
    expect(riskFactorsTemplate.userPromptTemplate.ja).toBeTruthy()
    expect(riskFactorsTemplate.userPromptTemplate.en).toBeTruthy()
  })

  it('should contain required variables', () => {
    expect(riskFactorsTemplate.variables).toContain('companyName')
    expect(riskFactorsTemplate.variables).toContain('industryRisks')
    expect(riskFactorsTemplate.variables).toContain('companyRisks')
    expect(riskFactorsTemplate.variables).toContain('mitigationStrategies')
  })

  it('should have markdown output format', () => {
    expect(riskFactorsTemplate.outputFormat).toBe('markdown')
  })

  it('should have temperature of 0.2', () => {
    expect(riskFactorsTemplate.temperature).toBe(0.2)
  })

  it('should contain template variables in user prompt', () => {
    expect(riskFactorsTemplate.userPromptTemplate.ja).toContain('{{companyName}}')
    expect(riskFactorsTemplate.userPromptTemplate.ja).toContain('{{industryRisks}}')
    expect(riskFactorsTemplate.userPromptTemplate.ja).toContain('{{companyRisks}}')
    expect(riskFactorsTemplate.userPromptTemplate.ja).toContain('{{mitigationStrategies}}')
  })

  it('should have 4 variables', () => {
    expect(riskFactorsTemplate.variables).toHaveLength(4)
  })
})

describe('getRiskFactorsTemplate', () => {
  it('should return the riskFactorsTemplate', () => {
    expect(getRiskFactorsTemplate()).toBe(riskFactorsTemplate)
  })
})

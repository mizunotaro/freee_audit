import { describe, it, expect } from 'vitest'
import {
  financialHighlightsTemplate,
  getFinancialHighlightsTemplate,
} from '@/lib/ai/prompts/templates/ir/financial-highlights'

describe('financialHighlightsTemplate', () => {
  it('should have correct id', () => {
    expect(financialHighlightsTemplate.id).toBe('ir-financial-highlights')
  })

  it('should have correct section type', () => {
    expect(financialHighlightsTemplate.sectionType).toBe('FINANCIAL_HIGHLIGHTS')
  })

  it('should use financial_analyst persona', () => {
    expect(financialHighlightsTemplate.persona).toBe('financial_analyst')
  })

  it('should have Japanese and English system prompts', () => {
    expect(financialHighlightsTemplate.systemPrompt.ja).toBeTruthy()
    expect(financialHighlightsTemplate.systemPrompt.en).toBeTruthy()
  })

  it('should have Japanese and English user prompt templates', () => {
    expect(financialHighlightsTemplate.userPromptTemplate.ja).toBeTruthy()
    expect(financialHighlightsTemplate.userPromptTemplate.en).toBeTruthy()
  })

  it('should contain required variables', () => {
    expect(financialHighlightsTemplate.variables).toContain('companyName')
    expect(financialHighlightsTemplate.variables).toContain('financialData')
    expect(financialHighlightsTemplate.variables).toContain('previousYearData')
    expect(financialHighlightsTemplate.variables).toContain('kpis')
  })

  it('should have markdown output format', () => {
    expect(financialHighlightsTemplate.outputFormat).toBe('markdown')
  })

  it('should have temperature of 0.2', () => {
    expect(financialHighlightsTemplate.temperature).toBe(0.2)
  })

  it('should have 4 variables', () => {
    expect(financialHighlightsTemplate.variables).toHaveLength(4)
  })

  it('should contain template variables in user prompt', () => {
    expect(financialHighlightsTemplate.userPromptTemplate.ja).toContain('{{companyName}}')
    expect(financialHighlightsTemplate.userPromptTemplate.ja).toContain('{{financialData}}')
    expect(financialHighlightsTemplate.userPromptTemplate.ja).toContain('{{previousYearData}}')
    expect(financialHighlightsTemplate.userPromptTemplate.ja).toContain('{{kpis}}')
  })

  it('should mention ROE and ROA in system prompt', () => {
    expect(financialHighlightsTemplate.systemPrompt.ja).toContain('ROE')
    expect(financialHighlightsTemplate.systemPrompt.ja).toContain('ROA')
  })
})

describe('getFinancialHighlightsTemplate', () => {
  it('should return the financialHighlightsTemplate', () => {
    expect(getFinancialHighlightsTemplate()).toBe(financialHighlightsTemplate)
  })
})

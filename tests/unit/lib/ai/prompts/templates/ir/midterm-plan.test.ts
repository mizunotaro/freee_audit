import { describe, it, expect } from 'vitest'
import {
  midtermPlanTemplate,
  getMidtermPlanTemplate,
} from '@/lib/ai/prompts/templates/ir/midterm-plan'

describe('midtermPlanTemplate', () => {
  it('should have correct id', () => {
    expect(midtermPlanTemplate.id).toBe('ir-midterm-plan')
  })

  it('should have correct section type', () => {
    expect(midtermPlanTemplate.sectionType).toBe('MIDTERM_PLAN')
  })

  it('should use cfo persona', () => {
    expect(midtermPlanTemplate.persona).toBe('cfo')
  })

  it('should have Japanese and English system prompts', () => {
    expect(midtermPlanTemplate.systemPrompt.ja).toBeTruthy()
    expect(midtermPlanTemplate.systemPrompt.en).toBeTruthy()
  })

  it('should have Japanese and English user prompt templates', () => {
    expect(midtermPlanTemplate.userPromptTemplate.ja).toBeTruthy()
    expect(midtermPlanTemplate.userPromptTemplate.en).toBeTruthy()
  })

  it('should contain required variables', () => {
    expect(midtermPlanTemplate.variables).toContain('companyName')
    expect(midtermPlanTemplate.variables).toContain('currentStatus')
    expect(midtermPlanTemplate.variables).toContain('marketTrend')
    expect(midtermPlanTemplate.variables).toContain('strategy')
    expect(midtermPlanTemplate.variables).toContain('targets')
  })

  it('should have markdown output format', () => {
    expect(midtermPlanTemplate.outputFormat).toBe('markdown')
  })

  it('should have temperature of 0.3', () => {
    expect(midtermPlanTemplate.temperature).toBe(0.3)
  })

  it('should have 5 variables', () => {
    expect(midtermPlanTemplate.variables).toHaveLength(5)
  })

  it('should contain template variables in user prompt', () => {
    expect(midtermPlanTemplate.userPromptTemplate.ja).toContain('{{companyName}}')
    expect(midtermPlanTemplate.userPromptTemplate.ja).toContain('{{currentStatus}}')
    expect(midtermPlanTemplate.userPromptTemplate.ja).toContain('{{marketTrend}}')
    expect(midtermPlanTemplate.userPromptTemplate.ja).toContain('{{strategy}}')
    expect(midtermPlanTemplate.userPromptTemplate.ja).toContain('{{targets}}')
  })
})

describe('getMidtermPlanTemplate', () => {
  it('should return the midtermPlanTemplate', () => {
    expect(getMidtermPlanTemplate()).toBe(midtermPlanTemplate)
  })
})

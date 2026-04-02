import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai/personas/prompts/constraints', () => ({
  getConstraints: vi.fn().mockReturnValue('Mocked constraints'),
}))

vi.mock('@/lib/ai/personas/prompts/output-formats', () => ({
  getOutputFormat: vi.fn().mockReturnValue('Mocked output format'),
}))

import { buildBasePrompt } from '@/lib/ai/personas/prompts/templates/base'
import type { PersonaConfig, PersonaBuildContext } from '@/lib/ai/personas/types'

const mockConfig: PersonaConfig = {
  type: 'cpa',
  name: 'Test CPA',
  nameJa: 'テストCPA',
  version: '1.0.0',
  systemPrompt: 'English system prompt',
  systemPromptJa: '日本語システムプロンプト',
  expertise: ['Auditing'],
  analysisFocus: [],
  outputStyle: 'formal',
  defaultModelComplexity: 'detailed_analysis',
  temperatureRange: { min: 0, max: 0.3, recommended: 0.1 },
}

describe('buildBasePrompt', () => {
  it('should use Japanese system prompt for ja language', () => {
    const context: PersonaBuildContext = { query: '分析してください', language: 'ja' }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.systemPrompt).toContain('日本語システムプロンプト')
    expect(result.userPrompt).toContain('分析してください')
  })

  it('should use English system prompt for en language', () => {
    const context: PersonaBuildContext = { query: 'Analyze this', language: 'en' }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.systemPrompt).toContain('English system prompt')
    expect(result.userPrompt).toContain('Analyze this')
  })

  it('should default to Japanese when language not specified', () => {
    const context: PersonaBuildContext = { query: 'test query' }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.systemPrompt).toContain('日本語システムプロンプト')
  })

  it('should include constraints and output format in system prompt', () => {
    const context: PersonaBuildContext = { query: 'test', language: 'en' }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.systemPrompt).toContain('Mocked constraints')
    expect(result.systemPrompt).toContain('Mocked output format')
  })

  it('should include financial data in Japanese user prompt', () => {
    const context: PersonaBuildContext = {
      query: 'test',
      language: 'ja',
      financialData: { revenue: 1000000 },
    }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.userPrompt).toContain('財務データ')
    expect(result.userPrompt).toContain('1000000')
  })

  it('should include financial data in English user prompt', () => {
    const context: PersonaBuildContext = {
      query: 'test',
      language: 'en',
      financialData: { revenue: 1000000 },
    }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.userPrompt).toContain('Financial Data')
    expect(result.userPrompt).toContain('1000000')
  })

  it('should include user role in Japanese prompt', () => {
    const context: PersonaBuildContext = {
      query: 'test',
      language: 'ja',
      userRole: 'business_owner',
    }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.userPrompt).toContain('ユーザーロール')
    expect(result.userPrompt).toContain('経営者')
  })

  it('should include user role in English prompt', () => {
    const context: PersonaBuildContext = {
      query: 'test',
      language: 'en',
      userRole: 'investor',
    }
    const result = buildBasePrompt(mockConfig, context)

    expect(result.userPrompt).toContain('User Role')
    expect(result.userPrompt).toContain('investor')
  })

  it('should map all user roles in Japanese', () => {
    const roles = ['business_owner', 'accountant', 'investor', 'lender'] as const
    const expectedJa = ['経営者', '会計士', '投資家', '金融機関']

    for (let i = 0; i < roles.length; i++) {
      const context: PersonaBuildContext = {
        query: 'test',
        language: 'ja',
        userRole: roles[i],
      }
      const result = buildBasePrompt(mockConfig, context)
      expect(result.userPrompt).toContain(expectedJa[i])
    }
  })

  it('should use raw role string for unknown role in Japanese', () => {
    const context: PersonaBuildContext = {
      query: 'test',
      language: 'ja',
      userRole: 'custom_role' as any,
    }
    const result = buildBasePrompt(mockConfig, context)
    expect(result.userPrompt).toContain('custom_role')
  })

  it('should not include financial data when not provided', () => {
    const context: PersonaBuildContext = { query: 'test', language: 'en' }
    const result = buildBasePrompt(mockConfig, context)
    expect(result.userPrompt).not.toContain('Financial Data')
  })

  it('should not include user role when not provided', () => {
    const context: PersonaBuildContext = { query: 'test', language: 'en' }
    const result = buildBasePrompt(mockConfig, context)
    expect(result.userPrompt).not.toContain('User Role')
  })
})

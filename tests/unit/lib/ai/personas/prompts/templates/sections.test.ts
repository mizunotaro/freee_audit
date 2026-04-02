import { describe, it, expect } from 'vitest'
import {
  buildExpertiseSection,
  buildAnalysisFocusSection,
  buildConversationContext,
} from '@/lib/ai/personas/prompts/templates/sections'

describe('buildExpertiseSection', () => {
  it('should build expertise section in Japanese', () => {
    const result = buildExpertiseSection(['Auditing', 'Tax Planning'], 'ja')
    expect(result.title).toBe('専門分野')
    expect(result.content).toContain('- Auditing')
    expect(result.content).toContain('- Tax Planning')
  })

  it('should build expertise section in English', () => {
    const result = buildExpertiseSection(['Auditing', 'Tax Planning'], 'en')
    expect(result.title).toBe('Areas of Expertise')
    expect(result.content).toContain('- Auditing')
  })

  it('should handle empty expertise array', () => {
    const result = buildExpertiseSection([], 'ja')
    expect(result.content).toBe('')
  })

  it('should handle single expertise', () => {
    const result = buildExpertiseSection(['Tax'], 'en')
    expect(result.content).toBe('- Tax')
  })
})

describe('buildAnalysisFocusSection', () => {
  const focusAreas = [
    { category: 'liquidity', weight: 0.3, metrics: ['current_ratio', 'quick_ratio'] },
    { category: 'safety', weight: 0.25, metrics: ['debt_ratio'] },
  ]

  it('should build analysis focus section in Japanese', () => {
    const result = buildAnalysisFocusSection(focusAreas, 'ja')
    expect(result.title).toBe('分析重点分野')
    expect(result.content).toContain('流動性')
    expect(result.content).toContain('安全性')
    expect(result.content).toContain('30%')
    expect(result.content).toContain('current_ratio')
  })

  it('should build analysis focus section in English', () => {
    const result = buildAnalysisFocusSection(focusAreas, 'en')
    expect(result.title).toBe('Analysis Focus Areas')
    expect(result.content).toContain('Liquidity')
    expect(result.content).toContain('Safety')
    expect(result.content).toContain('25%')
  })

  it('should handle unknown category by using raw name', () => {
    const result = buildAnalysisFocusSection(
      [{ category: 'custom_category', weight: 0.5, metrics: ['metric1'] }],
      'en'
    )
    expect(result.content).toContain('custom_category')
  })

  it('should handle empty focus areas', () => {
    const result = buildAnalysisFocusSection([], 'ja')
    expect(result.content).toBe('')
  })

  it('should format all category names in Japanese', () => {
    const categories = [
      { category: 'liquidity', weight: 0.1, metrics: ['m1'] },
      { category: 'safety', weight: 0.1, metrics: ['m1'] },
      { category: 'profitability', weight: 0.1, metrics: ['m1'] },
      { category: 'efficiency', weight: 0.1, metrics: ['m1'] },
      { category: 'growth', weight: 0.1, metrics: ['m1'] },
      { category: 'tax', weight: 0.1, metrics: ['m1'] },
      { category: 'compliance', weight: 0.1, metrics: ['m1'] },
      { category: 'strategy', weight: 0.1, metrics: ['m1'] },
    ]
    const result = buildAnalysisFocusSection(categories, 'ja')
    expect(result.content).toContain('流動性')
    expect(result.content).toContain('安全性')
    expect(result.content).toContain('収益性')
    expect(result.content).toContain('効率性')
    expect(result.content).toContain('成長性')
    expect(result.content).toContain('税務')
    expect(result.content).toContain('コンプライアンス')
    expect(result.content).toContain('戦略')
  })
})

describe('buildConversationContext', () => {
  it('should return empty string for empty history', () => {
    expect(buildConversationContext([], 'ja')).toBe('')
  })

  it('should build conversation context in Japanese', () => {
    const history = [
      { role: 'user', content: '質問' },
      { role: 'assistant', content: '回答' },
    ]
    const result = buildConversationContext(history, 'ja')
    expect(result).toContain('## 会話履歴')
    expect(result).toContain('**ユーザー:** 質問')
    expect(result).toContain('**アシスタント:** 回答')
  })

  it('should build conversation context in English', () => {
    const history = [
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: 'Answer' },
    ]
    const result = buildConversationContext(history, 'en')
    expect(result).toContain('## Conversation History')
    expect(result).toContain('**User:** Question')
    expect(result).toContain('**Assistant:** Answer')
  })

  it('should handle single message', () => {
    const history = [{ role: 'user', content: 'Hello' }]
    const result = buildConversationContext(history, 'en')
    expect(result).toContain('**User:** Hello')
    expect(result).not.toContain('**Assistant:**')
  })
})

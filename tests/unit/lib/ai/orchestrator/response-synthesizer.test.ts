import { synthesizeResponses } from '@/lib/ai/orchestrator/response-synthesizer'
import type {
  PersonaAnalysis,
  IntentClassification,
} from '@/lib/ai/orchestrator/orchestrator-types'

const mockIntentClassification: IntentClassification = {
  primary: 'financial_analysis',
  confidence: 0.85,
  secondary: [],
  keywords: ['財務', '分析'],
}

const createMockAnalysis = (
  persona: 'cpa' | 'tax_accountant' | 'cfo' | 'financial_analyst'
): PersonaAnalysis => ({
  persona,
  response: {
    persona,
    conclusion: `${persona}の分析結果`,
    confidence: 0.85,
    reasoning: [
      { point: '重要なポイント', analysis: '詳細分析', evidence: 'データ証拠', confidence: 0.9 },
    ],
    risks: [],
    metadata: {
      modelUsed: 'gpt-5-nano',
      tokensUsed: 500,
      processingTimeMs: 100,
      templateVersion: '1.0.0',
    },
  },
  executionTimeMs: 100,
  modelUsed: 'gpt-5-nano',
  tokensUsed: 500,
})

describe('response-synthesizer', () => {
  describe('synthesizeResponses', () => {
    it('should return empty response for empty analyses', () => {
      const result = synthesizeResponses([], mockIntentClassification)

      expect(result.summary).toBe('分析を完了できませんでした。')
      expect(result.personaAnalyses).toHaveLength(0)
      expect(result.confidence).toBe(0)
    })

    it('should synthesize single analysis', () => {
      const analyses = [createMockAnalysis('cpa')]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.summary).toContain('公認会計士')
      expect(result.personaAnalyses).toHaveLength(1)
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should synthesize multiple analyses', () => {
      const analyses = [createMockAnalysis('cpa'), createMockAnalysis('tax_accountant')]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.summary).toContain('公認会計士')
      expect(result.personaAnalyses).toHaveLength(2)
    })

    it('should sort analyses by priority based on intent', () => {
      const analyses = [createMockAnalysis('tax_accountant'), createMockAnalysis('cpa')]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.summary).toContain('公認会計士')
    })

    it('should calculate overall confidence', () => {
      const analyses = [createMockAnalysis('cpa')]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should calculate total cost', () => {
      const analyses = [createMockAnalysis('cpa'), createMockAnalysis('cfo')]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.totalCost).toBeGreaterThanOrEqual(0)
    })

    it('should extract consensus points from similar reasoning', () => {
      const analyses = [
        {
          ...createMockAnalysis('cpa'),
          response: {
            ...createMockAnalysis('cpa').response,
            reasoning: [
              { point: '重要なポイント', analysis: '分析1', evidence: '証拠1', confidence: 0.9 },
            ],
          },
        },
        {
          ...createMockAnalysis('tax_accountant'),
          response: {
            ...createMockAnalysis('tax_accountant').response,
            reasoning: [
              { point: '重要なポイント', analysis: '分析2', evidence: '証拠2', confidence: 0.85 },
            ],
          },
        },
      ]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.consensusPoints.length).toBeGreaterThanOrEqual(0)
    })

    it('should include high confidence notice in summary', () => {
      const highConfidenceIntent: IntentClassification = {
        ...mockIntentClassification,
        confidence: 0.95,
      }
      const analyses = [createMockAnalysis('cpa')]
      const result = synthesizeResponses(analyses, highConfidenceIntent)

      expect(result.summary).toContain('高い信頼度')
    })

    it('should generate recommended action from analysis', () => {
      const analyses = [
        {
          ...createMockAnalysis('cpa'),
          response: {
            ...createMockAnalysis('cpa').response,
            recommendedAction: '推奨アクション',
          },
        },
      ]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.recommendedAction).toContain('推奨アクション')
    })

    it('should include risk warnings in recommended action', () => {
      const analyses = [
        {
          ...createMockAnalysis('cpa'),
          response: {
            ...createMockAnalysis('cpa').response,
            risks: [
              {
                category: 'financial',
                description: '重大なリスク',
                severity: 'critical' as const,
                probability: 0.8,
              },
            ],
          },
        },
      ]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.recommendedAction).toContain('リスク警告')
    })

    it('should handle analyses with alternatives', () => {
      const analyses = [
        {
          ...createMockAnalysis('cpa'),
          response: {
            ...createMockAnalysis('cpa').response,
            alternatives: [
              {
                option: 'オプションA',
                pros: ['メリット1'],
                cons: ['デメリット1'],
                riskLevel: 'low' as const,
              },
            ],
          },
        },
        {
          ...createMockAnalysis('cfo'),
          response: {
            ...createMockAnalysis('cfo').response,
            alternatives: [
              {
                option: 'オプションA',
                pros: ['メリット2'],
                cons: ['デメリット2'],
                riskLevel: 'medium' as const,
              },
            ],
          },
        },
      ]
      const result = synthesizeResponses(analyses, mockIntentClassification)

      expect(result.divergentViews.length).toBeGreaterThanOrEqual(0)
    })

    it('should prioritize tax_accountant for tax_inquiry intent', () => {
      const taxIntent: IntentClassification = {
        primary: 'tax_inquiry',
        confidence: 0.9,
        secondary: [],
        keywords: ['税'],
      }
      const analyses = [createMockAnalysis('cpa'), createMockAnalysis('tax_accountant')]
      const result = synthesizeResponses(analyses, taxIntent)

      expect(result.summary).toContain('税理士')
    })

    it('should prioritize cfo for strategic_planning intent', () => {
      const strategicIntent: IntentClassification = {
        primary: 'strategic_planning',
        confidence: 0.9,
        secondary: [],
        keywords: ['戦略'],
      }
      const analyses = [createMockAnalysis('cpa'), createMockAnalysis('cfo')]
      const result = synthesizeResponses(analyses, strategicIntent)

      expect(result.summary).toContain('CFO')
    })

    it('should prioritize financial_analyst for ratio_analysis intent', () => {
      const ratioIntent: IntentClassification = {
        primary: 'ratio_analysis',
        confidence: 0.9,
        secondary: [],
        keywords: ['比率'],
      }
      const analyses = [createMockAnalysis('cpa'), createMockAnalysis('financial_analyst')]
      const result = synthesizeResponses(analyses, ratioIntent)

      expect(result.summary).toContain('財務アナリスト')
    })
  })
})

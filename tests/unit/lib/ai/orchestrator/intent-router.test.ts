import { classifyIntent, getWorkflowForIntent } from '@/lib/ai/orchestrator/intent-router'
import type { OrchestratorContext } from '@/lib/ai/orchestrator/orchestrator-types'

const mockContext: OrchestratorContext = {
  sessionId: 'test-session',
  userId: 'test-user',
  language: 'ja',
  conversationHistory: [],
}

describe('intent-router', () => {
  describe('classifyIntent', () => {
    it('should classify financial_analysis intent', () => {
      const result = classifyIntent('財務分析をしてください', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('financial_analysis')
        expect(result.data.confidence).toBeGreaterThan(0)
      }
    })

    it('should classify tax_inquiry intent', () => {
      const result = classifyIntent('法人税について教えてください', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('tax_inquiry')
      }
    })

    it('should classify strategic_planning intent', () => {
      const result = classifyIntent('今後の成長戦略を立案したい', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('strategic_planning')
      }
    })

    it('should classify ratio_analysis intent', () => {
      const result = classifyIntent('流動比率を計算して', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('ratio_analysis')
      }
    })

    it('should classify cashflow_analysis intent', () => {
      const result = classifyIntent('キャッシュフロー分析をお願いします', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('cashflow_analysis')
      }
    })

    it('should classify budget_inquiry intent', () => {
      const result = classifyIntent('予算と実績の差異を知りたい', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('budget_inquiry')
      }
    })

    it('should classify forecast_request intent', () => {
      const result = classifyIntent('将来の売上予測をして', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('forecast_request')
      }
    })

    it('should classify compliance_check intent', () => {
      const result = classifyIntent('コンプライアンス監査について', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('compliance_check')
      }
    })

    it('should default to general_inquiry for unknown input', () => {
      const result = classifyIntent('こんにちは', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('general_inquiry')
      }
    })

    it('should return secondary intents', () => {
      const result = classifyIntent('財務分析と税金について教えて', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.secondary.length).toBeGreaterThan(0)
      }
    })

    it('should extract matched keywords', () => {
      const result = classifyIntent('財務分析をしてください', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.keywords.length).toBeGreaterThan(0)
      }
    })

    it('should handle empty query', () => {
      const result = classifyIntent('', mockContext)

      expect(result.success).toBe(false)
    })

    it('should handle null/undefined query', () => {
      const resultNull = classifyIntent(null as unknown as string, mockContext)
      const resultUndefined = classifyIntent(undefined as unknown as string, mockContext)

      expect(resultNull.success).toBe(false)
      expect(resultUndefined.success).toBe(false)
    })

    it('should handle very long query', () => {
      const longQuery = '財務分析'.repeat(10000)
      const result = classifyIntent(longQuery, mockContext)

      expect(result.success).toBe(true)
    })

    it('should classify English keywords correctly', () => {
      const result = classifyIntent('Please analyze the financial statements', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.primary).toBe('financial_analysis')
      }
    })

    it('should handle special characters', () => {
      const result = classifyIntent('財務分析!@#$%^&*()をして', mockContext)

      expect(result.success).toBe(true)
    })

    it('should return confidence between 0 and 1', () => {
      const result = classifyIntent('財務分析', mockContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence).toBeGreaterThanOrEqual(0)
        expect(result.data.confidence).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('getWorkflowForIntent', () => {
    it('should return comprehensive_analysis for financial_analysis', () => {
      expect(getWorkflowForIntent('financial_analysis')).toBe('comprehensive_analysis')
    })

    it('should return tax_focused for tax_inquiry', () => {
      expect(getWorkflowForIntent('tax_inquiry')).toBe('tax_focused')
    })

    it('should return strategic_analysis for strategic_planning', () => {
      expect(getWorkflowForIntent('strategic_planning')).toBe('strategic_analysis')
    })

    it('should return compliance_review for compliance_check', () => {
      expect(getWorkflowForIntent('compliance_check')).toBe('compliance_review')
    })

    it('should return ratio_focused for ratio_analysis', () => {
      expect(getWorkflowForIntent('ratio_analysis')).toBe('ratio_focused')
    })

    it('should return cashflow_focused for cashflow_analysis', () => {
      expect(getWorkflowForIntent('cashflow_analysis')).toBe('cashflow_focused')
    })

    it('should return budget_analysis for budget_inquiry', () => {
      expect(getWorkflowForIntent('budget_inquiry')).toBe('budget_analysis')
    })

    it('should return forecast_analysis for forecast_request', () => {
      expect(getWorkflowForIntent('forecast_request')).toBe('forecast_analysis')
    })

    it('should return general_consultation for general_inquiry', () => {
      expect(getWorkflowForIntent('general_inquiry')).toBe('general_consultation')
    })
  })
})

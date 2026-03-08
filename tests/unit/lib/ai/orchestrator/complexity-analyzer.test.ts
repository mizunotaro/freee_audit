import { analyzeComplexity } from '@/lib/ai/orchestrator/complexity-analyzer'

describe('complexity-analyzer', () => {
  describe('analyzeComplexity', () => {
    it('should return a complexity score with all factors', () => {
      const input = 'なぜこの結果になったのですか？'
      const result = analyzeComplexity(input)

      expect(result).toHaveProperty('overall')
      expect(result).toHaveProperty('factors')
      expect(result).toHaveProperty('confidence')
      expect(result.factors).toHaveProperty('reasoningDepth')
      expect(result.factors).toHaveProperty('domainKnowledge')
      expect(result.factors).toHaveProperty('dataVolume')
      expect(result.factors).toHaveProperty('outputStructure')
      expect(result.factors).toHaveProperty('riskLevel')
    })

    it('should score reasoning depth based on indicators', () => {
      const input = 'なぜこの問題が発生したのか、原因と理由を説明してください'
      const result = analyzeComplexity(input)

      expect(result.factors.reasoningDepth).toBeGreaterThan(20)
    })

    it('should detect domain knowledge terms', () => {
      const input = '貸借対照書と損益計算書を分析してください'
      const result = analyzeComplexity(input)

      expect(result.factors.domainKnowledge).toBeGreaterThan(10)
    })

    it('should detect tax-related terms', () => {
      const input = '法人税と消費税の還付について確認'
      const result = analyzeComplexity(input)

      expect(result.factors.domainKnowledge).toBeGreaterThan(10)
    })

    it('should detect finance-related terms', () => {
      const input = 'キャッシュフローとROEを分析'
      const result = analyzeComplexity(input)

      expect(result.factors.domainKnowledge).toBeGreaterThan(10)
    })

    it('should detect risk indicators', () => {
      const input = 'この案件にはリスクと懸念があります'
      const result = analyzeComplexity(input)

      expect(result.factors.riskLevel).toBeGreaterThan(10)
    })

    it('should increase risk level for critical items', () => {
      const input = '重要な問題があります'
      const result = analyzeComplexity(input)

      expect(result.factors.riskLevel).toBeGreaterThan(20)
    })

    it('should analyze output structure requirements', () => {
      const input = '結果をJSON形式の表で出力してください'
      const result = analyzeComplexity(input)

      expect(result.factors.outputStructure).toBeGreaterThan(20)
    })

    it('should handle data volume correctly', () => {
      const input = 'シンプルな質問'
      const smallData = analyzeComplexity(input, 100)
      const largeData = analyzeComplexity(input, 10000)

      expect(largeData.factors.dataVolume).toBeGreaterThan(smallData.factors.dataVolume)
    })

    it('should calculate overall score within 0-100 range', () => {
      const inputs = [
        '短い質問',
        '複雑な分析を含む長いテキストで、貸借対照表と損益計算書の分析、リスク評価、戦略的な意思決定が必要な内容',
      ]

      inputs.forEach((input) => {
        const result = analyzeComplexity(input)
        expect(result.overall).toBeGreaterThanOrEqual(0)
        expect(result.overall).toBeLessThanOrEqual(100)
      })
    })

    it('should calculate confidence within 0-1 range', () => {
      const input = 'テスト入力'
      const result = analyzeComplexity(input)

      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should handle empty input', () => {
      const result = analyzeComplexity('')

      expect(result.overall).toBeGreaterThanOrEqual(0)
      expect(result.factors.dataVolume).toBe(0)
    })

    it('should handle null/undefined input gracefully', () => {
      const resultNull = analyzeComplexity(null as unknown as string)
      const resultUndefined = analyzeComplexity(undefined as unknown as string)

      expect(resultNull.overall).toBeGreaterThanOrEqual(0)
      expect(resultUndefined.overall).toBeGreaterThanOrEqual(0)
    })

    it('should sanitize very long input', () => {
      const longInput = '分析'.repeat(100000)
      const result = analyzeComplexity(longInput)

      expect(result.overall).toBeGreaterThanOrEqual(0)
    })

    it('should sanitize invalid token count', () => {
      const resultNegative = analyzeComplexity('test', -100)
      const resultNaN = analyzeComplexity('test', NaN)
      const resultInfinity = analyzeComplexity('test', Infinity)

      expect(resultNegative.factors.dataVolume).toBe(0)
      expect(resultNaN.factors.dataVolume).toBe(0)
      expect(resultInfinity.factors.dataVolume).toBe(0)
    })

    it('should handle English domain terms', () => {
      const input = 'Analyze the balance sheet and journal entries'
      const result = analyzeComplexity(input)

      expect(result.factors.domainKnowledge).toBeGreaterThan(10)
    })

    it('should detect report requirements', () => {
      const input = 'レポートを作成してください'
      const result = analyzeComplexity(input)

      expect(result.factors.outputStructure).toBeGreaterThan(20)
    })

    it('should detect comparison requirements', () => {
      const input = '複数のデータを比較してください'
      const result = analyzeComplexity(input)

      expect(result.factors.outputStructure).toBeGreaterThan(20)
    })

    it('should weight factors correctly in overall score', () => {
      const simpleInput = '短い'
      const complexInput =
        'なぜこの戦略が必要なのか、リスクと根拠を説明し、貸借対照表を分析してJSONで報告してください'

      const simpleResult = analyzeComplexity(simpleInput)
      const complexResult = analyzeComplexity(complexInput)

      expect(complexResult.overall).toBeGreaterThan(simpleResult.overall)
    })
  })
})

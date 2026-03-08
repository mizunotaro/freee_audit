import { classifyTask } from '@/lib/ai/orchestrator/task-classifier'
import type { TaskCategory } from '@/lib/ai/orchestrator/types'

describe('task-classifier', () => {
  describe('classifyTask', () => {
    it('should classify complex reasoning tasks', () => {
      const input = '戦略的な意思決定を行いたい'
      const result = classifyTask(input)

      expect(result.category).toBe('complex_reasoning')
      expect(result.estimatedOutputTokens).toBe(2000)
      expect(result.maxLatencyMs).toBe(60000)
    })

    it('should classify detailed analysis tasks', () => {
      const input = 'このデータを分析してリスクを評価してください'
      const result = classifyTask(input)

      expect(result.category).toBe('detailed_analysis')
      expect(result.estimatedOutputTokens).toBe(1500)
    })

    it('should classify standard analysis tasks', () => {
      const input = 'このレポートを要約してください'
      const result = classifyTask(input)

      expect(result.category).toBe('standard_analysis')
      expect(result.estimatedOutputTokens).toBe(800)
    })

    it('should classify fast response tasks', () => {
      const input = 'このテキストからデータを抽出してください'
      const result = classifyTask(input)

      expect(result.category).toBe('fast_response')
      expect(result.estimatedOutputTokens).toBe(300)
    })

    it('should default to standard_analysis for unknown input', () => {
      const input = 'unknown random text'
      const result = classifyTask(input)

      expect(result.category).toBe('standard_analysis')
    })

    it('should detect JSON requirement', () => {
      const input = '結果をJSON形式で返してください'
      const result = classifyTask(input)

      expect(result.requiresJson).toBe(true)
    })

    it('should detect structured output requirement', () => {
      const input = '構造化されたデータで出力してください'
      const result = classifyTask(input)

      expect(result.requiresJson).toBe(true)
    })

    it('should adjust category based on data volume', () => {
      const input = 'データを処理'
      const smallData = classifyTask(input, 3000)
      const largeData = classifyTask(input, 15000)

      expect(largeData.estimatedInputTokens).toBeGreaterThan(smallData.estimatedInputTokens)
    })

    it('should handle empty input', () => {
      const result = classifyTask('')

      expect(result.category).toBe('standard_analysis')
      expect(result.estimatedInputTokens).toBe(0)
    })

    it('should handle very long input', () => {
      const longInput = '分析'.repeat(100000)
      const result = classifyTask(longInput)

      expect(result.estimatedInputTokens).toBeGreaterThan(0)
    })

    it('should handle null/undefined input gracefully', () => {
      const resultNull = classifyTask(null as unknown as string)
      const resultUndefined = classifyTask(undefined as unknown as string)

      expect(resultNull.category).toBe('standard_analysis')
      expect(resultUndefined.category).toBe('standard_analysis')
    })

    it('should estimate input tokens correctly', () => {
      const input = 'This is a test input with some words'
      const result = classifyTask(input)

      expect(result.estimatedInputTokens).toBe(Math.ceil(input.length / 4))
    })

    it('should classify English keywords correctly', () => {
      const inputs: { input: string; expected: TaskCategory }[] = [
        { input: 'Please make a decision on strategy', expected: 'complex_reasoning' },
        { input: 'Analyze the risk in this document', expected: 'detailed_analysis' },
        { input: 'Summarize this text', expected: 'standard_analysis' },
        { input: 'Extract the important data', expected: 'fast_response' },
      ]

      inputs.forEach(({ input, expected }) => {
        const result = classifyTask(input)
        expect(result.category).toBe(expected)
      })
    })
  })
})

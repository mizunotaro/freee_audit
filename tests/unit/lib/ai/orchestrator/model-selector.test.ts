import { selectModel } from '@/lib/ai/orchestrator/model-selector'
import { classifyTask } from '@/lib/ai/orchestrator/task-classifier'
import { analyzeComplexity } from '@/lib/ai/orchestrator/complexity-analyzer'
import type {
  TaskMetadata,
  ComplexityScore,
  SelectionConstraints,
} from '@/lib/ai/orchestrator/types'

describe('model-selector', () => {
  describe('selectModel', () => {
    it('should select a model for standard analysis task', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model).toBeDefined()
        expect(result.data.model.provider).toBeDefined()
        expect(result.data.model.modelId).toBeDefined()
        expect(result.data.estimatedCost).toBeGreaterThanOrEqual(0)
        expect(result.data.estimatedLatencyMs).toBeGreaterThan(0)
        expect(result.data.reason).toBeDefined()
      }
    })

    it('should select claude for complex reasoning tasks', () => {
      const task: TaskMetadata = {
        category: 'complex_reasoning',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 2000,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 60000,
      }

      const complexity: ComplexityScore = {
        overall: 80,
        factors: {
          reasoningDepth: 80,
          domainKnowledge: 70,
          dataVolume: 60,
          outputStructure: 50,
          riskLevel: 90,
        },
        confidence: 0.9,
      }

      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model.provider).toBe('claude')
      }
    })

    it('should respect maxCost constraint', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const constraints: SelectionConstraints = {
        maxCost: 0.001,
      }

      const result = selectModel(task, complexity, constraints)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.estimatedCost).toBeLessThanOrEqual(0.001)
      }
    })

    it('should respect maxLatencyMs constraint', () => {
      const task: TaskMetadata = {
        category: 'fast_response',
        estimatedInputTokens: 200,
        estimatedOutputTokens: 300,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 5000,
      }

      const complexity: ComplexityScore = {
        overall: 30,
        factors: {
          reasoningDepth: 20,
          domainKnowledge: 30,
          dataVolume: 20,
          outputStructure: 30,
          riskLevel: 20,
        },
        confidence: 0.7,
      }

      const constraints: SelectionConstraints = {
        maxLatencyMs: 5000,
      }

      const result = selectModel(task, complexity, constraints)

      if (result.success) {
        expect(result.data.estimatedLatencyMs).toBeLessThanOrEqual(5000)
      }
    })

    it('should respect preferredProvider constraint', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const constraints: SelectionConstraints = {
        preferredProvider: 'gemini',
      }

      const result = selectModel(task, complexity, constraints)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model.provider).toBe('gemini')
      }
    })

    it('should exclude specified models', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const constraints: SelectionConstraints = {
        excludeModels: ['gpt-5-nano', 'gemini-2.0-flash'],
      }

      const result = selectModel(task, complexity, constraints)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model.modelId).not.toBe('gpt-5-nano')
        expect(result.data.model.modelId).not.toBe('gemini-2.0-flash')
      }
    })

    it('should require JSON capability when specified', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: true,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const constraints: SelectionConstraints = {
        requireJson: true,
      }

      const result = selectModel(task, complexity, constraints)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model.capabilities.json).toBe(true)
      }
    })

    it('should return fallback chain', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fallbackChain).toBeDefined()
        expect(Array.isArray(result.data.fallbackChain)).toBe(true)
      }
    })

    it('should provide selection score', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.selectionScore).toBeGreaterThanOrEqual(0)
        expect(result.data.selectionScore).toBeLessThanOrEqual(100)
      }
    })

    it('should return error when constraints are too strict', () => {
      const task: TaskMetadata = {
        category: 'standard_analysis',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 800,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 30000,
      }

      const complexity: ComplexityScore = {
        overall: 40,
        factors: {
          reasoningDepth: 30,
          domainKnowledge: 40,
          dataVolume: 50,
          outputStructure: 30,
          riskLevel: 40,
        },
        confidence: 0.8,
      }

      const constraints: SelectionConstraints = {
        maxCost: 0.0000001,
        maxLatencyMs: 1,
      }

      const result = selectModel(task, complexity, constraints)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('constraints_too_strict')
      }
    })

    it('should handle embedding task category', () => {
      const task: TaskMetadata = {
        category: 'embedding',
        estimatedInputTokens: 500,
        estimatedOutputTokens: 0,
        requiresJson: false,
        requiresVision: false,
        maxLatencyMs: 5000,
      }

      const complexity: ComplexityScore = {
        overall: 20,
        factors: {
          reasoningDepth: 10,
          domainKnowledge: 20,
          dataVolume: 30,
          outputStructure: 10,
          riskLevel: 10,
        },
        confidence: 0.9,
      }

      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
    })
  })

  describe('integration with task-classifier and complexity-analyzer', () => {
    it('should work with real task classification', () => {
      const input = 'この財務諸表を分析してリスクを評価してください'
      const task = classifyTask(input, 3000)
      const complexity = analyzeComplexity(input, 3000)
      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model).toBeDefined()
      }
    })

    it('should select appropriate model for complex reasoning', () => {
      const input =
        'この戦略的な意思決定について、複数の観点から比較検討し、推奨事項を提案してください'
      const task = classifyTask(input, 5000)
      const complexity = analyzeComplexity(input, 5000)
      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model.provider).toBe('claude')
      }
    })

    it('should select appropriate model for fast response', () => {
      const input = 'このテキストからデータを抽出して分類してください'
      const task = classifyTask(input, 500)
      const complexity = analyzeComplexity(input, 500)
      const result = selectModel(task, complexity)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(['openai', 'gemini']).toContain(result.data.model.provider)
      }
    })
  })
})

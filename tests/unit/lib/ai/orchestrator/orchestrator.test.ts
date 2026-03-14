import { AIOrchestrator, createOrchestrator } from '@/lib/ai/orchestrator/orchestrator'
import type {
  OrchestratorRequest,
  OrchestratorContext,
  OrchestratorEvent,
} from '@/lib/ai/orchestrator/orchestrator-types'
import * as aiModule from '@/lib/integrations/ai'
import type { AIProvider, GenerateResult } from '@/lib/integrations/ai/provider'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'

const mockContext: OrchestratorContext = {
  sessionId: 'test-session',
  userId: 'test-user',
  language: 'ja',
  conversationHistory: [],
}

const createMockRequest = (query: string): OrchestratorRequest => ({
  query,
  context: mockContext,
})

const createMockAIProvider = (): AIProvider => ({
  name: 'openai',
  analyzeDocument: vi.fn(),
  validateEntry: vi.fn(),
  generate: vi.fn(
    async (): Promise<GenerateResult> => ({
      content: JSON.stringify({
        conclusion: 'Mock analysis conclusion',
        confidence: 0.85,
        reasoning: [
          {
            point: 'Key finding',
            analysis: 'Detailed analysis',
            evidence: 'Data evidence',
            confidence: 0.9,
          },
        ],
        risks: [],
      }),
      model: 'gpt-5-nano',
      usage: {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      },
    })
  ),
})

vi.mock('@/lib/integrations/ai', () => ({
  getAIService: vi.fn(),
  resetAIService: vi.fn(),
}))

describe('orchestrator', () => {
  beforeEach(() => {
    const mockProvider = createMockAIProvider()
    vi.mocked(aiModule.getAIService).mockReturnValue({
      getProvider: vi.fn().mockResolvedValue(mockProvider),
    } as unknown as ReturnType<typeof aiModule.getAIService>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AIOrchestrator', () => {
    it('should create orchestrator instance', () => {
      const orchestrator = new AIOrchestrator()
      expect(orchestrator).toBeInstanceOf(AIOrchestrator)
    })

    it('should accept custom options', () => {
      const orchestrator = new AIOrchestrator({
        timeoutMs: 30000,
        maxParallelExecutions: 2,
      })
      expect(orchestrator).toBeInstanceOf(AIOrchestrator)
    })

    it('should process financial analysis request', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('財務分析をしてください')
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
      expect(result.metadata.workflowId).toBe('comprehensive_analysis')
    })

    it('should process tax inquiry request', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('法人税について教えて')
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
      expect(result.metadata.workflowId).toBe('tax_focused')
    })

    it('should process strategic planning request', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('戦略計画を立てたい')
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
      expect(result.metadata.workflowId).toBe('strategic_analysis')
    })

    it('should emit events during processing', async () => {
      const events: OrchestratorEvent[] = []
      const orchestrator = new AIOrchestrator({
        onEvent: (event) => events.push(event),
      })
      const request = createMockRequest('財務分析')
      await orchestrator.process(request)

      expect(events.some((e) => e.type === 'intent_classified')).toBe(true)
      expect(events.some((e) => e.type === 'workflow_selected')).toBe(true)
      expect(events.some((e) => e.type === 'orchestration_completed')).toBe(true)
    })

    it('should return intent classification in metadata', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('財務分析')
      const result = await orchestrator.process(request)

      expect(result.metadata.intentClassification.primary).toBe('financial_analysis')
      expect(result.metadata.intentClassification.confidence).toBeGreaterThan(0)
    })

    it('should return model selection in metadata', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('財務分析')
      const result = await orchestrator.process(request)

      expect(result.metadata.modelSelection).toBeDefined()
      expect(result.metadata.modelSelection.model).toBeDefined()
    })

    it('should return synthesized response on success', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('財務分析')
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
      expect(result.response).toBeDefined()
      expect(result.response?.summary).toBeDefined()
      expect(result.response?.confidence).toBeGreaterThan(0)
    })

    it('should handle general inquiry', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('こんにちは')
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
      expect(result.metadata.workflowId).toBe('general_consultation')
    })

    it('should include processing time in response', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('財務分析')
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
      expect(result.response?.processingTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should include timestamp in metadata', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('財務分析')
      const result = await orchestrator.process(request)

      expect(result.metadata.timestamp).toBeInstanceOf(Date)
    })

    it('should respect cost constraints', async () => {
      const orchestrator = new AIOrchestrator()
      const request: OrchestratorRequest = {
        query: '財務分析',
        context: mockContext,
        constraints: {
          maxCost: 0.001,
        },
      }
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
    })

    it('should respect latency constraints', async () => {
      const orchestrator = new AIOrchestrator()
      const request: OrchestratorRequest = {
        query: '財務分析',
        context: mockContext,
        constraints: {
          maxLatencyMs: 10000,
        },
      }
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
    })

    it('should handle empty query', async () => {
      const orchestrator = new AIOrchestrator()
      const request = createMockRequest('')
      const result = await orchestrator.process(request)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('invalid_input')
    })

    it('should handle conversation history', async () => {
      const orchestrator = new AIOrchestrator()
      const request: OrchestratorRequest = {
        query: '前回の話題について',
        context: {
          ...mockContext,
          conversationHistory: [
            { role: 'user', content: '財務分析について', timestamp: new Date() },
            { role: 'assistant', content: '財務分析の結果です', timestamp: new Date() },
          ],
        },
      }
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
    })

    it('should handle financial data in context', async () => {
      const orchestrator = new AIOrchestrator()
      const request: OrchestratorRequest = {
        query: 'この決算書を分析して',
        context: {
          ...mockContext,
          financialData: {
            revenue: 1000000,
            expenses: 800000,
          },
        },
      }
      const result = await orchestrator.process(request)

      expect(result.success).toBe(true)
    })

    it('should emit persona_started and persona_completed events', async () => {
      const events: OrchestratorEvent[] = []
      const orchestrator = new AIOrchestrator({
        onEvent: (event) => events.push(event),
      })
      const request = createMockRequest('財務分析')
      await orchestrator.process(request)

      const startedEvents = events.filter((e) => e.type === 'persona_started')
      const completedEvents = events.filter((e) => e.type === 'persona_completed')

      expect(startedEvents.length).toBeGreaterThan(0)
      expect(completedEvents.length).toBeGreaterThan(0)
    })

    it('should emit synthesis_completed event', async () => {
      const events: OrchestratorEvent[] = []
      const orchestrator = new AIOrchestrator({
        onEvent: (event) => events.push(event),
      })
      const request = createMockRequest('財務分析')
      await orchestrator.process(request)

      expect(events.some((e) => e.type === 'synthesis_completed')).toBe(true)
    })
  })

  describe('createOrchestrator', () => {
    it('should create orchestrator with default options', () => {
      const orchestrator = createOrchestrator()
      expect(orchestrator).toBeInstanceOf(AIOrchestrator)
    })

    it('should create orchestrator with custom options', () => {
      const orchestrator = createOrchestrator({
        timeoutMs: 45000,
        maxParallelExecutions: 3,
      })
      expect(orchestrator).toBeInstanceOf(AIOrchestrator)
    })
  })
})

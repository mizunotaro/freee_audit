import type { SelectionResult } from './types'
import type {
  OrchestratorRequest,
  OrchestratorResult,
  OrchestratorEvent,
  WorkflowDefinition,
  WorkflowStep,
  PersonaAnalysis,
} from './orchestrator-types'
import { classifyIntent, getWorkflowForIntent } from './intent-router'
import { selectModel } from './model-selector'
import { classifyTask } from './task-classifier'
import { analyzeComplexity } from './complexity-analyzer'
import { synthesizeResponses } from './response-synthesizer'
import { getPersona } from '@/lib/ai/personas/registry'
import { getAIService } from '@/lib/integrations/ai'
import type { PersonaResponse } from '@/lib/ai/personas/types'

type Result<T> = { success: true; data: T } | { success: false; error: Error }

type OrchestratorErrorCode = 'no_personas' | 'all_failed' | 'timeout' | 'invalid_input'

const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  comprehensive_analysis: {
    id: 'comprehensive_analysis',
    name: 'Comprehensive Financial Analysis',
    description: 'Multi-perspective analysis from all expert personas',
    version: '1.0.0',
    steps: [
      {
        id: 'cpa_analysis',
        persona: 'cpa',
        task: 'financial_analysis',
        dependencies: [],
        parallel: true,
        optional: false,
      },
      {
        id: 'tax_analysis',
        persona: 'tax_accountant',
        task: 'tax_implications',
        dependencies: [],
        parallel: true,
        optional: false,
      },
      {
        id: 'cfo_analysis',
        persona: 'cfo',
        task: 'strategic_overview',
        dependencies: [],
        parallel: true,
        optional: false,
      },
      {
        id: 'analyst_analysis',
        persona: 'financial_analyst',
        task: 'ratio_analysis',
        dependencies: [],
        parallel: true,
        optional: false,
      },
    ],
  },
  tax_focused: {
    id: 'tax_focused',
    name: 'Tax-Focused Analysis',
    description: 'Primary tax analysis with supporting perspectives',
    version: '1.0.0',
    steps: [
      {
        id: 'tax_primary',
        persona: 'tax_accountant',
        task: 'tax_analysis',
        dependencies: [],
        parallel: false,
        optional: false,
      },
      {
        id: 'cpa_support',
        persona: 'cpa',
        task: 'compliance_check',
        dependencies: ['tax_primary'],
        parallel: false,
        optional: true,
      },
    ],
  },
  strategic_analysis: {
    id: 'strategic_analysis',
    name: 'Strategic Business Analysis',
    description: 'CFO-led strategic planning analysis',
    version: '1.0.0',
    steps: [
      {
        id: 'cfo_lead',
        persona: 'cfo',
        task: 'strategic_planning',
        dependencies: [],
        parallel: false,
        optional: false,
      },
      {
        id: 'analyst_support',
        persona: 'financial_analyst',
        task: 'market_analysis',
        dependencies: [],
        parallel: true,
        optional: true,
      },
    ],
  },
  compliance_review: {
    id: 'compliance_review',
    name: 'Compliance Review',
    description: 'Audit and compliance focused analysis',
    version: '1.0.0',
    steps: [
      {
        id: 'cpa_audit',
        persona: 'cpa',
        task: 'compliance_audit',
        dependencies: [],
        parallel: false,
        optional: false,
      },
    ],
  },
  ratio_focused: {
    id: 'ratio_focused',
    name: 'Financial Ratio Analysis',
    description: 'Detailed ratio analysis with interpretation',
    version: '1.0.0',
    steps: [
      {
        id: 'analyst_ratios',
        persona: 'financial_analyst',
        task: 'ratio_analysis',
        dependencies: [],
        parallel: false,
        optional: false,
      },
      {
        id: 'cpa_validate',
        persona: 'cpa',
        task: 'ratio_validation',
        dependencies: ['analyst_ratios'],
        parallel: false,
        optional: true,
      },
    ],
  },
  cashflow_focused: {
    id: 'cashflow_focused',
    name: 'Cash Flow Analysis',
    description: 'Cash flow focused financial review',
    version: '1.0.0',
    steps: [
      {
        id: 'cfo_cashflow',
        persona: 'cfo',
        task: 'cashflow_management',
        dependencies: [],
        parallel: false,
        optional: false,
      },
      {
        id: 'analyst_projections',
        persona: 'financial_analyst',
        task: 'cashflow_projection',
        dependencies: [],
        parallel: true,
        optional: true,
      },
    ],
  },
  budget_analysis: {
    id: 'budget_analysis',
    name: 'Budget vs Actual Analysis',
    description: 'Budget variance analysis',
    version: '1.0.0',
    steps: [
      {
        id: 'cfo_budget',
        persona: 'cfo',
        task: 'budget_variance',
        dependencies: [],
        parallel: false,
        optional: false,
      },
    ],
  },
  forecast_analysis: {
    id: 'forecast_analysis',
    name: 'Financial Forecasting',
    description: 'Forward-looking financial analysis',
    version: '1.0.0',
    steps: [
      {
        id: 'analyst_forecast',
        persona: 'financial_analyst',
        task: 'financial_forecast',
        dependencies: [],
        parallel: false,
        optional: false,
      },
      {
        id: 'cfo_review',
        persona: 'cfo',
        task: 'forecast_review',
        dependencies: ['analyst_forecast'],
        parallel: false,
        optional: true,
      },
    ],
  },
  general_consultation: {
    id: 'general_consultation',
    name: 'General Financial Consultation',
    description: 'General purpose financial guidance',
    version: '1.0.0',
    steps: [
      {
        id: 'cpa_general',
        persona: 'cpa',
        task: 'general_guidance',
        dependencies: [],
        parallel: false,
        optional: false,
      },
    ],
  },
}

export interface OrchestratorOptions {
  readonly timeoutMs?: number
  readonly maxParallelExecutions?: number
  readonly onEvent?: (event: OrchestratorEvent) => void
}

export class AIOrchestrator {
  private readonly timeoutMs: number
  private readonly maxParallelExecutions: number
  private readonly eventHandler?: (event: OrchestratorEvent) => void

  constructor(options: OrchestratorOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 60000
    this.maxParallelExecutions = options.maxParallelExecutions ?? 4
    this.eventHandler = options.onEvent
  }

  async process(request: OrchestratorRequest): Promise<OrchestratorResult> {
    const startTime = Date.now()

    try {
      const result = await this.executeWorkflow(request, startTime)
      this.emitEvent({ type: 'orchestration_completed', data: result })
      return result
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'all_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          workflowId: 'unknown',
          intentClassification: {
            primary: 'general_inquiry',
            confidence: 0,
            secondary: [],
            keywords: [],
          },
          modelSelection: {} as SelectionResult,
          timestamp: new Date(),
        },
      }
    }
  }

  private async executeWorkflow(
    request: OrchestratorRequest,
    startTime: number
  ): Promise<OrchestratorResult> {
    const classificationResult = classifyIntent(request.query, request.context)
    if (!classificationResult.success) {
      return this.createErrorResult(classificationResult.error, 'invalid_input', startTime)
    }

    const intentClassification = classificationResult.data
    this.emitEvent({ type: 'intent_classified', data: intentClassification })

    const workflowId = getWorkflowForIntent(intentClassification.primary)
    const workflow = WORKFLOW_DEFINITIONS[workflowId]
    this.emitEvent({ type: 'workflow_selected', data: workflow })

    const modelSelectionResult = this.selectModelForTask(request.query, request.constraints)
    if (!modelSelectionResult.success) {
      return this.createErrorResult(modelSelectionResult.error, 'no_personas', startTime)
    }

    const modelSelection = modelSelectionResult.data
    this.emitEvent({ type: 'model_selected', data: modelSelection })

    const analyses = await this.executeSteps(workflow.steps, request, modelSelection)
    const successfulAnalyses = analyses.filter((a): a is PersonaAnalysis => a !== null)

    if (successfulAnalyses.length === 0) {
      return {
        success: false,
        error: {
          code: 'all_failed',
          message: 'All persona analyses failed',
          partialResults: [],
        },
        metadata: {
          workflowId: workflow.id,
          intentClassification,
          modelSelection,
          timestamp: new Date(),
        },
      }
    }

    const synthesized = synthesizeResponses(successfulAnalyses, intentClassification)
    this.emitEvent({ type: 'synthesis_completed', data: synthesized })

    return {
      success: true,
      response: {
        ...synthesized,
        processingTimeMs: Date.now() - startTime,
      },
      metadata: {
        workflowId: workflow.id,
        intentClassification,
        modelSelection,
        timestamp: new Date(),
      },
    }
  }

  private selectModelForTask(
    query: string,
    constraints?: OrchestratorRequest['constraints']
  ): Result<SelectionResult> {
    const task = classifyTask(query)
    const complexity = analyzeComplexity(query)

    const selectionResult = selectModel(task, complexity, {
      maxCost: constraints?.maxCost,
      maxLatencyMs: constraints?.maxLatencyMs,
    })

    if (!selectionResult.success) {
      return { success: false, error: new Error(selectionResult.error.message) }
    }

    return { success: true, data: selectionResult.data }
  }

  private async executeSteps(
    steps: readonly WorkflowStep[],
    request: OrchestratorRequest,
    _modelSelection: SelectionResult
  ): Promise<(PersonaAnalysis | null)[]> {
    const results = new Map<string, PersonaAnalysis | null>()
    const stepsByDependencies = this.groupStepsByDependencyLevel(steps)

    for (const level of stepsByDependencies) {
      const parallelSteps = level.filter((s) => s.parallel)
      const sequentialSteps = level.filter((s) => !s.parallel)

      const parallelResults = await Promise.all(
        parallelSteps.map((step) => this.executeStep(step, request, results))
      )
      parallelSteps.forEach((step, i) => results.set(step.id, parallelResults[i]))

      for (const step of sequentialSteps) {
        const result = await this.executeStep(step, request, results)
        results.set(step.id, result)
      }
    }

    return Array.from(results.values())
  }

  private groupStepsByDependencyLevel(steps: readonly WorkflowStep[]): WorkflowStep[][] {
    const levels: WorkflowStep[][] = []
    const processed = new Set<string>()
    const remaining = [...steps]

    while (remaining.length > 0) {
      const level = remaining.filter((step) => step.dependencies.every((dep) => processed.has(dep)))

      if (level.length === 0) {
        level.push(remaining[0])
      }

      levels.push(level)
      level.forEach((step) => {
        processed.add(step.id)
        const idx = remaining.indexOf(step)
        if (idx >= 0) remaining.splice(idx, 1)
      })
    }

    return levels
  }

  private async executeStep(
    step: WorkflowStep,
    request: OrchestratorRequest,
    _previousResults: Map<string, PersonaAnalysis | null>
  ): Promise<PersonaAnalysis | null> {
    this.emitEvent({ type: 'persona_started', data: { persona: step.persona, stepId: step.id } })

    const startTime = Date.now()

    try {
      const persona = getPersona(step.persona)
      if (!persona) {
        this.emitEvent({
          type: 'persona_failed',
          data: { persona: step.persona, error: new Error('Persona not found') },
        })
        return step.optional ? null : null
      }

      const promptResult = persona.buildPrompt({
        query: request.query,
        financialData: request.context.financialData,
        conversationHistory: request.context.conversationHistory.map((turn) => ({
          role: turn.role,
          content: turn.content,
          timestamp: turn.timestamp,
        })),
        language: request.context.language,
      })

      if (!promptResult.success) {
        this.emitEvent({
          type: 'persona_failed',
          data: { persona: step.persona, error: new Error(promptResult.error.message) },
        })
        return step.optional ? null : null
      }

      const aiService = getAIService()
      const aiProvider = await aiService.getProvider()

      if (!aiProvider) {
        this.emitEvent({
          type: 'persona_failed',
          data: { persona: step.persona, error: new Error('AI provider not available') },
        })
        return step.optional ? null : null
      }

      const response = await aiProvider.generate({
        messages: [
          { role: 'system', content: promptResult.data.systemPrompt },
          { role: 'user', content: promptResult.data.userPrompt },
        ],
        temperature: persona.temperature,
        maxTokens: 4096,
        timeout: this.timeoutMs,
      })

      const parsedResponse = this.parseResponse(response.content, step.persona)

      const analysis: PersonaAnalysis = {
        persona: step.persona,
        response: {
          ...parsedResponse,
          persona: step.persona,
          metadata: {
            modelUsed: response.model,
            tokensUsed: response.usage?.totalTokens ?? 0,
            processingTimeMs: Date.now() - startTime,
            templateVersion: '1.0.0',
          },
        },
        executionTimeMs: Date.now() - startTime,
        modelUsed: response.model,
        tokensUsed: response.usage?.totalTokens ?? 0,
      }

      this.emitEvent({ type: 'persona_completed', data: analysis })
      return analysis
    } catch (error) {
      this.emitEvent({
        type: 'persona_failed',
        data: {
          persona: step.persona,
          error: error instanceof Error ? error : new Error('Unknown error'),
        },
      })
      return step.optional ? null : null
    }
  }

  private parseResponse(
    content: string,
    _persona: string
  ): Omit<PersonaResponse, 'persona' | 'metadata'> {
    try {
      const parsed = JSON.parse(content)
      return {
        conclusion: parsed.conclusion || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      }
    } catch {
      return {
        conclusion: content.slice(0, 500),
        confidence: 0.5,
        reasoning: [
          {
            point: 'Raw response',
            analysis: content.slice(0, 1000),
            evidence: '',
            confidence: 0.5,
          },
        ],
        risks: [],
      }
    }
  }

  private createErrorResult(
    error: Error,
    code: OrchestratorErrorCode,
    _startTime: number
  ): OrchestratorResult {
    return {
      success: false,
      error: {
        code,
        message: error.message,
      },
      metadata: {
        workflowId: 'error',
        intentClassification: {
          primary: 'general_inquiry',
          confidence: 0,
          secondary: [],
          keywords: [],
        },
        modelSelection: {} as SelectionResult,
        timestamp: new Date(),
      },
    }
  }

  private emitEvent(event: OrchestratorEvent): void {
    this.eventHandler?.(event)
  }
}

export function createOrchestrator(options?: OrchestratorOptions): AIOrchestrator {
  return new AIOrchestrator(options)
}

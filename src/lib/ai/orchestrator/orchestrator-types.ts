import type { PersonaType, PersonaResponse } from '@/lib/ai/personas/types'
import type { SelectionResult } from './types'

export type IntentType =
  | 'financial_analysis'
  | 'tax_inquiry'
  | 'strategic_planning'
  | 'compliance_check'
  | 'ratio_analysis'
  | 'cashflow_analysis'
  | 'budget_inquiry'
  | 'forecast_request'
  | 'general_inquiry'

export interface IntentClassification {
  readonly primary: IntentType
  readonly confidence: number
  readonly secondary: readonly IntentType[]
  readonly keywords: readonly string[]
}

export interface WorkflowStep {
  readonly id: string
  readonly persona: PersonaType
  readonly task: string
  readonly dependencies: readonly string[]
  readonly parallel: boolean
  readonly optional: boolean
}

export interface WorkflowDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly steps: readonly WorkflowStep[]
  readonly version: string
}

export interface OrchestratorContext {
  readonly sessionId: string
  readonly userId: string
  readonly companyId?: string
  readonly language: 'ja' | 'en'
  readonly conversationHistory: readonly ConversationTurn[]
  readonly financialData?: Record<string, unknown>
}

export interface ConversationTurn {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly timestamp: Date
  readonly personaUsed?: PersonaType
}

export interface OrchestratorRequest {
  readonly query: string
  readonly context: OrchestratorContext
  readonly constraints?: {
    readonly maxCost?: number
    readonly maxLatencyMs?: number
    readonly preferredPersonas?: readonly PersonaType[]
    readonly enableReproducibility?: boolean
    readonly seed?: number
    readonly temperature?: number
  }
}

export interface PersonaAnalysis {
  readonly persona: PersonaType
  readonly response: PersonaResponse
  readonly executionTimeMs: number
  readonly modelUsed: string
  readonly tokensUsed: number
}

export interface SynthesizedResponse {
  readonly summary: string
  readonly personaAnalyses: readonly PersonaAnalysis[]
  readonly consensusPoints: readonly string[]
  readonly divergentViews: readonly DivergentView[]
  readonly recommendedAction: string
  readonly confidence: number
  readonly processingTimeMs: number
  readonly totalCost: number
}

export interface DivergentView {
  readonly topic: string
  readonly perspectives: readonly {
    readonly persona: PersonaType
    readonly viewpoint: string
  }[]
}

export interface OrchestratorResult {
  readonly success: boolean
  readonly response?: SynthesizedResponse
  readonly error?: {
    readonly code: 'no_personas' | 'all_failed' | 'timeout' | 'invalid_input'
    readonly message: string
    readonly partialResults?: readonly PersonaAnalysis[]
  }
  readonly metadata: {
    readonly workflowId: string
    readonly intentClassification: IntentClassification
    readonly modelSelection: SelectionResult
    readonly timestamp: Date
  }
}

export type OrchestratorEvent =
  | { type: 'intent_classified'; data: IntentClassification }
  | { type: 'workflow_selected'; data: WorkflowDefinition }
  | { type: 'model_selected'; data: SelectionResult }
  | { type: 'persona_started'; data: { persona: PersonaType; stepId: string } }
  | { type: 'persona_completed'; data: PersonaAnalysis }
  | { type: 'persona_failed'; data: { persona: PersonaType; error: Error } }
  | { type: 'synthesis_completed'; data: SynthesizedResponse }
  | { type: 'orchestration_completed'; data: OrchestratorResult }

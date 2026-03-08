import type { AIProviderType } from '@/lib/integrations/ai/provider'

export type TaskCategory =
  | 'complex_reasoning'
  | 'detailed_analysis'
  | 'standard_analysis'
  | 'fast_response'
  | 'embedding'

export interface TaskMetadata {
  readonly category: TaskCategory
  readonly estimatedInputTokens: number
  readonly estimatedOutputTokens: number
  readonly requiresJson: boolean
  readonly requiresVision: boolean
  readonly maxLatencyMs: number
  readonly costBudget?: number
}

export interface ComplexityFactors {
  readonly reasoningDepth: number
  readonly domainKnowledge: number
  readonly dataVolume: number
  readonly outputStructure: number
  readonly riskLevel: number
}

export interface ComplexityScore {
  readonly overall: number
  readonly factors: ComplexityFactors
  readonly confidence: number
}

export interface ModelCapabilities {
  readonly vision: boolean
  readonly tools: boolean
  readonly json: boolean
  readonly streaming: boolean
  readonly maxContextLength: number
  readonly maxOutputTokens: number
}

export interface ModelPricing {
  readonly inputPerMillion: number
  readonly outputPerMillion: number
}

export interface ModelOption {
  readonly provider: AIProviderType
  readonly modelId: string
  readonly displayName: string
  readonly capabilities: ModelCapabilities
  readonly pricing: ModelPricing
  readonly avgLatencyMs: number
  readonly reliability: number
}

export interface SelectionConstraints {
  readonly maxCost?: number
  readonly maxLatencyMs?: number
  readonly requireVision?: boolean
  readonly requireJson?: boolean
  readonly preferredProvider?: AIProviderType
  readonly excludeModels?: readonly string[]
}

export interface SelectionResult {
  readonly model: ModelOption
  readonly reason: string
  readonly estimatedCost: number
  readonly estimatedLatencyMs: number
  readonly fallbackChain: readonly ModelOption[]
  readonly selectionScore: number
}

export interface SelectionError {
  readonly code: 'no_models_available' | 'constraints_too_strict' | 'invalid_input'
  readonly message: string
  readonly availableModels: readonly ModelOption[]
}

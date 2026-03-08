import type { PersonaType } from '@/lib/ai/personas/types'
import type { IntentType } from '@/lib/ai/orchestrator/orchestrator-types'

export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system'
  readonly content: string
  readonly persona?: PersonaType
  readonly timestamp?: Date
}

export interface ChatRequest {
  readonly message: string
  readonly sessionId?: string
  readonly context?: {
    readonly companyId?: string
    readonly financialData?: Record<string, unknown>
    readonly language?: 'ja' | 'en'
  }
  readonly options?: {
    readonly maxCost?: number
    readonly maxLatencyMs?: number
    readonly preferredPersonas?: readonly PersonaType[]
    readonly stream?: boolean
  }
}

export interface ChatResponse {
  readonly success: boolean
  readonly sessionId: string
  readonly response?: {
    readonly summary: string
    readonly personaAnalyses: readonly PersonaAnalysisResponse[]
    readonly consensusPoints: readonly string[]
    readonly recommendedAction: string
    readonly confidence: number
  }
  readonly metadata?: {
    readonly intent: IntentType
    readonly intentConfidence: number
    readonly processingTimeMs: number
    readonly totalCost: number
    readonly modelUsed: string
  }
  readonly error?: {
    readonly code: string
    readonly message: string
  }
}

export interface PersonaAnalysisResponse {
  readonly persona: PersonaType
  readonly personaName: string
  readonly conclusion: string
  readonly confidence: number
  readonly reasoning: readonly {
    point: string
    analysis: string
    confidence: number
  }[]
  readonly risks: readonly {
    category: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }[]
}

export interface StreamChunk {
  readonly type:
    | 'intent'
    | 'persona_start'
    | 'persona_chunk'
    | 'persona_complete'
    | 'synthesis'
    | 'done'
    | 'error'
  readonly data: unknown
}

export interface RateLimitInfo {
  readonly limit: number
  readonly remaining: number
  readonly resetAt: Date
}

export type ChatResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

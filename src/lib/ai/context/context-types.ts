import type { PersonaType } from '@/lib/ai/personas/types'

export interface SessionConfig {
  readonly maxMessages: number
  readonly maxTokens: number
  readonly ttlMs: number
  readonly compressionThreshold: number
}

export interface MessageRole {
  readonly type: 'user' | 'assistant' | 'system'
  readonly persona?: PersonaType
}

export interface ContextMessage {
  readonly id: string
  readonly role: MessageRole['type']
  readonly content: string
  readonly timestamp: Date
  readonly tokenCount: number
  readonly persona?: PersonaType
  readonly metadata?: Record<string, unknown>
}

export interface TrackedEntity {
  readonly id: string
  readonly type: 'company' | 'period' | 'account' | 'amount' | 'ratio' | 'concept'
  readonly name: string
  readonly value?: string | number
  readonly firstMentioned: Date
  readonly lastMentioned: Date
  readonly mentionCount: number
}

export interface SessionSummary {
  readonly mainTopic: string
  readonly keyEntities: readonly string[]
  readonly sentiment: 'positive' | 'neutral' | 'negative'
  readonly topicCategories: readonly string[]
}

export interface Session {
  readonly id: string
  readonly userId: string
  readonly companyId?: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly messages: readonly ContextMessage[]
  readonly entities: readonly TrackedEntity[]
  readonly summary?: SessionSummary
  readonly tokenCount: number
  readonly config: SessionConfig
}

export interface ContextManagerOptions {
  readonly defaultConfig?: Partial<SessionConfig>
  readonly storageAdapter?: StorageAdapter
}

export interface StorageAdapter {
  get(sessionId: string): Promise<Session | null>
  set(sessionId: string, session: Session): Promise<void>
  delete(sessionId: string): Promise<void>
}

export interface AddMessageOptions {
  readonly persona?: PersonaType
  readonly metadata?: Record<string, unknown>
}

export interface ContextFitResult {
  readonly fits: boolean
  readonly messagesToFit: number
  readonly tokensToTrim: number
  readonly suggestedCompression: boolean
}

export interface CompressionResult {
  readonly originalTokenCount: number
  readonly compressedTokenCount: number
  readonly compressionRatio: number
  readonly summary?: string
}

export type ContextResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  maxMessages: 50,
  maxTokens: 8000,
  ttlMs: 24 * 60 * 60 * 1000,
  compressionThreshold: 0.8,
}

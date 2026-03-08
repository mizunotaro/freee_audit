export type {
  SessionConfig,
  MessageRole,
  ContextMessage,
  TrackedEntity,
  SessionSummary,
  Session,
  ContextManagerOptions,
  StorageAdapter,
  AddMessageOptions,
  ContextFitResult,
  CompressionResult,
  ContextResult,
} from './context-types'

export { DEFAULT_SESSION_CONFIG } from './context-types'

export { ContextManager, createContextManager } from './context-manager'

export {
  countTokens,
  countMessagesTokens,
  estimateTokenCost,
  fitTextToTokenLimit,
  estimateContextWindow,
} from './token-counter'

export type { TokenCountResult, CostEstimate } from './token-counter'

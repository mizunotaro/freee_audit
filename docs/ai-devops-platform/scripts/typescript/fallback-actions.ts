/**
 * Fallback Action Handlers for AI-DevOps-Platform
 * Provides recovery strategies for different error types
 *
 * @see docs/ai/QUALITY_STANDARDS.md - Quality Gate 1: Stability, Gate 2: Robustness
 */

import { Result, AppError, ErrorCodes, createError } from './result'
import { retry, retryWithResult, RetryConfig } from './retry'

export type ErrorClassification = 'retryable' | 'recoverable' | 'fatal'

export interface FallbackAction {
  type: 'retry' | 'use-default' | 'skip' | 'abort' | 'notify' | 'log-and-continue'
  config?: Record<string, unknown>
  execute?: () => Promise<unknown>
}

export interface FallbackStrategy {
  classify: (error: AppError) => ErrorClassification
  getAction: (error: AppError, attempt: number) => FallbackAction
  maxRetries: number
  notifyOnFatal?: (error: AppError, context: Record<string, unknown>) => Promise<void>
}

export const DEFAULT_FALLBACK_STRATEGY: FallbackStrategy = {
  classify(error: AppError): ErrorClassification {
    const retryableCodes = [
      ErrorCodes.NETWORK_ERROR,
      ErrorCodes.TIMEOUT_ERROR,
      ErrorCodes.RATE_LIMIT_ERROR,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
    ]

    if (retryableCodes.includes(error.code as any)) {
      return 'retryable'
    }

    const recoverableCodes = [ErrorCodes.RESOURCE_NOT_FOUND, ErrorCodes.VALIDATION_ERROR]

    if (recoverableCodes.includes(error.code as any)) {
      return 'recoverable'
    }

    return 'fatal'
  },

  getAction(error: AppError, attempt: number): FallbackAction {
    const classification = this.classify(error)

    switch (classification) {
      case 'retryable':
        if (attempt < this.maxRetries) {
          return { type: 'retry', config: { attempt } }
        }
        return { type: 'notify' }

      case 'recoverable':
        if (error.code === ErrorCodes.RESOURCE_NOT_FOUND) {
          return { type: 'use-default', config: { defaultValue: null } }
        }
        if (error.code === ErrorCodes.VALIDATION_ERROR) {
          return { type: 'skip' }
        }
        return { type: 'log-and-continue' }

      case 'fatal':
      default:
        return { type: 'abort' }
    }
  },

  maxRetries: 3,
}

export class FallbackHandler {
  private strategies: Map<string, FallbackStrategy> = new Map()
  private defaultStrategy: FallbackStrategy

  constructor(defaultStrategy: FallbackStrategy = DEFAULT_FALLBACK_STRATEGY) {
    this.defaultStrategy = defaultStrategy
    this.registerBuiltInStrategies()
  }

  private registerBuiltInStrategies(): void {
    this.registerStrategy('quality-gate', {
      classify(error: AppError): ErrorClassification {
        if (error.code === ErrorCodes.LINT_FAILED || error.code === ErrorCodes.TYPE_CHECK_FAILED) {
          return 'recoverable'
        }
        if (error.code === ErrorCodes.TEST_FAILED) {
          return 'retryable'
        }
        if (error.code === ErrorCodes.BUILD_FAILED) {
          return 'recoverable'
        }
        return 'fatal'
      },

      getAction(error: AppError, attempt: number): FallbackAction {
        const classification = this.classify(error)

        if (classification === 'retryable' && attempt < this.maxRetries) {
          return { type: 'retry', config: { attempt } }
        }

        if (classification === 'recoverable') {
          if (
            error.code === ErrorCodes.LINT_FAILED ||
            error.code === ErrorCodes.TYPE_CHECK_FAILED
          ) {
            return { type: 'notify', config: { reason: 'Auto-fixable errors detected' } }
          }
          if (error.code === ErrorCodes.BUILD_FAILED) {
            return {
              type: 'abort',
              config: { reason: 'Build failure requires manual intervention' },
            }
          }
        }

        return { type: 'abort' }
      },

      maxRetries: 3,
    })

    this.registerStrategy('llm-call', {
      classify(error: AppError): ErrorClassification {
        if (error.code === ErrorCodes.RATE_LIMIT_ERROR) {
          return 'retryable'
        }
        if (error.code === ErrorCodes.TIMEOUT_ERROR || error.code === ErrorCodes.NETWORK_ERROR) {
          return 'retryable'
        }
        if (error.code === ErrorCodes.VALIDATION_ERROR) {
          return 'recoverable'
        }
        return 'fatal'
      },

      getAction(error: AppError, attempt: number): FallbackAction {
        const classification = this.classify(error)

        if (classification === 'retryable') {
          if (error.code === ErrorCodes.RATE_LIMIT_ERROR) {
            const retryAfter = error.details?.retryAfter as number | undefined
            return {
              type: 'retry',
              config: { attempt, delayMs: retryAfter || 60000 },
            }
          }
          if (attempt < this.maxRetries) {
            return { type: 'retry', config: { attempt } }
          }
        }

        if (classification === 'recoverable') {
          return { type: 'use-default', config: { defaultValue: '' } }
        }

        return { type: 'abort' }
      },

      maxRetries: 3,
    })

    this.registerStrategy('github-api', {
      classify(error: AppError): ErrorClassification {
        if (error.code === ErrorCodes.RATE_LIMIT_ERROR) {
          return 'retryable'
        }
        if (error.code === ErrorCodes.NETWORK_ERROR || error.code === ErrorCodes.TIMEOUT_ERROR) {
          return 'retryable'
        }
        if (error.code === ErrorCodes.RESOURCE_NOT_FOUND) {
          return 'recoverable'
        }
        if (
          error.code === ErrorCodes.AUTHENTICATION_ERROR ||
          error.code === ErrorCodes.AUTHORIZATION_ERROR
        ) {
          return 'fatal'
        }
        return 'retryable'
      },

      getAction(error: AppError, attempt: number): FallbackAction {
        const classification = this.classify(error)

        if (classification === 'retryable' && attempt < this.maxRetries) {
          return { type: 'retry', config: { attempt } }
        }

        if (classification === 'recoverable') {
          if (error.code === ErrorCodes.RESOURCE_NOT_FOUND) {
            return { type: 'skip', config: { reason: 'Resource not found' } }
          }
        }

        return { type: 'abort' }
      },

      maxRetries: 5,
    })
  }

  registerStrategy(name: string, strategy: FallbackStrategy): void {
    this.strategies.set(name, strategy)
  }

  getStrategy(name: string): FallbackStrategy {
    return this.strategies.get(name) || this.defaultStrategy
  }

  async executeWithFallback<T>(
    fn: () => Promise<Result<T, AppError>>,
    strategyName: string,
    context: Record<string, unknown> = {}
  ): Promise<Result<T, AppError>> {
    const strategy = this.getStrategy(strategyName)
    let attempt = 0

    while (true) {
      attempt++

      const result = await fn()

      if (result.success) {
        return result
      }

      const action = strategy.getAction(result.error, attempt)

      switch (action.type) {
        case 'retry':
          const delayMs = (action.config?.delayMs as number) || 1000 * Math.pow(2, attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue

        case 'use-default':
          return Result.ok(action.config?.defaultValue as T)

        case 'skip':
          console.log(`Skipping due to: ${action.config?.reason || result.error.message}`)
          return Result.ok(null as T)

        case 'log-and-continue':
          console.error(`Error logged, continuing: ${result.error.message}`)
          return Result.ok(null as T)

        case 'notify':
          if (strategy.notifyOnFatal) {
            await strategy.notifyOnFatal(result.error, context)
          }
          return result

        case 'abort':
        default:
          if (strategy.notifyOnFatal) {
            await strategy.notifyOnFatal(result.error, context)
          }
          return result
      }
    }
  }
}

export const fallbackHandler = new FallbackHandler()

export interface QualityGateFallbackConfig {
  maxAutoFixAttempts: number
  autoFixCommands: Record<string, string[]>
  notifyOnFailure: boolean
}

export const DEFAULT_QUALITY_GATE_CONFIG: QualityGateFallbackConfig = {
  maxAutoFixAttempts: 3,
  autoFixCommands: {
    [ErrorCodes.LINT_FAILED]: ['pnpm eslint --fix src/', 'pnpm prettier --write src/'],
    [ErrorCodes.TYPE_CHECK_FAILED]: [],
    [ErrorCodes.TEST_FAILED]: [],
    [ErrorCodes.BUILD_FAILED]: [],
  },
  notifyOnFailure: true,
}

export async function handleQualityGateFailure(
  error: AppError,
  attempt: number,
  config: QualityGateFallbackConfig = DEFAULT_QUALITY_GATE_CONFIG
): Promise<FallbackAction> {
  if (attempt >= config.maxAutoFixAttempts) {
    return { type: 'abort', config: { reason: 'Max auto-fix attempts reached' } }
  }

  const fixCommands = config.autoFixCommands[error.code]

  if (fixCommands && fixCommands.length > 0) {
    return {
      type: 'retry',
      config: {
        attempt,
        preCommands: fixCommands,
      },
    }
  }

  if (error.code === ErrorCodes.TYPE_CHECK_FAILED) {
    return {
      type: 'notify',
      config: {
        reason: 'Type errors require manual fix or LLM intervention',
        attempt,
      },
    }
  }

  if (error.code === ErrorCodes.TEST_FAILED) {
    return {
      type: 'notify',
      config: {
        reason: 'Test failures require investigation',
        attempt,
      },
    }
  }

  return { type: 'abort' }
}

export interface LLMFallbackConfig {
  primaryModel: string
  fallbackModels: string[]
  maxTokens: number
  temperature: number
}

export const DEFAULT_LLM_FALLBACK_CONFIG: LLMFallbackConfig = {
  primaryModel: 'glm-5',
  fallbackModels: ['glm-4.6', 'gpt-4o-mini'],
  maxTokens: 4096,
  temperature: 0.0,
}

export async function executeWithLLMFallback<T>(
  callLLM: (model: string) => Promise<Result<T, AppError>>,
  config: LLMFallbackConfig = DEFAULT_LLM_FALLBACK_CONFIG
): Promise<Result<T, AppError>> {
  const models = [config.primaryModel, ...config.fallbackModels]

  for (const model of models) {
    const result = await callLLM(model)

    if (result.success) {
      return result
    }

    if (result.error.code === ErrorCodes.VALIDATION_ERROR) {
      return result
    }

    console.warn(`LLM ${model} failed, trying next model: ${result.error.message}`)
  }

  return Result.err(
    createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'All LLM providers failed', {
      attemptedModels: models,
    })
  )
}

import type { AIProviderType } from '@/lib/integrations/ai/provider'
import type {
  TaskMetadata,
  ComplexityScore,
  ModelOption,
  SelectionConstraints,
  SelectionResult,
  SelectionError,
} from './types'
import { MODEL_REGISTRY } from '@/lib/ai/config/defaults'

type Result<T> = { success: true; data: T } | { success: false; error: SelectionError }

const PRIORITY_MATRIX: Record<string, readonly AIProviderType[]> = {
  complex_reasoning: ['claude', 'openai', 'gemini', 'deepseek', 'qwen'],
  detailed_analysis: ['claude', 'openai', 'gemini', 'deepseek', 'qwen'],
  standard_analysis: ['openai', 'gemini', 'claude', 'deepseek', 'qwen'],
  fast_response: ['openai', 'gemini', 'groq', 'deepseek'],
  embedding: ['openai'],
}

const MODEL_PRIORITY: Record<string, Record<AIProviderType, readonly string[]>> = {
  complex_reasoning: {
    claude: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
    openai: ['gpt-4.1', 'gpt-4.1-mini'],
    gemini: ['gemini-1.5-pro', 'gemini-2.0-flash'],
    openrouter: ['anthropic/claude-sonnet-4'],
    deepseek: ['deepseek-reasoner', 'deepseek-chat'],
    kimi: ['moonshot-v1-128k', 'moonshot-v1-32k'],
    qwen: ['qwen-max', 'qwen-plus'],
    groq: ['llama-3.3-70b-versatile'],
    azure: ['gpt-4o', 'gpt-4o-mini'],
    aws: ['anthropic.claude-3-sonnet', 'anthropic.claude-3-haiku'],
    gcp: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    freee: [],
    custom: [],
  },
  detailed_analysis: {
    claude: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
    openai: ['gpt-4.1', 'gpt-4.1-mini'],
    gemini: ['gemini-1.5-pro', 'gemini-2.0-flash'],
    openrouter: ['anthropic/claude-sonnet-4'],
    deepseek: ['deepseek-chat'],
    kimi: ['moonshot-v1-32k', 'moonshot-v1-8k'],
    qwen: ['qwen-plus', 'qwen-turbo'],
    groq: ['llama-3.3-70b-versatile'],
    azure: ['gpt-4o', 'gpt-4o-mini'],
    aws: ['anthropic.claude-3-sonnet'],
    gcp: ['gemini-1.5-pro'],
    freee: [],
    custom: [],
  },
  standard_analysis: {
    openai: ['gpt-4.1-mini', 'gpt-5-nano'],
    gemini: ['gemini-2.0-flash', 'gemini-1.5-flash'],
    claude: ['claude-3-5-haiku-20241022'],
    openrouter: ['openai/gpt-5-nano'],
    deepseek: ['deepseek-chat'],
    kimi: ['moonshot-v1-8k'],
    qwen: ['qwen-turbo'],
    groq: ['llama-3.1-8b-instant'],
    azure: ['gpt-4o-mini'],
    aws: ['anthropic.claude-3-haiku'],
    gcp: ['gemini-1.5-flash'],
    freee: [],
    custom: [],
  },
  fast_response: {
    openai: ['gpt-5-nano', 'gpt-4o-mini'],
    gemini: ['gemini-2.0-flash', 'gemini-1.5-flash'],
    claude: [],
    openrouter: ['openai/gpt-5-nano'],
    deepseek: ['deepseek-chat'],
    kimi: ['moonshot-v1-8k'],
    qwen: ['qwen-turbo'],
    groq: ['llama-3.1-8b-instant'],
    azure: ['gpt-4o-mini'],
    aws: [],
    gcp: ['gemini-1.5-flash'],
    freee: [],
    custom: [],
  },
  embedding: {
    openai: ['text-embedding-3-small'],
    gemini: [],
    claude: [],
    openrouter: [],
    deepseek: [],
    kimi: [],
    qwen: [],
    groq: [],
    azure: ['text-embedding-3-small'],
    aws: [],
    gcp: [],
    freee: [],
    custom: [],
  },
}

export function selectModel(
  task: TaskMetadata,
  complexity: ComplexityScore,
  constraints: SelectionConstraints = {}
): Result<SelectionResult> {
  const sanitizedConstraints = sanitizeConstraints(constraints)
  const availableModels = getAvailableModels(sanitizedConstraints)

  if (availableModels.length === 0) {
    return {
      success: false,
      error: {
        code: 'no_models_available',
        message: 'No models available matching constraints',
        availableModels: [],
      },
    }
  }

  const scoredModels = scoreModels(availableModels, task, complexity, sanitizedConstraints)

  if (scoredModels.length === 0) {
    return {
      success: false,
      error: {
        code: 'constraints_too_strict',
        message: 'Constraints too restrictive',
        availableModels,
      },
    }
  }

  const [primary, ...fallbacks] = scoredModels

  return {
    success: true,
    data: {
      model: primary.model,
      reason: primary.reason,
      estimatedCost: primary.estimatedCost,
      estimatedLatencyMs: primary.estimatedLatencyMs,
      fallbackChain: fallbacks.map((s) => s.model),
      selectionScore: primary.score,
    },
  }
}

function sanitizeConstraints(constraints: SelectionConstraints): SelectionConstraints {
  return {
    maxCost:
      constraints.maxCost !== undefined && Number.isFinite(constraints.maxCost)
        ? Math.max(0, constraints.maxCost)
        : undefined,
    maxLatencyMs:
      constraints.maxLatencyMs !== undefined && Number.isFinite(constraints.maxLatencyMs)
        ? Math.max(0, constraints.maxLatencyMs)
        : undefined,
    requireVision: constraints.requireVision ?? false,
    requireJson: constraints.requireJson ?? false,
    preferredProvider: constraints.preferredProvider,
    excludeModels: constraints.excludeModels ?? [],
  }
}

function getAvailableModels(constraints: SelectionConstraints): ModelOption[] {
  const models: ModelOption[] = []

  for (const modelConfig of MODEL_REGISTRY) {
    if (constraints.excludeModels?.includes(modelConfig.modelId)) {
      continue
    }

    if (constraints.preferredProvider && modelConfig.provider !== constraints.preferredProvider) {
      continue
    }

    models.push({
      provider: modelConfig.provider,
      modelId: modelConfig.modelId,
      displayName: modelConfig.displayName,
      capabilities: {
        vision: modelConfig.capabilities.vision,
        tools: modelConfig.capabilities.tools,
        json: modelConfig.capabilities.json,
        streaming: modelConfig.capabilities.streaming,
        maxContextLength: modelConfig.contextLength,
        maxOutputTokens: modelConfig.maxOutputTokens,
      },
      pricing: {
        inputPerMillion: modelConfig.pricing.inputToken,
        outputPerMillion: modelConfig.pricing.outputToken,
      },
      avgLatencyMs: estimateLatency(modelConfig.provider),
      reliability: getReliability(modelConfig.provider),
    })
  }

  return models
}

interface ScoredModel {
  model: ModelOption
  score: number
  reason: string
  estimatedCost: number
  estimatedLatencyMs: number
}

function scoreModels(
  models: ModelOption[],
  task: TaskMetadata,
  complexity: ComplexityScore,
  constraints: SelectionConstraints
): ScoredModel[] {
  const priorityProviders = PRIORITY_MATRIX[task.category] || ['openai', 'claude', 'gemini']
  const modelPriority = MODEL_PRIORITY[task.category]

  return models
    .map((model) => {
      const baseScore = calculateBaseScore(
        model,
        task,
        complexity,
        priorityProviders,
        modelPriority
      )
      const cost = calculateCost(model, task)
      const latency = estimateModelLatency(model, task)

      if (!meetsConstraints(model, cost, latency, constraints, task)) {
        return null
      }

      const finalScore = adjustScoreForConstraints(baseScore, model, cost, latency, constraints)

      return {
        model,
        score: finalScore,
        reason: generateReason(model, task, complexity, finalScore),
        estimatedCost: cost,
        estimatedLatencyMs: latency,
      }
    })
    .filter((m): m is ScoredModel => m !== null)
    .sort((a, b) => b.score - a.score)
}

function calculateBaseScore(
  model: ModelOption,
  task: TaskMetadata,
  complexity: ComplexityScore,
  priorityProviders: readonly AIProviderType[],
  modelPriority: Record<AIProviderType, readonly string[]>
): number {
  let score = 50

  const providerIndex = priorityProviders.indexOf(model.provider)
  if (providerIndex >= 0) {
    score += (priorityProviders.length - providerIndex) * 10
  }

  const modelIndex = modelPriority[model.provider]?.indexOf(model.modelId) ?? -1
  if (modelIndex >= 0) {
    score += (modelPriority[model.provider].length - modelIndex) * 5
  }

  score += model.reliability * 10

  if (complexity.overall > 70) {
    if (model.provider === 'claude' || model.modelId.includes('4.1')) {
      score += 10
    }
  }

  if (task.requiresJson && !model.capabilities.json) {
    score -= 30
  }

  if (task.requiresVision && !model.capabilities.vision) {
    score -= 30
  }

  return Math.max(0, Math.min(100, score))
}

function calculateCost(model: ModelOption, task: TaskMetadata): number {
  const inputCost = (task.estimatedInputTokens / 1_000_000) * model.pricing.inputPerMillion
  const outputCost = (task.estimatedOutputTokens / 1_000_000) * model.pricing.outputPerMillion
  return Math.round((inputCost + outputCost) * 10000) / 10000
}

function estimateModelLatency(model: ModelOption, task: TaskMetadata): number {
  const baseLatency = model.avgLatencyMs
  const tokenFactor = 1 + (task.estimatedInputTokens / 5000) * 0.5
  return Math.round(baseLatency * tokenFactor)
}

function meetsConstraints(
  model: ModelOption,
  cost: number,
  latency: number,
  constraints: SelectionConstraints,
  task: TaskMetadata
): boolean {
  if (constraints.maxCost !== undefined && cost > constraints.maxCost) {
    return false
  }

  if (constraints.maxLatencyMs !== undefined && latency > constraints.maxLatencyMs) {
    return false
  }

  if (constraints.requireVision && !model.capabilities.vision) {
    return false
  }

  if (constraints.requireJson && !model.capabilities.json) {
    return false
  }

  if (task.estimatedOutputTokens > model.capabilities.maxOutputTokens) {
    return false
  }

  return true
}

function adjustScoreForConstraints(
  baseScore: number,
  _model: ModelOption,
  cost: number,
  latency: number,
  constraints: SelectionConstraints
): number {
  let score = baseScore

  if (constraints.maxCost !== undefined) {
    const costRatio = cost / constraints.maxCost
    if (costRatio < 0.5) {
      score += 5
    }
  }

  if (constraints.maxLatencyMs !== undefined) {
    const latencyRatio = latency / constraints.maxLatencyMs
    if (latencyRatio < 0.5) {
      score += 5
    }
  }

  return Math.min(100, score)
}

function generateReason(
  model: ModelOption,
  task: TaskMetadata,
  complexity: ComplexityScore,
  score: number
): string {
  const reasons: string[] = []

  if (score >= 80) {
    reasons.push(`${model.displayName} is optimal for ${task.category} tasks`)
  } else if (score >= 60) {
    reasons.push(`${model.displayName} is suitable for this task`)
  } else {
    reasons.push(`${model.displayName} is available as a fallback`)
  }

  if (complexity.overall > 70) {
    reasons.push('high complexity analysis')
  }

  return reasons.join('; ')
}

function estimateLatency(provider: AIProviderType): number {
  const latencies: Record<AIProviderType, number> = {
    openai: 2000,
    claude: 3000,
    gemini: 2500,
    openrouter: 3500,
    deepseek: 2500,
    kimi: 2000,
    qwen: 2000,
    groq: 500,
    azure: 2000,
    aws: 2500,
    gcp: 2500,
    freee: 3000,
    custom: 3000,
  }
  return latencies[provider]
}

function getReliability(provider: AIProviderType): number {
  const reliability: Record<AIProviderType, number> = {
    openai: 0.99,
    claude: 0.98,
    gemini: 0.97,
    openrouter: 0.95,
    deepseek: 0.96,
    kimi: 0.95,
    qwen: 0.96,
    groq: 0.97,
    azure: 0.99,
    aws: 0.98,
    gcp: 0.98,
    freee: 0.95,
    custom: 0.9,
  }
  return reliability[provider]
}

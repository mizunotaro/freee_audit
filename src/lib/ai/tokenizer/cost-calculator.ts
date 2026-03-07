import { MODEL_REGISTRY } from '../config/defaults'

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
  model: string
  pricingSource: 'registry' | 'fallback'
}

export interface ModelPricingInfo {
  inputTokenCost: number
  outputTokenCost: number
  contextLength: number
}

const FALLBACK_PRICING: ModelPricingInfo = {
  inputTokenCost: 0.5,
  outputTokenCost: 2.0,
  contextLength: 128000,
}

const MODEL_PRICING_PATTERNS: Array<{
  pattern: RegExp
  pricing: ModelPricingInfo
}> = [
  {
    pattern: /^gpt-5-nano/i,
    pricing: { inputTokenCost: 0.1, outputTokenCost: 0.4, contextLength: 1048576 },
  },
  {
    pattern: /^gpt-4\.1-mini/i,
    pricing: { inputTokenCost: 0.4, outputTokenCost: 1.6, contextLength: 1047576 },
  },
  {
    pattern: /^gpt-4\.1$/i,
    pricing: { inputTokenCost: 2.0, outputTokenCost: 8.0, contextLength: 1047576 },
  },
  {
    pattern: /^gpt-4o-mini/i,
    pricing: { inputTokenCost: 0.15, outputTokenCost: 0.6, contextLength: 128000 },
  },
  {
    pattern: /^gpt-4o(-\d{4})?$/i,
    pricing: { inputTokenCost: 2.5, outputTokenCost: 10.0, contextLength: 128000 },
  },
  {
    pattern: /^gpt-4-turbo/i,
    pricing: { inputTokenCost: 10.0, outputTokenCost: 30.0, contextLength: 128000 },
  },
  {
    pattern: /^gpt-4(-\d{4})?$/i,
    pricing: { inputTokenCost: 30.0, outputTokenCost: 60.0, contextLength: 8192 },
  },
  {
    pattern: /^claude-(sonnet-4|3\.5-sonnet)/i,
    pricing: { inputTokenCost: 3.0, outputTokenCost: 15.0, contextLength: 200000 },
  },
  {
    pattern: /^claude-3\.5-haiku/i,
    pricing: { inputTokenCost: 0.8, outputTokenCost: 4.0, contextLength: 200000 },
  },
  {
    pattern: /^claude-3-opus/i,
    pricing: { inputTokenCost: 15.0, outputTokenCost: 75.0, contextLength: 200000 },
  },
  {
    pattern: /^claude-/i,
    pricing: { inputTokenCost: 3.0, outputTokenCost: 15.0, contextLength: 200000 },
  },
  {
    pattern: /^gemini-2\.0-flash/i,
    pricing: { inputTokenCost: 0.1, outputTokenCost: 0.4, contextLength: 1048576 },
  },
  {
    pattern: /^gemini-1\.5-pro/i,
    pricing: { inputTokenCost: 1.25, outputTokenCost: 5.0, contextLength: 2097152 },
  },
  {
    pattern: /^gemini-1\.5-flash/i,
    pricing: { inputTokenCost: 0.075, outputTokenCost: 0.3, contextLength: 1048576 },
  },
  {
    pattern: /^gemini-/i,
    pricing: { inputTokenCost: 0.1, outputTokenCost: 0.4, contextLength: 1048576 },
  },
]

export function getModelPricing(model: string): ModelPricingInfo {
  const normalizedModel = normalizeModelId(model)

  const registryMatch = MODEL_REGISTRY.find(
    (m) => m.modelId.toLowerCase() === normalizedModel.toLowerCase()
  )

  if (registryMatch) {
    return {
      inputTokenCost: registryMatch.pricing.inputToken,
      outputTokenCost: registryMatch.pricing.outputToken,
      contextLength: registryMatch.contextLength,
    }
  }

  for (const { pattern, pricing } of MODEL_PRICING_PATTERNS) {
    if (pattern.test(normalizedModel)) {
      return pricing
    }
  }

  return FALLBACK_PRICING
}

function normalizeModelId(model: string): string {
  let normalized = model.trim()

  const openrouterPrefix = 'openrouter/'
  if (normalized.toLowerCase().startsWith(openrouterPrefix)) {
    normalized = normalized.slice(openrouterPrefix.length)
  }

  return normalized
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): CostEstimate {
  const pricing = getModelPricing(model)
  const pricingSource = pricing === FALLBACK_PRICING ? 'fallback' : 'registry'

  const inputCost = (inputTokens / 1_000_000) * pricing.inputTokenCost
  const outputCost = (outputTokens / 1_000_000) * pricing.outputTokenCost
  const totalCost = inputCost + outputCost

  return {
    inputTokens,
    outputTokens,
    inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
    outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
    model,
    pricingSource,
  }
}

export function getModelContextLength(model: string): number {
  const pricing = getModelPricing(model)
  return pricing.contextLength
}

export function estimateOutputTokens(inputTokens: number, maxOutputRatio: number = 0.5): number {
  return Math.min(Math.ceil(inputTokens * maxOutputRatio), 4096)
}

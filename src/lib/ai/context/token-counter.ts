import { tokenizerService } from '@/lib/ai/tokenizer/tokenizer'

export interface TokenCountResult {
  tokens: number
  encoding: string
  truncated: boolean
}

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  model: string
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5-nano': { input: 0.1, output: 0.4 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
}

const DEFAULT_MODEL = 'gpt-5-nano'
const CHARS_PER_TOKEN_JA = 2.5
const CHARS_PER_TOKEN_EN = 4

export function countTokens(text: string, model?: string): number {
  if (!text || typeof text !== 'string') return 0

  const sanitized = sanitizeText(text)

  try {
    const result = tokenizerService.countTokens(sanitized, { model })
    return result.tokens
  } catch {
    return estimateTokensFallback(sanitized)
  }
}

export function countMessagesTokens(
  messages: readonly { role: string; content: string }[]
): number {
  let total = 0

  for (const message of messages) {
    total += countTokens(message.role)
    total += countTokens(message.content)
    total += 4
  }

  total += 2
  return total
}

export function estimateTokenCost(
  inputTokens: number,
  outputTokens: number,
  model: string = DEFAULT_MODEL
): CostEstimate {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL]

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  const totalCost = inputCost + outputCost

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: Math.round(totalCost * 10000) / 10000,
    model,
  }
}

export function fitTextToTokenLimit(
  text: string,
  maxTokens: number,
  model?: string
): { text: string; tokens: number; truncated: boolean } {
  if (!text || typeof text !== 'string') {
    return { text: '', tokens: 0, truncated: false }
  }

  const sanitized = sanitizeText(text)
  const currentTokens = countTokens(sanitized, model)

  if (currentTokens <= maxTokens) {
    return { text: sanitized, tokens: currentTokens, truncated: false }
  }

  try {
    const truncated = tokenizerService.truncateToLimit(sanitized, maxTokens, model)
    const newTokens = countTokens(truncated, model)
    return { text: truncated, tokens: newTokens, truncated: true }
  } catch {
    const ratio = CHARS_PER_TOKEN_JA
    const estimatedChars = Math.floor(maxTokens * ratio)
    const truncated = sanitized.slice(0, estimatedChars)
    return { text: truncated, tokens: maxTokens, truncated: true }
  }
}

export function estimateContextWindow(
  messages: readonly { role: string; content: string }[],
  model: string = DEFAULT_MODEL
): {
  used: number
  available: number
  percentage: number
} {
  const used = countMessagesTokens(messages)
  const maxContext = getModelContextLength(model)
  const available = Math.max(0, maxContext - used)
  const percentage = Math.min(100, (used / maxContext) * 100)

  return { used, available, percentage }
}

function sanitizeText(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim()
  )
}

function estimateTokensFallback(text: string): number {
  const japaneseChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length
  const otherChars = text.length - japaneseChars

  const japaneseTokens = Math.ceil(japaneseChars / CHARS_PER_TOKEN_JA)
  const otherTokens = Math.ceil(otherChars / CHARS_PER_TOKEN_EN)

  return japaneseTokens + otherTokens
}

function getModelContextLength(model: string): number {
  const contextLengths: Record<string, number> = {
    'gpt-5-nano': 1048576,
    'gpt-4.1': 1047576,
    'gpt-4.1-mini': 1047576,
    'claude-sonnet-4-20250514': 200000,
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-5-haiku-20241022': 200000,
    'gemini-2.0-flash': 1048576,
    'gemini-1.5-pro': 2097152,
    'deepseek-chat': 64000,
    'qwen-turbo': 128000,
  }

  return contextLengths[model] ?? 128000
}

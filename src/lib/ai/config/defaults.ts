import type { AIProviderType, ModelConfig } from './types'

export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  openai: 'gpt-5-nano',
  claude: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  openrouter: 'openai/gpt-5-nano',
}

export const DEFAULT_TEMPERATURE = 0.1
export const DEFAULT_MAX_TOKENS = 4096

export const CACHE_TTL_MS = 5 * 60 * 1000

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    provider: 'openai',
    modelId: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    contextLength: 1048576,
    maxOutputTokens: 32768,
    pricing: { inputToken: 0.1, outputToken: 0.4 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    contextLength: 1047576,
    maxOutputTokens: 32768,
    pricing: { inputToken: 0.4, outputToken: 1.6 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'openai',
    modelId: 'gpt-4.1',
    displayName: 'GPT-4.1',
    contextLength: 1047576,
    maxOutputTokens: 32768,
    pricing: { inputToken: 2.0, outputToken: 8.0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    contextLength: 128000,
    maxOutputTokens: 16384,
    pricing: { inputToken: 0.15, outputToken: 0.6 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'claude',
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    contextLength: 200000,
    maxOutputTokens: 16384,
    pricing: { inputToken: 3.0, outputToken: 15.0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'claude',
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    contextLength: 200000,
    maxOutputTokens: 8192,
    pricing: { inputToken: 3.0, outputToken: 15.0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'claude',
    modelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    contextLength: 200000,
    maxOutputTokens: 8192,
    pricing: { inputToken: 0.8, outputToken: 4.0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    contextLength: 1048576,
    maxOutputTokens: 8192,
    pricing: { inputToken: 0.1, outputToken: 0.4 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'gemini',
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    contextLength: 2097152,
    maxOutputTokens: 8192,
    pricing: { inputToken: 1.25, outputToken: 5.0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'gemini',
    modelId: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    contextLength: 1048576,
    maxOutputTokens: 8192,
    pricing: { inputToken: 0.075, outputToken: 0.3 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'openrouter',
    modelId: 'openai/gpt-5-nano',
    displayName: 'OpenAI GPT-5 Nano (via OpenRouter)',
    contextLength: 1048576,
    maxOutputTokens: 32768,
    pricing: { inputToken: 0.1, outputToken: 0.4 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'openrouter',
    modelId: 'anthropic/claude-sonnet-4',
    displayName: 'Claude Sonnet 4 (via OpenRouter)',
    contextLength: 200000,
    maxOutputTokens: 16384,
    pricing: { inputToken: 3.0, outputToken: 15.0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
  {
    provider: 'openrouter',
    modelId: 'google/gemini-2.0-flash-001',
    displayName: 'Gemini 2.0 Flash (via OpenRouter)',
    contextLength: 1048576,
    maxOutputTokens: 8192,
    pricing: { inputToken: 0.1, outputToken: 0.4 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  },
]

export const ENV_KEY_MAP: Record<AIProviderType, { apiKey: string; modelKey: string }> = {
  openai: { apiKey: 'OPENAI_API_KEY', modelKey: 'OPENAI_MODEL' },
  claude: { apiKey: 'ANTHROPIC_API_KEY', modelKey: 'CLAUDE_MODEL' },
  gemini: { apiKey: 'GEMINI_API_KEY', modelKey: 'GEMINI_MODEL' },
  openrouter: { apiKey: 'OPENROUTER_API_KEY', modelKey: 'OPENROUTER_MODEL' },
}

export function getDefaultModel(provider: AIProviderType): string {
  return DEFAULT_MODELS[provider]
}

export function getDefaultTemperature(): number {
  return DEFAULT_TEMPERATURE
}

export function getDefaultMaxTokens(): number {
  return DEFAULT_MAX_TOKENS
}

export function getModelFromRegistry(
  provider: AIProviderType,
  modelId: string
): ModelConfig | undefined {
  return MODEL_REGISTRY.find((m) => m.provider === provider && m.modelId === modelId)
}

export function getModelsByProvider(provider: AIProviderType): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider)
}

export function isValidProvider(provider: string): provider is AIProviderType {
  return ['openai', 'claude', 'gemini', 'openrouter'].includes(provider)
}

export function sanitizeModelId(modelId: string): string {
  return modelId.trim().slice(0, 256)
}

export function sanitizeTemperature(temperature: number | undefined): number {
  if (temperature === undefined || temperature === null) {
    return DEFAULT_TEMPERATURE
  }
  const temp = Math.max(0, Math.min(2, temperature))
  return Math.round(temp * 100) / 100
}

export function sanitizeMaxTokens(maxTokens: number | undefined): number {
  if (maxTokens === undefined || maxTokens === null) {
    return DEFAULT_MAX_TOKENS
  }
  return Math.max(1, Math.min(1000000, Math.floor(maxTokens)))
}

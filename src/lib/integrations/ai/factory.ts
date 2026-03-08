import { AIProvider, AIProviderType, AIConfig } from './provider'
import { OpenAIProvider, createOpenAIProvider } from './openai'
import { GeminiProvider, createGeminiProvider } from './gemini'
import { ClaudeProvider, createClaudeProvider } from './claude'
import { OpenRouterProvider, createOpenRouterProvider } from './openrouter'
import { MockAIProvider, createMockAIProvider } from './mock'
import { FallbackAIProvider, FallbackConfig, createFallbackProvider } from './fallback-provider'
import {
  OpenAICompatibleProvider,
  createOpenAICompatibleProvider,
  OpenAICompatibleProviderConfig,
} from './openai-compatible'
import { providerRegistry } from '@/lib/ai/providers/registry'
import { getModelConfigService } from '@/lib/ai/config/model-config'
import { apiKeyService } from '@/services/secrets/api-key-service'
import { OPENAI_COMPATIBLE_CONFIGS } from '@/lib/ai/config/defaults'
import type { ResolvedConfig, OpenAICompatibleProviderType } from '@/lib/ai/config/types'
import './register-providers'

export type { AIProvider, AIProviderType, AIConfig, FallbackConfig }
export {
  OpenAIProvider,
  GeminiProvider,
  ClaudeProvider,
  OpenRouterProvider,
  MockAIProvider,
  FallbackAIProvider,
}
export { OpenAICompatibleProvider }

const PROVIDER_ENV_MAP: Record<AIProviderType, { keyEnv: string; modelEnv?: string }> = {
  openai: { keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL' },
  gemini: { keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL' },
  claude: { keyEnv: 'ANTHROPIC_API_KEY', modelEnv: 'CLAUDE_MODEL' },
  openrouter: { keyEnv: 'OPENROUTER_API_KEY', modelEnv: 'OPENROUTER_MODEL' },
  deepseek: { keyEnv: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_MODEL' },
  kimi: { keyEnv: 'KIMI_API_KEY', modelEnv: 'KIMI_MODEL' },
  qwen: { keyEnv: 'QWEN_API_KEY', modelEnv: 'QWEN_MODEL' },
  groq: { keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL' },
  azure: { keyEnv: 'AZURE_OPENAI_API_KEY', modelEnv: 'AZURE_OPENAI_MODEL' },
  aws: { keyEnv: 'AWS_ACCESS_KEY_ID', modelEnv: 'AWS_MODEL' },
  gcp: { keyEnv: 'GOOGLE_CLOUD_API_KEY', modelEnv: 'GCP_MODEL' },
  freee: { keyEnv: 'FREEE_API_KEY', modelEnv: 'FREEE_MODEL' },
  custom: { keyEnv: 'CUSTOM_LLM_API_KEY', modelEnv: 'CUSTOM_LLM_MODEL' },
}

const OPENAI_COMPATIBLE_PROVIDERS: OpenAICompatibleProviderType[] = [
  'deepseek',
  'kimi',
  'qwen',
  'groq',
  'custom',
]

function isOpenAICompatibleProvider(
  provider: AIProviderType
): provider is OpenAICompatibleProviderType {
  return OPENAI_COMPATIBLE_PROVIDERS.includes(provider as OpenAICompatibleProviderType)
}

export function createAIProvider(config: AIConfig): AIProvider {
  if (isOpenAICompatibleProvider(config.provider)) {
    const compatibleConfig = OPENAI_COMPATIBLE_CONFIGS[config.provider]
    const providerConfig: OpenAICompatibleProviderConfig = {
      apiKey: config.apiKey,
      provider: config.provider,
      baseUrl: compatibleConfig.baseUrl,
      defaultModel: compatibleConfig.defaultModel,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }
    return createOpenAICompatibleProvider(providerConfig)
  }

  switch (config.provider) {
    case 'openai':
      return createOpenAIProvider(config)
    case 'gemini':
      return createGeminiProvider(config)
    case 'claude':
      return createClaudeProvider(config)
    case 'openrouter':
      return createOpenRouterProvider(
        config as unknown as Parameters<typeof createOpenRouterProvider>[0]
      )
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

export function createAIProviderFromEnv(provider?: AIProviderType): AIProvider | null {
  if (process.env.AI_MOCK_MODE === 'true') {
    console.log('[AI] Running in mock mode')
    return createMockAIProvider({
      provider: provider || 'openai',
      apiKey: 'mock-api-key',
    })
  }

  const providersEnv = process.env.AI_PROVIDERS
  if (providersEnv) {
    return createFallbackProviderFromEnv(providersEnv)
  }

  const providerType = provider || (process.env.AI_PROVIDER as AIProviderType) || 'openai'
  const envConfig = PROVIDER_ENV_MAP[providerType]

  const apiKey = process.env[envConfig.keyEnv]
  if (!apiKey) {
    console.warn(`Missing API key for provider ${providerType}: ${envConfig.keyEnv}`)
    return null
  }

  const config: AIConfig = {
    provider: providerType,
    apiKey,
    model: envConfig.modelEnv ? process.env[envConfig.modelEnv] : undefined,
    temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.1,
    maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS, 10) : 1024,
  }

  return createAIProvider(config)
}

export function createFallbackProviderFromEnv(providersEnv: string): FallbackAIProvider | null {
  const validProviders: AIProviderType[] = [
    'openai',
    'gemini',
    'claude',
    'openrouter',
    'deepseek',
    'kimi',
    'qwen',
    'groq',
    'custom',
  ]

  const providerNames = providersEnv
    .split(',')
    .map((p) => p.trim().toLowerCase() as AIProviderType)
    .filter((p) => validProviders.includes(p))

  if (providerNames.length === 0) {
    console.warn('[AI] No valid providers specified in AI_PROVIDERS')
    return null
  }

  const providers: Array<{ provider: AIProvider; name: AIProviderType }> = []

  for (const providerName of providerNames) {
    const envConfig = PROVIDER_ENV_MAP[providerName]
    const apiKey = process.env[envConfig.keyEnv]

    if (!apiKey) {
      console.warn(`[AI] Missing API key for ${providerName}, skipping`)
      continue
    }

    const config: AIConfig = {
      provider: providerName,
      apiKey,
      model: envConfig.modelEnv ? process.env[envConfig.modelEnv] : undefined,
      temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.1,
      maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS, 10) : 1024,
    }

    providers.push({
      provider: createAIProvider(config),
      name: providerName,
    })
    console.log(`[AI] Provider ${providerName} added to fallback chain`)
  }

  if (providers.length === 0) {
    console.warn('[AI] No providers available with valid API keys')
    return null
  }

  console.log(`[AI] Fallback provider chain: ${providers.map((p) => p.name).join(' -> ')}`)

  return createFallbackProvider({
    providers,
    timeout: process.env.AI_TIMEOUT ? parseInt(process.env.AI_TIMEOUT, 10) : 30000,
    retries: process.env.AI_RETRIES ? parseInt(process.env.AI_RETRIES, 10) : 0,
  })
}

export function getAvailableProviders(): AIProviderType[] {
  const providers: AIProviderType[] = []

  for (const [provider, envConfig] of Object.entries(PROVIDER_ENV_MAP)) {
    if (process.env[envConfig.keyEnv]) {
      providers.push(provider as AIProviderType)
    }
  }

  return providers
}

export async function createAIProviderFromConfig(
  provider?: AIProviderType,
  options?: { userId?: string; companyId?: string }
): Promise<AIProvider | null> {
  if (process.env.AI_MOCK_MODE === 'true') {
    console.log('[AI] Running in mock mode')
    return createMockAIProvider({
      provider: provider || 'openai',
      apiKey: 'mock-api-key',
    })
  }

  const providerType = provider || 'openai'

  const keyConfig = await apiKeyService.getAPIKey(providerType, options)
  if (!keyConfig) {
    console.warn(`[AI] No API key found for provider ${providerType}`)
    return null
  }

  const modelConfigService = getModelConfigService()
  const resolvedConfig = await modelConfigService.getConfig(providerType, options)

  const config: AIConfig = {
    provider: providerType,
    apiKey: keyConfig.key,
    model: resolvedConfig.model,
    temperature: resolvedConfig.temperature,
    maxTokens: resolvedConfig.maxTokens,
  }

  return createAIProvider(config)
}

export async function createAIProviderWithConfig(
  provider: AIProviderType,
  options?: { userId?: string; companyId?: string }
): Promise<{ provider: AIProvider; config: ResolvedConfig } | null> {
  if (process.env.AI_MOCK_MODE === 'true') {
    console.log('[AI] Running in mock mode')
    const mockProvider = createMockAIProvider({
      provider,
      apiKey: 'mock-api-key',
    })
    return {
      provider: mockProvider,
      config: {
        provider,
        model: 'mock-model',
        temperature: 0.1,
        maxTokens: 1024,
        source: 'default',
      },
    }
  }

  const keyConfig = await apiKeyService.getAPIKey(provider, options)
  if (!keyConfig) {
    console.warn(`[AI] No API key found for provider ${provider}`)
    return null
  }

  const modelConfigService = getModelConfigService()
  const resolvedConfig = await modelConfigService.getConfig(provider, options)

  const config: AIConfig = {
    provider,
    apiKey: keyConfig.key,
    model: resolvedConfig.model,
    temperature: resolvedConfig.temperature,
    maxTokens: resolvedConfig.maxTokens,
  }

  const aiProvider = createAIProvider(config)

  return {
    provider: aiProvider,
    config: resolvedConfig,
  }
}

class AIService {
  private providerCache: Map<string, AIProvider> = new Map()
  private defaultProvider: AIProviderType = 'openai'

  setDefaultProvider(provider: AIProviderType): void {
    this.defaultProvider = provider
  }

  getDefaultProvider(): AIProviderType {
    const envProvider = process.env.AI_PROVIDER as AIProviderType
    return envProvider || this.defaultProvider
  }

  async getProvider(
    provider?: AIProviderType,
    options?: { userId?: string; companyId?: string }
  ): Promise<AIProvider | null> {
    const providerType = provider || this.getDefaultProvider()
    const cacheKey = `${providerType}:${options?.userId || 'default'}:${options?.companyId || 'default'}`

    const cached = this.providerCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const result = await createAIProviderFromConfig(providerType, options)
    if (result) {
      this.providerCache.set(cacheKey, result)
    }

    return result
  }

  clearCache(): void {
    this.providerCache.clear()
  }
}

let aiServiceInstance: AIService | null = null

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService()
  }
  return aiServiceInstance
}

export function resetAIService(): void {
  aiServiceInstance = null
}

export { providerRegistry }

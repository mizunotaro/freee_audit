import { AIProvider, AIProviderType, AIConfig } from './provider'
import { OpenAIProvider, createOpenAIProvider } from './openai'
import { GeminiProvider, createGeminiProvider } from './gemini'
import { ClaudeProvider, createClaudeProvider } from './claude'

export type { AIProvider, AIProviderType, AIConfig }
export { OpenAIProvider, GeminiProvider, ClaudeProvider }

const PROVIDER_ENV_MAP: Record<AIProviderType, { keyEnv: string; modelEnv?: string }> = {
  openai: { keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL' },
  gemini: { keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL' },
  claude: { keyEnv: 'ANTHROPIC_API_KEY', modelEnv: 'CLAUDE_MODEL' },
}

export function createAIProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return createOpenAIProvider(config)
    case 'gemini':
      return createGeminiProvider(config)
    case 'claude':
      return createClaudeProvider(config)
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

export function createAIProviderFromEnv(provider?: AIProviderType): AIProvider | null {
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

export function getAvailableProviders(): AIProviderType[] {
  const providers: AIProviderType[] = []

  for (const [provider, envConfig] of Object.entries(PROVIDER_ENV_MAP)) {
    if (process.env[envConfig.keyEnv]) {
      providers.push(provider as AIProviderType)
    }
  }

  return providers
}

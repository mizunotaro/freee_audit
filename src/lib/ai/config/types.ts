export type AIProviderType = 'openai' | 'claude' | 'gemini' | 'openrouter'

export interface ModelPricing {
  inputToken: number
  outputToken: number
}

export interface ModelCapabilities {
  vision: boolean
  tools: boolean
  json: boolean
  streaming: boolean
}

export interface ModelConfig {
  provider: AIProviderType
  modelId: string
  displayName: string
  contextLength: number
  maxOutputTokens: number
  pricing: ModelPricing
  capabilities: ModelCapabilities
}

export type ConfigSource = 'database' | 'environment' | 'default'

export interface ResolvedConfig {
  provider: AIProviderType
  model: string
  temperature: number
  maxTokens: number
  source: ConfigSource
}

export interface UserConfigOverride {
  userId: string
  companyId?: string
  provider: AIProviderType
  model?: string
  temperature?: number
  maxTokens?: number
  updatedAt: Date
  updatedBy: string
}

export interface CompanyConfigOverride {
  companyId: string
  provider: AIProviderType
  model?: string
  temperature?: number
  maxTokens?: number
  updatedAt: Date
  updatedBy: string
}

export interface ModelConfigRegistry {
  register(model: ModelConfig): void
  get(provider: AIProviderType, modelId: string): ModelConfig | undefined
  getAll(): ModelConfig[]
  getByProvider(provider: AIProviderType): ModelConfig[]
}

export interface ModelConfigService {
  getConfig(
    provider: AIProviderType,
    options?: { userId?: string; companyId?: string }
  ): Promise<ResolvedConfig>
  getModelMetadata(provider: AIProviderType, modelId: string): ModelConfig | undefined
  clearCache(): void
}

export type EnvironmentConfigMap = Partial<Record<AIProviderType, string>>

export interface DatabaseConfigResult {
  model: string | null
  temperature: number | null
  maxTokens: number | null
}

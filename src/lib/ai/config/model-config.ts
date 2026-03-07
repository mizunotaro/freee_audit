import { MemoryCache } from '@/lib/cache/memory-cache'
import type {
  AIProviderType,
  ResolvedConfig,
  ModelConfig,
  ConfigSource,
  ModelConfigService as IModelConfigService,
  DatabaseConfigResult,
} from './types'
import {
  DEFAULT_MODELS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  CACHE_TTL_MS,
  MODEL_REGISTRY,
  ENV_KEY_MAP,
  getDefaultModel,
  getDefaultTemperature,
  getDefaultMaxTokens,
  getModelFromRegistry,
  isValidProvider,
  sanitizeModelId,
  sanitizeTemperature,
  sanitizeMaxTokens,
} from './defaults'

function createCacheKey(provider: AIProviderType, userId?: string, companyId?: string): string {
  const parts: string[] = [provider]
  if (companyId) parts.push(`company:${companyId}`)
  if (userId) parts.push(`user:${userId}`)
  return parts.join(':')
}

class ModelConfigRegistryImpl {
  private models: Map<string, ModelConfig> = new Map()

  constructor() {
    for (const model of MODEL_REGISTRY) {
      this.register(model)
    }
  }

  register(model: ModelConfig): void {
    const key = `${model.provider}:${model.modelId}`
    this.models.set(key, model)
  }

  get(provider: AIProviderType, modelId: string): ModelConfig | undefined {
    return this.models.get(`${provider}:${modelId}`)
  }

  getAll(): ModelConfig[] {
    return Array.from(this.models.values())
  }

  getByProvider(provider: AIProviderType): ModelConfig[] {
    return this.getAll().filter((m) => m.provider === provider)
  }
}

export const modelRegistry = new ModelConfigRegistryImpl()

interface DatabaseConfigFetcher {
  (
    provider: AIProviderType,
    userId?: string,
    companyId?: string
  ): Promise<DatabaseConfigResult | null>
}

function getEnvironmentConfig(provider: AIProviderType): {
  model: string | null
  temperature: number | null
  maxTokens: number | null
} {
  const envConfig = ENV_KEY_MAP[provider]
  if (!envConfig) {
    return { model: null, temperature: null, maxTokens: null }
  }

  const model = process.env[envConfig.modelKey] || null
  const temperature = process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : null
  const maxTokens = process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS, 10) : null

  return {
    model: model ? sanitizeModelId(model) : null,
    temperature: temperature !== null && !isNaN(temperature) ? temperature : null,
    maxTokens: maxTokens !== null && !isNaN(maxTokens) ? maxTokens : null,
  }
}

export class ModelConfigService implements IModelConfigService {
  private cache: MemoryCache<ResolvedConfig>
  private dbFetcher: DatabaseConfigFetcher | null
  private configLog: Array<{
    timestamp: Date
    provider: AIProviderType
    config: ResolvedConfig
    userId?: string
    companyId?: string
  }> = []

  constructor(options?: { dbFetcher?: DatabaseConfigFetcher; cacheTTL?: number }) {
    this.cache = new MemoryCache<ResolvedConfig>(options?.cacheTTL ?? CACHE_TTL_MS)
    this.dbFetcher = options?.dbFetcher ?? null
  }

  async getConfig(
    provider: AIProviderType,
    options?: { userId?: string; companyId?: string }
  ): Promise<ResolvedConfig> {
    if (!isValidProvider(provider)) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    const cacheKey = createCacheKey(provider, options?.userId, options?.companyId)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const resolved = await this.resolveConfig(provider, options)

    this.cache.set(cacheKey, resolved)
    this.logConfig(provider, resolved, options?.userId, options?.companyId)

    return resolved
  }

  private async resolveConfig(
    provider: AIProviderType,
    options?: { userId?: string; companyId?: string }
  ): Promise<ResolvedConfig> {
    let model: string | null = null
    let temperature: number | null = null
    let maxTokens: number | null = null
    let source: ConfigSource = 'default'

    if (this.dbFetcher) {
      try {
        const dbConfig = await this.dbFetcher(provider, options?.userId, options?.companyId)
        if (dbConfig) {
          if (dbConfig.model) {
            model = sanitizeModelId(dbConfig.model)
            source = 'database'
          }
          if (dbConfig.temperature !== null) {
            temperature = dbConfig.temperature
          }
          if (dbConfig.maxTokens !== null) {
            maxTokens = dbConfig.maxTokens
          }
        }
      } catch (error) {
        console.warn(`[ModelConfig] Database fetch failed, falling back to env/defaults:`, error)
      }
    }

    if (source === 'default') {
      const envConfig = getEnvironmentConfig(provider)
      if (envConfig.model) {
        model = envConfig.model
        source = 'environment'
      }
      if (envConfig.temperature !== null && temperature === null) {
        temperature = envConfig.temperature
      }
      if (envConfig.maxTokens !== null && maxTokens === null) {
        maxTokens = envConfig.maxTokens
      }
    }

    if (!model) {
      model = getDefaultModel(provider)
    }

    return {
      provider,
      model,
      temperature: sanitizeTemperature(temperature ?? getDefaultTemperature()),
      maxTokens: sanitizeMaxTokens(maxTokens ?? getDefaultMaxTokens()),
      source,
    }
  }

  private logConfig(
    provider: AIProviderType,
    config: ResolvedConfig,
    userId?: string,
    companyId?: string
  ): void {
    this.configLog.push({
      timestamp: new Date(),
      provider,
      config,
      userId,
      companyId,
    })

    if (this.configLog.length > 500) {
      this.configLog = this.configLog.slice(-500)
    }
  }

  getModelMetadata(provider: AIProviderType, modelId: string): ModelConfig | undefined {
    return getModelFromRegistry(provider, modelId) ?? modelRegistry.get(provider, modelId)
  }

  clearCache(): void {
    this.cache.clear()
  }

  getConfigLog(): Array<{
    timestamp: Date
    provider: AIProviderType
    config: ResolvedConfig
    userId?: string
    companyId?: string
  }> {
    return [...this.configLog]
  }

  getCacheStats(): { size: number; keys: string[] } {
    return this.cache.getStats()
  }

  async batchGetConfig(
    requests: Array<{
      provider: AIProviderType
      userId?: string
      companyId?: string
    }>
  ): Promise<ResolvedConfig[]> {
    return Promise.all(
      requests.map((req) =>
        this.getConfig(req.provider, { userId: req.userId, companyId: req.companyId })
      )
    )
  }
}

let defaultInstance: ModelConfigService | null = null

export function getModelConfigService(options?: {
  dbFetcher?: DatabaseConfigFetcher
  cacheTTL?: number
}): ModelConfigService {
  if (!defaultInstance) {
    defaultInstance = new ModelConfigService(options)
  }
  return defaultInstance
}

export function resetModelConfigService(): void {
  defaultInstance = null
}

export {
  DEFAULT_MODELS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  CACHE_TTL_MS,
  MODEL_REGISTRY,
  getDefaultModel,
  getDefaultTemperature,
  getDefaultMaxTokens,
  isValidProvider,
  sanitizeModelId,
  sanitizeTemperature,
  sanitizeMaxTokens,
}

export type {
  AIProviderType,
  ResolvedConfig,
  ModelConfig,
  ConfigSource,
  ModelConfigService as IModelConfigService,
}

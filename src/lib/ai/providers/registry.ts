import type { AIProviderType, ModelConfig, ResolvedConfig } from '../config/types'
import type {
  AIProvider,
  ProviderMetadata,
  ProviderFactory,
  RegisteredProvider,
  ProviderRegistryOptions,
} from './types'
import {
  ProviderRegistrationError,
  ProviderNotFoundError,
  ProviderInitializationError,
} from './types'

class ProviderRegistry {
  private providers: Map<AIProviderType, RegisteredProvider> = new Map()
  private options: ProviderRegistryOptions
  private instanceCache: Map<string, AIProvider> = new Map()

  constructor(options: ProviderRegistryOptions = {}) {
    this.options = {
      strictMode: options.strictMode ?? true,
      lazyInit: options.lazyInit ?? true,
    }
  }

  register(metadata: ProviderMetadata, factory: ProviderFactory, models: ModelConfig[]): void {
    const providerName = metadata.name

    if (this.providers.has(providerName)) {
      if (this.options.strictMode) {
        throw new ProviderRegistrationError(providerName, 'Provider already registered')
      }
      console.warn(`[ProviderRegistry] Provider "${providerName}" already registered. Overwriting.`)
    }

    if (!metadata.displayName || !metadata.description) {
      throw new ProviderRegistrationError(
        providerName,
        'Metadata must include displayName and description'
      )
    }

    if (typeof factory !== 'function') {
      throw new ProviderRegistrationError(providerName, 'Factory must be a function')
    }

    if (!Array.isArray(models) || models.length === 0) {
      throw new ProviderRegistrationError(providerName, 'At least one model must be provided')
    }

    const providerModels = models.filter((m) => m.provider === providerName)
    if (providerModels.length === 0) {
      throw new ProviderRegistrationError(
        providerName,
        'Models must belong to the provider being registered'
      )
    }

    this.providers.set(providerName, {
      metadata,
      factory,
      availableModels: providerModels,
    })

    this.instanceCache.delete(providerName)
  }

  get(name: AIProviderType): RegisteredProvider | undefined {
    return this.providers.get(name)
  }

  getAll(): RegisteredProvider[] {
    return Array.from(this.providers.values())
  }

  getByCapability(capability: keyof ModelConfig['capabilities']): RegisteredProvider[] {
    return this.getAll().filter((provider) =>
      provider.availableModels.some((model) => model.capabilities[capability] === true)
    )
  }

  isAvailable(name: AIProviderType): boolean {
    return this.providers.has(name)
  }

  createInstance(name: AIProviderType, config: ResolvedConfig): AIProvider {
    const registered = this.providers.get(name)

    if (!registered) {
      throw new ProviderNotFoundError(name)
    }

    const cacheKey = `${name}:${config.model}:${config.source}`

    if (this.options.lazyInit && this.instanceCache.has(cacheKey)) {
      return this.instanceCache.get(cacheKey)!
    }

    try {
      const instance = registered.factory(config)
      this.instanceCache.set(cacheKey, instance)
      return instance
    } catch (error) {
      throw new ProviderInitializationError(
        name,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  clearInstanceCache(): void {
    this.instanceCache.clear()
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.instanceCache.size,
      keys: Array.from(this.instanceCache.keys()),
    }
  }

  unregister(name: AIProviderType): boolean {
    const deleted = this.providers.delete(name)
    if (deleted) {
      for (const key of this.instanceCache.keys()) {
        if (key.startsWith(`${name}:`)) {
          this.instanceCache.delete(key)
        }
      }
    }
    return deleted
  }

  getNames(): AIProviderType[] {
    return Array.from(this.providers.keys())
  }

  async healthCheckAll(): Promise<Record<AIProviderType, boolean>> {
    const results: Record<AIProviderType, boolean> = {} as Record<AIProviderType, boolean>

    for (const [name, provider] of this.providers) {
      try {
        const config: ResolvedConfig = {
          provider: name,
          model: provider.availableModels[0]?.modelId ?? 'unknown',
          temperature: 0.1,
          maxTokens: 4096,
          source: 'default',
        }
        const instance = this.createInstance(name, config)
        results[name] = await instance.healthCheck()
      } catch {
        results[name] = false
      }
    }

    return results
  }
}

export const providerRegistry = new ProviderRegistry()

export function createProviderRegistry(options?: ProviderRegistryOptions): ProviderRegistry {
  return new ProviderRegistry(options)
}

export {
  ProviderRegistry,
  ProviderRegistrationError,
  ProviderNotFoundError,
  ProviderInitializationError,
}

export type {
  AIProvider,
  ProviderMetadata,
  ProviderFactory,
  RegisteredProvider,
  ProviderRegistryOptions,
}

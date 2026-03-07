import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ProviderRegistry,
  createProviderRegistry,
  ProviderRegistrationError,
  ProviderNotFoundError,
  ProviderInitializationError,
} from '@/lib/ai/providers/registry'
import type { AIProvider, ProviderMetadata } from '@/lib/ai/providers/types'
import type { AIProviderType, ModelConfig, ResolvedConfig } from '@/lib/ai/config/types'

function createMockProvider(name: string, modelConfig: ModelConfig): AIProvider {
  return {
    name: name as AIProvider['name'],
    modelConfig,
    analyzeDocument: vi.fn().mockResolvedValue({
      documentId: 'doc-1',
      text: 'extracted text',
      confidence: 0.95,
      processingTimeMs: 100,
    }),
    validateEntry: vi.fn().mockResolvedValue({
      entryId: 'entry-1',
      isValid: true,
      confidence: 0.9,
      issues: [],
      processingTimeMs: 50,
    }),
    healthCheck: vi.fn().mockResolvedValue(true),
  }
}

function createTestMetadata(name: string): ProviderMetadata {
  return {
    name: name as ProviderMetadata['name'],
    displayName: `Test ${name}`,
    description: `Test provider for ${name}`,
    website: `https://${name}.test.com`,
    requiresApiKey: true,
    supportsZDR: false,
    dataResidency: ['US'],
  }
}

function createTestModelConfig(provider: string, modelId: string): ModelConfig {
  return {
    provider: provider as ModelConfig['provider'],
    modelId,
    displayName: `Test ${modelId}`,
    contextLength: 128000,
    maxOutputTokens: 4096,
    pricing: { inputToken: 1.0, outputToken: 2.0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  }
}

function createTestResolvedConfig(provider: string, model: string): ResolvedConfig {
  return {
    provider: provider as ResolvedConfig['provider'],
    model,
    temperature: 0.1,
    maxTokens: 4096,
    source: 'default',
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry

  beforeEach(() => {
    registry = createProviderRegistry()
  })

  describe('register', () => {
    it('should register a provider with valid metadata, factory, and models', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      expect(() => registry.register(metadata, factory, models)).not.toThrow()
      expect(registry.isAvailable('openai')).toBe(true)
    })

    it('should throw ProviderRegistrationError when registering duplicate provider in strict mode', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)

      expect(() => registry.register(metadata, factory, models)).toThrow(ProviderRegistrationError)
    })

    it('should warn and overwrite in non-strict mode', () => {
      const nonStrictRegistry = createProviderRegistry({ strictMode: false })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      nonStrictRegistry.register(metadata, factory, models)
      nonStrictRegistry.register(metadata, factory, models)

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should throw error when metadata is missing required fields', () => {
      const metadata = { ...createTestMetadata('openai'), displayName: '' }
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      expect(() => registry.register(metadata, factory, models)).toThrow(ProviderRegistrationError)
    })

    it('should throw error when factory is not a function', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]

      expect(() =>
        registry.register(metadata, 'not-a-function' as unknown as () => AIProvider, models)
      ).toThrow(ProviderRegistrationError)
    })

    it('should throw error when models array is empty', () => {
      const metadata = createTestMetadata('openai')
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', {} as ModelConfig))

      expect(() => registry.register(metadata, factory, [])).toThrow(ProviderRegistrationError)
    })

    it('should throw error when models do not belong to the provider', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('claude', 'claude-3')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      expect(() => registry.register(metadata, factory, models)).toThrow(ProviderRegistrationError)
    })

    it('should filter models to only include provider-specific models', () => {
      const metadata = createTestMetadata('openai')
      const models = [
        createTestModelConfig('openai', 'gpt-4'),
        createTestModelConfig('claude', 'claude-3'),
      ]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const registered = registry.get('openai')

      expect(registered?.availableModels).toHaveLength(1)
      expect(registered?.availableModels[0].modelId).toBe('gpt-4')
    })
  })

  describe('get', () => {
    it('should return registered provider', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const result = registry.get('openai')

      expect(result).toBeDefined()
      expect(result?.metadata.name).toBe('openai')
      expect(result?.factory).toBe(factory)
    })

    it('should return undefined for unregistered provider', () => {
      expect(registry.get('openrouter' as AIProviderType)).toBeUndefined()
    })
  })

  describe('getAll', () => {
    it('should return all registered providers', () => {
      const openaiMetadata = createTestMetadata('openai')
      const openaiModels = [createTestModelConfig('openai', 'gpt-4')]
      const openaiFactory = vi.fn().mockReturnValue(createMockProvider('openai', openaiModels[0]))

      const claudeMetadata = createTestMetadata('claude')
      const claudeModels = [createTestModelConfig('claude', 'claude-3')]
      const claudeFactory = vi.fn().mockReturnValue(createMockProvider('claude', claudeModels[0]))

      registry.register(openaiMetadata, openaiFactory, openaiModels)
      registry.register(claudeMetadata, claudeFactory, claudeModels)

      const all = registry.getAll()
      expect(all).toHaveLength(2)
      expect(all.map((p) => p.metadata.name)).toContain('openai')
      expect(all.map((p) => p.metadata.name)).toContain('claude')
    })

    it('should return empty array when no providers registered', () => {
      expect(registry.getAll()).toEqual([])
    })
  })

  describe('getByCapability', () => {
    it('should return providers with specified capability', () => {
      const metadata = createTestMetadata('openai')
      const models = [
        {
          ...createTestModelConfig('openai', 'gpt-4'),
          capabilities: { vision: true, tools: true, json: true, streaming: true },
        },
      ]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const result = registry.getByCapability('vision')

      expect(result).toHaveLength(1)
      expect(result[0].metadata.name).toBe('openai')
    })

    it('should return empty array when no providers have capability', () => {
      const metadata = createTestMetadata('openai')
      const models = [
        {
          ...createTestModelConfig('openai', 'gpt-4'),
          capabilities: { vision: false, tools: false, json: false, streaming: false },
        },
      ]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const result = registry.getByCapability('vision')

      expect(result).toHaveLength(0)
    })
  })

  describe('isAvailable', () => {
    it('should return true for registered provider', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)

      expect(registry.isAvailable('openai')).toBe(true)
    })

    it('should return false for unregistered provider', () => {
      expect(registry.isAvailable('openrouter' as AIProviderType)).toBe(false)
    })
  })

  describe('createInstance', () => {
    it('should create provider instance using factory', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const mockProvider = createMockProvider('openai', models[0])
      const factory = vi.fn().mockReturnValue(mockProvider)

      registry.register(metadata, factory, models)
      const config = createTestResolvedConfig('openai', 'gpt-4')
      const instance = registry.createInstance('openai', config)

      expect(factory).toHaveBeenCalledWith(config)
      expect(instance).toBe(mockProvider)
    })

    it('should throw ProviderNotFoundError for unregistered provider', () => {
      const config = createTestResolvedConfig('openrouter', 'unknown-model')

      expect(() => registry.createInstance('openrouter' as AIProviderType, config)).toThrow(
        ProviderNotFoundError
      )
    })

    it('should throw ProviderInitializationError when factory throws', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockImplementation(() => {
        throw new Error('Factory error')
      })

      registry.register(metadata, factory, models)
      const config = createTestResolvedConfig('openai', 'gpt-4')

      expect(() => registry.createInstance('openai', config)).toThrow(ProviderInitializationError)
    })

    it('should cache instances with lazyInit enabled', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const config = createTestResolvedConfig('openai', 'gpt-4')

      registry.createInstance('openai', config)
      registry.createInstance('openai', config)

      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('should not cache instances with lazyInit disabled', () => {
      const noCacheRegistry = createProviderRegistry({ lazyInit: false })
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      noCacheRegistry.register(metadata, factory, models)
      const config = createTestResolvedConfig('openai', 'gpt-4')

      noCacheRegistry.createInstance('openai', config)
      noCacheRegistry.createInstance('openai', config)

      expect(factory).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearInstanceCache', () => {
    it('should clear all cached instances', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const config = createTestResolvedConfig('openai', 'gpt-4')

      registry.createInstance('openai', config)
      registry.clearInstanceCache()
      registry.createInstance('openai', config)

      expect(factory).toHaveBeenCalledTimes(2)
    })
  })

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const config = createTestResolvedConfig('openai', 'gpt-4')

      registry.createInstance('openai', config)
      const stats = registry.getCacheStats()

      expect(stats.size).toBe(1)
      expect(stats.keys).toContain('openai:gpt-4:default')
    })
  })

  describe('unregister', () => {
    it('should remove provider and its cached instances', () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockReturnValue(createMockProvider('openai', models[0]))

      registry.register(metadata, factory, models)
      const config = createTestResolvedConfig('openai', 'gpt-4')
      registry.createInstance('openai', config)

      const result = registry.unregister('openai')

      expect(result).toBe(true)
      expect(registry.isAvailable('openai')).toBe(false)
      expect(registry.getCacheStats().size).toBe(0)
    })

    it('should return false for unregistered provider', () => {
      expect(registry.unregister('openrouter' as AIProviderType)).toBe(false)
    })
  })

  describe('getNames', () => {
    it('should return all registered provider names', () => {
      const openaiMetadata = createTestMetadata('openai')
      const openaiModels = [createTestModelConfig('openai', 'gpt-4')]
      const openaiFactory = vi.fn().mockReturnValue(createMockProvider('openai', openaiModels[0]))

      const claudeMetadata = createTestMetadata('claude')
      const claudeModels = [createTestModelConfig('claude', 'claude-3')]
      const claudeFactory = vi.fn().mockReturnValue(createMockProvider('claude', claudeModels[0]))

      registry.register(openaiMetadata, openaiFactory, openaiModels)
      registry.register(claudeMetadata, claudeFactory, claudeModels)

      const names = registry.getNames()
      expect(names).toContain('openai')
      expect(names).toContain('claude')
    })
  })

  describe('healthCheckAll', () => {
    it('should return health status for all providers', async () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const mockProvider = createMockProvider('openai', models[0])
      const factory = vi.fn().mockReturnValue(mockProvider)

      registry.register(metadata, factory, models)
      const results = await registry.healthCheckAll()

      expect(results['openai']).toBe(true)
      expect(mockProvider.healthCheck).toHaveBeenCalled()
    })

    it('should return false for providers that fail health check', async () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const mockProvider = createMockProvider('openai', models[0])
      mockProvider.healthCheck = vi.fn().mockResolvedValue(false)
      const factory = vi.fn().mockReturnValue(mockProvider)

      registry.register(metadata, factory, models)
      const results = await registry.healthCheckAll()

      expect(results['openai']).toBe(false)
    })

    it('should return false for providers that throw on initialization', async () => {
      const metadata = createTestMetadata('openai')
      const models = [createTestModelConfig('openai', 'gpt-4')]
      const factory = vi.fn().mockImplementation(() => {
        throw new Error('Init failed')
      })

      registry.register(metadata, factory, models)
      const results = await registry.healthCheckAll()

      expect(results['openai']).toBe(false)
    })
  })
})

describe('Error classes', () => {
  it('ProviderRegistrationError should have correct properties', () => {
    const error = new ProviderRegistrationError('test-provider', 'test reason')

    expect(error.name).toBe('ProviderRegistrationError')
    expect(error.providerName).toBe('test-provider')
    expect(error.reason).toBe('test reason')
    expect(error.message).toBe('Failed to register provider "test-provider": test reason')
  })

  it('ProviderNotFoundError should have correct properties', () => {
    const error = new ProviderNotFoundError('missing-provider')

    expect(error.name).toBe('ProviderNotFoundError')
    expect(error.providerName).toBe('missing-provider')
    expect(error.message).toBe('Provider "missing-provider" not found in registry')
  })

  it('ProviderInitializationError should have correct properties', () => {
    const cause = new Error('Underlying error')
    const error = new ProviderInitializationError('fail-provider', cause)

    expect(error.name).toBe('ProviderInitializationError')
    expect(error.providerName).toBe('fail-provider')
    expect(error.cause).toBe(cause)
    expect(error.message).toBe('Failed to initialize provider "fail-provider": Underlying error')
  })
})

describe('createProviderRegistry', () => {
  it('should create registry with default options', () => {
    const registry = createProviderRegistry()
    expect(registry).toBeInstanceOf(ProviderRegistry)
  })

  it('should create registry with custom options', () => {
    const registry = createProviderRegistry({ strictMode: false, lazyInit: false })
    expect(registry).toBeInstanceOf(ProviderRegistry)
  })
})

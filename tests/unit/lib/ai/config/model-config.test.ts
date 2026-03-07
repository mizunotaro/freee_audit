import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ModelConfigService,
  getModelConfigService,
  resetModelConfigService,
  modelRegistry,
  DEFAULT_MODELS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  getDefaultModel,
  getDefaultTemperature,
  getDefaultMaxTokens,
  isValidProvider,
  sanitizeModelId,
  sanitizeTemperature,
  sanitizeMaxTokens,
} from '@/lib/ai/config/model-config'
import type { AIProviderType, DatabaseConfigResult } from '@/lib/ai/config/types'

describe('ModelConfigService', () => {
  const originalEnv = { ...process.env }
  let service: ModelConfigService

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetModelConfigService()
    service = new ModelConfigService()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.useRealTimers()
  })

  describe('getConfig', () => {
    it('should return default config when no overrides exist', async () => {
      const config = await service.getConfig('openai')

      expect(config.provider).toBe('openai')
      expect(config.model).toBe(DEFAULT_MODELS.openai)
      expect(config.temperature).toBe(DEFAULT_TEMPERATURE)
      expect(config.maxTokens).toBe(DEFAULT_MAX_TOKENS)
      expect(config.source).toBe('default')
    })

    it('should return correct defaults for each provider', async () => {
      const providers: AIProviderType[] = ['openai', 'claude', 'gemini', 'openrouter']

      for (const provider of providers) {
        const config = await service.getConfig(provider)
        expect(config.provider).toBe(provider)
        expect(config.model).toBe(DEFAULT_MODELS[provider])
      }
    })

    it('should throw error for invalid provider', async () => {
      await expect(service.getConfig('invalid' as AIProviderType)).rejects.toThrow(
        'Invalid provider: invalid'
      )
    })

    it('should use environment variable for model', async () => {
      process.env.OPENAI_MODEL = 'gpt-4.1-mini'

      const envService = new ModelConfigService()
      const config = await envService.getConfig('openai')

      expect(config.model).toBe('gpt-4.1-mini')
      expect(config.source).toBe('environment')
    })

    it('should use environment variable for temperature', async () => {
      process.env.AI_TEMPERATURE = '0.5'

      const envService = new ModelConfigService()
      const config = await envService.getConfig('openai')

      expect(config.temperature).toBe(0.5)
    })

    it('should use environment variable for maxTokens', async () => {
      process.env.AI_MAX_TOKENS = '2048'

      const envService = new ModelConfigService()
      const config = await envService.getConfig('openai')

      expect(config.maxTokens).toBe(2048)
    })

    it('should prefer database config over environment', async () => {
      process.env.OPENAI_MODEL = 'gpt-4.1-mini'

      const dbFetcher = vi.fn().mockResolvedValue({
        model: 'gpt-4.1',
        temperature: 0.3,
        maxTokens: 8192,
      } as DatabaseConfigResult)

      const dbService = new ModelConfigService({ dbFetcher })
      const config = await dbService.getConfig('openai')

      expect(config.model).toBe('gpt-4.1')
      expect(config.temperature).toBe(0.3)
      expect(config.maxTokens).toBe(8192)
      expect(config.source).toBe('database')
      expect(dbFetcher).toHaveBeenCalledWith('openai', undefined, undefined)
    })

    it('should pass userId and companyId to dbFetcher', async () => {
      const dbFetcher = vi.fn().mockResolvedValue(null)
      const dbService = new ModelConfigService({ dbFetcher })

      await dbService.getConfig('openai', { userId: 'user123', companyId: 'company456' })

      expect(dbFetcher).toHaveBeenCalledWith('openai', 'user123', 'company456')
    })

    it('should fallback to environment when database fetch fails', async () => {
      process.env.OPENAI_MODEL = 'gpt-4.1-mini'

      const dbFetcher = vi.fn().mockRejectedValue(new Error('DB connection failed'))
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const dbService = new ModelConfigService({ dbFetcher })
      const config = await dbService.getConfig('openai')

      expect(config.model).toBe('gpt-4.1-mini')
      expect(config.source).toBe('environment')
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should fallback to defaults when both db and env fail', async () => {
      const dbFetcher = vi.fn().mockRejectedValue(new Error('DB connection failed'))
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const dbService = new ModelConfigService({ dbFetcher })
      const config = await dbService.getConfig('openai')

      expect(config.model).toBe(DEFAULT_MODELS.openai)
      expect(config.source).toBe('default')

      consoleWarnSpy.mockRestore()
    })
  })

  describe('caching', () => {
    it('should cache resolved configs', async () => {
      const dbFetcher = vi.fn().mockResolvedValue({ model: 'gpt-4.1' } as DatabaseConfigResult)
      const dbService = new ModelConfigService({ dbFetcher })

      const config1 = await dbService.getConfig('openai')
      const config2 = await dbService.getConfig('openai')

      expect(dbFetcher).toHaveBeenCalledTimes(1)
      expect(config1).toEqual(config2)
    })

    it('should cache configs with different keys for different contexts', async () => {
      const dbFetcher = vi.fn().mockResolvedValue({ model: 'gpt-4.1' } as DatabaseConfigResult)
      const dbService = new ModelConfigService({ dbFetcher })

      await dbService.getConfig('openai', { userId: 'user1' })
      await dbService.getConfig('openai', { userId: 'user2' })

      expect(dbFetcher).toHaveBeenCalledTimes(2)
    })

    it('should clear cache when clearCache is called', async () => {
      const dbFetcher = vi.fn().mockResolvedValue({ model: 'gpt-4.1' } as DatabaseConfigResult)
      const dbService = new ModelConfigService({ dbFetcher })

      await dbService.getConfig('openai')
      dbService.clearCache()
      await dbService.getConfig('openai')

      expect(dbFetcher).toHaveBeenCalledTimes(2)
    })

    it('should respect custom cache TTL', async () => {
      vi.useFakeTimers()

      const dbFetcher = vi.fn().mockResolvedValue({ model: 'gpt-4.1' } as DatabaseConfigResult)
      const dbService = new ModelConfigService({ dbFetcher, cacheTTL: 1000 })

      await dbService.getConfig('openai')
      vi.advanceTimersByTime(500)
      await dbService.getConfig('openai')
      expect(dbFetcher).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(600)
      await dbService.getConfig('openai')
      expect(dbFetcher).toHaveBeenCalledTimes(2)
    })
  })

  describe('getModelMetadata', () => {
    it('should return model metadata for known models', () => {
      const metadata = service.getModelMetadata('openai', 'gpt-5-nano')

      expect(metadata).toBeDefined()
      expect(metadata?.displayName).toBe('GPT-5 Nano')
      expect(metadata?.contextLength).toBe(1048576)
    })

    it('should return undefined for unknown models', () => {
      const metadata = service.getModelMetadata('openai', 'unknown-model')
      expect(metadata).toBeUndefined()
    })

    it('should return correct capabilities', () => {
      const metadata = service.getModelMetadata('claude', 'claude-sonnet-4-20250514')

      expect(metadata?.capabilities.vision).toBe(true)
      expect(metadata?.capabilities.tools).toBe(true)
      expect(metadata?.capabilities.json).toBe(true)
      expect(metadata?.capabilities.streaming).toBe(true)
    })
  })

  describe('batchGetConfig', () => {
    it('should resolve multiple configs in parallel', async () => {
      const configs = await service.batchGetConfig([
        { provider: 'openai' },
        { provider: 'claude' },
        { provider: 'gemini' },
      ])

      expect(configs).toHaveLength(3)
      expect(configs[0].provider).toBe('openai')
      expect(configs[1].provider).toBe('claude')
      expect(configs[2].provider).toBe('gemini')
    })
  })

  describe('configLog', () => {
    it('should log config resolutions', async () => {
      await service.getConfig('openai', { userId: 'user123' })

      const log = service.getConfigLog()
      expect(log).toHaveLength(1)
      expect(log[0].provider).toBe('openai')
      expect(log[0].userId).toBe('user123')
      expect(log[0].config).toBeDefined()
    })

    it('should limit log size to 1000 entries', async () => {
      for (let i = 0; i < 1100; i++) {
        await service.getConfig('openai', { userId: `user${i}` })
      }

      const log = service.getConfigLog()
      expect(log.length).toBeLessThanOrEqual(500)
    })
  })
})

describe('modelRegistry', () => {
  it('should contain all registered models', () => {
    const models = modelRegistry.getAll()
    expect(models.length).toBeGreaterThan(0)
  })

  it('should get models by provider', () => {
    const openaiModels = modelRegistry.getByProvider('openai')
    expect(openaiModels.length).toBeGreaterThan(0)
    expect(openaiModels.every((m) => m.provider === 'openai')).toBe(true)
  })

  it('should get specific model', () => {
    const model = modelRegistry.get('openai', 'gpt-5-nano')
    expect(model).toBeDefined()
    expect(model?.modelId).toBe('gpt-5-nano')
  })
})

describe('helper functions', () => {
  describe('getDefaultModel', () => {
    it('should return correct default for each provider', () => {
      expect(getDefaultModel('openai')).toBe('gpt-5-nano')
      expect(getDefaultModel('claude')).toBe('claude-sonnet-4-20250514')
      expect(getDefaultModel('gemini')).toBe('gemini-2.0-flash')
      expect(getDefaultModel('openrouter')).toBe('openai/gpt-5-nano')
    })
  })

  describe('getDefaultTemperature', () => {
    it('should return default temperature', () => {
      expect(getDefaultTemperature()).toBe(DEFAULT_TEMPERATURE)
    })
  })

  describe('getDefaultMaxTokens', () => {
    it('should return default max tokens', () => {
      expect(getDefaultMaxTokens()).toBe(DEFAULT_MAX_TOKENS)
    })
  })

  describe('isValidProvider', () => {
    it('should return true for valid providers', () => {
      expect(isValidProvider('openai')).toBe(true)
      expect(isValidProvider('claude')).toBe(true)
      expect(isValidProvider('gemini')).toBe(true)
      expect(isValidProvider('openrouter')).toBe(true)
    })

    it('should return false for invalid providers', () => {
      expect(isValidProvider('invalid')).toBe(false)
      expect(isValidProvider('')).toBe(false)
      expect(isValidProvider('OPENAI')).toBe(false)
    })
  })

  describe('sanitizeModelId', () => {
    it('should trim whitespace', () => {
      expect(sanitizeModelId('  gpt-4  ')).toBe('gpt-4')
    })

    it('should truncate to 256 characters', () => {
      const longId = 'a'.repeat(300)
      expect(sanitizeModelId(longId).length).toBe(256)
    })
  })

  describe('sanitizeTemperature', () => {
    it('should return default for undefined', () => {
      expect(sanitizeTemperature(undefined)).toBe(DEFAULT_TEMPERATURE)
    })

    it('should clamp to 0-2 range', () => {
      expect(sanitizeTemperature(-0.5)).toBe(0)
      expect(sanitizeTemperature(3)).toBe(2)
    })

    it('should round to 2 decimal places', () => {
      expect(sanitizeTemperature(0.123)).toBe(0.12)
      expect(sanitizeTemperature(1.999)).toBe(2)
    })
  })

  describe('sanitizeMaxTokens', () => {
    it('should return default for undefined', () => {
      expect(sanitizeMaxTokens(undefined)).toBe(DEFAULT_MAX_TOKENS)
    })

    it('should clamp to 1-1000000 range', () => {
      expect(sanitizeMaxTokens(0)).toBe(1)
      expect(sanitizeMaxTokens(-100)).toBe(1)
      expect(sanitizeMaxTokens(2000000)).toBe(1000000)
    })

    it('should floor to integer', () => {
      expect(sanitizeMaxTokens(100.9)).toBe(100)
    })
  })
})

describe('getModelConfigService', () => {
  beforeEach(() => {
    resetModelConfigService()
  })

  it('should return singleton instance', () => {
    const instance1 = getModelConfigService()
    const instance2 = getModelConfigService()

    expect(instance1).toBe(instance2)
  })

  it('should create new instance after reset', () => {
    const instance1 = getModelConfigService()
    resetModelConfigService()
    const instance2 = getModelConfigService()

    expect(instance1).not.toBe(instance2)
  })
})

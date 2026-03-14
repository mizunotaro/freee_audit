import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createAIProviderFromEnv,
  createFallbackProviderFromEnv,
  getAvailableProviders,
  createAIProviderFromConfig,
  createAIProviderWithConfig,
  getAIService,
  resetAIService,
  createAIProvider,
} from '@/lib/integrations/ai/factory'
import type { AIConfig } from '@/lib/integrations/ai/factory'

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {}
  },
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {}
  },
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    constructor() {}
    getGenerativeModel() {
      return {
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => '' } }),
      }
    }
  },
}))

describe('AI Factory - Fallback Integration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('createAIProviderFromEnv with AI_PROVIDERS', () => {
    it('should create fallback provider when AI_PROVIDERS is set', async () => {
      process.env.AI_PROVIDERS = 'openai,gemini'
      process.env.OPENAI_API_KEY = 'test-openai-key'
      process.env.GEMINI_API_KEY = 'test-gemini-key'

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { createAIProviderFromEnv: createFromEnv } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFromEnv()

      expect(provider).not.toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Fallback provider chain: openai -> gemini')

      consoleLogSpy.mockRestore()
    })

    it('should skip providers without API keys', async () => {
      process.env.AI_PROVIDERS = 'openai,gemini,claude'
      process.env.OPENAI_API_KEY = 'test-openai-key'
      process.env.GEMINI_API_KEY = undefined
      process.env.ANTHROPIC_API_KEY = 'test-claude-key'

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { createAIProviderFromEnv: createFromEnv } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFromEnv()

      expect(provider).not.toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith('[AI] Missing API key for gemini, skipping')
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Fallback provider chain: openai -> claude')

      consoleWarnSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should return null when no providers have API keys', async () => {
      process.env.AI_PROVIDERS = 'openai,gemini'
      process.env.OPENAI_API_KEY = undefined
      process.env.GEMINI_API_KEY = undefined

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { createAIProviderFromEnv: createFromEnv } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFromEnv()

      expect(provider).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith('[AI] No providers available with valid API keys')

      consoleWarnSpy.mockRestore()
    })

    it('should ignore invalid provider names', async () => {
      process.env.AI_PROVIDERS = 'invalid,openai,unknown'
      process.env.OPENAI_API_KEY = 'test-openai-key'

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { createAIProviderFromEnv: createFromEnv } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFromEnv()

      expect(provider).not.toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Fallback provider chain: openai')

      consoleWarnSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should use AI_TIMEOUT and AI_RETRIES from environment', async () => {
      process.env.AI_PROVIDERS = 'openai'
      process.env.OPENAI_API_KEY = 'test-openai-key'
      process.env.AI_TIMEOUT = '60000'
      process.env.AI_RETRIES = '3'

      const { createAIProviderFromEnv: createFromEnv } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFromEnv()

      expect(provider).not.toBeNull()
    })
  })

  describe('createFallbackProviderFromEnv', () => {
    it('should return null when no valid providers specified', async () => {
      process.env.AI_PROVIDERS = 'invalid,unknown'

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { createFallbackProviderFromEnv: createFallback } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFallback('invalid,unknown')

      expect(provider).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AI] No valid providers specified in AI_PROVIDERS'
      )

      consoleWarnSpy.mockRestore()
    })

    it('should handle empty provider string', async () => {
      const { createFallbackProviderFromEnv: createFallback } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFallback('')

      expect(provider).toBeNull()
    })

    it('should handle whitespace in provider names', async () => {
      process.env.AI_PROVIDERS = ' openai , gemini '
      process.env.OPENAI_API_KEY = 'test-openai-key'
      process.env.GEMINI_API_KEY = 'test-gemini-key'

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { createFallbackProviderFromEnv: createFallback } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFallback(' openai , gemini ')

      expect(provider).not.toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Fallback provider chain: openai -> gemini')

      consoleLogSpy.mockRestore()
    })

    it('should respect case-insensitive provider names', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key'
      process.env.GEMINI_API_KEY = 'test-gemini-key'

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { createFallbackProviderFromEnv: createFallback } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFallback('OpenAI,GEMINI')

      expect(provider).not.toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Fallback provider chain: openai -> gemini')

      consoleLogSpy.mockRestore()
    })
  })

  describe('getAvailableProviders', () => {
    it('should return providers with API keys', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key'
      process.env.GEMINI_API_KEY = 'test-gemini-key'
      process.env.ANTHROPIC_API_KEY = undefined

      const { getAvailableProviders: getAvailable } = await import('@/lib/integrations/ai/factory')
      const providers = getAvailable()

      expect(providers).toContain('openai')
      expect(providers).toContain('gemini')
      expect(providers).not.toContain('claude')
    })

    it('should return empty array when no API keys set', async () => {
      process.env.OPENAI_API_KEY = undefined
      process.env.GEMINI_API_KEY = undefined
      process.env.ANTHROPIC_API_KEY = undefined

      const { getAvailableProviders: getAvailable } = await import('@/lib/integrations/ai/factory')
      const providers = getAvailable()

      expect(providers).toEqual([])
    })
  })

  describe('mock mode', () => {
    it('should return mock provider when AI_MOCK_MODE is true', async () => {
      process.env.AI_MOCK_MODE = 'true'
      process.env.AI_PROVIDERS = 'openai,gemini'

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { createAIProviderFromEnv: createFromEnv } =
        await import('@/lib/integrations/ai/factory')
      const provider = createFromEnv()

      expect(provider).not.toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Running in mock mode')

      consoleLogSpy.mockRestore()
    })
  })

  describe('createAIProvider', () => {
    it('should create OpenAI provider', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
      }
      const provider = createAIProvider(config)
      expect(provider).toBeDefined()
      expect(provider.name).toBe('openai')
    })

    it('should create Claude provider', () => {
      const config: AIConfig = {
        provider: 'claude',
        apiKey: 'test-key',
        model: 'claude-3-sonnet',
      }
      const provider = createAIProvider(config)
      expect(provider).toBeDefined()
      expect(provider.name).toBe('claude')
    })

    it('should create Gemini provider', () => {
      const config: AIConfig = {
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-pro',
      }
      const provider = createAIProvider(config)
      expect(provider).toBeDefined()
      expect(provider.name).toBe('gemini')
    })

    it('should create OpenRouter provider', () => {
      const config: AIConfig = {
        provider: 'openrouter',
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      }
      const provider = createAIProvider(config)
      expect(provider).toBeDefined()
      expect(provider.name).toBe('openrouter')
    })

    it('should throw error for unknown provider', () => {
      const config = {
        provider: 'unknown' as 'openai',
        apiKey: 'test-key',
      }
      expect(() => createAIProvider(config)).toThrow('Unknown AI provider')
    })
  })

  describe('createAIProviderFromConfig', () => {
    it('should return null when no API key is available', async () => {
      vi.mock('@/services/secrets/api-key-service', () => ({
        apiKeyService: {
          getAPIKey: vi.fn().mockResolvedValue(null),
        },
      }))

      const provider = await createAIProviderFromConfig('openai')
      expect(provider).toBeNull()
    })

    it('should return mock provider when AI_MOCK_MODE is true', async () => {
      process.env.AI_MOCK_MODE = 'true'
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const provider = await createAIProviderFromConfig('openai')

      expect(provider).not.toBeNull()
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Running in mock mode')

      consoleLogSpy.mockRestore()
    })
  })

  describe('createAIProviderWithConfig', () => {
    it('should return null when no API key is available', async () => {
      vi.mock('@/services/secrets/api-key-service', () => ({
        apiKeyService: {
          getAPIKey: vi.fn().mockResolvedValue(null),
        },
      }))

      const result = await createAIProviderWithConfig('openai')
      expect(result).toBeNull()
    })

    it('should return mock provider and config when AI_MOCK_MODE is true', async () => {
      process.env.AI_MOCK_MODE = 'true'
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = await createAIProviderWithConfig('openai')

      expect(result).not.toBeNull()
      expect(result?.provider).toBeDefined()
      expect(result?.config).toBeDefined()
      expect(result?.config.provider).toBe('openai')
      expect(consoleLogSpy).toHaveBeenCalledWith('[AI] Running in mock mode')

      consoleLogSpy.mockRestore()
    })
  })

  describe('getAIService', () => {
    beforeEach(() => {
      resetAIService()
    })

    it('should return singleton AIService instance', () => {
      const service1 = getAIService()
      const service2 = getAIService()

      expect(service1).toBe(service2)
    })

    it('should allow setting default provider', () => {
      const service = getAIService()
      service.setDefaultProvider('claude')

      expect(service.getDefaultProvider()).toBe('claude')
    })

    it('should clear cache', () => {
      const service = getAIService()
      service.clearCache()

      expect(service).toBeDefined()
    })

    it('should reset service', () => {
      const service1 = getAIService()
      service1.setDefaultProvider('gemini')

      resetAIService()

      const service2 = getAIService()
      expect(service2.getDefaultProvider()).toBe('openai')
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain existing AIConfig interface', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2048,
      }

      expect(config.provider).toBe('openai')
      expect(config.apiKey).toBe('test-key')
      expect(config.model).toBe('gpt-4')
      expect(config.temperature).toBe(0.5)
      expect(config.maxTokens).toBe(2048)
    })

    it('should support all provider types', () => {
      const providers: AIConfig['provider'][] = ['openai', 'gemini', 'claude', 'openrouter']

      providers.forEach((provider) => {
        const config: AIConfig = {
          provider,
          apiKey: 'test-key',
        }
        expect(() => createAIProvider(config)).not.toThrow()
      })
    })
  })
})

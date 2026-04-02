import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockRegister = vi.fn()

vi.mock('@/lib/ai/providers/registry', () => ({
  providerRegistry: {
    register: mockRegister,
  },
}))

vi.mock('@/lib/ai/config/defaults', () => ({
  MODEL_REGISTRY: [
    {
      provider: 'openai',
      modelId: 'gpt-4',
      displayName: 'GPT-4',
      contextLength: 128000,
      maxOutputTokens: 4096,
      pricing: { inputToken: 0.01, outputToken: 0.03 },
      capabilities: { vision: true, tools: true, json: true, streaming: true },
    },
    {
      provider: 'claude',
      modelId: 'claude-sonnet-4',
      displayName: 'Claude Sonnet 4',
      contextLength: 200000,
      maxOutputTokens: 8192,
      pricing: { inputToken: 0.003, outputToken: 0.015 },
      capabilities: { vision: true, tools: true, json: true, streaming: true },
    },
    {
      provider: 'gemini',
      modelId: 'gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      contextLength: 128000,
      maxOutputTokens: 8192,
      pricing: { inputToken: 0, outputToken: 0 },
      capabilities: { vision: true, tools: true, json: true, streaming: true },
    },
    {
      provider: 'openrouter',
      modelId: 'openai/gpt-4',
      displayName: 'GPT-4 via OpenRouter',
      contextLength: 128000,
      maxOutputTokens: 4096,
      pricing: { inputToken: 0.01, outputToken: 0.03 },
      capabilities: { vision: true, tools: true, json: true, streaming: true },
    },
  ],
}))

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
  GoogleGenerativeAI: class MockGoogle {
    constructor() {}
    getGenerativeModel() {
      return { generateContent: vi.fn() }
    }
  },
  HarmCategory: {},
  HarmBlockThreshold: {},
  Part: {},
}))

describe('register-providers', () => {
  let registerProviders: () => void
  let isProvidersRegistered: () => boolean
  let resetProviderRegistration: () => void
  let importCallCount: number

  beforeEach(async () => {
    vi.resetModules()
    mockRegister.mockClear()

    const mod = await import('@/lib/integrations/ai/register-providers')
    registerProviders = mod.registerProviders
    isProvidersRegistered = mod.isProvidersRegistered
    resetProviderRegistration = mod.resetProviderRegistration

    importCallCount = mockRegister.mock.calls.length
    resetProviderRegistration()
    mockRegister.mockClear()
  })

  describe('registerProviders', () => {
    it('should register all providers', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      registerProviders()

      expect(mockRegister).toHaveBeenCalledTimes(4)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[AI] Providers registered: openai, claude, gemini, openrouter'
      )

      consoleLogSpy.mockRestore()
    })

    it('should register providers with correct metadata', () => {
      registerProviders()

      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'openai', displayName: 'OpenAI' }),
        expect.any(Function),
        expect.any(Array)
      )
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'claude', displayName: 'Anthropic Claude' }),
        expect.any(Function),
        expect.any(Array)
      )
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'gemini', displayName: 'Google Gemini' }),
        expect.any(Function),
        expect.any(Array)
      )
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'openrouter', displayName: 'OpenRouter' }),
        expect.any(Function),
        expect.any(Array)
      )
    })

    it('should not register twice', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      registerProviders()
      registerProviders()

      expect(mockRegister).toHaveBeenCalledTimes(4)
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)

      consoleLogSpy.mockRestore()
    })
  })

  describe('isProvidersRegistered', () => {
    it('should return false before registration', () => {
      expect(isProvidersRegistered()).toBe(false)
    })

    it('should return true after registration', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registerProviders()
      expect(isProvidersRegistered()).toBe(true)
      consoleLogSpy.mockRestore()
    })
  })

  describe('resetProviderRegistration', () => {
    it('should reset registration state', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registerProviders()
      expect(isProvidersRegistered()).toBe(true)

      resetProviderRegistration()
      expect(isProvidersRegistered()).toBe(false)

      consoleLogSpy.mockRestore()
    })

    it('should allow re-registration after reset', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      registerProviders()
      resetProviderRegistration()
      registerProviders()

      expect(mockRegister).toHaveBeenCalledTimes(8)

      consoleLogSpy.mockRestore()
    })
  })
})

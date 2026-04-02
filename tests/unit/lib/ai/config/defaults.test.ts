import { describe, it, expect } from 'vitest'
import {
  OPENAI_COMPATIBLE_CONFIGS,
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
  getModelsByProvider,
  isValidProvider,
  sanitizeModelId,
  sanitizeTemperature,
  sanitizeMaxTokens,
} from '@/lib/ai/config/defaults'
import type { AIProviderType } from '@/lib/ai/config/types'

describe('defaults constants', () => {
  it('should export OPENAI_COMPATIBLE_CONFIGS with correct providers', () => {
    expect(OPENAI_COMPATIBLE_CONFIGS.deepseek).toBeDefined()
    expect(OPENAI_COMPATIBLE_CONFIGS.kimi).toBeDefined()
    expect(OPENAI_COMPATIBLE_CONFIGS.qwen).toBeDefined()
    expect(OPENAI_COMPATIBLE_CONFIGS.groq).toBeDefined()
    expect(OPENAI_COMPATIBLE_CONFIGS.custom).toBeDefined()
  })

  it('should have correct baseUrl for each compatible provider', () => {
    expect(OPENAI_COMPATIBLE_CONFIGS.deepseek.baseUrl).toBe('https://api.deepseek.com/v1')
    expect(OPENAI_COMPATIBLE_CONFIGS.kimi.baseUrl).toBe('https://api.moonshot.cn/v1')
    expect(OPENAI_COMPATIBLE_CONFIGS.qwen.baseUrl).toContain('dashscope')
    expect(OPENAI_COMPATIBLE_CONFIGS.groq.baseUrl).toContain('groq.com')
  })

  it('should have apiKeyEnvVar and modelEnvVar for each compatible provider', () => {
    for (const config of Object.values(OPENAI_COMPATIBLE_CONFIGS)) {
      expect(config.apiKeyEnvVar).toBeTruthy()
      expect(config.modelEnvVar).toBeTruthy()
      expect(config.defaultModel).toBeTruthy()
    }
  })

  it('should export DEFAULT_MODELS with all provider types', () => {
    const providers: AIProviderType[] = [
      'openai',
      'claude',
      'gemini',
      'openrouter',
      'deepseek',
      'kimi',
      'qwen',
      'groq',
      'azure',
      'aws',
      'gcp',
      'freee',
      'custom',
    ]
    for (const provider of providers) {
      expect(DEFAULT_MODELS[provider]).toBeTruthy()
    }
  })

  it('should have correct default model values', () => {
    expect(DEFAULT_MODELS.openai).toBe('gpt-5.4-nano')
    expect(DEFAULT_MODELS.claude).toBe('claude-sonnet-4-6-20250514')
    expect(DEFAULT_MODELS.gemini).toBe('gemini-2.5-flash-preview-05-20')
    expect(DEFAULT_MODELS.openrouter).toBe('openai/gpt-5.4-nano')
  })

  it('should export DEFAULT_TEMPERATURE as 0.1', () => {
    expect(DEFAULT_TEMPERATURE).toBe(0.1)
  })

  it('should export DEFAULT_MAX_TOKENS as 4096', () => {
    expect(DEFAULT_MAX_TOKENS).toBe(4096)
  })

  it('should export CACHE_TTL_MS as 5 minutes', () => {
    expect(CACHE_TTL_MS).toBe(5 * 60 * 1000)
  })

  it('should have non-empty MODEL_REGISTRY', () => {
    expect(MODEL_REGISTRY.length).toBeGreaterThan(0)
  })

  it('should have unique modelId per provider in MODEL_REGISTRY', () => {
    const keys = MODEL_REGISTRY.map((m) => `${m.provider}:${m.modelId}`)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  it('should have required fields in each MODEL_REGISTRY entry', () => {
    for (const model of MODEL_REGISTRY) {
      expect(model.provider).toBeTruthy()
      expect(model.modelId).toBeTruthy()
      expect(model.displayName).toBeTruthy()
      expect(typeof model.contextLength).toBe('number')
      expect(typeof model.maxOutputTokens).toBe('number')
      expect(model.pricing).toBeDefined()
      expect(model.capabilities).toBeDefined()
    }
  })

  it('should export ENV_KEY_MAP with all provider types', () => {
    const providers: AIProviderType[] = [
      'openai',
      'claude',
      'gemini',
      'openrouter',
      'deepseek',
      'kimi',
      'qwen',
      'groq',
      'azure',
      'aws',
      'gcp',
      'freee',
      'custom',
    ]
    for (const provider of providers) {
      expect(ENV_KEY_MAP[provider]).toBeDefined()
      expect(ENV_KEY_MAP[provider].apiKey).toBeTruthy()
      expect(ENV_KEY_MAP[provider].modelKey).toBeTruthy()
    }
  })

  it('should have correct API key env vars', () => {
    expect(ENV_KEY_MAP.openai.apiKey).toBe('OPENAI_API_KEY')
    expect(ENV_KEY_MAP.claude.apiKey).toBe('ANTHROPIC_API_KEY')
    expect(ENV_KEY_MAP.gemini.apiKey).toBe('GEMINI_API_KEY')
    expect(ENV_KEY_MAP.openrouter.apiKey).toBe('OPENROUTER_API_KEY')
  })
})

describe('getDefaultModel', () => {
  it('should return correct default for each provider', () => {
    expect(getDefaultModel('openai')).toBe('gpt-5.4-nano')
    expect(getDefaultModel('claude')).toBe('claude-sonnet-4-6-20250514')
    expect(getDefaultModel('gemini')).toBe('gemini-2.5-flash-preview-05-20')
  })
})

describe('getDefaultTemperature', () => {
  it('should return 0.1', () => {
    expect(getDefaultTemperature()).toBe(0.1)
  })
})

describe('getDefaultMaxTokens', () => {
  it('should return 4096', () => {
    expect(getDefaultMaxTokens()).toBe(4096)
  })
})

describe('getModelFromRegistry', () => {
  it('should find model by provider and modelId', () => {
    const model = getModelFromRegistry('openai', 'gpt-5.4-nano')
    expect(model).toBeDefined()
    expect(model?.displayName).toBe('GPT-5.4 Nano')
  })

  it('should return undefined for unknown model', () => {
    const model = getModelFromRegistry('openai', 'nonexistent')
    expect(model).toBeUndefined()
  })

  it('should return undefined for unknown provider', () => {
    const model = getModelFromRegistry('unknown' as AIProviderType, 'gpt-5.4-nano')
    expect(model).toBeUndefined()
  })

  it('should return correct pricing data', () => {
    const model = getModelFromRegistry('openai', 'gpt-5.4-nano')
    expect(model?.pricing.inputToken).toBe(0.2)
    expect(model?.pricing.outputToken).toBe(1.25)
  })
})

describe('getModelsByProvider', () => {
  it('should return all models for a given provider', () => {
    const openaiModels = getModelsByProvider('openai')
    expect(openaiModels.length).toBeGreaterThan(0)
    expect(openaiModels.every((m) => m.provider === 'openai')).toBe(true)
  })

  it('should return empty array for unknown provider', () => {
    const models = getModelsByProvider('unknown' as AIProviderType)
    expect(models).toHaveLength(0)
  })

  it('should return correct count for claude models', () => {
    const claudeModels = getModelsByProvider('claude')
    expect(claudeModels.length).toBeGreaterThan(0)
  })
})

describe('isValidProvider', () => {
  it('should return true for all valid providers', () => {
    const validProviders: AIProviderType[] = [
      'openai',
      'claude',
      'gemini',
      'openrouter',
      'deepseek',
      'kimi',
      'qwen',
      'groq',
      'azure',
      'aws',
      'gcp',
      'freee',
      'custom',
    ]
    for (const provider of validProviders) {
      expect(isValidProvider(provider)).toBe(true)
    }
  })

  it('should return false for invalid providers', () => {
    expect(isValidProvider('invalid')).toBe(false)
    expect(isValidProvider('')).toBe(false)
    expect(isValidProvider('OPENAI')).toBe(false)
    expect(isValidProvider('GPT')).toBe(false)
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

  it('should return unchanged short valid id', () => {
    expect(sanitizeModelId('gpt-5.4-nano')).toBe('gpt-5.4-nano')
  })
})

describe('sanitizeTemperature', () => {
  it('should return default for undefined', () => {
    expect(sanitizeTemperature(undefined)).toBe(DEFAULT_TEMPERATURE)
  })

  it('should return default for null', () => {
    expect(sanitizeTemperature(null as unknown as undefined)).toBe(DEFAULT_TEMPERATURE)
  })

  it('should clamp to 0 minimum', () => {
    expect(sanitizeTemperature(-0.5)).toBe(0)
  })

  it('should clamp to 2 maximum', () => {
    expect(sanitizeTemperature(3)).toBe(2)
  })

  it('should round to 2 decimal places', () => {
    expect(sanitizeTemperature(0.123)).toBe(0.12)
  })

  it('should preserve valid temperatures', () => {
    expect(sanitizeTemperature(0.5)).toBe(0.5)
    expect(sanitizeTemperature(1.0)).toBe(1.0)
  })
})

describe('sanitizeMaxTokens', () => {
  it('should return default for undefined', () => {
    expect(sanitizeMaxTokens(undefined)).toBe(DEFAULT_MAX_TOKENS)
  })

  it('should return default for null', () => {
    expect(sanitizeMaxTokens(null as unknown as undefined)).toBe(DEFAULT_MAX_TOKENS)
  })

  it('should clamp to minimum of 1', () => {
    expect(sanitizeMaxTokens(0)).toBe(1)
    expect(sanitizeMaxTokens(-100)).toBe(1)
  })

  it('should clamp to maximum of 1000000', () => {
    expect(sanitizeMaxTokens(2000000)).toBe(1000000)
  })

  it('should floor to integer', () => {
    expect(sanitizeMaxTokens(100.9)).toBe(100)
  })

  it('should preserve valid values', () => {
    expect(sanitizeMaxTokens(4096)).toBe(4096)
    expect(sanitizeMaxTokens(8192)).toBe(8192)
  })
})

import { describe, it, expect } from 'vitest'
import {
  PROVIDER_REGISTRY,
  getProviderMetadata,
  getProvidersByZDR,
  getProvidersByDataResidency,
  filterProvidersBySecurity,
} from '@/lib/integrations/ai/provider-registry'
import type { AIProviderType } from '@/lib/integrations/ai/provider'

describe('PROVIDER_REGISTRY', () => {
  it('should have entries for all provider types', () => {
    const expectedProviders: AIProviderType[] = [
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

    expectedProviders.forEach(function (p) {
      expect(PROVIDER_REGISTRY[p]).toBeDefined()
      expect(PROVIDER_REGISTRY[p].name).toBe(p)
    })
  })

  it('should have displayName for each provider', () => {
    Object.values(PROVIDER_REGISTRY).forEach(function (meta) {
      expect(meta.displayName).toBeTruthy()
      expect(typeof meta.displayName).toBe('string')
    })
  })

  it('should have non-empty dataResidency arrays', () => {
    Object.values(PROVIDER_REGISTRY).forEach(function (meta) {
      expect(meta.dataResidency.length).toBeGreaterThan(0)
    })
  })
})

describe('getProviderMetadata', () => {
  it('should return metadata for known provider', () => {
    const meta = getProviderMetadata('openai')
    expect(meta).toBeDefined()
    expect(meta!.name).toBe('openai')
    expect(meta!.displayName).toBe('OpenAI')
    expect(meta!.supportsZDR).toBe(true)
    expect(meta!.dataResidency).toContain('US')
  })

  it('should return metadata for claude', () => {
    const meta = getProviderMetadata('claude')
    expect(meta!.displayName).toBe('Anthropic Claude')
    expect(meta!.supportsZDR).toBe(true)
    expect(meta!.dataResidency).toEqual(expect.arrayContaining(['US', 'EU']))
  })

  it('should return metadata for gemini', () => {
    const meta = getProviderMetadata('gemini')
    expect(meta!.displayName).toBe('Google Gemini')
    expect(meta!.supportsZDR).toBe(false)
  })

  it('should return metadata for openrouter', () => {
    const meta = getProviderMetadata('openrouter')
    expect(meta!.displayName).toBe('OpenRouter')
    expect(meta!.dataResidency).toEqual(['GLOBAL'])
  })

  it('should return undefined for unknown provider string', () => {
    const meta = getProviderMetadata('unknown' as AIProviderType)
    expect(meta).toBeUndefined()
  })
})

describe('getProvidersByZDR', () => {
  it('should return providers that support ZDR', () => {
    const zdrProviders = getProvidersByZDR(true)
    expect(zdrProviders).toContain('openai')
    expect(zdrProviders).toContain('claude')
    expect(zdrProviders).toContain('azure')
    expect(zdrProviders).toContain('aws')
  })

  it('should return providers that do not support ZDR', () => {
    const nonZdrProviders = getProvidersByZDR(false)
    expect(nonZdrProviders).toContain('gemini')
    expect(nonZdrProviders).toContain('openrouter')
    expect(nonZdrProviders).toContain('deepseek')
    expect(nonZdrProviders).toContain('kimi')
    expect(nonZdrProviders).toContain('qwen')
    expect(nonZdrProviders).toContain('groq')
    expect(nonZdrProviders).toContain('gcp')
  })
})

describe('getProvidersByDataResidency', () => {
  it('should return providers with US residency', () => {
    const usProviders = getProvidersByDataResidency('US')
    expect(usProviders).toContain('openai')
    expect(usProviders).toContain('claude')
    expect(usProviders).toContain('groq')
  })

  it('should return providers with EU residency', () => {
    const euProviders = getProvidersByDataResidency('EU')
    expect(euProviders).toContain('claude')
    expect(euProviders).toContain('gemini')
  })

  it('should return providers with GLOBAL residency', () => {
    const globalProviders = getProvidersByDataResidency('GLOBAL')
    expect(globalProviders).toContain('openrouter')
    expect(globalProviders).toContain('deepseek')
    expect(globalProviders).toContain('kimi')
    expect(globalProviders).toContain('azure')
    expect(globalProviders).toContain('aws')
  })
})

describe('filterProvidersBySecurity', () => {
  it('should filter by ZDR requirement', () => {
    const providers: AIProviderType[] = ['openai', 'gemini', 'claude']
    const result = filterProvidersBySecurity(providers, { requireZDR: true })

    expect(result).toContain('openai')
    expect(result).toContain('claude')
    expect(result).not.toContain('gemini')
  })

  it('should filter by allowed data residency', () => {
    const providers: AIProviderType[] = ['openai', 'gemini', 'openrouter']
    const result = filterProvidersBySecurity(providers, {
      allowedDataResidency: ['US'],
    })

    expect(result).toContain('openai')
    expect(result).not.toContain('openrouter')
  })

  it('should filter by both ZDR and data residency', () => {
    const providers: AIProviderType[] = ['openai', 'claude', 'gemini', 'groq']
    const result = filterProvidersBySecurity(providers, {
      requireZDR: true,
      allowedDataResidency: ['US'],
    })

    expect(result).toContain('openai')
    expect(result).toContain('claude')
    expect(result).not.toContain('gemini')
    expect(result).not.toContain('groq')
  })

  it('should return all providers when no filters applied', () => {
    const providers: AIProviderType[] = ['openai', 'claude']
    const result = filterProvidersBySecurity(providers, {})

    expect(result).toEqual(['openai', 'claude'])
  })

  it('should exclude providers not in registry', () => {
    const providers: AIProviderType[] = ['openai', 'unknown' as AIProviderType]
    const result = filterProvidersBySecurity(providers, {})

    expect(result).toEqual(['openai'])
  })

  it('should handle empty providers array', () => {
    const result = filterProvidersBySecurity([], { requireZDR: true })
    expect(result).toEqual([])
  })

  it('should handle empty allowedDataResidency', () => {
    const providers: AIProviderType[] = ['openai', 'gemini']
    const result = filterProvidersBySecurity(providers, {
      allowedDataResidency: [],
    })

    expect(result).toEqual(['openai', 'gemini'])
  })
})

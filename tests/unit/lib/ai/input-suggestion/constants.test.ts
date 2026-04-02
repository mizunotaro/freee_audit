import { describe, it, expect } from 'vitest'
import {
  CONFIG_VERSION,
  INPUT_SUGGESTION_CONFIG,
  FIELD_DEFAULTS,
} from '@/lib/ai/input-suggestion/constants'

describe('CONFIG_VERSION', () => {
  it('should be a valid semver string', () => {
    expect(CONFIG_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should be 1.0.0', () => {
    expect(CONFIG_VERSION).toBe('1.0.0')
  })
})

describe('INPUT_SUGGESTION_CONFIG', () => {
  it('should have version matching CONFIG_VERSION', () => {
    expect(INPUT_SUGGESTION_CONFIG.version).toBe(CONFIG_VERSION)
  })

  it('should have correct AI configuration', () => {
    expect(INPUT_SUGGESTION_CONFIG.ai.maxQueryLength).toBe(5000)
    expect(INPUT_SUGGESTION_CONFIG.ai.maxContextLength).toBe(10000)
    expect(INPUT_SUGGESTION_CONFIG.ai.maxTokens).toBe(1000)
    expect(INPUT_SUGGESTION_CONFIG.ai.temperature).toBe(0.3)
    expect(INPUT_SUGGESTION_CONFIG.ai.defaultLanguage).toBe('ja')
  })

  it('should have correct fallback configuration', () => {
    expect(INPUT_SUGGESTION_CONFIG.fallback.enabled).toBe(true)
    expect(INPUT_SUGGESTION_CONFIG.fallback.minConfidence).toBe(50)
  })

  it('should have correct rate limit configuration', () => {
    expect(INPUT_SUGGESTION_CONFIG.rateLimit.maxRequestsPerMinute).toBe(10)
    expect(INPUT_SUGGESTION_CONFIG.rateLimit.cooldownMs).toBe(6000)
  })

  it('should be declared as const', () => {
    expect(INPUT_SUGGESTION_CONFIG.version).toBe(CONFIG_VERSION)
  })
})

describe('FIELD_DEFAULTS', () => {
  it('should contain expected field keys', () => {
    expect(FIELD_DEFAULTS.growthRate).toBeDefined()
    expect(FIELD_DEFAULTS.discountRate).toBeDefined()
    expect(FIELD_DEFAULTS.terminalGrowthRate).toBeDefined()
    expect(FIELD_DEFAULTS.riskFreeRate).toBeDefined()
    expect(FIELD_DEFAULTS.beta).toBeDefined()
    expect(FIELD_DEFAULTS.marketRiskPremium).toBeDefined()
    expect(FIELD_DEFAULTS.volatility).toBeDefined()
    expect(FIELD_DEFAULTS.per).toBeDefined()
    expect(FIELD_DEFAULTS.pbr).toBeDefined()
    expect(FIELD_DEFAULTS.evEbitda).toBeDefined()
    expect(FIELD_DEFAULTS.psr).toBeDefined()
    expect(FIELD_DEFAULTS.materialityThreshold).toBeDefined()
  })

  it('should have correct structure for each field', () => {
    for (const [key, field] of Object.entries(FIELD_DEFAULTS)) {
      expect(typeof field.value).toBe('number')
      expect(typeof field.min).toBe('number')
      expect(typeof field.max).toBe('number')
      expect(typeof field.source).toBe('string')
      expect(field.min).toBeLessThanOrEqual(field.value)
      expect(field.max).toBeGreaterThanOrEqual(field.value)
    }
  })

  it('should have reasonable growth rate defaults', () => {
    expect(FIELD_DEFAULTS.growthRate.value).toBe(0.05)
    expect(FIELD_DEFAULTS.growthRate.min).toBe(-0.2)
    expect(FIELD_DEFAULTS.growthRate.max).toBe(0.5)
  })

  it('should have reasonable discount rate defaults', () => {
    expect(FIELD_DEFAULTS.discountRate.value).toBe(0.1)
    expect(FIELD_DEFAULTS.discountRate.min).toBe(0.05)
    expect(FIELD_DEFAULTS.discountRate.max).toBe(0.2)
  })

  it('should have valid source types', () => {
    const validSources = ['industry_average', 'regulatory']
    for (const field of Object.values(FIELD_DEFAULTS)) {
      expect(validSources).toContain(field.source)
    }
  })

  it('should have beta default of 1.0', () => {
    expect(FIELD_DEFAULTS.beta.value).toBe(1.0)
  })
})

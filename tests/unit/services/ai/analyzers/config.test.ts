import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CONFIG_VERSION,
  DEFAULT_ANALYZER_CONFIG,
  getAnalyzerConfig,
  mergeConfig,
} from '@/services/ai/analyzers/config'

describe('Config', () => {
  describe('CONFIG_VERSION', () => {
    it('should be defined', () => {
      expect(CONFIG_VERSION).toBeDefined()
    })

    it('should be a valid semver string', () => {
      expect(CONFIG_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('DEFAULT_ANALYZER_CONFIG', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_ANALYZER_CONFIG.version).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.timeout).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.categoryTimeout).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.maxIterations).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.maxAlerts).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.maxRecommendations).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.allowPartialFailure).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.epsilon).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.cacheMaxSize).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.cacheTtl).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.maxInputSize).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.retry).toBeDefined()
      expect(DEFAULT_ANALYZER_CONFIG.circuitBreaker).toBeDefined()
    })

    it('should have positive timeout values', () => {
      expect(DEFAULT_ANALYZER_CONFIG.timeout).toBeGreaterThan(0)
      expect(DEFAULT_ANALYZER_CONFIG.categoryTimeout).toBeGreaterThan(0)
    })

    it('should have positive iteration limits', () => {
      expect(DEFAULT_ANALYZER_CONFIG.maxIterations).toBeGreaterThan(0)
    })

    it('should have positive cache settings', () => {
      expect(DEFAULT_ANALYZER_CONFIG.cacheMaxSize).toBeGreaterThan(0)
      expect(DEFAULT_ANALYZER_CONFIG.cacheTtl).toBeGreaterThan(0)
    })

    it('should have valid retry config', () => {
      expect(DEFAULT_ANALYZER_CONFIG.retry.maxRetries).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_ANALYZER_CONFIG.retry.initialDelayMs).toBeGreaterThan(0)
      expect(DEFAULT_ANALYZER_CONFIG.retry.maxDelayMs).toBeGreaterThan(0)
      expect(DEFAULT_ANALYZER_CONFIG.retry.backoffMultiplier).toBeGreaterThan(0)
    })

    it('should have valid circuit breaker config', () => {
      expect(DEFAULT_ANALYZER_CONFIG.circuitBreaker.failureThreshold).toBeGreaterThan(0)
      expect(DEFAULT_ANALYZER_CONFIG.circuitBreaker.resetTimeoutMs).toBeGreaterThan(0)
    })

    it('should have valid maxInputSize', () => {
      expect(DEFAULT_ANALYZER_CONFIG.maxInputSize.balanceSheetItems).toBeGreaterThan(0)
      expect(DEFAULT_ANALYZER_CONFIG.maxInputSize.profitLossItems).toBeGreaterThan(0)
      expect(DEFAULT_ANALYZER_CONFIG.maxInputSize.recursionDepth).toBeGreaterThan(0)
    })

    it('should match CONFIG_VERSION', () => {
      expect(DEFAULT_ANALYZER_CONFIG.version).toBe(CONFIG_VERSION)
    })
  })

  describe('getAnalyzerConfig', () => {
    it('should return config object', () => {
      const config = getAnalyzerConfig()
      expect(config).toBeDefined()
    })

    it('should return config with version', () => {
      const config = getAnalyzerConfig()
      expect(config.version).toBe(CONFIG_VERSION)
    })

    it('should use defaults when no env vars set', () => {
      const config = getAnalyzerConfig()
      expect(config.timeout).toBe(DEFAULT_ANALYZER_CONFIG.timeout)
    })

    describe('with environment variables', () => {
      let originalEnv: NodeJS.ProcessEnv

      beforeEach(() => {
        originalEnv = { ...process.env }
      })

      afterEach(() => {
        process.env = originalEnv
      })

      it('should parse valid env var number', () => {
        process.env.ANALYZER_TIMEOUT = '60000'
        const config = getAnalyzerConfig()
        expect(config.timeout).toBe(60000)
      })

      it('should fallback for invalid env var number', () => {
        process.env.ANALYZER_TIMEOUT = 'invalid'
        const config = getAnalyzerConfig()
        expect(config.timeout).toBe(DEFAULT_ANALYZER_CONFIG.timeout)
      })

      it('should handle empty string env var', () => {
        process.env.ANALYZER_TIMEOUT = ''
        const config = getAnalyzerConfig()
        expect(config.timeout).toBe(DEFAULT_ANALYZER_CONFIG.timeout)
      })
    })
  })

  describe('mergeConfig', () => {
    it('should merge partial config with base', () => {
      const merged = mergeConfig(DEFAULT_ANALYZER_CONFIG, { timeout: 60000 })
      expect(merged.timeout).toBe(60000)
      expect(merged.categoryTimeout).toBe(DEFAULT_ANALYZER_CONFIG.categoryTimeout)
    })

    it('should preserve unspecified values', () => {
      const merged = mergeConfig(DEFAULT_ANALYZER_CONFIG, { timeout: 60000 })
      expect(merged.maxAlerts).toBe(DEFAULT_ANALYZER_CONFIG.maxAlerts)
      expect(merged.allowPartialFailure).toBe(DEFAULT_ANALYZER_CONFIG.allowPartialFailure)
    })

    it('should merge nested maxInputSize', () => {
      const merged = mergeConfig(DEFAULT_ANALYZER_CONFIG, {
        maxInputSize: {
          balanceSheetItems: 500,
          profitLossItems: DEFAULT_ANALYZER_CONFIG.maxInputSize.profitLossItems,
          recursionDepth: DEFAULT_ANALYZER_CONFIG.maxInputSize.recursionDepth,
        },
      })
      expect(merged.maxInputSize.balanceSheetItems).toBe(500)
    })

    it('should merge nested retry config', () => {
      const merged = mergeConfig(DEFAULT_ANALYZER_CONFIG, {
        retry: { maxRetries: 5, initialDelayMs: 2000, maxDelayMs: 20000, backoffMultiplier: 3 },
      })
      expect(merged.retry.maxRetries).toBe(5)
    })

    it('should merge nested circuit breaker config', () => {
      const merged = mergeConfig(DEFAULT_ANALYZER_CONFIG, {
        circuitBreaker: { failureThreshold: 10, resetTimeoutMs: 60000 },
      })
      expect(merged.circuitBreaker.failureThreshold).toBe(10)
    })

    it('should handle empty override', () => {
      const merged = mergeConfig(DEFAULT_ANALYZER_CONFIG, {})
      expect(merged).toEqual(DEFAULT_ANALYZER_CONFIG)
    })

    it('should not mutate base config', () => {
      const originalTimeout = DEFAULT_ANALYZER_CONFIG.timeout
      mergeConfig(DEFAULT_ANALYZER_CONFIG, { timeout: 99999 })
      expect(DEFAULT_ANALYZER_CONFIG.timeout).toBe(originalTimeout)
    })

    it('should not mutate override config', () => {
      const override = { timeout: 99999 }
      mergeConfig(DEFAULT_ANALYZER_CONFIG, override)
      expect(override.timeout).toBe(99999)
    })
  })
})

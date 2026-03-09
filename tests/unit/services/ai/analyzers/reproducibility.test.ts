import { describe, it, expect } from 'vitest'
import { FinancialAnalyzer } from '@/services/ai/analyzers/financial-analyzer'
import { MockTimeProvider, SystemTimeProvider, NoOpLogger } from '@/services/ai/analyzers/utils'
import { DeterministicIdGenerator, DefaultIdGenerator } from '@/services/ai/analyzers/types'
import { CONFIG_VERSION } from '@/services/ai/analyzers/config'
import { createMockStatementSet } from './helpers/fixtures'

describe('Reproducibility', () => {
  describe('Config versioning', () => {
    it('should have CONFIG_VERSION defined', () => {
      expect(CONFIG_VERSION).toBeDefined()
      expect(typeof CONFIG_VERSION).toBe('string')
      expect(CONFIG_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('Deterministic ID generation', () => {
    it('should generate deterministic IDs', () => {
      const gen1 = new DeterministicIdGenerator()
      const gen2 = new DeterministicIdGenerator()

      expect(gen1.generateAlertId()).toBe(gen2.generateAlertId())
      expect(gen1.generateRecommendationId()).toBe(gen2.generateRecommendationId())
    })

    it('should generate sequential IDs', () => {
      const gen = new DeterministicIdGenerator()

      expect(gen.generateAlertId()).toBe('alert_deterministic_1')
      expect(gen.generateAlertId()).toBe('alert_deterministic_2')
      expect(gen.generateRecommendationId()).toBe('rec_deterministic_1')
    })

    it('should generate unique IDs within same instance', () => {
      const gen = new DeterministicIdGenerator()

      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        ids.add(gen.generateAlertId())
      }

      expect(ids.size).toBe(10)
    })
  })

  describe('Non-deterministic ID generation', () => {
    it('should generate unique IDs', () => {
      const gen = new DefaultIdGenerator()

      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(gen.generateAlertId())
      }

      expect(ids.size).toBe(100)
    })

    it('should include timestamp in ID', () => {
      const gen = new DefaultIdGenerator()
      const id = gen.generateAlertId()

      expect(id).toMatch(/^alert_\d+_/)
    })

    it('should include random component in ID', () => {
      const gen = new DefaultIdGenerator()
      const id = gen.generateAlertId()

      const parts = id.split('_')
      expect(parts.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Time provider', () => {
    it('should return fixed time in MockTimeProvider', () => {
      const fixedTime = new Date('2024-01-01T00:00:00Z')
      const provider = new MockTimeProvider(fixedTime)

      expect(provider.now()).toEqual(fixedTime)
      expect(provider.now()).toEqual(fixedTime)
    })

    it('should return fixed timestamp in MockTimeProvider', () => {
      const fixedTime = new Date('2024-01-01T00:00:00Z')
      const provider = new MockTimeProvider(fixedTime)

      expect(provider.timestamp()).toBe(fixedTime.getTime())
      expect(provider.timestamp()).toBe(fixedTime.getTime())
    })

    it('should return current time in SystemTimeProvider', () => {
      const provider = new SystemTimeProvider()
      const before = Date.now()
      const result = provider.timestamp()
      const after = Date.now()

      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })

    it('should return Date object in SystemTimeProvider', () => {
      const provider = new SystemTimeProvider()
      const result = provider.now()

      expect(result).toBeInstanceOf(Date)
    })
  })

  describe('NoOpLogger', () => {
    it('should not throw on any log level', () => {
      const logger = new NoOpLogger()

      expect(() => logger.debug('test')).not.toThrow()
      expect(() => logger.info('test')).not.toThrow()
      expect(() => logger.warn('test')).not.toThrow()
      expect(() => logger.error('test')).not.toThrow()
    })
  })

  describe('Deterministic analysis', () => {
    it('should produce identical results with same inputs using create method', () => {
      const fixedTime = new Date('2024-01-01T00:00:00Z')
      const statements = createMockStatementSet()

      const analyzer1 = FinancialAnalyzer.create({
        deterministic: true,
        fixedTimestamp: fixedTime,
      })
      const analyzer2 = FinancialAnalyzer.create({
        deterministic: true,
        fixedTimestamp: fixedTime,
      })

      const result1 = analyzer1.analyze(statements)
      const result2 = analyzer2.analyze(statements)

      expect(result1.data?.overallScore).toBe(result2.data?.overallScore)
    })

    it('should produce consistent analyzedAt with fixed timestamp', () => {
      const fixedTime = new Date('2024-01-01T00:00:00Z')
      const statements = createMockStatementSet()

      const analyzer = FinancialAnalyzer.create({
        deterministic: true,
        fixedTimestamp: fixedTime,
      })

      const result = analyzer.analyze(statements)

      expect(result.data?.analyzedAt).toEqual(fixedTime)
    })
  })

  describe('Config immutability', () => {
    it('should not mutate input config', () => {
      const config = { timeout: 5000 }
      const originalTimeout = config.timeout

      new FinancialAnalyzer(config)

      expect(config.timeout).toBe(originalTimeout)
    })
  })

  describe('Multiple analyses consistency', () => {
    it('should produce consistent results for multiple analyses', () => {
      const statements = createMockStatementSet()
      const analyzer = new FinancialAnalyzer()

      const result1 = analyzer.analyze(statements)
      const result2 = analyzer.analyze(statements)

      expect(result1.data?.overallScore).toBe(result2.data?.overallScore)
      expect(result1.data?.categoryAnalyses.length).toBe(result2.data?.categoryAnalyses.length)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseInfoSource } from '@/services/external-info/sources/base-source'
import type {
  InfoSourceConfig,
  ExternalInfoQuery,
  ExternalInfoResult,
} from '@/services/external-info/types'

class TestableInfoSource extends BaseInfoSource {
  readonly sourceId = 'test_source' as any
  readonly displayName = 'Test Source'

  private fetchResult: ExternalInfoResult

  constructor(config: InfoSourceConfig, fetchResult?: ExternalInfoResult) {
    super(config)
    this.fetchResult =
      fetchResult ??
      ({
        success: true,
        data: [],
        sourceId: 'test_source',
        queryTime: new Date(),
      } as any)
  }

  async fetch(query: ExternalInfoQuery): Promise<ExternalInfoResult> {
    return this.fetchResult
  }
}

function makeConfig(overrides: Partial<InfoSourceConfig> = {}): InfoSourceConfig {
  return {
    id: 'test_source' as any,
    name: 'Test Source',
    description: 'Test source description',
    enabled: true,
    priority: 1,
    timeoutMs: 5000,
    maxRetries: 3,
    retryDelayMs: 1000,
    cacheTtlMs: 60000,
    ...overrides,
  }
}

describe('BaseInfoSource', () => {
  let source: TestableInfoSource

  beforeEach(function () {
    source = new TestableInfoSource(makeConfig())
  })

  describe('getConfig', () => {
    it('should return the source config', function () {
      const config = source.getConfig()

      expect(config.id).toBe('test_source')
      expect(config.name).toBe('Test Source')
    })
  })

  describe('getHealth', () => {
    it('should return initial health status', function () {
      const health = source.getHealth()

      expect(health.sourceId).toBe('test_source')
      expect(health.status).toBe('active')
      expect(health.consecutiveFailures).toBe(0)
    })
  })

  describe('updateConfig', () => {
    it('should update config properties', function () {
      source.updateConfig({ timeoutMs: 10000 })

      const config = source.getConfig()
      expect(config.timeoutMs).toBe(10000)
    })
  })

  describe('isEnabled', () => {
    it('should be enabled by default', function () {
      expect(source.isEnabled()).toBe(true)
    })

    it('should be disabled when config disabled', function () {
      const disabledSource = new TestableInfoSource(makeConfig({ enabled: false }))

      expect(disabledSource.isEnabled()).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('should be available when active', function () {
      expect(source.isAvailable()).toBe(true)
    })
  })

  describe('recordSuccess', () => {
    it('should update health on success', function () {
      source['recordSuccess'](100)

      const health = source.getHealth()
      expect(health.status).toBe('active')
      expect(health.consecutiveFailures).toBe(0)
      expect(health.lastSuccessAt).toBeDefined()
    })
  })

  describe('recordFailure', () => {
    it('should update health on first failure', function () {
      source['recordFailure']('Connection error')

      const health = source.getHealth()
      expect(health.status).toBe('degraded')
      expect(health.consecutiveFailures).toBe(1)
      expect(health.lastError).toBe('Connection error')
    })

    it('should mark unavailable after 3 consecutive failures', function () {
      source['recordFailure']('Error 1')
      source['recordFailure']('Error 2')
      source['recordFailure']('Error 3')

      const health = source.getHealth()
      expect(health.status).toBe('unavailable')
      expect(health.consecutiveFailures).toBe(3)
    })
  })

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async function () {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await source['retryWithBackoff'](operation, 3, 100)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async function () {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')

      const result = await source['retryWithBackoff'](operation, 3, 10)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should throw after all retries exhausted', async function () {
      const operation = vi.fn().mockRejectedValue(new Error('persistent failure'))

      await expect(source['retryWithBackoff'](operation, 2, 10)).rejects.toThrow(
        'persistent failure'
      )
      expect(operation).toHaveBeenCalledTimes(3)
    })
  })

  describe('fetch', () => {
    it('should execute fetch and return result', async function () {
      const result = await source.fetch({ query: 'test', type: 'company_info' } as any)

      expect(result.success).toBe(true)
    })
  })
})

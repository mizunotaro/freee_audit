import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OnePasswordProvider } from '@/lib/secrets/providers/onepassword'
import type { OnePasswordConfig, SecretValue } from '@/lib/secrets/types'

import { fetchWithTimeout } from '@/lib/utils/timeout'

vi.mock('@/lib/utils/timeout', () => ({
  fetchWithTimeout: vi.fn(),
}))

describe('OnePasswordProvider', () => {
  let provider: OnePasswordProvider
  const defaultConfig: OnePasswordConfig = {
    provider: 'onepassword',
    connectHost: 'http://localhost:8080',
    connectToken: 'test-token',
    vaultId: 'test-vault',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OnePasswordProvider(defaultConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create provider with config', () => {
      expect(provider).toBeInstanceOf(OnePasswordProvider)
      expect(provider.type).toBe('onepassword')
    })

    it('should accept cache settings', () => {
      const configWithCache: OnePasswordConfig = {
        ...defaultConfig,
        cacheEnabled: true,
        cacheTTLSeconds: 600,
      }
      const providerWithCache = new OnePasswordProvider(configWithCache)
      expect(providerWithCache).toBeInstanceOf(OnePasswordProvider)
    })
    it('should handle trailing slash in connect host', () => {
      const configWithSlash: OnePasswordConfig = {
        ...defaultConfig,
        connectHost: 'http://localhost:8080/',
      }
      const providerWithSlash = new OnePasswordProvider(configWithSlash)
      expect(providerWithSlash).toBeInstanceOf(OnePasswordProvider)
    })
    it('should work with disabled cache', () => {
      const configNoCache: OnePasswordConfig = {
        ...defaultConfig,
        cacheEnabled: false,
      }
      const providerNoCache = new OnePasswordProvider(configNoCache)
      expect(providerNoCache).toBeInstanceOf(OnePasswordProvider)
    })
  })

  describe('type', () => {
    it('should return onepassword as type', () => {
      expect(provider.type).toBe('onepassword')
    })
  })

  describe('getSecrets', () => {
    it('should get multiple secrets', async () => {
      const mockProvider = {
        getSecret: vi
          .fn()
          .mockResolvedValueOnce({
            name: 'secret-1',
            value: 'value-1',
          } as SecretValue)
          .mockResolvedValueOnce({
            name: 'secret-2',
            value: 'value-2',
          } as SecretValue),
      }
      Object.defineProperty(provider, 'getSecret', {
        value: mockProvider.getSecret,
      })
      const result = await provider.getSecrets(['secret-1', 'secret-2'])
      expect(result.size).toBe(2)
      expect(result.get('secret-1')?.value).toBe('value-1')
      expect(result.get('secret-2')?.value).toBe('value-2')
    })
    it('should handle partial failures', async () => {
      const mockProvider = {
        getSecret: vi
          .fn()
          .mockResolvedValueOnce({
            name: 'secret-1',
            value: 'value-1',
          } as SecretValue)
          .mockResolvedValueOnce(null),
      }
      Object.defineProperty(provider, 'getSecret', {
        value: mockProvider.getSecret,
      })
      const result = await provider.getSecrets(['secret-1', 'non-existent'])
      expect(result.size).toBe(1)
      expect(result.has('secret-1')).toBe(true)
    })
    it('should return empty map for all failures', async () => {
      const mockProvider = {
        getSecret: vi.fn().mockResolvedValue(null),
      }
      Object.defineProperty(provider, 'getSecret', {
        value: mockProvider.getSecret,
      })
      const result = await provider.getSecrets(['non-existent-1', 'non-existent-2'])
      expect(result.size).toBe(0)
    })
  })

  describe('healthCheck', () => {
    it('should return true when 1Password is accessible', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      const result = await provider.healthCheck()
      expect(result).toBe(true)
    })
    it('should return false when 1Password is not accessible', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)
      const result = await provider.healthCheck()
      expect(result).toBe(false)
    })
    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
      const result = await provider.healthCheck()
      expect(result).toBe(false)
    })
  })
})

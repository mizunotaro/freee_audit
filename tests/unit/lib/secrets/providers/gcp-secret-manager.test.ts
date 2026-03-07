import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GCPSecretManagerProvider } from '@/lib/secrets/providers/gcp-secret-manager'
import type { GCPSecretConfig, SecretValue } from '@/lib/secrets/types'

describe('GCPSecretManagerProvider', () => {
  let provider: GCPSecretManagerProvider
  const defaultConfig: GCPSecretConfig = {
    provider: 'gcp_secret',
    projectId: 'test-project',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new GCPSecretManagerProvider(defaultConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create provider with config', () => {
      expect(provider).toBeInstanceOf(GCPSecretManagerProvider)
      expect(provider.type).toBe('gcp_secret')
    })

    it('should accept credentials in config', () => {
      const configWithCreds: GCPSecretConfig = {
        ...defaultConfig,
        credentials: {
          clientEmail: 'test@test-project.iam.gserviceaccount.com',
          privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        },
      }
      const providerWithCreds = new GCPSecretManagerProvider(configWithCreds)

      expect(providerWithCreds).toBeInstanceOf(GCPSecretManagerProvider)
    })

    it('should accept cache settings', () => {
      const configWithCache: GCPSecretConfig = {
        ...defaultConfig,
        cacheEnabled: true,
        cacheTTLSeconds: 600,
      }
      const providerWithCache = new GCPSecretManagerProvider(configWithCache)

      expect(providerWithCache).toBeInstanceOf(GCPSecretManagerProvider)
    })

    it('should work with disabled cache', () => {
      const configNoCache: GCPSecretConfig = {
        ...defaultConfig,
        cacheEnabled: false,
      }
      const providerNoCache = new GCPSecretManagerProvider(configNoCache)

      expect(providerNoCache).toBeInstanceOf(GCPSecretManagerProvider)
    })
  })

  describe('type', () => {
    it('should return gcp_secret as type', () => {
      expect(provider.type).toBe('gcp_secret')
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
})

describe('GCPSecretManagerProvider Error Handling', () => {
  it('should handle initialization error when package not installed', async () => {
    const provider = new GCPSecretManagerProvider({
      provider: 'gcp_secret',
      projectId: 'test-project',
    })

    await expect(provider.getSecret('test')).rejects.toThrow(
      'GCP Secret Manager client initialization failed'
    )
  })

  it('should handle health check error when package not installed', async () => {
    const provider = new GCPSecretManagerProvider({
      provider: 'gcp_secret',
      projectId: 'test-project',
    })

    const result = await provider.healthCheck()
    expect(result).toBe(false)
  })

  it('should handle listSecrets error when package not installed', async () => {
    const provider = new GCPSecretManagerProvider({
      provider: 'gcp_secret',
      projectId: 'test-project',
    })

    await expect(provider.listSecrets()).rejects.toThrow(
      'GCP Secret Manager client initialization failed'
    )
  })
})

describe('GCPSecretManagerProvider Configuration', () => {
  it('should work with various project IDs', () => {
    const projectIds = ['my-project', 'my-project-123', 'PROJECT_ID']

    projectIds.forEach((projectId) => {
      const provider = new GCPSecretManagerProvider({
        provider: 'gcp_secret',
        projectId,
      })
      expect(provider).toBeInstanceOf(GCPSecretManagerProvider)
    })
  })

  it('should create provider with all optional config', () => {
    const provider = new GCPSecretManagerProvider({
      provider: 'gcp_secret',
      projectId: 'test-project',
      credentials: {
        clientEmail: 'test@test.iam.gserviceaccount.com',
        privateKey: 'test-key',
      },
      cacheEnabled: true,
      cacheTTLSeconds: 300,
    })

    expect(provider).toBeInstanceOf(GCPSecretManagerProvider)
  })

  it('should create provider with close method', async () => {
    const provider = new GCPSecretManagerProvider({
      provider: 'gcp_secret',
      projectId: 'test-project',
    })

    await expect(provider.close?.()).resolves.not.toThrow()
  })
})

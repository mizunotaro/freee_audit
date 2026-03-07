import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AWSSecretsManagerProvider } from '@/lib/secrets/providers/aws-secrets-manager'
import type { AWSSecretConfig, SecretValue } from '@/lib/secrets/types'

describe('AWSSecretsManagerProvider', () => {
  let provider: AWSSecretsManagerProvider
  const defaultConfig: AWSSecretConfig = {
    provider: 'aws_secrets',
    region: 'us-east-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new AWSSecretsManagerProvider(defaultConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create provider with config', () => {
      expect(provider).toBeInstanceOf(AWSSecretsManagerProvider)
      expect(provider.type).toBe('aws_secrets')
    })

    it('should accept credentials in config', () => {
      const configWithCreds: AWSSecretConfig = {
        ...defaultConfig,
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      }
      const providerWithCreds = new AWSSecretsManagerProvider(configWithCreds)

      expect(providerWithCreds).toBeInstanceOf(AWSSecretsManagerProvider)
    })

    it('should accept cache settings', () => {
      const configWithCache: AWSSecretConfig = {
        ...defaultConfig,
        cacheEnabled: true,
        cacheTTLSeconds: 600,
      }
      const providerWithCache = new AWSSecretsManagerProvider(configWithCache)

      expect(providerWithCache).toBeInstanceOf(AWSSecretsManagerProvider)
    })

    it('should work with disabled cache', () => {
      const configNoCache: AWSSecretConfig = {
        ...defaultConfig,
        cacheEnabled: false,
      }
      const providerNoCache = new AWSSecretsManagerProvider(configNoCache)

      expect(providerNoCache).toBeInstanceOf(AWSSecretsManagerProvider)
    })
  })

  describe('type', () => {
    it('should return aws_secrets as type', () => {
      expect(provider.type).toBe('aws_secrets')
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

describe('AWSSecretsManagerProvider Error Handling', () => {
  it('should handle initialization error when package not installed', async () => {
    const provider = new AWSSecretsManagerProvider({
      provider: 'aws_secrets',
      region: 'us-east-1',
    })

    await expect(provider.getSecret('test')).rejects.toThrow(
      'AWS Secrets Manager client initialization failed'
    )
  })

  it('should handle health check error when package not installed', async () => {
    const provider = new AWSSecretsManagerProvider({
      provider: 'aws_secrets',
      region: 'us-east-1',
    })

    const result = await provider.healthCheck()
    expect(result).toBe(false)
  })

  it('should handle listSecrets error when package not installed', async () => {
    const provider = new AWSSecretsManagerProvider({
      provider: 'aws_secrets',
      region: 'us-east-1',
    })

    await expect(provider.listSecrets()).rejects.toThrow(
      'AWS Secrets Manager client initialization failed'
    )
  })
})

describe('AWSSecretsManagerProvider Caching', () => {
  it('should use default cache settings when not specified', () => {
    const provider = new AWSSecretsManagerProvider({
      provider: 'aws_secrets',
      region: 'us-east-1',
    })

    expect(provider).toBeInstanceOf(AWSSecretsManagerProvider)
  })

  it('should create provider with custom cache TTL', () => {
    const provider = new AWSSecretsManagerProvider({
      provider: 'aws_secrets',
      region: 'us-east-1',
      cacheEnabled: true,
      cacheTTLSeconds: 600,
    })

    expect(provider).toBeInstanceOf(AWSSecretsManagerProvider)
  })
})

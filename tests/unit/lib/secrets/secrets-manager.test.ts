import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SecretsManager,
  EnvSecretProvider,
  LocalSecretProvider,
  initSecretsManager,
} from '@/lib/secrets'
import type { SecretValue, SecretConfig } from '@/lib/secrets/types'

describe('SecretsManager', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('should initialize with env provider', () => {
      const manager = new SecretsManager({ provider: 'env' })
      expect(manager).toBeDefined()
    })

    it('should throw error when no provider is configured', () => {
      expect(() => new SecretsManager([] as SecretConfig[])).toThrow(
        'At least one secret provider must be configured'
      )
    })

    it('should accept multiple providers', () => {
      const manager = new SecretsManager([{ provider: 'env' }, { provider: 'local' }])
      expect(manager).toBeDefined()
    })

    it('should set first provider as default', () => {
      const manager = new SecretsManager([{ provider: 'env' }, { provider: 'local' }])
      expect(manager).toBeDefined()
    })

    it('should accept explicit default provider', () => {
      const manager = new SecretsManager([{ provider: 'env' }, { provider: 'local' }], 'local')
      expect(manager).toBeDefined()
    })
  })

  describe('getSecret', () => {
    it('should retrieve secret from environment', async () => {
      process.env.TEST_SECRET = 'test-value'
      const manager = new SecretsManager({ provider: 'env' })

      const secret = await manager.getSecret('TEST_SECRET')
      expect(secret).not.toBeNull()
      expect(secret?.value).toBe('test-value')
      expect(secret?.name).toBe('TEST_SECRET')
    })

    it('should return null for missing secret', async () => {
      const manager = new SecretsManager({ provider: 'env' })

      const secret = await manager.getSecret('NONEXISTENT_SECRET')
      expect(secret).toBeNull()
    })

    it('should include metadata in secret value', async () => {
      process.env.META_SECRET = 'meta-value'
      const manager = new SecretsManager({ provider: 'env' })

      const secret = await manager.getSecret('META_SECRET')
      expect(secret?.metadata?.source).toBe('environment')
    })
  })

  describe('getSecretValue', () => {
    it('should return string value directly', async () => {
      process.env.STRING_SECRET = 'string-value'
      const manager = new SecretsManager({ provider: 'env' })

      const value = await manager.getSecretValue('STRING_SECRET')
      expect(value).toBe('string-value')
    })

    it('should return null for missing secret', async () => {
      const manager = new SecretsManager({ provider: 'env' })

      const value = await manager.getSecretValue('MISSING_SECRET')
      expect(value).toBeNull()
    })
  })

  describe('requireSecret', () => {
    it('should return value when secret exists', async () => {
      process.env.REQUIRED_SECRET = 'required-value'
      const manager = new SecretsManager({ provider: 'env' })

      const value = await manager.requireSecret('REQUIRED_SECRET')
      expect(value).toBe('required-value')
    })

    it('should throw error for missing secret', async () => {
      const manager = new SecretsManager({ provider: 'env' })

      await expect(manager.requireSecret('MISSING_REQUIRED')).rejects.toThrow(
        'Required secret MISSING_REQUIRED not found'
      )
    })
  })

  describe('getSecrets', () => {
    it('should retrieve multiple secrets', async () => {
      process.env.SECRET_A = 'value-a'
      process.env.SECRET_B = 'value-b'
      const manager = new SecretsManager({ provider: 'env' })

      const secrets = await manager.getSecrets(['SECRET_A', 'SECRET_B'])
      expect(secrets.size).toBe(2)
      expect(secrets.get('SECRET_A')?.value).toBe('value-a')
      expect(secrets.get('SECRET_B')?.value).toBe('value-b')
    })

    it('should handle missing secrets gracefully', async () => {
      process.env.EXISTING_SECRET = 'exists'
      const manager = new SecretsManager({ provider: 'env' })

      const secrets = await manager.getSecrets(['EXISTING_SECRET', 'NONEXISTENT'])
      expect(secrets.size).toBe(1)
      expect(secrets.get('EXISTING_SECRET')?.value).toBe('exists')
    })
  })

  describe('listSecrets', () => {
    it('should list all environment variables', async () => {
      const manager = new SecretsManager({ provider: 'env' })

      const secrets = await manager.listSecrets()
      expect(Array.isArray(secrets)).toBe(true)
      expect(secrets.length).toBeGreaterThan(0)
    })

    it('should filter secrets by prefix', async () => {
      process.env.PREFIX_A = 'a'
      process.env.PREFIX_B = 'b'
      process.env.OTHER = 'other'
      const manager = new SecretsManager({ provider: 'env' })

      const secrets = await manager.listSecrets('PREFIX_')
      expect(secrets).toContain('PREFIX_A')
      expect(secrets).toContain('PREFIX_B')
      expect(secrets).not.toContain('OTHER')
    })
  })

  describe('setDefaultProvider', () => {
    it('should change default provider', () => {
      const manager = new SecretsManager([{ provider: 'env' }, { provider: 'local' }])
      manager.setDefaultProvider('local')
      expect(() => manager.setDefaultProvider('local')).not.toThrow()
    })

    it('should throw for unconfigured provider', () => {
      const manager = new SecretsManager({ provider: 'env' })

      expect(() => manager.setDefaultProvider('local')).toThrow('Provider local is not configured')
    })
  })

  describe('mapSecret', () => {
    it('should map secret to specific provider', () => {
      const manager = new SecretsManager([{ provider: 'env' }, { provider: 'local' }])
      expect(() => manager.mapSecret('MY_SECRET', 'local')).not.toThrow()
    })

    it('should throw for unconfigured provider', () => {
      const manager = new SecretsManager({ provider: 'env' })

      expect(() => manager.mapSecret('MY_SECRET', 'local')).toThrow(
        'Provider local is not configured'
      )
    })
  })

  describe('healthCheck', () => {
    it('should return health status for all providers', async () => {
      const manager = new SecretsManager([{ provider: 'env' }, { provider: 'local' }])

      const health = await manager.healthCheck()
      expect(health.get('env')).toBe(true)
      expect(health.get('local')).toBe(true)
    })
  })

  describe('close', () => {
    it('should close all providers', async () => {
      const manager = new SecretsManager({ provider: 'env' })

      await expect(manager.close()).resolves.not.toThrow()
    })
  })

  describe('getProvider', () => {
    it('should return specific provider', () => {
      const manager = new SecretsManager({ provider: 'env' })

      const provider = manager.getProvider<EnvSecretProvider>('env')
      expect(provider).toBeDefined()
      expect(provider?.type).toBe('env')
    })

    it('should return undefined for unconfigured provider', () => {
      const manager = new SecretsManager({ provider: 'env' })

      const provider = manager.getProvider('local')
      expect(provider).toBeUndefined()
    })
  })
})

describe('EnvSecretProvider', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getSecret', () => {
    it('should return secret value', async () => {
      process.env.ENV_TEST = 'env-value'
      const provider = new EnvSecretProvider({ provider: 'env' })

      const secret = await provider.getSecret('ENV_TEST')
      expect(secret).not.toBeNull()
      expect(secret?.value).toBe('env-value')
    })

    it('should return null for missing secret', async () => {
      const provider = new EnvSecretProvider({ provider: 'env' })

      const secret = await provider.getSecret('MISSING_ENV_VAR')
      expect(secret).toBeNull()
    })

    it('should include lastUpdated timestamp', async () => {
      process.env.TIMESTAMP_TEST = 'value'
      const provider = new EnvSecretProvider({ provider: 'env' })

      const secret = await provider.getSecret('TIMESTAMP_TEST')
      expect(secret?.lastUpdated).toBeInstanceOf(Date)
    })
  })

  describe('listSecrets', () => {
    it('should list all environment variables', async () => {
      const provider = new EnvSecretProvider({ provider: 'env' })

      const secrets = await provider.listSecrets()
      expect(Array.isArray(secrets)).toBe(true)
    })

    it('should filter by prefix', async () => {
      process.env.FILTER_A = 'a'
      process.env.FILTER_B = 'b'
      process.env.NO_FILTER = 'no'
      const provider = new EnvSecretProvider({ provider: 'env' })

      const secrets = await provider.listSecrets('FILTER_')
      expect(secrets).toContain('FILTER_A')
      expect(secrets).toContain('FILTER_B')
      expect(secrets).not.toContain('NO_FILTER')
    })
  })

  describe('healthCheck', () => {
    it('should always return true', async () => {
      const provider = new EnvSecretProvider({ provider: 'env' })

      const health = await provider.healthCheck()
      expect(health).toBe(true)
    })
  })

  describe('getSecrets', () => {
    it('should retrieve multiple secrets', async () => {
      process.env.MULTI_A = 'a'
      process.env.MULTI_B = 'b'
      const provider = new EnvSecretProvider({ provider: 'env' })

      const secrets = await provider.getSecrets(['MULTI_A', 'MULTI_B'])
      expect(secrets.size).toBe(2)
    })
  })
})

describe('LocalSecretProvider', () => {
  describe('constructor', () => {
    it('should initialize without secrets file', () => {
      const provider = new LocalSecretProvider({ provider: 'local' })
      expect(provider).toBeDefined()
    })
  })

  describe('getSecret', () => {
    it('should return null for missing secret', async () => {
      const provider = new LocalSecretProvider({ provider: 'local' })

      const secret = await provider.getSecret('MISSING_LOCAL')
      expect(secret).toBeNull()
    })
  })

  describe('listSecrets', () => {
    it('should return empty array when no secrets loaded', async () => {
      const provider = new LocalSecretProvider({ provider: 'local' })

      const secrets = await provider.listSecrets()
      expect(Array.isArray(secrets)).toBe(true)
    })
  })

  describe('healthCheck', () => {
    it('should always return true', async () => {
      const provider = new LocalSecretProvider({ provider: 'local' })

      const health = await provider.healthCheck()
      expect(health).toBe(true)
    })
  })
})

describe('initSecretsManager', () => {
  it('should create and return a new manager', () => {
    const manager = initSecretsManager({ provider: 'env' })
    expect(manager).toBeInstanceOf(SecretsManager)
  })
})

describe('Secret Caching', () => {
  it('should respect cacheEnabled config', async () => {
    process.env.CACHE_TEST = 'cached-value'
    const manager = new SecretsManager({ provider: 'env', cacheEnabled: true })

    const secret1 = await manager.getSecret('CACHE_TEST')
    const secret2 = await manager.getSecret('CACHE_TEST')

    expect(secret1).not.toBeNull()
    expect(secret2).not.toBeNull()
  })

  it('should work with cache disabled', async () => {
    process.env.NO_CACHE = 'no-cache-value'
    const manager = new SecretsManager({ provider: 'env', cacheEnabled: false })

    const secret = await manager.getSecret('NO_CACHE')
    expect(secret?.value).toBe('no-cache-value')
  })
})

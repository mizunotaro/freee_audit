import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AzureKeyVaultProvider } from '@/lib/secrets/providers/azure-keyvault'
import type { AzureKeyVaultConfig, SecretValue } from '@/lib/secrets/types'

describe('AzureKeyVaultProvider', () => {
  let provider: AzureKeyVaultProvider
  const defaultConfig: AzureKeyVaultConfig = {
    provider: 'azure_keyvault',
    vaultUrl: 'https://test-vault.vault.azure.net',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new AzureKeyVaultProvider(defaultConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create provider with config', () => {
      expect(provider).toBeInstanceOf(AzureKeyVaultProvider)
      expect(provider.type).toBe('azure_keyvault')
    })

    it('should accept client credentials', () => {
      const configWithCreds: AzureKeyVaultConfig = {
        ...defaultConfig,
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'secret-123',
      }
      const providerWithCreds = new AzureKeyVaultProvider(configWithCreds)

      expect(providerWithCreds).toBeInstanceOf(AzureKeyVaultProvider)
    })

    it('should accept cache settings', () => {
      const configWithCache: AzureKeyVaultConfig = {
        ...defaultConfig,
        cacheEnabled: true,
        cacheTTLSeconds: 600,
      }
      const providerWithCache = new AzureKeyVaultProvider(configWithCache)

      expect(providerWithCache).toBeInstanceOf(AzureKeyVaultProvider)
    })

    it('should work with disabled cache', () => {
      const configNoCache: AzureKeyVaultConfig = {
        ...defaultConfig,
        cacheEnabled: false,
      }
      const providerNoCache = new AzureKeyVaultProvider(configNoCache)

      expect(providerNoCache).toBeInstanceOf(AzureKeyVaultProvider)
    })
  })

  describe('type', () => {
    it('should return azure_keyvault as type', () => {
      expect(provider.type).toBe('azure_keyvault')
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

describe('AzureKeyVaultProvider Error Handling', () => {
  it('should handle initialization error when package not installed', async () => {
    const provider = new AzureKeyVaultProvider({
      provider: 'azure_keyvault',
      vaultUrl: 'https://test-vault.vault.azure.net',
    })

    await expect(provider.getSecret('test')).rejects.toThrow(
      'Azure Key Vault client initialization failed'
    )
  })

  it('should handle health check error when package not installed', async () => {
    const provider = new AzureKeyVaultProvider({
      provider: 'azure_keyvault',
      vaultUrl: 'https://test-vault.vault.azure.net',
    })

    const result = await provider.healthCheck()
    expect(result).toBe(false)
  })

  it('should handle listSecrets error when package not installed', async () => {
    const provider = new AzureKeyVaultProvider({
      provider: 'azure_keyvault',
      vaultUrl: 'https://test-vault.vault.azure.net',
    })

    await expect(provider.listSecrets()).rejects.toThrow(
      'Azure Key Vault client initialization failed'
    )
  })
})

describe('AzureKeyVaultProvider Configuration', () => {
  it('should work with various vault URLs', () => {
    const urls = [
      'https://my-vault.vault.azure.net',
      'https://my-vault.vault.usgovcloudapi.net',
      'https://my-vault.vault.chinacloudapi.cn',
    ]

    urls.forEach((url) => {
      const provider = new AzureKeyVaultProvider({
        provider: 'azure_keyvault',
        vaultUrl: url,
      })
      expect(provider).toBeInstanceOf(AzureKeyVaultProvider)
    })
  })

  it('should create provider with all optional config', () => {
    const provider = new AzureKeyVaultProvider({
      provider: 'azure_keyvault',
      vaultUrl: 'https://test.vault.azure.net',
      tenantId: 'tenant-123',
      clientId: 'client-123',
      clientSecret: 'secret-123',
      cacheEnabled: true,
      cacheTTLSeconds: 300,
    })

    expect(provider).toBeInstanceOf(AzureKeyVaultProvider)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiKeyService, getAPIKey, requireAPIKey } from '@/services/secrets/api-key-service'
import { getSecretsManager } from '@/lib/secrets'
import { decrypt } from '@/lib/crypto'
import { prisma } from '@/lib/db'

vi.mock('@/lib/secrets', () => ({
  getSecretsManager: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    settings: {
      findFirst: vi.fn(),
    },
  },
}))

describe('api-key-service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    apiKeyService.clearCache()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getAPIKey', () => {
    it('should return API key from environment', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key'

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      vi.mocked(prisma.settings.findFirst).mockResolvedValue(null)

      const result = await apiKeyService.getAPIKey('openai')

      expect(result).not.toBeNull()
      expect(result?.key).toBe('test-openai-key')
    })

    it('should return null when no key available', async () => {
      delete process.env.OPENAI_API_KEY

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      vi.mocked(prisma.settings.findFirst).mockResolvedValue(null)

      const result = await apiKeyService.getAPIKey('openai')

      expect(result).toBeNull()
    })

    it('should return cached key', async () => {
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      await apiKeyService.getAPIKey('openai')
      await apiKeyService.getAPIKey('openai')

      expect(getSecretsManager).toHaveBeenCalledTimes(1)
    })

    it('should get key from secret manager', async () => {
      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue({
          value: 'secret-key',
          version: '1',
          lastUpdated: new Date(),
        }),
      } as any)

      const result = await apiKeyService.getAPIKey('openai')

      expect(result?.key).toBe('secret-key')
    })

    it('should get key from database', async () => {
      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      vi.mocked(decrypt).mockReturnValue('decrypted-key')
      vi.mocked(prisma.settings.findFirst).mockResolvedValue({
        openaiApiKey: 'encrypted-key',
      } as any)

      const result = await apiKeyService.getAPIKey('openai')

      expect(result?.key).toBe('decrypted-key')
    })

    it('should return endpoint for azure', async () => {
      process.env.AZURE_OPENAI_API_KEY = 'azure-key'
      process.env.AZURE_OPENAI_ENDPOINT = 'https://azure.example.com'

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      const result = await apiKeyService.getAPIKey('azure')

      expect(result?.endpoint).toBe('https://azure.example.com')
    })

    it('should get openrouter key from environment', async () => {
      process.env.OPENROUTER_API_KEY = 'openrouter-key'

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      const result = await apiKeyService.getAPIKey('openrouter')

      expect(result?.key).toBe('openrouter-key')
      expect(result?.provider).toBe('openrouter')
    })

    it('should handle secret manager error gracefully', async () => {
      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockRejectedValue(new Error('Secret manager error')),
      } as any)

      delete process.env.OPENAI_API_KEY
      vi.mocked(prisma.settings.findFirst).mockResolvedValue(null)

      const result = await apiKeyService.getAPIKey('openai')

      expect(result).toBeNull()
    })

    it('should handle database error gracefully', async () => {
      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      vi.mocked(prisma.settings.findFirst).mockRejectedValue(new Error('DB error'))

      delete process.env.OPENAI_API_KEY

      const result = await apiKeyService.getAPIKey('openai')

      expect(result).toBeNull()
    })

    it('should support all provider types', async () => {
      const providers = [
        'openai',
        'gemini',
        'claude',
        'azure',
        'aws',
        'gcp',
        'freee',
        'openrouter',
      ] as const

      for (const provider of providers) {
        process.env[getEnvKey(provider)] = `test-${provider}-key`

        vi.mocked(getSecretsManager).mockReturnValue({
          getSecret: vi.fn().mockResolvedValue(null),
        } as any)

        const result = await apiKeyService.getAPIKey(provider)
        expect(result?.key).toBe(`test-${provider}-key`)
        apiKeyService.clearCache()
      }
    })
  })

  describe('clearCache', () => {
    it('should clear all cache', async () => {
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      await apiKeyService.getAPIKey('openai')
      apiKeyService.clearCache()
      await apiKeyService.getAPIKey('openai')

      expect(getSecretsManager).toHaveBeenCalledTimes(2)
    })

    it('should clear cache for specific provider', async () => {
      process.env.OPENAI_API_KEY = 'openai-key'
      process.env.GEMINI_API_KEY = 'gemini-key'

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      await apiKeyService.getAPIKey('openai')
      await apiKeyService.getAPIKey('gemini')

      apiKeyService.clearCache('openai')

      await apiKeyService.getAPIKey('openai')
      await apiKeyService.getAPIKey('gemini')

      expect(getSecretsManager).toHaveBeenCalledTimes(3)
    })
  })

  describe('healthCheck', () => {
    it('should return health status for all providers', async () => {
      process.env.OPENAI_API_KEY = 'test-key'

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      const result = await apiKeyService.healthCheck()

      expect(result.size).toBe(8)
      expect(result.get('openai')?.available).toBe(true)
    })

    it('should mark provider as unavailable when no key', async () => {
      delete process.env.OPENAI_API_KEY

      vi.mocked(getSecretsManager).mockReturnValue({
        getSecret: vi.fn().mockResolvedValue(null),
      } as any)

      vi.mocked(prisma.settings.findFirst).mockResolvedValue(null)

      const result = await apiKeyService.healthCheck()

      expect(result.get('openai')?.available).toBe(false)
    })
  })
})

describe('getAPIKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiKeyService.clearCache()
  })

  it('should return key string', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    vi.mocked(getSecretsManager).mockReturnValue({
      getSecret: vi.fn().mockResolvedValue(null),
    } as any)

    const result = await getAPIKey('openai')

    expect(result).toBe('test-key')
  })

  it('should return null when no key', async () => {
    delete process.env.OPENAI_API_KEY

    vi.mocked(getSecretsManager).mockReturnValue({
      getSecret: vi.fn().mockResolvedValue(null),
    } as any)

    vi.mocked(prisma.settings.findFirst).mockResolvedValue(null)

    const result = await getAPIKey('openai')

    expect(result).toBeNull()
  })
})

describe('requireAPIKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiKeyService.clearCache()
  })

  it('should return key when available', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    vi.mocked(getSecretsManager).mockReturnValue({
      getSecret: vi.fn().mockResolvedValue(null),
    } as any)

    const result = await requireAPIKey('openai')

    expect(result).toBe('test-key')
  })

  it('should throw error when no key', async () => {
    delete process.env.OPENAI_API_KEY

    vi.mocked(getSecretsManager).mockReturnValue({
      getSecret: vi.fn().mockResolvedValue(null),
    } as any)

    vi.mocked(prisma.settings.findFirst).mockResolvedValue(null)

    await expect(requireAPIKey('openai')).rejects.toThrow(
      'openai API key is required but not configured'
    )
  })
})

function getEnvKey(provider: string): string {
  const mapping: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    claude: 'ANTHROPIC_API_KEY',
    azure: 'AZURE_OPENAI_API_KEY',
    aws: 'AWS_ACCESS_KEY_ID',
    gcp: 'GOOGLE_APPLICATION_CREDENTIALS',
    freee: 'FREEE_CLIENT_SECRET',
    openrouter: 'OPENROUTER_API_KEY',
  }
  return mapping[provider]
}

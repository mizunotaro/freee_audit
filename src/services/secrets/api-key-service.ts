import { getSecretsManager } from '@/lib/secrets'
import { decrypt } from '@/lib/crypto'
import { prisma } from '@/lib/db'

export type AIProvider =
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'azure'
  | 'aws'
  | 'gcp'
  | 'freee'
  | 'openrouter'

export interface APIKeyMetadata {
  zdr?: boolean
  dataResidency?: 'US' | 'EU' | 'GLOBAL'
  [key: string]: string | boolean | undefined
}

export interface APIKeyConfig {
  provider: AIProvider
  key: string
  endpoint?: string
  region?: string
  projectId?: string
  metadata?: APIKeyMetadata
}

export interface APIKeySource {
  source: 'database' | 'gcp_secret' | 'aws_secrets' | 'azure_keyvault' | 'onepassword' | 'env'
  lastFetched: Date
  cached: boolean
}

class APIKeyService {
  private cache: Map<string, { config: APIKeyConfig; source: APIKeySource; expiresAt: number }> =
    new Map()
  private cacheTTL = 5 * 60 * 1000

  async getAPIKey(
    provider: APIKeyConfig['provider'],
    options?: {
      userId?: string
      companyId?: string
      preferSecretManager?: boolean
    }
  ): Promise<APIKeyConfig | null> {
    const cacheKey = `${provider}:${options?.userId || 'default'}:${options?.companyId || 'default'}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.config,
        metadata: {
          ...cached.config.metadata,
          source: String(cached.source.source),
          cached: 'true',
        },
      }
    }

    const result = await this.fetchAPIKey(provider, options)
    if (result) {
      this.cache.set(cacheKey, {
        config: result.config,
        source: result.source,
        expiresAt: Date.now() + this.cacheTTL,
      })
    }

    return result?.config || null
  }

  private async fetchAPIKey(
    provider: APIKeyConfig['provider'],
    options?: {
      userId?: string
      companyId?: string
      preferSecretManager?: boolean
    }
  ): Promise<{ config: APIKeyConfig; source: APIKeySource } | null> {
    if (options?.preferSecretManager !== false) {
      const fromSecretManager = await this.getFromSecretManager(provider)
      if (fromSecretManager) {
        return {
          config: fromSecretManager,
          source: {
            source: this.detectSecretSource(),
            lastFetched: new Date(),
            cached: false,
          },
        }
      }
    }

    const fromDB = await this.getFromDatabase(provider, options?.userId)
    if (fromDB) {
      return {
        config: fromDB,
        source: {
          source: 'database',
          lastFetched: new Date(),
          cached: false,
        },
      }
    }

    const fromEnv = this.getFromEnvironment(provider)
    if (fromEnv) {
      return {
        config: fromEnv,
        source: {
          source: 'env',
          lastFetched: new Date(),
          cached: false,
        },
      }
    }

    return null
  }

  private async getFromSecretManager(
    provider: APIKeyConfig['provider']
  ): Promise<APIKeyConfig | null> {
    try {
      const manager = getSecretsManager()
      const secretName = this.getSecretName(provider)
      const secret = await manager.getSecret(secretName)

      if (!secret) return null

      return {
        provider,
        key: secret.value,
        metadata: {
          secretName,
          ...(secret.version ? { secretVersion: secret.version } : {}),
          ...(secret.lastUpdated ? { lastUpdated: secret.lastUpdated.toISOString() } : {}),
        },
      }
    } catch (error) {
      console.error(`Failed to get ${provider} API key from secret manager:`, error)
      return null
    }
  }

  private async getFromDatabase(
    provider: APIKeyConfig['provider'],
    userId?: string
  ): Promise<APIKeyConfig | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settings = await (prisma as any).settings.findFirst({
        where: {
          userId: userId || undefined,
        },
      })

      if (!settings) return null

      const keyField = this.getDatabaseKeyField(provider)
      const encryptedKey = settings[keyField]

      if (!encryptedKey) return null

      const decryptedKey = decrypt(encryptedKey)

      const config: APIKeyConfig = {
        provider,
        key: decryptedKey,
      }

      if (provider === 'azure' && settings.azureEndpoint) {
        config.endpoint = settings.azureEndpoint
      }

      if (provider === 'aws') {
        config.region = settings.awsRegion || undefined
      }

      if (settings.aiZdrEnabled !== undefined || settings.aiDataResidency) {
        config.metadata = {
          zdr: settings.aiZdrEnabled ?? undefined,
          dataResidency: settings.aiDataResidency || undefined,
        }
      }

      return config
    } catch (error) {
      console.error(`Failed to get ${provider} API key from database:`, error)
      return null
    }
  }

  private getFromEnvironment(provider: APIKeyConfig['provider']): APIKeyConfig | null {
    const envMapping: Record<APIKeyConfig['provider'], { key: string; endpoint?: string }> = {
      openai: { key: 'OPENAI_API_KEY' },
      gemini: { key: 'GEMINI_API_KEY' },
      claude: { key: 'ANTHROPIC_API_KEY' },
      azure: { key: 'AZURE_OPENAI_API_KEY', endpoint: 'AZURE_OPENAI_ENDPOINT' },
      aws: { key: 'AWS_ACCESS_KEY_ID' },
      gcp: { key: 'GOOGLE_APPLICATION_CREDENTIALS' },
      freee: { key: 'FREEE_CLIENT_SECRET' },
      openrouter: { key: 'OPENROUTER_API_KEY' },
    }

    const mapping = envMapping[provider]
    const key = process.env[mapping.key]

    if (!key) return null

    const config: APIKeyConfig = {
      provider,
      key,
    }

    if (mapping.endpoint) {
      config.endpoint = process.env[mapping.endpoint]
    }

    return config
  }

  private getSecretName(provider: APIKeyConfig['provider']): string {
    const prefix = process.env.SECRET_PREFIX || 'api-keys'
    return `${prefix}/${provider}`
  }

  private getDatabaseKeyField(provider: APIKeyConfig['provider']): string {
    const fieldMapping: Record<APIKeyConfig['provider'], string> = {
      openai: 'openaiApiKey',
      gemini: 'geminiApiKey',
      claude: 'claudeApiKey',
      azure: 'azureApiKey',
      aws: 'awsSecretAccessKey',
      gcp: 'gcpApiKey',
      freee: 'freeeClientSecret',
      openrouter: 'openrouterApiKey',
    }
    return fieldMapping[provider]
  }

  private detectSecretSource(): APIKeySource['source'] {
    const source = process.env.SECRET_PROVIDER
    if (source === 'gcp_secret') return 'gcp_secret'
    if (source === 'aws_secrets') return 'aws_secrets'
    if (source === 'azure_keyvault') return 'azure_keyvault'
    if (source === 'onepassword') return 'onepassword'
    return 'env'
  }

  clearCache(provider?: APIKeyConfig['provider']): void {
    if (provider) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(provider)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  async healthCheck(): Promise<
    Map<APIKeyConfig['provider'], { available: boolean; source: string }>
  > {
    const results = new Map<APIKeyConfig['provider'], { available: boolean; source: string }>()

    const providers: APIKeyConfig['provider'][] = [
      'openai',
      'gemini',
      'claude',
      'azure',
      'aws',
      'gcp',
      'freee',
      'openrouter',
    ]

    await Promise.all(
      providers.map(async (provider) => {
        try {
          const config = await this.getAPIKey(provider, { preferSecretManager: true })
          results.set(provider, {
            available: !!config,
            source: typeof config?.metadata?.source === 'string' ? config.metadata.source : 'none',
          })
        } catch {
          results.set(provider, {
            available: false,
            source: 'error',
          })
        }
      })
    )

    return results
  }
}

export const apiKeyService = new APIKeyService()

export async function getAPIKey(
  provider: APIKeyConfig['provider'],
  options?: {
    userId?: string
    companyId?: string
    preferSecretManager?: boolean
  }
): Promise<string | null> {
  const config = await apiKeyService.getAPIKey(provider, options)
  return config?.key || null
}

export async function requireAPIKey(
  provider: APIKeyConfig['provider'],
  options?: {
    userId?: string
    companyId?: string
    preferSecretManager?: boolean
  }
): Promise<string> {
  const key = await getAPIKey(provider, options)
  if (!key) {
    throw new Error(`${provider} API key is required but not configured`)
  }
  return key
}

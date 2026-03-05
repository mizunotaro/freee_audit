export type SecretProviderType =
  | 'local'
  | 'env'
  | 'gcp_secret'
  | 'aws_secrets'
  | 'azure_keyvault'
  | 'onepassword'
  | 'lastpass'

export interface SecretConfig {
  provider: SecretProviderType
  cacheEnabled?: boolean
  cacheTTLSeconds?: number
}

export interface GCPSecretConfig extends SecretConfig {
  provider: 'gcp_secret'
  projectId: string
  credentials?: {
    clientEmail: string
    privateKey: string
  }
}

export interface AWSSecretConfig extends SecretConfig {
  provider: 'aws_secrets'
  region: string
  accessKeyId?: string
  secretAccessKey?: string
}

export interface AzureKeyVaultConfig extends SecretConfig {
  provider: 'azure_keyvault'
  vaultUrl: string
  tenantId?: string
  clientId?: string
  clientSecret?: string
}

export interface OnePasswordConfig extends SecretConfig {
  provider: 'onepassword'
  connectHost: string
  connectToken: string
  vaultId: string
}

export interface LastPassConfig extends SecretConfig {
  provider: 'lastpass'
  clientId: string
  clientSecret: string
}

export interface LocalSecretConfig extends SecretConfig {
  provider: 'local'
  encryptionKey?: string
}

export type AnySecretConfig =
  | GCPSecretConfig
  | AWSSecretConfig
  | AzureKeyVaultConfig
  | OnePasswordConfig
  | LastPassConfig
  | LocalSecretConfig
  | SecretConfig

export interface SecretValue {
  name: string
  value: string
  version?: string
  lastUpdated?: Date
  metadata?: Record<string, string | boolean | number | undefined>
}

export interface SecretProvider {
  type: SecretProviderType
  getSecret(name: string): Promise<SecretValue | null>
  getSecrets(names: string[]): Promise<Map<string, SecretValue>>
  listSecrets(prefix?: string): Promise<string[]>
  healthCheck(): Promise<boolean>
  close?(): Promise<void>
}

export abstract class BaseSecretProvider implements SecretProvider {
  abstract type: SecretProviderType
  protected config: SecretConfig
  private cache: Map<string, { value: SecretValue; expiresAt: number }> = new Map()

  constructor(config: SecretConfig) {
    this.config = {
      cacheEnabled: true,
      cacheTTLSeconds: 300,
      ...config,
    }
  }

  abstract getSecret(name: string): Promise<SecretValue | null>
  abstract listSecrets(prefix?: string): Promise<string[]>
  abstract healthCheck(): Promise<boolean>

  async getSecrets(names: string[]): Promise<Map<string, SecretValue>> {
    const results = new Map<string, SecretValue>()
    await Promise.all(
      names.map(async (name) => {
        const secret = await this.getSecret(name)
        if (secret) {
          results.set(name, secret)
        }
      })
    )
    return results
  }

  protected getCached(name: string): SecretValue | null {
    if (!this.config.cacheEnabled) return null

    const cached = this.cache.get(name)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }
    return null
  }

  protected setCache(name: string, value: SecretValue): void {
    if (!this.config.cacheEnabled) return

    this.cache.set(name, {
      value,
      expiresAt: Date.now() + (this.config.cacheTTLSeconds || 300) * 1000,
    })
  }

  protected clearCache(name?: string): void {
    if (name) {
      this.cache.delete(name)
    } else {
      this.cache.clear()
    }
  }

  async close(): Promise<void> {
    this.clearCache()
  }
}

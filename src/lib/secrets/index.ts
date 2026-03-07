import {
  BaseSecretProvider,
  type AnySecretConfig,
  type SecretProvider,
  type SecretValue,
  type SecretProviderType,
  type GCPSecretConfig,
  type AWSSecretConfig,
  type AzureKeyVaultConfig,
  type OnePasswordConfig,
  type LocalSecretConfig,
} from './types'
import { GCPSecretManagerProvider } from './providers/gcp-secret-manager'
import { AWSSecretsManagerProvider } from './providers/aws-secrets-manager'
import { AzureKeyVaultProvider } from './providers/azure-keyvault'
import { OnePasswordProvider } from './providers/onepassword'

export * from './types'

export class SecretsManager {
  private providers: Map<SecretProviderType, SecretProvider> = new Map()
  private defaultProvider: SecretProviderType
  private secretMapping: Map<string, SecretProviderType> = new Map()

  constructor(configs: AnySecretConfig | AnySecretConfig[], defaultProvider?: SecretProviderType) {
    const configArray = Array.isArray(configs) ? configs : [configs]

    for (const config of configArray) {
      const provider = this.createProvider(config)
      this.providers.set(config.provider, provider)
    }

    this.defaultProvider = defaultProvider || this.providers.keys().next().value || 'env'

    if (this.providers.size === 0) {
      throw new Error('At least one secret provider must be configured')
    }
  }

  private createProvider(config: AnySecretConfig): SecretProvider {
    switch (config.provider) {
      case 'gcp_secret':
        return new GCPSecretManagerProvider(config as GCPSecretConfig)
      case 'aws_secrets':
        return new AWSSecretsManagerProvider(config as AWSSecretConfig)
      case 'azure_keyvault':
        return new AzureKeyVaultProvider(config as AzureKeyVaultConfig)
      case 'onepassword':
        return new OnePasswordProvider(config as OnePasswordConfig)
      case 'local':
        return new LocalSecretProvider(config as LocalSecretConfig)
      case 'env':
      default:
        return new EnvSecretProvider(config)
    }
  }

  setDefaultProvider(type: SecretProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Provider ${type} is not configured`)
    }
    this.defaultProvider = type
  }

  mapSecret(secretName: string, providerType: SecretProviderType): void {
    if (!this.providers.has(providerType)) {
      throw new Error(`Provider ${providerType} is not configured`)
    }
    this.secretMapping.set(secretName, providerType)
  }

  private getProviderForSecret(name: string): SecretProvider {
    const providerType = this.secretMapping.get(name) || this.defaultProvider
    const provider = this.providers.get(providerType)

    if (!provider) {
      throw new Error(`Provider ${providerType} is not available`)
    }

    return provider
  }

  async getSecret(name: string): Promise<SecretValue | null> {
    const provider = this.getProviderForSecret(name)
    return provider.getSecret(name)
  }

  async getSecretValue(name: string): Promise<string | null> {
    const secret = await this.getSecret(name)
    return secret?.value || null
  }

  async requireSecret(name: string): Promise<string> {
    const value = await this.getSecretValue(name)
    if (value === null) {
      throw new Error(`Required secret ${name} not found`)
    }
    return value
  }

  async getSecrets(names: string[]): Promise<Map<string, SecretValue>> {
    const results = new Map<string, SecretValue>()

    const byProvider = new Map<SecretProviderType, string[]>()
    for (const name of names) {
      const providerType = this.secretMapping.get(name) || this.defaultProvider
      if (!byProvider.has(providerType)) {
        byProvider.set(providerType, [])
      }
      byProvider.get(providerType)!.push(name)
    }

    await Promise.all(
      Array.from(byProvider.entries()).map(async ([providerType, secretNames]) => {
        const provider = this.providers.get(providerType)
        if (!provider) return

        const providerResults = await provider.getSecrets(secretNames)
        for (const [name, value] of providerResults) {
          results.set(name, value)
        }
      })
    )

    return results
  }

  async listSecrets(prefix?: string, providerType?: SecretProviderType): Promise<string[]> {
    const provider = providerType
      ? this.providers.get(providerType)
      : this.providers.get(this.defaultProvider)

    if (!provider) {
      throw new Error(`Provider ${providerType || this.defaultProvider} is not available`)
    }

    return provider.listSecrets(prefix)
  }

  async healthCheck(): Promise<Map<SecretProviderType, boolean>> {
    const results = new Map<SecretProviderType, boolean>()

    await Promise.all(
      Array.from(this.providers.entries()).map(async ([type, provider]) => {
        try {
          results.set(type, await provider.healthCheck())
        } catch {
          results.set(type, false)
        }
      })
    )

    return results
  }

  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.providers.values()).map(async (provider) => {
        if (provider.close) {
          await provider.close()
        }
      })
    )
  }

  getProvider<T extends SecretProvider>(type: SecretProviderType): T | undefined {
    return this.providers.get(type) as T | undefined
  }
}

export class EnvSecretProvider extends BaseSecretProvider {
  type = 'env' as const

  async getSecret(name: string): Promise<SecretValue | null> {
    const value = process.env[name]
    if (!value) return null

    return {
      name,
      value,
      lastUpdated: new Date(),
      metadata: {
        source: 'environment',
      },
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    const names = Object.keys(process.env)
    if (prefix) {
      return names.filter((n) => n.startsWith(prefix))
    }
    return names
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}

export class LocalSecretProvider extends BaseSecretProvider {
  type = 'local' as const
  private secrets: Map<string, SecretValue> = new Map()

  constructor(config: LocalSecretConfig) {
    super(config)
    this.loadSecrets()
  }

  private loadSecrets(): void {
    const secretsPath = process.env.LOCAL_SECRETS_PATH || './secrets.json'
    try {
       
      const fs = require('fs')
      if (fs.existsSync(secretsPath)) {
        const data = fs.readFileSync(secretsPath, 'utf-8')
        const secrets = JSON.parse(data)
        for (const [name, value] of Object.entries(secrets)) {
          this.secrets.set(name, {
            name,
            value: value as string,
            lastUpdated: new Date(),
            metadata: {
              source: 'local',
              path: secretsPath,
            },
          })
        }
      }
    } catch (error) {
      console.error('Failed to load local secrets:', error)
    }
  }

  async getSecret(name: string): Promise<SecretValue | null> {
    return this.secrets.get(name) || null
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    let names = Array.from(this.secrets.keys())
    if (prefix) {
      names = names.filter((n) => n.startsWith(prefix))
    }
    return names
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}

let secretsManager: SecretsManager | null = null

export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    const configs = getSecretConfigs()
    secretsManager = new SecretsManager(configs, getSecretProviderFromEnv())
  }
  return secretsManager
}

export function initSecretsManager(
  configs: AnySecretConfig | AnySecretConfig[],
  defaultProvider?: SecretProviderType
): SecretsManager {
  secretsManager = new SecretsManager(configs, defaultProvider)
  return secretsManager
}

function getSecretProviderFromEnv(): SecretProviderType {
  return (process.env.SECRET_PROVIDER as SecretProviderType) || 'env'
}

function getSecretConfigs(): AnySecretConfig[] {
  const configs: AnySecretConfig[] = []

  if (process.env.GCP_PROJECT_ID) {
    configs.push({
      provider: 'gcp_secret',
      projectId: process.env.GCP_PROJECT_ID,
    } as GCPSecretConfig)
  }

  if (process.env.AWS_REGION) {
    configs.push({
      provider: 'aws_secrets',
      region: process.env.AWS_REGION,
    } as AWSSecretConfig)
  }

  if (process.env.AZURE_KEYVAULT_URL) {
    configs.push({
      provider: 'azure_keyvault',
      vaultUrl: process.env.AZURE_KEYVAULT_URL,
    } as AzureKeyVaultConfig)
  }

  if (process.env.ONEPASSWORD_CONNECT_HOST && process.env.ONEPASSWORD_CONNECT_TOKEN) {
    configs.push({
      provider: 'onepassword',
      connectHost: process.env.ONEPASSWORD_CONNECT_HOST,
      connectToken: process.env.ONEPASSWORD_CONNECT_TOKEN,
      vaultId: process.env.ONEPASSWORD_VAULT_ID || '',
    } as OnePasswordConfig)
  }

  configs.push({ provider: 'env' })

  return configs
}

export async function getSecret(name: string): Promise<string | null> {
  const manager = getSecretsManager()
  return manager.getSecretValue(name)
}

export async function requireSecret(name: string): Promise<string> {
  const manager = getSecretsManager()
  return manager.requireSecret(name)
}

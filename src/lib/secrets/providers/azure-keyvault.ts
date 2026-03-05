import { BaseSecretProvider, type AzureKeyVaultConfig, type SecretValue } from '../types'

interface AzureKeyVaultClient {
  getSecret(
    secretName: string,
    options?: { version?: string }
  ): Promise<{
    name: string
    value: string
    version?: string
    lastUpdated?: Date
    enabled?: boolean
  }>
  listSecrets(): Promise<Array<{ name: string; id: string }>>
}

export class AzureKeyVaultProvider extends BaseSecretProvider {
  type = 'azure_keyvault' as const
  private azureConfig: AzureKeyVaultConfig
  private client: AzureKeyVaultClient | null = null

  constructor(config: AzureKeyVaultConfig) {
    super(config)
    this.azureConfig = config
  }

  private async createClient(): Promise<AzureKeyVaultClient> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity')
      const { SecretClient } = await import('@azure/keyvault-secrets')

      const credential =
        this.azureConfig.clientId && this.azureConfig.clientSecret
          ? new DefaultAzureCredential()
          : new DefaultAzureCredential()

      const client = new SecretClient(this.azureConfig.vaultUrl, credential)

      return {
        getSecret: async (secretName, options) => {
          const secret = await client.getSecret(secretName, { version: options?.version })
          return {
            name: secret.name,
            value: secret.value || '',
            version: secret.properties.version,
            lastUpdated: secret.properties.updatedOn,
            enabled: secret.properties.enabled,
          }
        },
        listSecrets: async () => {
          const secrets: Array<{ name: string; id: string }> = []
          for await (const secret of client.listPropertiesOfSecrets()) {
            secrets.push({
              name: secret.name,
              id: secret.id,
            })
          }
          return secrets
        },
      }
    } catch (error) {
      console.error('Failed to initialize Azure Key Vault client:', error)
      throw new Error(
        'Azure Key Vault client initialization failed. Install @azure/keyvault-secrets and @azure/identity packages.'
      )
    }
  }

  private async getClient(): Promise<AzureKeyVaultClient> {
    if (!this.client) {
      this.client = await this.createClient()
    }
    return this.client
  }

  async getSecret(name: string): Promise<SecretValue | null> {
    const cached = this.getCached(name)
    if (cached) return cached

    try {
      const client = await this.getClient()
      const secret = await client.getSecret(name)

      if (!secret.enabled) {
        return null
      }

      const secretValue: SecretValue = {
        name: secret.name,
        value: secret.value,
        version: secret.version,
        lastUpdated: secret.lastUpdated,
        metadata: {
          vaultUrl: this.azureConfig.vaultUrl,
          enabled: String(secret.enabled),
        },
      }

      this.setCache(name, secretValue)
      return secretValue
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return null
      }
      console.error(`Failed to get secret ${name} from Azure Key Vault:`, error)
      throw error
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    try {
      const client = await this.getClient()
      const secrets = await client.listSecrets()
      let names = secrets.map((s) => s.name)

      if (prefix) {
        names = names.filter((n) => n.startsWith(prefix))
      }

      return names
    } catch (error) {
      console.error('Failed to list secrets from Azure Key Vault:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient()
      const secrets = await client.listSecrets()
      return Array.isArray(secrets)
    } catch {
      return false
    }
  }
}

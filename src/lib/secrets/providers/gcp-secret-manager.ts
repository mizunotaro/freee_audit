import { BaseSecretProvider, type GCPSecretConfig, type SecretValue } from '../types'

interface GCPClient {
  accessSecretVersion(request: { name: string }): Promise<
    {
      name?: string
      payload?: { data?: Buffer | string }
      createTime?: { toDate(): Date }
    }[]
  >
  listSecrets(request: { parent: string; pageSize?: number }): Promise<
    {
      name?: string
    }[][]
  >
  close(): void
}

export class GCPSecretManagerProvider extends BaseSecretProvider {
  type = 'gcp_secret' as const
  private gcpConfig: GCPSecretConfig
  private client: GCPClient | null = null

  constructor(config: GCPSecretConfig) {
    super(config)
    this.gcpConfig = config
  }

  private async createClient(): Promise<GCPClient> {
    try {
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager')

      const clientOptions: any = {
        projectId: this.gcpConfig.projectId,
      }

      if (this.gcpConfig.credentials) {
        clientOptions.credentials = {
          client_email: this.gcpConfig.credentials.clientEmail,
          private_key: this.gcpConfig.credentials.privateKey,
        }
      }

      return new SecretManagerServiceClient(clientOptions)
    } catch (error) {
      console.error('Failed to initialize GCP Secret Manager client:', error)
      throw new Error(
        'GCP Secret Manager client initialization failed. Install @google-cloud/secret-manager package.'
      )
    }
  }

  private async getClient(): Promise<GCPClient> {
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
      const secretName = `projects/${this.gcpConfig.projectId}/secrets/${name}/versions/latest`

      const [version] = await client.accessSecretVersion({ name: secretName })
      const payload = version.payload?.data
      const value = typeof payload === 'string' ? payload : payload?.toString('utf-8')

      if (!value) return null

      const secretValue: SecretValue = {
        name,
        value,
        version: version.name?.split('/').pop(),
        lastUpdated: version.createTime?.toDate(),
        metadata: {
          location: secretName,
        },
      }

      this.setCache(name, secretValue)
      return secretValue
    } catch (error) {
      if ((error as { code?: number }).code === 5) {
        return null
      }
      console.error(`Failed to get secret ${name} from GCP:`, error)
      throw error
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    try {
      const client = await this.getClient()
      const parent = `projects/${this.gcpConfig.projectId}`

      const [secrets] = await client.listSecrets({ parent, pageSize: 100 })

      let names = (secrets as any[]).map((s: any) => s.name?.split('/').pop() || '').filter(Boolean)

      if (prefix) {
        names = names.filter((n: string) => n.startsWith(prefix))
      }

      return names
    } catch (error) {
      console.error('Failed to list secrets from GCP:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient()
      const parent = `projects/${this.gcpConfig.projectId}`
      await client.listSecrets({ parent, pageSize: 1 })
      return true
    } catch {
      return false
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close()
      this.client = null
    }
    await super.close?.()
  }
}

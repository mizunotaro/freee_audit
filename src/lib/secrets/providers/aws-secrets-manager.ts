import { BaseSecretProvider, type AWSSecretConfig, type SecretValue } from '../types'

interface AWSSecretsClient {
  getSecretValue(params: { SecretId: string; VersionStage?: string }): Promise<{
    Name?: string
    VersionId?: string
    SecretString?: string
    SecretBinary?: Buffer
    LastUpdated?: Date
  }>
  listSecrets(params: {
    MaxResults?: number
    Filters?: Array<{ Key: string; Values: string[] }>
  }): Promise<{
    SecretList: Array<{
      Name: string
      ARN: string
      LastChangedDate?: Date
    }>
  }>
}

export class AWSSecretsManagerProvider extends BaseSecretProvider {
  type = 'aws_secrets' as const
  private awsConfig: AWSSecretConfig
  private client: AWSSecretsClient | null = null

  constructor(config: AWSSecretConfig) {
    super(config)
    this.awsConfig = config
  }

  private async createClient(): Promise<AWSSecretsClient> {
    try {
      const { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } =
        await import('@aws-sdk/client-secrets-manager')

      const credentials =
        this.awsConfig.accessKeyId && this.awsConfig.secretAccessKey
          ? {
              accessKeyId: this.awsConfig.accessKeyId,
              secretAccessKey: this.awsConfig.secretAccessKey,
            }
          : undefined

      const client = new SecretsManagerClient({
        region: this.awsConfig.region,
        credentials,
      })

      return {
        getSecretValue: async (params) => {
          const command = new GetSecretValueCommand(params)
          const response = await client.send(command)
          return {
            Name: response.Name,
            VersionId: response.VersionId,
            SecretString: response.SecretString,
            SecretBinary: response.SecretBinary ? Buffer.from(response.SecretBinary) : undefined,
            LastUpdated: response.CreatedDate,
          }
        },
        listSecrets: async (params) => {
          const command = new ListSecretsCommand(params)
          const response = await client.send(command)
          return {
            SecretList: (response.SecretList || []).map((s) => ({
              Name: s.Name || '',
              ARN: s.ARN || '',
              LastChangedDate: s.LastChangedDate,
            })),
          }
        },
      }
    } catch (error) {
      console.error('Failed to initialize AWS Secrets Manager client:', error)
      throw new Error(
        'AWS Secrets Manager client initialization failed. Install @aws-sdk/client-secrets-manager package.'
      )
    }
  }

  private async getClient(): Promise<AWSSecretsClient> {
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
      const response = await client.getSecretValue({ SecretId: name })

      let value: string
      if (response.SecretString) {
        value = response.SecretString
      } else if (response.SecretBinary) {
        value = response.SecretBinary.toString('base64')
      } else {
        return null
      }

      const secretValue: SecretValue = {
        name: response.Name || name,
        value,
        version: response.VersionId,
        lastUpdated: response.LastUpdated,
        metadata: {
          arn: name,
          region: this.awsConfig.region,
        },
      }

      this.setCache(name, secretValue)
      return secretValue
    } catch (error) {
      if ((error as { name?: string }).name === 'ResourceNotFoundException') {
        return null
      }
      console.error(`Failed to get secret ${name} from AWS:`, error)
      throw error
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    try {
      const client = await this.getClient()
      const filters = prefix ? [{ Key: 'name' as const, Values: [prefix] }] : undefined

      const response = await client.listSecrets({ MaxResults: 100, Filters: filters })
      return response.SecretList.map((s) => s.Name).filter(Boolean)
    } catch (error) {
      console.error('Failed to list secrets from AWS:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient()
      await client.listSecrets({ MaxResults: 1 })
      return true
    } catch {
      return false
    }
  }
}

declare module '@aws-sdk/client-secrets-manager' {
  export interface SecretsManagerClientConfig {
    region: string
    credentials?: {
      accessKeyId: string
      secretAccessKey: string
    }
  }

  export interface SecretListEntry {
    Name?: string
    ARN?: string
    LastChangedDate?: Date
  }

  export interface GetSecretValueResponse {
    SecretString?: string
    SecretBinary?: Uint8Array | Buffer
    Name?: string
    VersionId?: string
    CreatedDate?: Date
    SecretList?: SecretListEntry[]
  }

  export class SecretsManagerClient {
    constructor(config: SecretsManagerClientConfig)
    send(command: GetSecretValueCommand): Promise<GetSecretValueResponse>
    send(command: ListSecretsCommand): Promise<{ SecretList?: SecretListEntry[] }>
  }

  export class GetSecretValueCommand {
    constructor(input: { SecretId: string; VersionStage?: string })
  }

  export class ListSecretsCommand {
    constructor(input?: { MaxResults?: number; Filters?: Array<{ Key: string; Values: string[] }> })
  }
}

declare module '@azure/identity' {
  export interface TokenCredential {
    getToken(scopes: string | string[]): Promise<{ token: string; expiresOnTimestamp: number }>
  }

  export class DefaultAzureCredential implements TokenCredential {
    getToken(scopes: string | string[]): Promise<{ token: string; expiresOnTimestamp: number }>
  }
}

declare module '@azure/keyvault-secrets' {
  export interface SecretProperties {
    version?: string
    updatedOn?: Date
    enabled?: boolean
    name?: string
    id?: string
  }

  export interface KeyVaultSecret {
    value?: string
    name?: string
    properties: SecretProperties
  }

  export interface GetSecretOptions {
    version?: string
  }

  export class SecretClient {
    constructor(vaultUrl: string, credential: unknown)
    getSecret(name: string, options?: GetSecretOptions): Promise<KeyVaultSecret>
    listPropertiesOfSecrets(): AsyncIterable<KeyVaultSecret>
  }
}

declare module '@google-cloud/secret-manager' {
  export interface AccessSecretVersionResponse {
    payload?: {
      data?: string | Buffer
    }
  }

  export interface Secret {
    name?: string
  }

  export class SecretManagerServiceClient {
    constructor(options?: { projectId?: string })
    accessSecretVersion(request: { name: string }): Promise<[AccessSecretVersionResponse]>
    listSecrets(request: { parent: string }): Promise<[Secret[]]>
    close(): void
  }
}

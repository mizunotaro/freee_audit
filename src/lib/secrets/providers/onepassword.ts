import { BaseSecretProvider, type OnePasswordConfig, type SecretValue } from '../types'

interface OnePasswordItem {
  id: string
  title: string
  category: string
  fields: Array<{
    id: string
    label: string
    value: string
    type: string
  }>
}

interface OnePasswordClient {
  getItem(itemId: string): Promise<OnePasswordItem>
  getItems(vaultId: string): Promise<OnePasswordItem[]>
}

export class OnePasswordProvider extends BaseSecretProvider {
  type = 'onepassword' as const
  private opConfig: OnePasswordConfig
  private client: OnePasswordClient | null = null

  constructor(config: OnePasswordConfig) {
    super(config)
    this.opConfig = config
  }

  private async createClient(): Promise<OnePasswordClient> {
    const baseUrl = this.opConfig.connectHost.replace(/\/$/, '')

    return {
      getItem: async (itemId: string): Promise<OnePasswordItem> => {
        const response = await fetch(`${baseUrl}/v1/items/${itemId}`, {
          headers: {
            Authorization: `Bearer ${this.opConfig.connectToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Item ${itemId} not found`)
          }
          throw new Error(`Failed to get item: ${response.status} ${response.statusText}`)
        }

        return response.json()
      },

      getItems: async (vaultId: string): Promise<OnePasswordItem[]> => {
        const response = await fetch(`${baseUrl}/v1/vaults/${vaultId}/items`, {
          headers: {
            Authorization: `Bearer ${this.opConfig.connectToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to list items: ${response.status} ${response.statusText}`)
        }

        return response.json()
      },
    }
  }

  private async getClient(): Promise<OnePasswordClient> {
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

      // First try to get item by ID
      try {
        const item = await client.getItem(name)
        const passwordField = item.fields.find(
          (f) => f.label.toLowerCase() === 'password' || f.type === 'CONCEALED'
        )
        const value = passwordField?.value || ''

        const secretValue: SecretValue = {
          name: item.title,
          value,
          lastUpdated: new Date(),
          metadata: {
            id: item.id,
            category: item.category,
            vaultId: this.opConfig.vaultId,
          },
        }

        this.setCache(name, secretValue)
        return secretValue
      } catch {
        // If direct lookup fails, search by title
        const items = await client.getItems(this.opConfig.vaultId)
        const matchingItem = items.find((item) => item.title === name)

        if (!matchingItem) return null

        const fullItem = await client.getItem(matchingItem.id)
        const passwordField = fullItem.fields.find(
          (f) => f.label.toLowerCase() === 'password' || f.type === 'CONCEALED'
        )
        const value = passwordField?.value || ''

        const secretValue: SecretValue = {
          name: fullItem.title,
          value,
          lastUpdated: new Date(),
          metadata: {
            id: fullItem.id,
            category: fullItem.category,
            vaultId: this.opConfig.vaultId,
          },
        }

        this.setCache(name, secretValue)
        return secretValue
      }
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return null
      }
      console.error(`Failed to get secret ${name} from 1Password:`, error)
      throw error
    }
  }

  async listSecrets(prefix?: string): Promise<string[]> {
    try {
      const client = await this.getClient()
      const items = await client.getItems(this.opConfig.vaultId)

      let names = items.map((item) => item.title)

      if (prefix) {
        names = names.filter((n) => n.startsWith(prefix))
      }

      return names
    } catch (error) {
      console.error('Failed to list secrets from 1Password:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient()
      await client.getItems(this.opConfig.vaultId)
      return true
    } catch {
      return false
    }
  }
}

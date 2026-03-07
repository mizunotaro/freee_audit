import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OnePasswordProvider } from '@/lib/secrets/providers/onepassword'
import type { OnePasswordConfig } from '@/lib/secrets/types'

describe('OnePasswordProvider Extended Tests', () => {
  let provider: OnePasswordProvider
  const defaultConfig: OnePasswordConfig = {
    provider: 'onepassword',
    connectHost: 'http://localhost:8080',
    connectToken: 'test-token',
    vaultId: 'test-vault',
  }

  const mockItem = {
    id: 'item-1',
    title: 'API_KEY',
    category: 'LOGIN',
    fields: [
      { id: 'f1', label: 'username', value: 'test-user', type: 'TEXT' },
      { id: 'f2', label: 'password', value: 'test-password', type: 'CONCEALED' },
    ],
  }

  const mockItems = [
    {
      id: 'item-1',
      title: 'API_KEY',
      category: 'LOGIN',
      fields: [{ id: 'f1', label: 'password', value: 'test-password', type: 'CONCEALED' }],
    },
    {
      id: 'item-2',
      title: 'DB_PASSWORD',
      category: 'PASSWORD',
      fields: [{ id: 'f2', label: 'password', value: 'db-pass', type: 'CONCEALED' }],
    },
    {
      id: 'item-3',
      title: 'AWS_SECRET',
      category: 'LOGIN',
      fields: [{ id: 'f3', label: 'password', value: 'aws-secret', type: 'CONCEALED' }],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OnePasswordProvider(defaultConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getSecret', () => {
    it('should retrieve secret by ID', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItem,
      } as Response)

      const result = await provider.getSecret('item-1')

      expect(result).toBeDefined()
      expect(result?.name).toBe('API_KEY')
      expect(result?.value).toBe('test-password')
      expect(result?.metadata?.id).toBe('item-1')
    })

    it('should retrieve secret by title when ID lookup fails', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockItems,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockItem,
        } as Response)

      const result = await provider.getSecret('API_KEY')

      expect(result).toBeDefined()
      expect(result?.name).toBe('API_KEY')
      expect(result?.value).toBe('test-password')
    })

    it('should return null when secret not found', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockItems,
        } as Response)

      const result = await provider.getSecret('NON_EXISTENT')

      expect(result).toBeNull()
    })

    it('should return cached secret on subsequent calls', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItem,
      } as Response)

      const result1 = await provider.getSecret('item-1')
      const result2 = await provider.getSecret('item-1')

      expect(result1).toEqual(result2)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      await expect(provider.getSecret('item-1')).rejects.toThrow()
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(provider.getSecret('item-1')).rejects.toThrow('Network error')
    })

    it('should extract password field by label', async () => {
      const itemWithPasswordField = {
        id: 'item-1',
        title: 'SECRET',
        category: 'PASSWORD',
        fields: [{ id: 'f1', label: 'Password', value: 'my-password', type: 'TEXT' }],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => itemWithPasswordField,
      } as Response)

      const result = await provider.getSecret('item-1')

      expect(result?.value).toBe('my-password')
    })

    it('should extract concealed field when no password label', async () => {
      const itemWithConcealedField = {
        id: 'item-1',
        title: 'SECRET',
        category: 'PASSWORD',
        fields: [{ id: 'f1', label: 'API Token', value: 'my-token', type: 'CONCEALED' }],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => itemWithConcealedField,
      } as Response)

      const result = await provider.getSecret('item-1')

      expect(result?.value).toBe('my-token')
    })

    it('should return empty value when no password field found', async () => {
      const itemWithoutPassword = {
        id: 'item-1',
        title: 'SECRET',
        category: 'LOGIN',
        fields: [{ id: 'f1', label: 'username', value: 'user', type: 'TEXT' }],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => itemWithoutPassword,
      } as Response)

      const result = await provider.getSecret('item-1')

      expect(result?.value).toBe('')
    })

    it('should include metadata in returned secret', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItem,
      } as Response)

      const result = await provider.getSecret('item-1')

      expect(result?.metadata).toEqual({
        id: 'item-1',
        category: 'LOGIN',
        vaultId: 'test-vault',
      })
    })
  })

  describe('listSecrets', () => {
    it('should list all secrets', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      } as Response)

      const result = await provider.listSecrets()

      expect(result).toHaveLength(3)
      expect(result).toContain('API_KEY')
      expect(result).toContain('DB_PASSWORD')
      expect(result).toContain('AWS_SECRET')
    })

    it('should filter secrets by prefix', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      } as Response)

      const result = await provider.listSecrets('API')

      expect(result).toHaveLength(1)
      expect(result).toContain('API_KEY')
    })

    it('should return empty array when no items found', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

      const result = await provider.listSecrets()

      expect(result).toEqual([])
    })

    it('should handle API errors when listing', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      await expect(provider.listSecrets()).rejects.toThrow()
    })

    it('should return empty array when prefix matches nothing', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      } as Response)

      const result = await provider.listSecrets('NONEXISTENT_PREFIX')

      expect(result).toEqual([])
    })
  })

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

      const result = await provider.healthCheck()

      expect(result).toBe(true)
    })

    it('should return false when API returns error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      const result = await provider.healthCheck()

      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await provider.healthCheck()

      expect(result).toBe(false)
    })
  })

  describe('client initialization', () => {
    it('should create client with correct base URL', async () => {
      const configWithSlash: OnePasswordConfig = {
        ...defaultConfig,
        connectHost: 'http://localhost:8080/',
      }
      provider = new OnePasswordProvider(configWithSlash)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItem,
      } as Response)

      await provider.getSecret('item-1')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^http:\/\/localhost:8080\/v1\/items\//),
        expect.any(Object)
      )
    })

    it('should include authorization header', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockItem,
      } as Response)

      await provider.getSecret('item-1')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })
  })
})

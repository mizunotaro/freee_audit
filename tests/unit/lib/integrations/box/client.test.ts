import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BoxClient, createBoxClient } from '@/lib/integrations/box/client'
import { BoxApiError } from '@/lib/integrations/box/types'
import { fetchWithTimeout } from '@/lib/utils/timeout'

vi.mock('@/lib/utils/timeout', () => ({
  fetchWithTimeout: vi.fn(),
}))

vi.mock('@/lib/integrations/box/token-store', () => ({
  getToken: vi.fn(),
  saveToken: vi.fn(),
  deleteToken: vi.fn(),
  isTokenExpired: vi.fn(),
  getValidAccessToken: vi.fn(),
  hasValidToken: vi.fn(),
  parseTokenResponse: vi.fn(),
}))

const mockFetchWithTimeout = vi.mocked(fetchWithTimeout)

describe('BoxClient', () => {
  let client: BoxClient

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BOX_MOCK_MODE = 'true'
    client = new BoxClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.BOX_MOCK_MODE
  })

  describe('constructor', () => {
    it('should create client with default config', () => {
      const defaultClient = new BoxClient()
      expect(defaultClient).toBeInstanceOf(BoxClient)
    })

    it('should create client with custom config', () => {
      const customClient = new BoxClient({
        clientId: 'custom_id',
        clientSecret: 'custom_secret',
        redirectUri: 'https://custom.callback',
      })
      expect(customClient).toBeInstanceOf(BoxClient)
    })
  })

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL', () => {
      const url = client.getAuthorizationUrl()
      expect(url).toContain('account.box.com/api/oauth2/authorize')
      expect(url).toContain('client_id=')
      expect(url).toContain('response_type=code')
    })

    it('should include state parameter when provided', () => {
      const url = client.getAuthorizationUrl('random_state_123')
      expect(url).toContain('state=random_state_123')
    })
  })

  describe('exchangeCodeForToken', () => {
    it('should return mock token in mock mode', async () => {
      const token = await client.exchangeCodeForToken('auth_code')
      expect(token.access_token).toContain('mock_access_token')
      expect(token.refresh_token).toContain('mock_refresh_token')
      expect(token.expires_in).toBe(3600)
      expect(token.token_type).toBe('Bearer')
    })
  })

  describe('refreshToken', () => {
    it('should return mock token in mock mode', async () => {
      const token = await client.refreshToken('old_refresh_token')
      expect(token.access_token).toContain('mock_access_token')
      expect(token.refresh_token).toContain('mock_refresh_token')
    })
  })

  describe('uploadFile', () => {
    it('should return mock file in mock mode', async () => {
      const fileBuffer = Buffer.from('test file content')
      const result = await client.uploadFile('0', fileBuffer, 'test.pdf')

      expect(result.type).toBe('file')
      expect(result.name).toBe('uploaded_file.pdf')
    })

    it('should accept upload options', async () => {
      const fileBuffer = Buffer.from('test file content')
      const result = await client.uploadFile('0', fileBuffer, 'test.pdf', {
        description: 'Test file',
        contentModifiedAt: new Date('2024-01-01'),
        contentCreatedAt: new Date('2024-01-01'),
      })

      expect(result.type).toBe('file')
    })
  })

  describe('downloadFile', () => {
    it('should return mock buffer in mock mode', async () => {
      const result = await client.downloadFile('file_id_123')
      expect(result).toBeInstanceOf(Buffer)
      expect(result.toString()).toBe('mock file content')
    })
  })

  describe('createFolder', () => {
    it('should return mock folder in mock mode', async () => {
      const result = await client.createFolder('New Folder', '0')

      expect(result.type).toBe('folder')
      expect(result.name).toBe('New Folder')
    })
  })

  describe('getFolder', () => {
    it('should return mock folder in mock mode', async () => {
      const result = await client.getFolder('0')

      expect(result.type).toBe('folder')
      expect(result.id).toBe('0')
      expect(result.name).toBe('All Files')
      expect(result.item_collection).toBeDefined()
    })
  })

  describe('listFiles', () => {
    it('should return mock items in mock mode', async () => {
      const result = await client.listFiles('0')

      expect(result.total_count).toBe(1)
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].type).toBe('file')
    })

    it('should accept options', async () => {
      const result = await client.listFiles('0', {
        limit: 10,
        offset: 0,
        sort: 'name',
        direction: 'ASC',
      })

      expect(result).toBeDefined()
    })

    it('should accept fields option', async () => {
      const result = await client.listFiles('0', {
        fields: ['name', 'size', 'created_at'],
      })

      expect(result).toBeDefined()
    })
  })

  describe('getFile', () => {
    it('should return mock file in mock mode', async () => {
      const result = await client.getFile('file_id')

      expect(result.type).toBe('file')
    })
  })

  describe('deleteFile', () => {
    it('should complete without error in mock mode', async () => {
      await expect(client.deleteFile('file_id')).resolves.not.toThrow()
    })
  })

  describe('deleteFolder', () => {
    it('should complete without error in mock mode', async () => {
      await expect(client.deleteFolder('folder_id')).resolves.not.toThrow()
    })

    it('should accept recursive option', async () => {
      await expect(client.deleteFolder('folder_id', false)).resolves.not.toThrow()
    })
  })

  describe('search', () => {
    it('should return mock search results in mock mode', async () => {
      const result = await client.search({ query: 'test' })

      expect(result.total_count).toBe(0)
      expect(result.entries).toHaveLength(0)
    })

    it('should accept search options', async () => {
      const result = await client.search({
        query: 'test',
        limit: 10,
        offset: 0,
        type: 'file',
        fileExtensions: ['pdf', 'docx'],
        ancestorFolderIds: ['123', '456'],
        contentTypes: ['name', 'description'],
      })

      expect(result).toBeDefined()
    })
  })

  describe('getCurrentUser', () => {
    it('should return mock user in mock mode', async () => {
      const result = await client.getCurrentUser()

      expect(result.id).toBe('mock_user_id')
      expect(result.name).toBe('Mock User')
      expect(result.login).toBe('mock@example.com')
    })
  })

  describe('getConnectionStatus', () => {
    it('should return connected status in mock mode', async () => {
      const result = await client.getConnectionStatus('company_123')

      expect(result.connected).toBe(true)
      expect(result.userId).toBe('mock_user_id')
      expect(result.userName).toBe('Mock User')
    })
  })

  describe('disconnect', () => {
    it('should call deleteToken', async () => {
      const { deleteToken } = await import('@/lib/integrations/box/token-store')
      await client.disconnect('company_123')
      expect(deleteToken).toHaveBeenCalledWith('company_123')
    })
  })
})

describe('BoxClient Non-Mock Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.BOX_MOCK_MODE
    process.env.BOX_CLIENT_ID = 'test_client_id'
    process.env.BOX_CLIENT_SECRET = 'test_client_secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.BOX_CLIENT_ID
    delete process.env.BOX_CLIENT_SECRET
  })

  describe('exchangeCodeForToken', () => {
    it('should call token endpoint', async () => {
      const mockResponse = {
        access_token: 'test_access',
        refresh_token: 'test_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient()
      const result = await client.exchangeCodeForToken('auth_code')

      expect(result).toEqual(mockResponse)
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://api.box.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
        }),
        expect.any(Number)
      )
    })

    it('should throw BoxApiError on failure', async () => {
      const mockError = {
        type: 'error',
        status: 400,
        code: 'invalid_request',
        message: 'Invalid request',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient()

      await expect(client.exchangeCodeForToken('invalid_code')).rejects.toThrow(BoxApiError)
    })
  })

  describe('refreshToken', () => {
    it('should call token endpoint with refresh_token', async () => {
      const mockResponse = {
        access_token: 'new_access',
        refresh_token: 'new_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient()
      const result = await client.refreshToken('old_refresh')

      expect(result).toEqual(mockResponse)
    })
  })

  describe('uploadFile', () => {
    it('should upload file with form data', async () => {
      const mockResponse = {
        entries: [
          {
            type: 'file',
            id: 'file_123',
            name: 'test.pdf',
          },
        ],
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const fileBuffer = Buffer.from('test content')
      const result = await client.uploadFile('0', fileBuffer, 'test.pdf')

      expect(result.id).toBe('file_123')
    })
  })

  describe('downloadFile', () => {
    it('should download file as buffer', async () => {
      const mockBuffer = new Uint8Array([1, 2, 3, 4])

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockBuffer.buffer,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.downloadFile('file_123')

      expect(result).toBeInstanceOf(Buffer)
    })
  })
})

describe('BoxApiError', () => {
  it('should create error with all properties', () => {
    const boxError = {
      type: 'error',
      status: 404,
      code: 'not_found',
      message: 'Item not found',
      context_info: {
        errors: [{ reason: 'invalid_id', name: 'id', message: 'Invalid ID' }],
      },
    }

    const error = new BoxApiError(boxError)

    expect(error.name).toBe('BoxApiError')
    expect(error.type).toBe('error')
    expect(error.status).toBe(404)
    expect(error.code).toBe('not_found')
    expect(error.message).toBe('Item not found')
    expect(error.contextInfo).toEqual(boxError.context_info)
  })

  it('should be instance of Error', () => {
    const boxError = {
      type: 'error',
      status: 400,
      code: 'bad_request',
      message: 'Bad request',
    }

    const error = new BoxApiError(boxError)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(BoxApiError)
  })
})

describe('createBoxClient', () => {
  it('should create client with access token', () => {
    const client = createBoxClient('test_token', 'company_123')
    expect(client).toBeInstanceOf(BoxClient)
  })
})

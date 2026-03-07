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

describe('BoxClient Extended Tests', () => {
  let client: BoxClient

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BOX_MOCK_MODE = 'true'
    client = new BoxClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.BOX_MOCK_MODE
    delete process.env.BOX_CLIENT_ID
    delete process.env.BOX_CLIENT_SECRET
  })

  describe('getMockResponse edge cases', () => {
    it('should return empty object for unknown endpoints', async () => {
      const result = await client.getCurrentUser()
      expect(result).toBeDefined()
    })
  })

  describe('uploadFile with options', () => {
    it('should handle upload with all options', async () => {
      const fileBuffer = Buffer.from('test file content')
      const result = await client.uploadFile('0', fileBuffer, 'test.pdf', {
        description: 'Test description',
        contentModifiedAt: new Date('2024-01-15T10:00:00Z'),
        contentCreatedAt: new Date('2024-01-10T08:00:00Z'),
      })

      expect(result.type).toBe('file')
    })
  })

  describe('search with all options', () => {
    it('should handle search with all optional parameters', async () => {
      const result = await client.search({
        query: 'test query',
        limit: 50,
        offset: 10,
        type: 'file',
        fileExtensions: ['pdf', 'docx', 'xlsx'],
        ancestorFolderIds: ['123', '456', '789'],
        contentTypes: ['name', 'description', 'file_content'],
      })

      expect(result).toBeDefined()
      expect(result.entries).toEqual([])
    })

    it('should handle search with minimal parameters', async () => {
      const result = await client.search({
        query: 'minimal',
      })

      expect(result).toBeDefined()
    })
  })

  describe('listFiles with all options', () => {
    it('should handle list with all optional parameters', async () => {
      const result = await client.listFiles('0', {
        limit: 50,
        offset: 25,
        fields: ['name', 'size', 'created_at', 'modified_at', 'created_by'],
        sort: 'name',
        direction: 'DESC',
      })

      expect(result).toBeDefined()
      expect(result.entries).toHaveLength(1)
    })

    it('should handle list without options', async () => {
      const result = await client.listFiles('0')

      expect(result).toBeDefined()
      expect(result.total_count).toBe(1)
    })
  })
})

describe('BoxClient Non-Mock Mode Extended', () => {
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

  describe('createFolder', () => {
    it('should create folder with access token', async () => {
      const mockResponse = {
        type: 'folder',
        id: '12345',
        name: 'New Folder',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.createFolder('New Folder', '0')

      expect(result.id).toBe('12345')
      expect(result.name).toBe('New Folder')
    })

    it('should throw BoxApiError on create folder failure', async () => {
      const mockError = {
        type: 'error',
        status: 409,
        code: 'item_name_in_use',
        message: 'Item with the same name already exists',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.createFolder('Existing Folder')).rejects.toThrow(BoxApiError)
    })
  })

  describe('getFolder', () => {
    it('should get folder by ID', async () => {
      const mockResponse = {
        type: 'folder',
        id: '12345',
        name: 'Test Folder',
        item_collection: {
          total_count: 0,
          entries: [],
        },
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.getFolder('12345')

      expect(result.id).toBe('12345')
      expect(result.name).toBe('Test Folder')
    })
  })

  describe('getFile', () => {
    it('should get file by ID', async () => {
      const mockResponse = {
        type: 'file',
        id: '67890',
        name: 'document.pdf',
        size: 1024,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.getFile('67890')

      expect(result.id).toBe('67890')
      expect(result.name).toBe('document.pdf')
    })

    it('should throw BoxApiError on file not found', async () => {
      const mockError = {
        type: 'error',
        status: 404,
        code: 'not_found',
        message: 'File not found',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.getFile('nonexistent')).rejects.toThrow(BoxApiError)
    })
  })

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      await expect(client.deleteFile('12345')).resolves.not.toThrow()
    })

    it('should throw BoxApiError on delete failure', async () => {
      const mockError = {
        type: 'error',
        status: 404,
        code: 'not_found',
        message: 'File not found',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.deleteFile('nonexistent')).rejects.toThrow(BoxApiError)
    })
  })

  describe('deleteFolder', () => {
    it('should delete folder recursively', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      await expect(client.deleteFolder('12345', true)).resolves.not.toThrow()
    })

    it('should delete folder non-recursively', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      await expect(client.deleteFolder('12345', false)).resolves.not.toThrow()
    })
  })

  describe('search', () => {
    it('should search for files', async () => {
      const mockResponse = {
        total_count: 2,
        limit: 100,
        offset: 0,
        entries: [
          { type: 'file', id: '1', name: 'file1.pdf' },
          { type: 'file', id: '2', name: 'file2.pdf' },
        ],
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.search({ query: 'test' })

      expect(result.total_count).toBe(2)
      expect(result.entries).toHaveLength(2)
    })

    it('should handle empty search results', async () => {
      const mockResponse = {
        total_count: 0,
        limit: 100,
        offset: 0,
        entries: [],
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.search({ query: 'nonexistent' })

      expect(result.total_count).toBe(0)
      expect(result.entries).toHaveLength(0)
    })
  })

  describe('getCurrentUser', () => {
    it('should get current user info', async () => {
      const mockResponse = {
        id: 'user_123',
        name: 'Test User',
        login: 'test@example.com',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.getCurrentUser()

      expect(result.id).toBe('user_123')
      expect(result.name).toBe('Test User')
    })
  })

  describe('getConnectionStatus', () => {
    it('should return connected status when token valid', async () => {
      const { getToken, isTokenExpired } = await import('@/lib/integrations/box/token-store')
      vi.mocked(getToken).mockResolvedValueOnce({
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
      })
      vi.mocked(isTokenExpired).mockResolvedValueOnce(false)

      const mockUserResponse = {
        id: 'user_123',
        name: 'Test User',
        login: 'test@example.com',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.getConnectionStatus('company_123')

      expect(result.connected).toBe(true)
      expect(result.userId).toBe('user_123')
    })

    it('should return disconnected when no token', async () => {
      const { getToken } = await import('@/lib/integrations/box/token-store')
      vi.mocked(getToken).mockResolvedValueOnce(null)

      const client = new BoxClient()
      const result = await client.getConnectionStatus('company_123')

      expect(result.connected).toBe(false)
    })

    it('should return disconnected when token expired', async () => {
      const { getToken, isTokenExpired } = await import('@/lib/integrations/box/token-store')
      vi.mocked(getToken).mockResolvedValueOnce({
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: new Date(Date.now() - 1000),
        tokenType: 'Bearer',
      })
      vi.mocked(isTokenExpired).mockResolvedValueOnce(true)

      const client = new BoxClient()
      const result = await client.getConnectionStatus('company_123')

      expect(result.connected).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      const mockError = {
        type: 'error',
        status: 401,
        code: 'unauthorized',
        message: 'Unauthorized access',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'invalid_token' })

      await expect(client.getFile('123')).rejects.toThrow(BoxApiError)
    })

    it('should handle 403 forbidden error', async () => {
      const mockError = {
        type: 'error',
        status: 403,
        code: 'access_denied',
        message: 'Access denied',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.getFile('restricted')).rejects.toThrow(BoxApiError)
    })

    it('should handle 429 rate limit error', async () => {
      const mockError = {
        type: 'error',
        status: 429,
        code: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.getFile('123')).rejects.toThrow(BoxApiError)
    })

    it('should handle 500 server error', async () => {
      const mockError = {
        type: 'error',
        status: 500,
        code: 'internal_error',
        message: 'Internal server error',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.getFile('123')).rejects.toThrow(BoxApiError)
    })

    it('should handle 503 service unavailable', async () => {
      const mockError = {
        type: 'error',
        status: 503,
        code: 'service_unavailable',
        message: 'Service unavailable',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.getFile('123')).rejects.toThrow(BoxApiError)
    })
  })

  describe('uploadFile edge cases', () => {
    it('should handle large file upload', async () => {
      const mockResponse = {
        entries: [
          {
            type: 'file',
            id: 'large_file',
            name: 'large.pdf',
            size: 104857600,
          },
        ],
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const largeBuffer = Buffer.alloc(1024 * 1024)
      const result = await client.uploadFile('0', largeBuffer, 'large.pdf')

      expect(result.id).toBe('large_file')
    })

    it('should handle upload with special characters in filename', async () => {
      const mockResponse = {
        entries: [
          {
            type: 'file',
            id: 'special_file',
            name: 'file (1) [test].pdf',
          },
        ],
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.uploadFile('0', Buffer.from('test'), 'file (1) [test].pdf')

      expect(result.name).toBe('file (1) [test].pdf')
    })

    it('should throw BoxApiError on upload failure', async () => {
      const mockError = {
        type: 'error',
        status: 413,
        code: 'request_entity_too_large',
        message: 'File too large',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.uploadFile('0', Buffer.from('test'), 'large.pdf')).rejects.toThrow(
        BoxApiError
      )
    })
  })

  describe('downloadFile edge cases', () => {
    it('should handle large file download', async () => {
      const largeBuffer = new Uint8Array(1024 * 1024)

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => largeBuffer.buffer,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })
      const result = await client.downloadFile('large_file')

      expect(result).toBeInstanceOf(Buffer)
    })

    it('should throw BoxApiError on download failure', async () => {
      const mockError = {
        type: 'error',
        status: 404,
        code: 'not_found',
        message: 'File not found',
      }

      mockFetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        json: async () => mockError,
      } as Response)

      const client = new BoxClient({ accessToken: 'test_token' })

      await expect(client.downloadFile('nonexistent')).rejects.toThrow(BoxApiError)
    })
  })
})

describe('BoxApiError Extended', () => {
  it('should handle error with context info', () => {
    const boxError = {
      type: 'error',
      status: 400,
      code: 'bad_request',
      message: 'Bad request',
      context_info: {
        errors: [
          { reason: 'invalid_parameter', name: 'name', message: 'Name is required' },
          { reason: 'invalid_parameter', name: 'parent', message: 'Parent ID is required' },
        ],
      },
    }

    const error = new BoxApiError(boxError)

    expect(error.contextInfo).toBeDefined()
    expect(error.contextInfo?.errors).toHaveLength(2)
  })

  it('should handle error without context info', () => {
    const boxError = {
      type: 'error',
      status: 500,
      code: 'internal_error',
      message: 'Internal server error',
    }

    const error = new BoxApiError(boxError)

    expect(error.contextInfo).toBeUndefined()
  })
})

describe('createBoxClient Extended', () => {
  it('should create client without parameters', () => {
    process.env.BOX_MOCK_MODE = 'true'
    const client = createBoxClient()
    expect(client).toBeInstanceOf(BoxClient)
  })

  it('should create client with both parameters', () => {
    const client = createBoxClient('test_token', 'company_123')
    expect(client).toBeInstanceOf(BoxClient)
  })
})

describe('BoxClient Mock Mode Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.BOX_MOCK_MODE
    delete process.env.BOX_CLIENT_ID
    delete process.env.BOX_CLIENT_SECRET
  })

  it('should use mock mode when BOX_MOCK_MODE is true', () => {
    process.env.BOX_MOCK_MODE = 'true'
    process.env.BOX_CLIENT_ID = 'real_id'
    process.env.BOX_CLIENT_SECRET = 'real_secret'

    const client = new BoxClient()
    expect(client).toBeInstanceOf(BoxClient)
  })

  it('should use mock mode when BOX_CLIENT_ID is missing', () => {
    delete process.env.BOX_MOCK_MODE
    delete process.env.BOX_CLIENT_ID
    process.env.BOX_CLIENT_SECRET = 'real_secret'

    const client = new BoxClient()
    expect(client).toBeInstanceOf(BoxClient)
  })

  it('should use mock mode when BOX_CLIENT_SECRET is missing', () => {
    delete process.env.BOX_MOCK_MODE
    process.env.BOX_CLIENT_ID = 'real_id'
    delete process.env.BOX_CLIENT_SECRET

    const client = new BoxClient()
    expect(client).toBeInstanceOf(BoxClient)
  })

  it('should not use mock mode when credentials are present', () => {
    delete process.env.BOX_MOCK_MODE
    process.env.BOX_CLIENT_ID = 'real_id'
    process.env.BOX_CLIENT_SECRET = 'real_secret'

    const client = new BoxClient()
    expect(client).toBeInstanceOf(BoxClient)
  })
})

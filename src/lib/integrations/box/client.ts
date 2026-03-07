import type {
  BoxClientConfig,
  BoxTokenResponse,
  BoxError,
  BoxConnectionStatus,
  BoxFile,
  BoxFolder,
  BoxItemList,
  BoxUploadResponse,
  UploadFileOptions,
  CreateFolderOptions,
  ListItemsOptions,
  BoxSearchResult,
  SearchOptions,
} from './types'
import { BoxApiError } from './types'
import { getToken, saveToken, deleteToken, isTokenExpired } from './token-store'
import { fetchWithTimeout } from '@/lib/utils/timeout'

const BOX_API_BASE_URL = 'https://api.box.com/2.0'
const BOX_UPLOAD_URL = 'https://upload.box.com/api/2.0'
const BOX_AUTH_URL = 'https://account.box.com/api/oauth2/authorize'
const BOX_TOKEN_URL = 'https://api.box.com/oauth2/token'

const API_TIMEOUT = 60000
const UPLOAD_TIMEOUT = 300000

function isMockMode(): boolean {
  return (
    process.env.BOX_MOCK_MODE === 'true' ||
    !process.env.BOX_CLIENT_ID ||
    !process.env.BOX_CLIENT_SECRET
  )
}

export class BoxClient {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private companyId?: string
  private accessToken?: string

  constructor(config?: Partial<BoxClientConfig> & { accessToken?: string }, companyId?: string) {
    this.clientId = config?.clientId || process.env.BOX_CLIENT_ID || ''
    this.clientSecret = config?.clientSecret || process.env.BOX_CLIENT_SECRET || ''
    this.redirectUri =
      config?.redirectUri ||
      process.env.BOX_REDIRECT_URI ||
      'http://localhost:3000/api/box/callback'
    this.companyId = companyId
    this.accessToken = config?.accessToken
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
    })

    if (state) {
      params.append('state', state)
    }

    return `${BOX_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForToken(code: string): Promise<BoxTokenResponse> {
    if (isMockMode()) {
      return this.getMockTokenResponse()
    }

    const response = await fetchWithTimeout(
      BOX_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
        }).toString(),
      },
      API_TIMEOUT
    )

    if (!response.ok) {
      const error = (await response.json()) as BoxError
      throw new BoxApiError(error)
    }

    return response.json()
  }

  async refreshToken(refreshToken: string): Promise<BoxTokenResponse> {
    if (isMockMode()) {
      return this.getMockTokenResponse()
    }

    const response = await fetchWithTimeout(
      BOX_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
      },
      API_TIMEOUT
    )

    if (!response.ok) {
      const error = (await response.json()) as BoxError
      throw new BoxApiError(error)
    }

    return response.json()
  }

  private async getValidAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken
    }

    if (!this.companyId) {
      throw new Error('Company ID is required')
    }

    if (isMockMode()) {
      return 'mock_access_token'
    }

    const token = await getToken(this.companyId)
    if (!token) {
      throw new Error('No Box token found. Please authenticate first.')
    }

    if (await isTokenExpired(this.companyId)) {
      const newTokenResponse = await this.refreshToken(token.refreshToken)
      await saveToken(this.companyId, newTokenResponse)
      return newTokenResponse.access_token
    }

    return token.accessToken
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: Record<string, unknown>
      headers?: Record<string, string>
      timeout?: number
    }
  ): Promise<T> {
    if (isMockMode()) {
      return this.getMockResponse<T>(endpoint, method)
    }

    const accessToken = await this.getValidAccessToken()

    const response = await fetchWithTimeout(
      `${BOX_API_BASE_URL}${endpoint}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      },
      options?.timeout || API_TIMEOUT
    )

    if (!response.ok) {
      const error = (await response.json()) as BoxError
      throw new BoxApiError(error)
    }

    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  async uploadFile(
    folderId: string,
    file: Buffer,
    name: string,
    options?: Partial<UploadFileOptions>
  ): Promise<BoxFile> {
    if (isMockMode()) {
      return this.getMockResponse<BoxFile>('/files/content', 'POST')
    }

    const accessToken = await this.getValidAccessToken()

    const attributes: Record<string, unknown> = {
      name,
      parent: { id: folderId },
    }

    if (options?.description) {
      attributes.description = options.description
    }
    if (options?.contentModifiedAt) {
      attributes.content_modified_at = options.contentModifiedAt.toISOString()
    }
    if (options?.contentCreatedAt) {
      attributes.content_created_at = options.contentCreatedAt.toISOString()
    }

    const formData = new FormData()
    formData.append('attributes', JSON.stringify(attributes))
    formData.append('file', new Blob([new Uint8Array(file)]), name)

    const response = await fetchWithTimeout(
      `${BOX_UPLOAD_URL}/files/content`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      },
      UPLOAD_TIMEOUT
    )

    if (!response.ok) {
      const error = (await response.json()) as BoxError
      throw new BoxApiError(error)
    }

    const result = (await response.json()) as BoxUploadResponse
    return result.entries[0]
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    if (isMockMode()) {
      return Buffer.from('mock file content')
    }

    const accessToken = await this.getValidAccessToken()

    const response = await fetchWithTimeout(
      `${BOX_API_BASE_URL}/files/${fileId}/content`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      UPLOAD_TIMEOUT
    )

    if (!response.ok) {
      const error = (await response.json()) as BoxError
      throw new BoxApiError(error)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async createFolder(name: string, parentId = '0'): Promise<BoxFolder> {
    return this.request<BoxFolder>('POST', '/folders', {
      body: {
        name,
        parent: { id: parentId },
      },
    })
  }

  async getFolder(folderId: string): Promise<BoxFolder> {
    return this.request<BoxFolder>('GET', `/folders/${folderId}`)
  }

  async listFiles(folderId: string, options?: ListItemsOptions): Promise<BoxItemList> {
    const params = new URLSearchParams()

    if (options?.limit) {
      params.append('limit', String(options.limit))
    }
    if (options?.offset) {
      params.append('offset', String(options.offset))
    }
    if (options?.fields && options.fields.length > 0) {
      params.append('fields', options.fields.join(','))
    }
    if (options?.sort) {
      params.append('sort', options.sort)
    }
    if (options?.direction) {
      params.append('direction', options.direction)
    }

    const queryString = params.toString()
    const endpoint = queryString
      ? `/folders/${folderId}/items?${queryString}`
      : `/folders/${folderId}/items`

    return this.request<BoxItemList>('GET', endpoint)
  }

  async getFile(fileId: string): Promise<BoxFile> {
    return this.request<BoxFile>('GET', `/files/${fileId}`)
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.request<void>('DELETE', `/files/${fileId}`)
  }

  async deleteFolder(folderId: string, recursive = true): Promise<void> {
    const params = recursive ? '?recursive=true' : ''
    await this.request<void>('DELETE', `/folders/${folderId}${params}`)
  }

  async search(options: SearchOptions): Promise<BoxSearchResult> {
    const params = new URLSearchParams({
      query: options.query,
    })

    if (options.limit) {
      params.append('limit', String(options.limit))
    }
    if (options.offset) {
      params.append('offset', String(options.offset))
    }
    if (options.type) {
      params.append('type', options.type)
    }
    if (options.fileExtensions && options.fileExtensions.length > 0) {
      params.append('file_extensions', options.fileExtensions.join(','))
    }
    if (options.ancestorFolderIds && options.ancestorFolderIds.length > 0) {
      params.append('ancestor_folder_ids', options.ancestorFolderIds.join(','))
    }
    if (options.contentTypes && options.contentTypes.length > 0) {
      params.append('content_types', options.contentTypes.join(','))
    }

    return this.request<BoxSearchResult>('GET', `/search?${params.toString()}`)
  }

  async getCurrentUser(): Promise<{ id: string; name: string; login: string }> {
    return this.request<{ id: string; name: string; login: string }>('GET', '/users/me')
  }

  async getConnectionStatus(companyId: string): Promise<BoxConnectionStatus> {
    if (isMockMode()) {
      return {
        connected: true,
        userId: 'mock_user_id',
        userName: 'Mock User',
        rootFolderId: '0',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        lastSyncAt: new Date(),
      }
    }

    const token = await getToken(companyId)
    if (!token) {
      return { connected: false }
    }

    const expired = await isTokenExpired(companyId)
    if (expired) {
      return { connected: false }
    }

    try {
      const user = await this.getCurrentUser()

      return {
        connected: true,
        userId: user.id,
        userName: user.name,
        rootFolderId: '0',
        expiresAt: token.expiresAt,
        lastSyncAt: new Date(),
      }
    } catch {
      return { connected: false }
    }
  }

  async disconnect(companyId: string): Promise<void> {
    await deleteToken(companyId)
  }

  private getMockTokenResponse(): BoxTokenResponse {
    return {
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'root_readwrite',
    }
  }

  private getMockResponse<T>(endpoint: string, method: string): T {
    if (endpoint.includes('/users/me')) {
      return {
        id: 'mock_user_id',
        name: 'Mock User',
        login: 'mock@example.com',
      } as T
    }

    if (endpoint.includes('/folders') && method === 'POST') {
      return {
        type: 'folder',
        id: 'mock_folder_' + Date.now(),
        name: 'New Folder',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
      } as T
    }

    if (endpoint.includes('/folders/') && endpoint.includes('/items')) {
      return {
        total_count: 1,
        limit: 100,
        offset: 0,
        order: [{ by: 'name', direction: 'ASC' }],
        entries: [
          {
            type: 'file',
            id: 'mock_file_1',
            name: 'sample.pdf',
            size: 102400,
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
          },
        ],
      } as T
    }

    if (endpoint.match(/\/folders\/[^/]+$/) && method === 'GET') {
      return {
        type: 'folder',
        id: '0',
        name: 'All Files',
        item_collection: {
          total_count: 1,
          limit: 100,
          offset: 0,
          order: [{ by: 'name', direction: 'ASC' }],
          entries: [
            {
              type: 'file',
              id: 'mock_file_1',
              name: 'sample.pdf',
              size: 102400,
              created_at: new Date().toISOString(),
              modified_at: new Date().toISOString(),
            },
          ],
        },
      } as T
    }

    if (endpoint.match(/\/files\/[^/]+$/) && method === 'GET') {
      return {
        type: 'file',
        id: 'mock_file_1',
        name: 'sample.pdf',
        size: 102400,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
      } as T
    }

    if (endpoint.includes('/files') && endpoint.includes('/content') && method === 'GET') {
      return Buffer.from('mock file content') as T
    }

    if (endpoint.includes('/files/content') && method === 'POST') {
      return {
        type: 'file',
        id: 'mock_file_' + Date.now(),
        name: 'uploaded_file.pdf',
        size: 102400,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
      } as T
    }

    if (endpoint.includes('/search')) {
      return {
        total_count: 0,
        limit: 100,
        offset: 0,
        entries: [],
      } as T
    }

    return {} as T
  }
}

export function createBoxClient(accessToken?: string, companyId?: string): BoxClient {
  return new BoxClient({ accessToken }, companyId)
}

export const boxClient = new BoxClient()

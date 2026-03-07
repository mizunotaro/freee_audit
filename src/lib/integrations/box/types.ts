export interface BoxToken {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  tokenType: string
  scope?: string
}

export interface BoxTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

export interface BoxClientConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface BoxError {
  type: string
  status: number
  code: string
  message: string
  context_info?: {
    errors?: Array<{
      reason: string
      name: string
      message: string
    }>
  }
}

export class BoxApiError extends Error {
  type: string
  status: number
  code: string
  contextInfo?: BoxError['context_info']

  constructor(error: BoxError) {
    super(error.message)
    this.name = 'BoxApiError'
    this.type = error.type
    this.status = error.status
    this.code = error.code
    this.contextInfo = error.context_info
  }
}

export interface BoxFile {
  type: 'file'
  id: string
  file_version?: {
    type: 'file_version'
    id: string
    sha1: string
  }
  sequence_id?: string
  etag?: string
  sha1?: string
  name: string
  description?: string
  size: number
  path_collection?: {
    total_count: number
    entries: Array<{
      type: string
      id: string
      sequence_id?: string
      etag?: string
      name: string
    }>
  }
  created_at?: string
  modified_at?: string
  trashed_at?: string | null
  purged_at?: string | null
  content_created_at?: string
  content_modified_at?: string
  created_by?: BoxUser
  modified_by?: BoxUser
  owned_by?: BoxUser
  shared_link?: BoxSharedLink
  parent?: BoxFolder
  item_status?: string
}

export interface BoxFolder {
  type: 'folder'
  id: string
  sequence_id?: string
  etag?: string
  name: string
  created_at?: string
  modified_at?: string
  description?: string
  size?: number
  path_collection?: {
    total_count: number
    entries: Array<{
      type: string
      id: string
      sequence_id?: string
      etag?: string
      name: string
    }>
  }
  created_by?: BoxUser
  modified_by?: BoxUser
  owned_by?: BoxUser
  shared_link?: BoxSharedLink
  parent?: BoxFolder
  item_status?: string
  item_collection?: {
    total_count: number
    limit: number
    offset: number
    order: Array<{
      by: string
      direction: string
    }>
    entries: Array<BoxFile | BoxFolder>
  }
}

export interface BoxUser {
  type: 'user'
  id: string
  name: string
  login: string
}

export interface BoxSharedLink {
  url: string
  download_url?: string
  vanity_url?: string
  access: 'open' | 'company' | 'collaborators'
  effective_access?: 'open' | 'company' | 'collaborators'
  effective_permission?: 'can_download' | 'can_preview' | 'can_edit'
  unshared_at?: string
  is_password_enabled?: boolean
  permissions?: {
    can_download?: boolean
    can_preview?: boolean
    can_edit?: boolean
  }
}

export interface BoxUploadResponse {
  total_count: number
  entries: BoxFile[]
}

export interface BoxItemList {
  total_count: number
  limit: number
  offset: number
  order: Array<{
    by: string
    direction: string
  }>
  entries: Array<BoxFile | BoxFolder>
}

export interface BoxConnectionStatus {
  connected: boolean
  userId?: string
  userName?: string
  rootFolderId?: string
  expiresAt?: Date
  lastSyncAt?: Date
}

export interface UploadFileOptions {
  name: string
  parentFolderId: string
  contentModifiedAt?: Date
  contentCreatedAt?: Date
  description?: string
}

export interface CreateFolderOptions {
  name: string
  parentFolderId?: string
}

export interface ListItemsOptions {
  limit?: number
  offset?: number
  fields?: string[]
  sort?: 'name' | 'date' | 'size'
  direction?: 'ASC' | 'DESC'
}

export interface SearchOptions {
  query: string
  limit?: number
  offset?: number
  type?: 'file' | 'folder'
  fileExtensions?: string[]
  ancestorFolderIds?: string[]
  contentTypes?: ('name' | 'description' | 'file_content' | 'comments' | 'tags')[]
}

export interface BoxSearchResult {
  total_count: number
  limit: number
  offset: number
  entries: Array<BoxFile | BoxFolder>
}

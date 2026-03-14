export type InfoSourceId = 'mock' | 'nta' | 'web_search' | 'mof' | 'custom'

export type InfoCategory =
  | 'tax_law'
  | 'social_insurance'
  | 'accounting_standard'
  | 'corporate_law'
  | 'notification'
  | 'general'

export type InfoPriority = 'low' | 'medium' | 'high' | 'critical'

export type InfoSourceStatus = 'active' | 'degraded' | 'unavailable' | 'disabled'

export interface ExternalInfoItem {
  readonly id: string
  readonly source: InfoSourceId
  readonly category: InfoCategory
  readonly title: string
  readonly summary: string
  readonly content: string
  readonly publishedAt?: Date
  readonly effectiveFrom?: Date
  readonly effectiveTo?: Date
  readonly url?: string
  readonly tags: readonly string[]
  readonly relevanceScore: number
  readonly fetchedAt: Date
}

export interface ExternalInfoQuery {
  readonly query: string
  readonly categories?: readonly InfoCategory[]
  readonly sources?: readonly InfoSourceId[]
  readonly fromDate?: Date
  readonly toDate?: Date
  readonly limit?: number
  readonly minRelevance?: number
}

export interface ExternalInfoResult {
  readonly success: boolean
  readonly items: readonly ExternalInfoItem[]
  readonly totalFound: number
  readonly source: InfoSourceId
  readonly fetchedAt: Date
  readonly latencyMs: number
  readonly error?: {
    readonly code: string
    readonly message: string
  }
}

export interface InfoSourceConfig {
  readonly id: InfoSourceId
  readonly name: string
  readonly description: string
  readonly enabled: boolean
  readonly priority: number
  readonly timeoutMs: number
  readonly maxRetries: number
  readonly retryDelayMs: number
  readonly cacheTtlMs: number
  readonly customConfig?: Record<string, unknown>
}

export interface InfoSourceHealth {
  readonly sourceId: InfoSourceId
  readonly status: InfoSourceStatus
  readonly lastSuccessAt?: Date
  readonly lastFailureAt?: Date
  readonly consecutiveFailures: number
  readonly averageLatencyMs: number
  readonly lastError?: string
}

export type ExternalInfoServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: Record<string, unknown> } }

export const DEFAULT_SOURCE_CONFIGS: Record<InfoSourceId, InfoSourceConfig> = {
  mock: {
    id: 'mock',
    name: 'Mock Source',
    description: 'Development mock data source',
    enabled: true,
    priority: 100,
    timeoutMs: 5000,
    maxRetries: 0,
    retryDelayMs: 0,
    cacheTtlMs: 60000,
  },
  nta: {
    id: 'nta',
    name: 'National Tax Agency',
    description: 'Japan National Tax Agency (国税庁)',
    enabled: true,
    priority: 10,
    timeoutMs: 30000,
    maxRetries: 3,
    retryDelayMs: 1000,
    cacheTtlMs: 86400000,
  },
  web_search: {
    id: 'web_search',
    name: 'Web Search',
    description: 'General web search integration',
    enabled: false,
    priority: 50,
    timeoutMs: 15000,
    maxRetries: 2,
    retryDelayMs: 500,
    cacheTtlMs: 3600000,
  },
  mof: {
    id: 'mof',
    name: 'Ministry of Finance',
    description: 'Japan Ministry of Finance (財務省)',
    enabled: false,
    priority: 20,
    timeoutMs: 30000,
    maxRetries: 3,
    retryDelayMs: 1000,
    cacheTtlMs: 86400000,
  },
  custom: {
    id: 'custom',
    name: 'Custom Source',
    description: 'User-defined custom source',
    enabled: false,
    priority: 80,
    timeoutMs: 15000,
    maxRetries: 2,
    retryDelayMs: 500,
    cacheTtlMs: 3600000,
  },
} as const

export const INFO_CATEGORY_LABELS: Record<InfoCategory, { ja: string; en: string }> = {
  tax_law: { ja: '税法', en: 'Tax Law' },
  social_insurance: { ja: '社会保険', en: 'Social Insurance' },
  accounting_standard: { ja: '会計基準', en: 'Accounting Standard' },
  corporate_law: { ja: '会社法', en: 'Corporate Law' },
  notification: { ja: '通知・お知らせ', en: 'Notification' },
  general: { ja: '一般', en: 'General' },
}

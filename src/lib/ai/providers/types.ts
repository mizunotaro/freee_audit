import type { AIProviderType, ModelConfig, ResolvedConfig } from '../config/types'

export interface DocumentAnalysisRequest {
  documentId: string
  content: string
  mimeType: string
  options?: {
    extractTables?: boolean
    extractMetadata?: boolean
    language?: string
  }
}

export interface DocumentAnalysisResult {
  documentId: string
  text: string
  tables?: Array<{
    rows: string[][]
    headers?: string[]
  }>
  metadata?: Record<string, unknown>
  confidence: number
  processingTimeMs: number
}

export interface EntryValidationRequest {
  entryId: string
  entry: {
    debitAccountId: string
    creditAccountId: string
    amount: number
    description: string
    date: string
  }
  context?: {
    previousEntries?: Array<{
      debitAccountId: string
      creditAccountId: string
      amount: number
      description: string
    }>
    companyInfo?: {
      industry?: string
      fiscalYearStart?: string
    }
  }
}

export interface EntryValidationResult {
  entryId: string
  isValid: boolean
  confidence: number
  issues: Array<{
    type: 'error' | 'warning' | 'info'
    code: string
    message: string
    field?: string
  }>
  suggestions?: Array<{
    field: string
    value: unknown
    reason: string
  }>
  processingTimeMs: number
}

export interface AIProvider {
  readonly name: AIProviderType
  readonly modelConfig: ModelConfig
  analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult>
  validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult>
  healthCheck(): Promise<boolean>
}

export interface ProviderMetadata {
  name: AIProviderType
  displayName: string
  description: string
  website: string
  requiresApiKey: boolean
  supportsZDR: boolean
  dataResidency: ('US' | 'EU' | 'GLOBAL')[]
}

export interface ProviderFactory {
  (config: ResolvedConfig): AIProvider
}

export interface RegisteredProvider {
  metadata: ProviderMetadata
  factory: ProviderFactory
  availableModels: ModelConfig[]
}

export interface ProviderRegistryOptions {
  strictMode?: boolean
  lazyInit?: boolean
}

export class ProviderRegistrationError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly reason: string
  ) {
    super(`Failed to register provider "${providerName}": ${reason}`)
    this.name = 'ProviderRegistrationError'
  }
}

export class ProviderNotFoundError extends Error {
  constructor(public readonly providerName: string) {
    super(`Provider "${providerName}" not found in registry`)
    this.name = 'ProviderNotFoundError'
  }
}

export class ProviderInitializationError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly cause: Error
  ) {
    super(`Failed to initialize provider "${providerName}": ${cause.message}`)
    this.name = 'ProviderInitializationError'
  }
}

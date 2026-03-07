import OpenAI from 'openai'
import {
  BaseAIProvider,
  AIConfig,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'
import { API_TIMEOUTS } from '@/lib/utils/timeout'
import { getDefaultModel } from '@/lib/ai/config/model-config'

export interface OpenRouterProviderConfig {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
  siteUrl?: string
  siteName?: string
  zdr?: boolean
  dataResidency?: 'US' | 'EU' | 'GLOBAL'
  providerRouting?: {
    order?: string[]
    allow_fallbacks?: boolean
    require_parameters?: boolean
    only?: string[]
    ignore?: string[]
    quantizations?: string[]
  }
  transforms?: string[]
  maxRetries?: number
}

export interface OpenRouterModelInfo {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
    image?: string
    request?: string
  }
  top_provider?: {
    is_moderated?: boolean
    max_completion_tokens?: number
  }
  per_request_limits?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export interface OpenRouterErrorInfo {
  type:
    | 'rate_limit'
    | 'authentication'
    | 'invalid_request'
    | 'server_error'
    | 'provider_error'
    | 'unknown'
  message: string
  retryAfter?: number
  statusCode?: number
  providerName?: string
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000
const MAX_RETRY_DELAY_MS = 30000

function parseOpenRouterError(error: unknown): OpenRouterErrorInfo {
  if (error instanceof Error) {
    const httpError = error as Error & {
      status?: number
      headers?: Record<string, string>
      error?: { code?: number; message?: string; metadata?: { provider_name?: string } }
    }

    if (httpError.status === 429) {
      const retryAfter = httpError.headers?.['retry-after']
      return {
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        retryAfter: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
        statusCode: 429,
      }
    }

    if (httpError.status === 401 || httpError.status === 403) {
      return {
        type: 'authentication',
        message: 'Authentication failed',
        statusCode: httpError.status,
      }
    }

    if (httpError.status === 400) {
      return {
        type: 'invalid_request',
        message: httpError.error?.message || error.message,
        statusCode: 400,
      }
    }

    if (httpError.status === 402) {
      return {
        type: 'provider_error',
        message: 'Insufficient credits or provider unavailable',
        statusCode: 402,
        providerName: httpError.error?.metadata?.provider_name,
      }
    }

    if (httpError.status && httpError.status >= 500) {
      return {
        type: 'server_error',
        message: 'Server error',
        statusCode: httpError.status,
        providerName: httpError.error?.metadata?.provider_name,
      }
    }

    return {
      type: 'unknown',
      message: error.message,
      statusCode: httpError.status,
    }
  }

  return {
    type: 'unknown',
    message: 'Unknown error',
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class OpenRouterProvider extends BaseAIProvider {
  readonly name = 'openrouter' as const
  private client: OpenAI
  private resolvedModel: string
  private openRouterConfig: OpenRouterProviderConfig
  private maxRetries: number

  constructor(config: OpenRouterProviderConfig) {
    super(config as AIConfig)
    this.openRouterConfig = config
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES

    const defaultModel = getDefaultModel('openrouter')
    this.resolvedModel = config.model || defaultModel

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: OPENROUTER_BASE_URL,
      timeout: API_TIMEOUTS.AI_API,
      defaultHeaders: {
        'HTTP-Referer':
          config.siteUrl ||
          process.env.OPENROUTER_SITE_URL ||
          process.env.APP_URL ||
          'https://freee-audit.app',
        'X-Title': config.siteName || 'Freee Audit',
      },
    })
  }

  private buildExtraParams(): Record<string, unknown> {
    const extra: Record<string, unknown> = {}

    const provider: Record<string, unknown> = {}

    if (this.openRouterConfig.zdr !== false) {
      provider.zdr = true
    }

    if (this.openRouterConfig.dataResidency && this.openRouterConfig.dataResidency !== 'GLOBAL') {
      provider.data_residency = this.openRouterConfig.dataResidency
    }

    if (
      this.openRouterConfig.providerRouting?.order &&
      this.openRouterConfig.providerRouting.order.length > 0
    ) {
      provider.order = this.openRouterConfig.providerRouting.order
    }

    if (this.openRouterConfig.providerRouting?.allow_fallbacks !== undefined) {
      provider.allow_fallbacks = this.openRouterConfig.providerRouting.allow_fallbacks
    }

    if (this.openRouterConfig.providerRouting?.require_parameters !== undefined) {
      provider.require_parameters = this.openRouterConfig.providerRouting.require_parameters
    }

    if (
      this.openRouterConfig.providerRouting?.only &&
      this.openRouterConfig.providerRouting.only.length > 0
    ) {
      provider.only = this.openRouterConfig.providerRouting.only
    }

    if (
      this.openRouterConfig.providerRouting?.ignore &&
      this.openRouterConfig.providerRouting.ignore.length > 0
    ) {
      provider.ignore = this.openRouterConfig.providerRouting.ignore
    }

    if (
      this.openRouterConfig.providerRouting?.quantizations &&
      this.openRouterConfig.providerRouting.quantizations.length > 0
    ) {
      provider.quantizations = this.openRouterConfig.providerRouting.quantizations
    }

    if (Object.keys(provider).length > 0) {
      extra.provider = provider
    }

    if (this.openRouterConfig.transforms && this.openRouterConfig.transforms.length > 0) {
      extra.transforms = this.openRouterConfig.transforms
    }

    return extra
  }

  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        const errorInfo = parseOpenRouterError(error)

        if (
          errorInfo.type === 'authentication' ||
          errorInfo.type === 'invalid_request' ||
          errorInfo.type === 'provider_error'
        ) {
          throw error
        }

        if (attempt < this.maxRetries) {
          let retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
          if (errorInfo.retryAfter) {
            retryDelay = Math.min(errorInfo.retryAfter, MAX_RETRY_DELAY_MS)
          } else {
            retryDelay = Math.min(retryDelay, MAX_RETRY_DELAY_MS)
          }

          console.warn(
            `[OpenRouterProvider] ${operationName} attempt ${attempt + 1} failed, retrying in ${retryDelay}ms:`,
            errorInfo.message,
            errorInfo.providerName ? `(provider: ${errorInfo.providerName})` : ''
          )

          await delay(retryDelay)
        }
      }
    }

    throw lastError
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const extraParams = this.buildExtraParams()

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: `${this.getSystemPrompt()}\n\n${this.getSystemPromptJa()}\n\nExtract information from this ${request.documentType}.`,
      },
    ]

    if (request.documentType === 'pdf') {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:application/pdf;base64,${request.documentBase64}`,
        },
      })
    } else {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${request.mimeType};base64,${request.documentBase64}`,
        },
      })
    }

    const response = await this.withRetry(async () => {
      return this.client.chat.completions.create({
        model: this.resolvedModel,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: this.openRouterConfig.maxTokens || 1024,
        temperature: this.openRouterConfig.temperature || 0.1,
        response_format: { type: 'json_object' },
        ...extraParams,
      })
    }, 'analyzeDocument')

    const resultText = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(resultText)

    return {
      date: result.date || null,
      amount: result.amount ?? 0,
      taxAmount: result.taxAmount ?? 0,
      taxRate: result.taxRate,
      description: result.description || '',
      vendorName: result.vendorName || '',
      confidence: result.confidence ?? 0.5,
      rawText: resultText,
    }
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    const extraParams = this.buildExtraParams()

    const response = await this.withRetry(async () => {
      return this.client.chat.completions.create({
        model: this.resolvedModel,
        messages: [
          {
            role: 'system',
            content: this.getValidationPrompt(),
          },
          {
            role: 'user',
            content: JSON.stringify(
              {
                journalEntry: request.journalEntry,
                documentData: request.documentData,
              },
              null,
              2
            ),
          },
        ],
        max_tokens: this.openRouterConfig.maxTokens || 1024,
        temperature: this.openRouterConfig.temperature || 0.1,
        response_format: { type: 'json_object' },
        ...extraParams,
      })
    }, 'validateEntry')

    const resultText = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(resultText)

    return {
      isValid: result.isValid ?? false,
      issues: (result.issues || []).map((issue: Record<string, unknown>) => ({
        field: String(issue.field || ''),
        severity: (issue.severity as 'error' | 'warning' | 'info') || 'info',
        message: String(issue.messageJa || issue.message || ''),
        messageEn: String(issue.message || ''),
        expectedValue: issue.expectedValue,
        actualValue: issue.actualValue,
      })) as ValidationIssue[],
      suggestions: result.suggestions,
    }
  }

  async getAvailableModels(): Promise<OpenRouterModelInfo[]> {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${this.openRouterConfig.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.data
  }

  async getModelInfo(modelId: string): Promise<OpenRouterModelInfo | undefined> {
    const models = await this.getAvailableModels()
    return models.find((m) => m.id === modelId)
  }
}

export function createOpenRouterProvider(config: OpenRouterProviderConfig): OpenRouterProvider {
  return new OpenRouterProvider(config)
}

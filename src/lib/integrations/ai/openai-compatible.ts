import OpenAI from 'openai'
import {
  BaseAIProvider,
  AIConfig,
  DocumentAnalysisRequest,
  EntryValidationRequest,
  GenerateOptions,
  GenerateResult,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'
import { API_TIMEOUTS } from '@/lib/utils/timeout'
import type { OpenAICompatibleProviderType } from '@/lib/ai/config/types'

export interface OpenAICompatibleProviderConfig {
  apiKey: string
  provider: OpenAICompatibleProviderType
  baseUrl: string
  defaultModel: string
  model?: string
  temperature?: number
  maxTokens?: number
  headers?: Record<string, string>
  maxRetries?: number
}

export interface OpenAICompatibleErrorInfo {
  type: 'rate_limit' | 'authentication' | 'invalid_request' | 'server_error' | 'unknown'
  message: string
  retryAfter?: number
  statusCode?: number
}

const DEFAULT_MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000
const MAX_RETRY_DELAY_MS = 30000

function parseError(error: unknown): OpenAICompatibleErrorInfo {
  if (error instanceof Error) {
    const httpError = error as Error & { status?: number; headers?: Record<string, string> }

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
        message: error.message,
        statusCode: 400,
      }
    }

    if (httpError.status && httpError.status >= 500) {
      return {
        type: 'server_error',
        message: 'Server error',
        statusCode: httpError.status,
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

export class OpenAICompatibleProvider extends BaseAIProvider {
  readonly name: OpenAICompatibleProviderType
  private client: OpenAI
  private resolvedModel: string
  private maxRetries: number
  private configData: OpenAICompatibleProviderConfig

  constructor(config: OpenAICompatibleProviderConfig) {
    const aiConfig: AIConfig = {
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }
    super(aiConfig)
    this.name = config.provider
    this.configData = config
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.resolvedModel = config.model || config.defaultModel

    const clientConfig: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: API_TIMEOUTS.AI_API,
    }

    if (config.headers) {
      clientConfig.defaultHeaders = config.headers
    }

    this.client = new OpenAI(clientConfig)
  }

  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        const errorInfo = parseError(error)

        if (errorInfo.type === 'authentication' || errorInfo.type === 'invalid_request') {
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
            `[${this.name}Provider] ${operationName} attempt ${attempt + 1} failed, retrying in ${retryDelay}ms:`,
            errorInfo.message
          )

          await delay(retryDelay)
        }
      }
    }

    throw lastError
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
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
        max_tokens: this.configData.maxTokens || 1024,
        temperature: this.configData.temperature || 0.1,
        response_format: { type: 'json_object' },
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
        max_tokens: this.configData.maxTokens || 1024,
        temperature: this.configData.temperature || 0.1,
        response_format: { type: 'json_object' },
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

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || this.resolvedModel
    const temperature = options.temperature ?? this.configData.temperature ?? 0.1
    const maxTokens = options.maxTokens ?? this.configData.maxTokens ?? 1024

    const response = await this.withRetry(async () => {
      return this.client.chat.completions.create({
        model,
        messages: options.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
      })
    }, 'generate')

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    }
  }
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleProviderConfig
): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(config)
}

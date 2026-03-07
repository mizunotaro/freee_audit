import Anthropic from '@anthropic-ai/sdk'
import {
  BaseAIProvider,
  AIConfig,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'
import { API_TIMEOUTS } from '@/lib/utils/timeout'
import { getDefaultModel } from '@/lib/ai/config/model-config'

const MAX_RETRIES = 3
const RETRY_DELAY_BASE_MS = 1000

function isOverloadedError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { status?: number; message?: string }
    if (err.status === 529) {
      return true
    }
    if (typeof err.message === 'string') {
      return err.message.includes('overloaded') || err.message.includes('529')
    }
  }
  return false
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizeInput(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100000)
}

export class ClaudeProvider extends BaseAIProvider {
  readonly name = 'claude' as const
  private client: Anthropic
  private resolvedModel: string

  constructor(config: AIConfig) {
    super(config)
    this.resolvedModel = config.model || getDefaultModel('claude')
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: API_TIMEOUTS.AI_API,
    })
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (isOverloadedError(error) && attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt)
          await sleep(delay)
          continue
        }
        throw error
      }
    }
    throw lastError
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const model = this.resolvedModel

    const content: Anthropic.Messages.ContentBlockParam[] = []

    if (request.documentType === 'pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: request.documentBase64,
        },
      })
    } else {
      const mediaType = request.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: request.documentBase64,
        },
      })
    }

    const promptText = sanitizeInput(
      `${this.getSystemPrompt()}\n\n${this.getSystemPromptJa()}\n\nExtract information from this document and return JSON only.`
    )
    content.push({
      type: 'text',
      text: promptText,
    })

    const response = await this.withRetry(() =>
      this.client.messages.create({
        model,
        max_tokens: this.config.maxTokens || 1024,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      })
    )

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    const responseText = textBlock?.text || '{}'

    let parsedResult: Record<string, unknown> = {}
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0])
      }
    } catch {
      parsedResult = {}
    }

    return {
      date: (parsedResult.date as string) || null,
      amount: (parsedResult.amount as number) ?? 0,
      taxAmount: (parsedResult.taxAmount as number) ?? 0,
      taxRate: parsedResult.taxRate as number | undefined,
      description: (parsedResult.description as string) || '',
      vendorName: (parsedResult.vendorName as string) || '',
      confidence: (parsedResult.confidence as number) ?? 0.5,
      rawText: responseText,
    }
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    const model = this.resolvedModel

    const journalEntryStr = sanitizeInput(JSON.stringify(request.journalEntry, null, 2))
    const documentDataStr = sanitizeInput(JSON.stringify(request.documentData, null, 2))
    const validationPrompt = sanitizeInput(this.getValidationPrompt())

    const response = await this.withRetry(() =>
      this.client.messages.create({
        model,
        max_tokens: this.config.maxTokens || 1024,
        system: validationPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Validate the following journal entry against the document data:

Journal Entry:
${journalEntryStr}

Document Data:
${documentDataStr}

Return JSON with isValid, issues array, and optional suggestions.`,
              },
            ],
          },
        ],
      })
    )

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    const responseText = textBlock?.text || '{}'

    let parsedResult: Record<string, unknown> = {}
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0])
      }
    } catch {
      parsedResult = { isValid: false, issues: [] }
    }

    return {
      isValid: (parsedResult.isValid as boolean) ?? false,
      issues: ((parsedResult.issues as Array<Record<string, unknown>>) || []).map((issue) => ({
        field: String(issue.field || ''),
        severity: (issue.severity as 'error' | 'warning' | 'info') || 'info',
        message: String(issue.messageJa || issue.message || ''),
        messageEn: String(issue.message || ''),
        expectedValue: issue.expectedValue,
        actualValue: issue.actualValue,
      })) as ValidationIssue[],
      suggestions: parsedResult.suggestions as string[] | undefined,
    }
  }
}

export function createClaudeProvider(config: AIConfig): ClaudeProvider {
  return new ClaudeProvider(config)
}

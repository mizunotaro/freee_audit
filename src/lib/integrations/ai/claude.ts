import Anthropic from '@anthropic-ai/sdk'
import {
  BaseAIProvider,
  AIConfig,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'

export class ClaudeProvider extends BaseAIProvider {
  readonly name = 'claude' as const
  private client: Anthropic

  constructor(config: AIConfig) {
    super(config)
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const model = this.config.model || 'claude-sonnet-4-20250514'

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

    content.push({
      type: 'text',
      text: `${this.getSystemPrompt()}\n\n${this.getSystemPromptJa()}\n\nExtract information from this document and return JSON only.`,
    })

    const response = await this.client.messages.create({
      model,
      max_tokens: this.config.maxTokens || 1024,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    })

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
    const model = this.config.model || 'claude-sonnet-4-20250514'

    const response = await this.client.messages.create({
      model,
      max_tokens: this.config.maxTokens || 1024,
      system: this.getValidationPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Validate the following journal entry against the document data:

Journal Entry:
${JSON.stringify(request.journalEntry, null, 2)}

Document Data:
${JSON.stringify(request.documentData, null, 2)}

Return JSON with isValid, issues array, and optional suggestions.`,
            },
          ],
        },
      ],
    })

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

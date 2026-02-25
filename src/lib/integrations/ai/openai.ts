import OpenAI from 'openai'
import {
  BaseAIProvider,
  AIConfig,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai' as const
  private client: OpenAI

  constructor(config: AIConfig) {
    super(config)
    this.client = new OpenAI({ apiKey: config.apiKey })
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const model = this.config.model || 'gpt-4o'

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

    const response = await this.client.chat.completions.create({
      model,
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
      max_tokens: this.config.maxTokens || 1024,
      temperature: this.config.temperature || 0.1,
      response_format: { type: 'json_object' },
    })

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
    const model = this.config.model || 'gpt-4o'

    const response = await this.client.chat.completions.create({
      model,
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
      max_tokens: this.config.maxTokens || 1024,
      temperature: this.config.temperature || 0.1,
      response_format: { type: 'json_object' },
    })

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
}

export function createOpenAIProvider(config: AIConfig): OpenAIProvider {
  return new OpenAIProvider(config)
}

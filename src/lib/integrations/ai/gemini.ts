import { GoogleGenerativeAI, Part } from '@google/generative-ai'
import {
  BaseAIProvider,
  AIConfig,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'

export class GeminiProvider extends BaseAIProvider {
  readonly name = 'gemini' as const
  private genAI: GoogleGenerativeAI

  constructor(config: AIConfig) {
    super(config)
    this.genAI = new GoogleGenerativeAI(config.apiKey)
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const model = this.config.model || 'gemini-1.5-pro'
    const generativeModel = this.genAI.getGenerativeModel({ model })

    const parts: Part[] = [{ text: `${this.getSystemPrompt()}\n\n${this.getSystemPromptJa()}` }]

    if (request.documentType === 'pdf') {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: request.documentBase64,
        },
      })
    } else {
      parts.push({
        inlineData: {
          mimeType: request.mimeType,
          data: request.documentBase64,
        },
      })
    }

    parts.push({ text: 'Extract information from this document and return JSON only.' })

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: this.config.temperature ?? 0.1,
        maxOutputTokens: this.config.maxTokens ?? 1024,
        responseMimeType: 'application/json',
      },
    })

    const responseText = result.response.text()
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
    const model = this.config.model || 'gemini-1.5-pro'
    const generativeModel = this.genAI.getGenerativeModel({ model })

    const prompt = `${this.getValidationPrompt()}

Validate the following journal entry against the document data:

Journal Entry:
${JSON.stringify(request.journalEntry, null, 2)}

Document Data:
${JSON.stringify(request.documentData, null, 2)}

Return JSON with isValid, issues array, and optional suggestions.`

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.config.temperature ?? 0.1,
        maxOutputTokens: this.config.maxTokens ?? 1024,
        responseMimeType: 'application/json',
      },
    })

    const responseText = result.response.text()
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

export function createGeminiProvider(config: AIConfig): GeminiProvider {
  return new GeminiProvider(config)
}

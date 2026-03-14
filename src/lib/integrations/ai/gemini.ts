import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import {
  BaseAIProvider,
  AIConfig,
  DocumentAnalysisRequest,
  EntryValidationRequest,
  GenerateOptions,
  GenerateResult,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult, ValidationIssue } from '@/types/audit'
import { API_TIMEOUTS, TimeoutError } from '@/lib/utils/timeout'
import {
  getDefaultModel,
  getDefaultTemperature,
  getDefaultMaxTokens,
} from '@/lib/ai/config/model-config'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs))
    }, timeoutMs)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer))
  })
}

export interface GeminiConfig extends AIConfig {
  vertexAI?: {
    projectId: string
    location: string
  }
  safetySettings?: Array<{
    category: HarmCategory
    threshold: HarmBlockThreshold
  }>
}

const DEFAULT_SAFETY_SETTINGS: Array<{
  category: HarmCategory
  threshold: HarmBlockThreshold
}> = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
]

export class GeminiProvider extends BaseAIProvider {
  readonly name = 'gemini' as const
  private genAI: GoogleGenerativeAI
  private resolvedModel: string
  private safetySettings: Array<{ category: HarmCategory; threshold: HarmBlockThreshold }>

  constructor(config: GeminiConfig) {
    super(config)
    this.genAI = new GoogleGenerativeAI(config.apiKey)
    this.resolvedModel = config.model || getDefaultModel('gemini')
    this.safetySettings = config.safetySettings ?? DEFAULT_SAFETY_SETTINGS
  }

  getModel(): string {
    return this.resolvedModel
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const generativeModel = this.genAI.getGenerativeModel({
      model: this.resolvedModel,
      safetySettings: this.safetySettings,
    })

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

    const temperature = this.config.temperature ?? getDefaultTemperature()
    const maxTokens = this.config.maxTokens ?? getDefaultMaxTokens()

    const result = await withTimeout(
      generativeModel.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      }),
      API_TIMEOUTS.AI_API
    )

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
    const generativeModel = this.genAI.getGenerativeModel({
      model: this.resolvedModel,
      safetySettings: this.safetySettings,
    })

    const prompt = `${this.getValidationPrompt()}

Validate the following journal entry against the document data:

Journal Entry:
${JSON.stringify(request.journalEntry, null, 2)}

Document Data:
${JSON.stringify(request.documentData, null, 2)}

Return JSON with isValid, issues array, and optional suggestions.`

    const temperature = this.config.temperature ?? getDefaultTemperature()
    const maxTokens = this.config.maxTokens ?? getDefaultMaxTokens()

    const result = await withTimeout(
      generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      }),
      API_TIMEOUTS.AI_API
    )

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

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || this.resolvedModel
    const temperature = options.temperature ?? this.config.temperature ?? getDefaultTemperature()
    const maxTokens = options.maxTokens ?? this.config.maxTokens ?? getDefaultMaxTokens()
    const timeout = options.timeout ?? API_TIMEOUTS.AI_API

    const generativeModel = this.genAI.getGenerativeModel({
      model,
      safetySettings: this.safetySettings,
    })

    const parts: Part[] = []
    const systemMessage = options.messages.find((m) => m.role === 'system')
    const userMessages = options.messages.filter((m) => m.role === 'user')

    if (systemMessage) {
      parts.push({ text: systemMessage.content })
    }

    for (const msg of userMessages) {
      parts.push({ text: msg.content })
    }

    const result = await withTimeout(
      generativeModel.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
      timeout
    )

    const responseText = result.response.text()
    const usageMetadata = result.response.usageMetadata

    return {
      content: responseText,
      model,
      usage: usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount ?? 0,
            completionTokens: usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    }
  }
}

export function createGeminiProvider(config: GeminiConfig): GeminiProvider {
  return new GeminiProvider(config)
}

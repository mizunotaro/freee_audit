import { DocumentAnalysisResult, EntryValidationResult } from '@/types/audit'

export type AIProviderType = 'openai' | 'gemini' | 'claude'

export interface AIConfig {
  provider: AIProviderType
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface DocumentAnalysisRequest {
  documentBase64: string
  documentType: 'pdf' | 'image' | 'excel'
  mimeType: string
  extractionFields?: string[]
}

export interface EntryValidationRequest {
  journalEntry: {
    date: string
    debitAccount: string
    creditAccount: string
    amount: number
    taxAmount: number
    taxType?: string
    description: string
  }
  documentData: DocumentAnalysisResult
}

export interface AIProvider {
  readonly name: AIProviderType
  analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult>
  validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult>
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: AIProviderType
  protected config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  abstract analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult>
  abstract validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult>

  protected getSystemPrompt(): string {
    return `You are an expert in accounting document analysis.
Extract the following information accurately and return it in JSON format:
- date: Date (YYYY-MM-DD format)
- amount: Amount (excluding tax)
- taxAmount: Tax amount
- taxRate: Tax rate (if applicable, as decimal e.g. 0.10 for 10%)
- description: Description/summary
- vendorName: Vendor/supplier name
- confidence: Confidence score (0-1)

If any field cannot be determined, use null for that field.
Always respond with valid JSON only, no additional text.`
  }

  protected getSystemPromptJa(): string {
    return `あなたは会計証憑分析の専門家です。
以下の情報を正確に抽出し、JSON形式で返してください：
- date: 日付（YYYY-MM-DD形式）
- amount: 金額（税抜）
- taxAmount: 消費税額
- taxRate: 税率（該当する場合、小数で例：0.10は10%）
- description: 摘要
- vendorName: 取引先名
- confidence: 信頼度（0-1）

特定できないフィールドはnullを使用してください。
必ず有効なJSONのみで回答し、追加のテキストは含めないでください。`
  }

  protected getValidationPrompt(): string {
    return `You are an accounting expert. Validate the journal entry against the document data.
Check for:
1. Date consistency
2. Amount consistency (allow small rounding differences)
3. Tax amount consistency
4. Account appropriateness
5. Description relevance

Return JSON with:
- isValid: boolean
- issues: array of { field, severity: "error"|"warning"|"info", message (English), messageJa (Japanese), expectedValue, actualValue }
- suggestions: optional array of improvement suggestions

Severity levels:
- error: Must be corrected (amount/date mismatch)
- warning: Should be reviewed (account classification)
- info: FYI (minor discrepancies)`
  }
}

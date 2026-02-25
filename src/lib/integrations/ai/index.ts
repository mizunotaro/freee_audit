export type AIProvider = 'openai' | 'gemini' | 'claude'

export interface AIConfig {
  provider: AIProvider
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface AIProviderInterface {
  analyzeDocument(request: { documentBase64: string; mimeType: string }): Promise<{
    date: string | null
    amount: number
    taxAmount: number
    description: string
    vendorName: string
    confidence: number
  }>
  validateEntry?(request: {
    journalEntry: {
      date: string
      debitAccount: string
      creditAccount: string
      amount: number
      taxAmount: number
      taxType?: string
      description: string
    }
    documentData: {
      date: string | null
      amount: number
      taxAmount: number
      description: string
      vendorName: string
    }
  }): Promise<{
    isValid: boolean
    issues: Array<{
      field: string
      severity: 'error' | 'warning' | 'info'
      message: string
      messageEn: string
    }>
    suggestions?: string[]
  }>
}

export function createAIProviderFromEnv(_config?: Partial<AIConfig>): AIProviderInterface {
  return {
    analyzeDocument: async () => ({
      date: null,
      amount: 0,
      taxAmount: 0,
      description: '',
      vendorName: '',
      confidence: 0,
    }),
    validateEntry: async () => ({
      isValid: true,
      issues: [],
    }),
  }
}

export function getAIConfig(): AIConfig {
  return {
    provider: (process.env.AI_PROVIDER as AIProvider) || 'openai',
    apiKey:
      process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY,
    model: process.env.OPENAI_MODEL || process.env.GEMINI_MODEL || process.env.CLAUDE_MODEL,
  }
}

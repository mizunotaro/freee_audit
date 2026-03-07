export type { AIProvider, AIProviderType, AIConfig, FallbackConfig } from './factory'
export {
  OpenAIProvider,
  GeminiProvider,
  ClaudeProvider,
  OpenRouterProvider,
  MockAIProvider,
  FallbackAIProvider,
  createAIProvider,
  createAIProviderFromEnv,
  createAIProviderFromConfig,
  createAIProviderWithConfig,
  createFallbackProviderFromEnv,
  getAvailableProviders,
  getAIService,
  resetAIService,
  providerRegistry,
} from './factory'

export type { DocumentAnalysisRequest, EntryValidationRequest } from './provider'
export { BaseAIProvider } from './provider'

export {
  registerProviders,
  isProvidersRegistered,
  resetProviderRegistration,
} from './register-providers'

export type {
  AIProvider as NewAIProvider,
  ProviderMetadata,
  ProviderFactory,
  RegisteredProvider,
  DocumentAnalysisRequest as NewDocumentAnalysisRequest,
  DocumentAnalysisResult,
  EntryValidationRequest as NewEntryValidationRequest,
  EntryValidationResult,
} from '@/lib/ai/providers/types'

export type {
  AIProviderType as AIProviderTypeNew,
  ResolvedConfig,
  ModelConfig,
  ConfigSource,
} from '@/lib/ai/config/types'

export {
  getModelConfigService,
  resetModelConfigService,
  DEFAULT_MODELS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
} from '@/lib/ai/config/model-config'

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

export function createAIProviderFromEnvLegacy(
  config?: Partial<import('./factory').AIConfig>
): AIProviderInterface {
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

export function getAIConfig(): import('./factory').AIConfig {
  const provider = (process.env.AI_PROVIDER as import('./factory').AIProviderType) || 'openai'
  const apiKey =
    process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || ''
  const model = process.env.OPENAI_MODEL || process.env.GEMINI_MODEL || process.env.CLAUDE_MODEL

  return {
    provider,
    apiKey,
    model,
  }
}

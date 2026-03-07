import { providerRegistry } from '@/lib/ai/providers/registry'
import type {
  AIProvider as NewAIProvider,
  ProviderMetadata,
  ProviderFactory,
  DocumentAnalysisRequest,
  DocumentAnalysisResult,
  EntryValidationRequest,
  EntryValidationResult,
} from '@/lib/ai/providers/types'
import type { AIProviderType, ResolvedConfig, ModelConfig } from '@/lib/ai/config/types'
import { MODEL_REGISTRY } from '@/lib/ai/config/defaults'
import { OpenAIProvider } from './openai'
import { ClaudeProvider } from './claude'
import { GeminiProvider } from './gemini'
import { OpenRouterProvider, OpenRouterProviderConfig } from './openrouter'
import type { AIConfig } from './provider'

const OPENAI_METADATA: ProviderMetadata = {
  name: 'openai',
  displayName: 'OpenAI',
  description: 'GPT-4, GPT-5 series models',
  website: 'https://openai.com',
  requiresApiKey: true,
  supportsZDR: false,
  dataResidency: ['US'],
}

const CLAUDE_METADATA: ProviderMetadata = {
  name: 'claude',
  displayName: 'Anthropic Claude',
  description: 'Claude 4 series models',
  website: 'https://anthropic.com',
  requiresApiKey: true,
  supportsZDR: true,
  dataResidency: ['US'],
}

const GEMINI_METADATA: ProviderMetadata = {
  name: 'gemini',
  displayName: 'Google Gemini',
  description: 'Gemini 2.0 series models',
  website: 'https://ai.google.dev',
  requiresApiKey: true,
  supportsZDR: false,
  dataResidency: ['US', 'EU'],
}

const OPENROUTER_METADATA: ProviderMetadata = {
  name: 'openrouter',
  displayName: 'OpenRouter',
  description: 'Unified API for multiple providers',
  website: 'https://openrouter.ai',
  requiresApiKey: true,
  supportsZDR: true,
  dataResidency: ['US', 'EU', 'GLOBAL'],
}

function getModelConfig(provider: AIProviderType, modelId: string): ModelConfig {
  const found = MODEL_REGISTRY.find((m) => m.provider === provider && m.modelId === modelId)
  if (found) return found
  return {
    provider,
    modelId,
    displayName: modelId,
    contextLength: 128000,
    maxOutputTokens: 16384,
    pricing: { inputToken: 0, outputToken: 0 },
    capabilities: { vision: true, tools: true, json: true, streaming: true },
  }
}

function getProviderModels(provider: AIProviderType): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider)
}

class OpenAIProviderAdapter implements NewAIProvider {
  readonly name: AIProviderType = 'openai'
  readonly modelConfig: ModelConfig
  private provider: OpenAIProvider

  constructor(config: ResolvedConfig) {
    const aiConfig: AIConfig = {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }
    this.provider = new OpenAIProvider(aiConfig)
    this.modelConfig = getModelConfig('openai', config.model)
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const startTime = Date.now()
    const result = await this.provider.analyzeDocument({
      documentBase64: request.content,
      documentType: request.mimeType.includes('pdf') ? 'pdf' : 'image',
      mimeType: request.mimeType,
    })
    return {
      documentId: request.documentId,
      text: result.description || '',
      metadata: {
        date: result.date,
        amount: result.amount,
        taxAmount: result.taxAmount,
        taxRate: result.taxRate,
        vendorName: result.vendorName,
        rawText: result.rawText,
      },
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    }
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    const startTime = Date.now()
    const result = await this.provider.validateEntry({
      journalEntry: {
        date: request.entry.date,
        debitAccount: request.entry.debitAccountId,
        creditAccount: request.entry.creditAccountId,
        amount: request.entry.amount,
        taxAmount: 0,
        description: request.entry.description,
      },
      documentData: {
        date: null,
        amount: 0,
        taxAmount: 0,
        description: '',
        vendorName: '',
        confidence: 0,
      },
    })
    return {
      entryId: request.entryId,
      isValid: result.isValid,
      confidence: 0.9,
      issues: result.issues.map((issue) => ({
        type: issue.severity as 'error' | 'warning' | 'info',
        code: issue.field,
        message: issue.message,
        field: issue.field,
      })),
      suggestions: result.suggestions?.map((s) => ({
        field: 'general',
        value: s,
        reason: 'AI suggestion',
      })),
      processingTimeMs: Date.now() - startTime,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return !!process.env.OPENAI_API_KEY
    } catch {
      return false
    }
  }
}

class ClaudeProviderAdapter implements NewAIProvider {
  readonly name: AIProviderType = 'claude'
  readonly modelConfig: ModelConfig
  private provider: ClaudeProvider

  constructor(config: ResolvedConfig) {
    const aiConfig: AIConfig = {
      provider: 'claude',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }
    this.provider = new ClaudeProvider(aiConfig)
    this.modelConfig = getModelConfig('claude', config.model)
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const startTime = Date.now()
    const result = await this.provider.analyzeDocument({
      documentBase64: request.content,
      documentType: request.mimeType.includes('pdf') ? 'pdf' : 'image',
      mimeType: request.mimeType,
    })
    return {
      documentId: request.documentId,
      text: result.description || '',
      metadata: {
        date: result.date,
        amount: result.amount,
        taxAmount: result.taxAmount,
        taxRate: result.taxRate,
        vendorName: result.vendorName,
        rawText: result.rawText,
      },
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    }
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    const startTime = Date.now()
    const result = await this.provider.validateEntry({
      journalEntry: {
        date: request.entry.date,
        debitAccount: request.entry.debitAccountId,
        creditAccount: request.entry.creditAccountId,
        amount: request.entry.amount,
        taxAmount: 0,
        description: request.entry.description,
      },
      documentData: {
        date: null,
        amount: 0,
        taxAmount: 0,
        description: '',
        vendorName: '',
        confidence: 0,
      },
    })
    return {
      entryId: request.entryId,
      isValid: result.isValid,
      confidence: 0.9,
      issues: result.issues.map((issue) => ({
        type: issue.severity as 'error' | 'warning' | 'info',
        code: issue.field,
        message: issue.message,
        field: issue.field,
      })),
      suggestions: result.suggestions?.map((s) => ({
        field: 'general',
        value: s,
        reason: 'AI suggestion',
      })),
      processingTimeMs: Date.now() - startTime,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return !!process.env.ANTHROPIC_API_KEY
    } catch {
      return false
    }
  }
}

class GeminiProviderAdapter implements NewAIProvider {
  readonly name: AIProviderType = 'gemini'
  readonly modelConfig: ModelConfig
  private provider: GeminiProvider

  constructor(config: ResolvedConfig) {
    const aiConfig: AIConfig = {
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY || '',
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }
    this.provider = new GeminiProvider(aiConfig)
    this.modelConfig = getModelConfig('gemini', config.model)
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const startTime = Date.now()
    const result = await this.provider.analyzeDocument({
      documentBase64: request.content,
      documentType: request.mimeType.includes('pdf') ? 'pdf' : 'image',
      mimeType: request.mimeType,
    })
    return {
      documentId: request.documentId,
      text: result.description || '',
      metadata: {
        date: result.date,
        amount: result.amount,
        taxAmount: result.taxAmount,
        taxRate: result.taxRate,
        vendorName: result.vendorName,
        rawText: result.rawText,
      },
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    }
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    const startTime = Date.now()
    const result = await this.provider.validateEntry({
      journalEntry: {
        date: request.entry.date,
        debitAccount: request.entry.debitAccountId,
        creditAccount: request.entry.creditAccountId,
        amount: request.entry.amount,
        taxAmount: 0,
        description: request.entry.description,
      },
      documentData: {
        date: null,
        amount: 0,
        taxAmount: 0,
        description: '',
        vendorName: '',
        confidence: 0,
      },
    })
    return {
      entryId: request.entryId,
      isValid: result.isValid,
      confidence: 0.9,
      issues: result.issues.map((issue) => ({
        type: issue.severity as 'error' | 'warning' | 'info',
        code: issue.field,
        message: issue.message,
        field: issue.field,
      })),
      suggestions: result.suggestions?.map((s) => ({
        field: 'general',
        value: s,
        reason: 'AI suggestion',
      })),
      processingTimeMs: Date.now() - startTime,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return !!process.env.GEMINI_API_KEY
    } catch {
      return false
    }
  }
}

class OpenRouterProviderAdapter implements NewAIProvider {
  readonly name: AIProviderType = 'openrouter'
  readonly modelConfig: ModelConfig
  private provider: OpenRouterProvider

  constructor(config: ResolvedConfig) {
    const openRouterConfig: OpenRouterProviderConfig = {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      zdr: true,
    }
    this.provider = new OpenRouterProvider(openRouterConfig)
    this.modelConfig = getModelConfig('openrouter', config.model)
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const startTime = Date.now()
    const result = await this.provider.analyzeDocument({
      documentBase64: request.content,
      documentType: request.mimeType.includes('pdf') ? 'pdf' : 'image',
      mimeType: request.mimeType,
    })
    return {
      documentId: request.documentId,
      text: result.description || '',
      metadata: {
        date: result.date,
        amount: result.amount,
        taxAmount: result.taxAmount,
        taxRate: result.taxRate,
        vendorName: result.vendorName,
        rawText: result.rawText,
      },
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime,
    }
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    const startTime = Date.now()
    const result = await this.provider.validateEntry({
      journalEntry: {
        date: request.entry.date,
        debitAccount: request.entry.debitAccountId,
        creditAccount: request.entry.creditAccountId,
        amount: request.entry.amount,
        taxAmount: 0,
        description: request.entry.description,
      },
      documentData: {
        date: null,
        amount: 0,
        taxAmount: 0,
        description: '',
        vendorName: '',
        confidence: 0,
      },
    })
    return {
      entryId: request.entryId,
      isValid: result.isValid,
      confidence: 0.9,
      issues: result.issues.map((issue) => ({
        type: issue.severity as 'error' | 'warning' | 'info',
        code: issue.field,
        message: issue.message,
        field: issue.field,
      })),
      suggestions: result.suggestions?.map((s) => ({
        field: 'general',
        value: s,
        reason: 'AI suggestion',
      })),
      processingTimeMs: Date.now() - startTime,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return !!process.env.OPENROUTER_API_KEY
    } catch {
      return false
    }
  }
}

let registered = false

export function registerProviders(): void {
  if (registered) {
    return
  }

  const openaiFactory: ProviderFactory = (config) => new OpenAIProviderAdapter(config)
  providerRegistry.register(OPENAI_METADATA, openaiFactory, getProviderModels('openai'))

  const claudeFactory: ProviderFactory = (config) => new ClaudeProviderAdapter(config)
  providerRegistry.register(CLAUDE_METADATA, claudeFactory, getProviderModels('claude'))

  const geminiFactory: ProviderFactory = (config) => new GeminiProviderAdapter(config)
  providerRegistry.register(GEMINI_METADATA, geminiFactory, getProviderModels('gemini'))

  const openrouterFactory: ProviderFactory = (config) => new OpenRouterProviderAdapter(config)
  providerRegistry.register(OPENROUTER_METADATA, openrouterFactory, getProviderModels('openrouter'))

  registered = true
  console.log('[AI] Providers registered: openai, claude, gemini, openrouter')
}

export function isProvidersRegistered(): boolean {
  return registered
}

export function resetProviderRegistration(): void {
  registered = false
}

registerProviders()

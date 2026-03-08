export type PersonaType = 'cpa' | 'tax_accountant' | 'cfo' | 'financial_analyst'

export type AnalysisCategory =
  | 'liquidity'
  | 'safety'
  | 'profitability'
  | 'efficiency'
  | 'growth'
  | 'tax'
  | 'compliance'
  | 'strategy'

export type ModelComplexity =
  | 'complex_reasoning'
  | 'detailed_analysis'
  | 'standard_analysis'
  | 'fast_response'
export type OutputStyle = 'formal' | 'practical' | 'strategic' | 'analytical'

export interface AnalysisFocus {
  category: AnalysisCategory
  weight: number
  metrics: readonly string[]
}

export interface PersonaConfig {
  readonly type: PersonaType
  readonly name: string
  readonly nameJa: string
  readonly version: string
  readonly systemPrompt: string
  readonly systemPromptJa: string
  readonly expertise: readonly string[]
  readonly analysisFocus: readonly AnalysisFocus[]
  readonly outputStyle: OutputStyle
  readonly defaultModelComplexity: ModelComplexity
  readonly temperatureRange: {
    readonly min: number
    readonly max: number
    readonly recommended: number
  }
}

export interface ReasoningItem {
  point: string
  analysis: string
  evidence: string
  confidence: number
}

export interface AlternativeOption {
  option: string
  pros: readonly string[]
  cons: readonly string[]
  riskLevel: 'low' | 'medium' | 'high'
}

export interface RiskItem {
  category: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  probability: number
  mitigation?: string
}

export interface PersonaResponse {
  readonly persona: PersonaType
  readonly conclusion: string
  readonly confidence: number
  readonly reasoning: readonly ReasoningItem[]
  readonly alternatives?: readonly AlternativeOption[]
  readonly risks: readonly RiskItem[]
  readonly recommendedAction?: string
  readonly metadata: {
    readonly modelUsed: string
    readonly tokensUsed: number
    readonly processingTimeMs: number
    readonly templateVersion: string
  }
}

export interface PersonaBuildContext {
  readonly query: string
  readonly financialData?: Record<string, unknown>
  readonly conversationHistory?: readonly ConversationMessage[]
  readonly userRole?: 'business_owner' | 'accountant' | 'investor' | 'lender'
  readonly language?: 'ja' | 'en'
}

export interface ConversationMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly timestamp: Date
}

export interface CompiledPrompt {
  readonly systemPrompt: string
  readonly userPrompt: string
  readonly estimatedTokens: number
  readonly personaType: PersonaType
  readonly personaVersion: string
}

export interface PersonaError {
  readonly code: 'validation_error' | 'compilation_error' | 'token_limit_exceeded'
  readonly message: string
  readonly details?: Record<string, unknown>
}

export type PersonaResult<T> = { success: true; data: T } | { success: false; error: PersonaError }

export interface PromptVariables {
  ocrText: string
  companyContext?: string
  chartOfAccounts?: string
  fiscalYearEnd?: number
  additionalContext?: string
}

export interface JournalEntry {
  entryDate: string
  description: string
  debitAccount: string
  debitAccountName: string
  creditAccount: string
  creditAccountName: string
  amount: number
  taxAmount: number
  taxType: string
}

export interface JournalProposalResponse {
  entries: readonly JournalEntry[]
  rationale: string
  confidence: number
  warnings: readonly string[]
}

export type PersonaRole = 'cpa' | 'tax_accountant' | 'cfo' | 'financial_analyst'

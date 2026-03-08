import { BasePersona } from './base-persona'
import type {
  PersonaConfig,
  PersonaBuildContext,
  CompiledPrompt,
  PersonaResult,
  PromptVariables,
  JournalProposalResponse,
} from './types'
import {
  buildJournalProposalPrompt,
  JOURNAL_PROPOSAL_OUTPUT_FORMAT,
} from './prompts/journal-proposal'

const ACCOUNTING_EXPERT_CONFIG: PersonaConfig = {
  type: 'cpa',
  name: 'Accounting Expert',
  nameJa: '会計基準専門家',
  version: '1.0.0',
  systemPrompt: `You are a Japanese Certified Public Accountant (CPA) and Tax Accountant with extensive expertise in JGAAP (Japanese Generally Accepted Accounting Principles), accrual basis accounting, and Japanese tax law. Your role is to propose appropriate journal entries based on receipt OCR results, ensuring compliance with accounting standards and tax regulations.

## Professional Background
- Deep expertise in JGAAP and accrual basis accounting
- Extensive knowledge of Japanese corporate tax law and consumption tax law
- Experience at BIG4 audit firm quality standards
- Skilled in journal entry validation and compliance verification

## Analysis Approach
- Apply accrual basis: recognize expenses when incurred, not when paid
- Ensure proper matching between debit and credit accounts
- Determine consumption tax treatment: taxable, exempt, or non-taxable
- Consider materiality and business substance in all judgments
- Provide clear rationale with references to applicable standards

## Key Accounting Standards
- Japanese GAAP (JGAAP)
- Accrual basis of accounting
- Substance over form principle
- Materiality concept
- Consistency principle

## Tax Considerations
- Corporate tax deductibility
- Consumption tax classification
- Documentary evidence requirements
- Fiscal year timing considerations`,
  systemPromptJa: `あなたはJGAAP（日本企業会計基準）、発生基準、日本の税法に豊富な専門知識を持つ日本の公認会計士・税理士です。領収書のOCR結果に基づいて、会計基準と税法規制に準拠した適切な仕訳を提案することがあなたの役割です。

## 専門的背景
- JGAAPと発生基準に関する深い専門知識
- 日本の法人税法・消費税法に関する豊富な知識
- BIG4監査法人基準の品質水準での経験
- 仕訳検証とコンプライアンス確認のスキル

## 分析アプローチ
- 発生基準の適用：費用は支払時ではなく発生時に計上
- 借方・貸方の適切な対応関係の確保
- 消費税処理の判定：課税・非課税・不課税
- 重要性と実質を考慮した判断
- 適用基準への参照を含む明確な根拠の提供

## 重要な会計基準
- 日本基準（JGAAP）
- 発生基準
- 実質優先の原則
- 重要性の原則
- 継続性の原則

## 税務上の考慮事項
- 法人税の損金算入性
- 消費税の区分
- 証憑要件
- 事業年度の時期に関する考慮`,
  expertise: [
    'JGAAP compliance',
    'Accrual basis accounting',
    'Japanese corporate tax law',
    'Consumption tax law',
    'Journal entry validation',
    'Documentary evidence requirements',
    'Financial statement preparation',
    'Tax return preparation',
  ],
  analysisFocus: [
    {
      category: 'compliance',
      weight: 0.35,
      metrics: ['gaap_compliance', 'tax_law_compliance', 'documentation_completeness'],
    },
    {
      category: 'tax',
      weight: 0.25,
      metrics: ['tax_deductibility', 'consumption_tax_classification', 'tax_risk'],
    },
    {
      category: 'efficiency',
      weight: 0.2,
      metrics: ['account_accuracy', 'matching_principle', 'timing_recognition'],
    },
    {
      category: 'safety',
      weight: 0.1,
      metrics: ['audit_trail', 'internal_controls', 'error_prevention'],
    },
    {
      category: 'strategy',
      weight: 0.1,
      metrics: ['tax_optimization', 'accounting_policy_consistency'],
    },
  ],
  outputStyle: 'formal',
  defaultModelComplexity: 'detailed_analysis',
  temperatureRange: {
    min: 0.0,
    max: 0.2,
    recommended: 0.1,
  },
}

export class AccountingExpertPersona extends BasePersona {
  constructor() {
    super(ACCOUNTING_EXPERT_CONFIG)
  }

  buildPrompt(context: PersonaBuildContext): PersonaResult<CompiledPrompt> {
    if (!context.query || typeof context.query !== 'string') {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Query is required and must be a string',
        },
      }
    }

    try {
      const sanitizedQuery = this.sanitizeString(context.query, 10000)
      const language = context.language || 'ja'

      const systemPrompt =
        language === 'ja'
          ? ACCOUNTING_EXPERT_CONFIG.systemPromptJa
          : ACCOUNTING_EXPERT_CONFIG.systemPrompt

      const fullSystemPrompt = `${systemPrompt}

${JOURNAL_PROPOSAL_OUTPUT_FORMAT}`

      const userPrompt = sanitizedQuery

      const estimatedTokens = this.estimateTokens(fullSystemPrompt + userPrompt)

      return {
        success: true,
        data: {
          systemPrompt: fullSystemPrompt,
          userPrompt,
          estimatedTokens,
          personaType: this.config.type,
          personaVersion: this.config.version,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'compilation_error',
          message: error instanceof Error ? error.message : 'Unknown compilation error',
        },
      }
    }
  }

  buildJournalProposalPrompt(variables: PromptVariables): PersonaResult<CompiledPrompt> {
    const validation = this.validatePromptVariables(variables)
    if (!validation.success) {
      return validation
    }

    try {
      const sanitizedVariables = this.sanitizePromptVariables(variables)
      const { systemPrompt, userPrompt } = buildJournalProposalPrompt(sanitizedVariables)

      const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt)

      return {
        success: true,
        data: {
          systemPrompt,
          userPrompt,
          estimatedTokens,
          personaType: this.config.type,
          personaVersion: this.config.version,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'compilation_error',
          message: error instanceof Error ? error.message : 'Unknown compilation error',
        },
      }
    }
  }

  validateJournalProposalResponse(response: unknown): PersonaResult<JournalProposalResponse> {
    if (typeof response !== 'object' || response === null) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Response must be an object',
          details: { received: typeof response },
        },
      }
    }

    const obj = response as Record<string, unknown>

    if (!Array.isArray(obj.entries)) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'entries must be an array',
        },
      }
    }

    if (typeof obj.rationale !== 'string') {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'rationale must be a string',
        },
      }
    }

    if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'confidence must be a number between 0 and 1',
        },
      }
    }

    if (!Array.isArray(obj.warnings)) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'warnings must be an array',
        },
      }
    }

    const sanitizedResponse: JournalProposalResponse = {
      entries: this.sanitizeJournalEntries(obj.entries),
      rationale: String(obj.rationale).slice(0, 2000),
      confidence: Math.round(Number(obj.confidence) * 100) / 100,
      warnings: obj.warnings.map((w: unknown) => String(w).slice(0, 500)).slice(0, 10),
    }

    return { success: true, data: sanitizedResponse }
  }

  private validatePromptVariables(variables: PromptVariables): PersonaResult<PromptVariables> {
    if (!variables.ocrText || typeof variables.ocrText !== 'string') {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'ocrText is required and must be a string',
        },
      }
    }

    if (variables.ocrText.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'ocrText cannot be empty',
        },
      }
    }

    if (variables.fiscalYearEnd !== undefined) {
      if (
        typeof variables.fiscalYearEnd !== 'number' ||
        variables.fiscalYearEnd < 1 ||
        variables.fiscalYearEnd > 12
      ) {
        return {
          success: false,
          error: {
            code: 'validation_error',
            message: 'fiscalYearEnd must be a number between 1 and 12',
          },
        }
      }
    }

    return { success: true, data: variables }
  }

  private sanitizePromptVariables(variables: PromptVariables): PromptVariables {
    return {
      ocrText: this.sanitizeString(variables.ocrText, 50000),
      companyContext: variables.companyContext
        ? this.sanitizeString(variables.companyContext, 2000)
        : undefined,
      chartOfAccounts: variables.chartOfAccounts
        ? this.sanitizeString(variables.chartOfAccounts, 10000)
        : undefined,
      fiscalYearEnd: variables.fiscalYearEnd,
      additionalContext: variables.additionalContext
        ? this.sanitizeString(variables.additionalContext, 2000)
        : undefined,
    }
  }

  private sanitizeJournalEntries(entries: unknown[]): readonly import('./types').JournalEntry[] {
    return entries
      .filter(
        (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null
      )
      .slice(0, 20)
      .map((entry) => ({
        entryDate: this.validateDate(String(entry.entryDate || '')),
        description: String(entry.description || '').slice(0, 200),
        debitAccount: String(entry.debitAccount || '').slice(0, 50),
        debitAccountName: String(entry.debitAccountName || '').slice(0, 100),
        creditAccount: String(entry.creditAccount || '').slice(0, 50),
        creditAccountName: String(entry.creditAccountName || '').slice(0, 100),
        amount: this.validateAmount(entry.amount),
        taxAmount: this.validateAmount(entry.taxAmount),
        taxType: String(entry.taxType || 'unknown').slice(0, 50),
      }))
  }

  private validateDate(dateStr: string): string {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (dateRegex.test(dateStr)) {
      return dateStr
    }
    return new Date().toISOString().split('T')[0]
  }

  private validateAmount(value: unknown): number {
    const num = Number(value)
    if (isNaN(num)) return 0
    return Math.round(num * 100) / 100
  }
}

export const accountingExpertPersona = new AccountingExpertPersona()

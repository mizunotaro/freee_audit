export type {
  PersonaType,
  AnalysisCategory,
  ModelComplexity,
  OutputStyle,
  AnalysisFocus,
  PersonaConfig,
  ReasoningItem,
  AlternativeOption,
  RiskItem,
  PersonaResponse,
  PersonaBuildContext,
  ConversationMessage,
  CompiledPrompt,
  PersonaError,
  PersonaResult,
  PromptVariables,
  JournalEntry,
  JournalProposalResponse,
  PersonaRole,
} from './types'

export { BasePersona } from './base-persona'

export {
  personaRegistry,
  getPersona,
  getPersonaOrThrow,
  getAllPersonas,
  getAllPersonaConfigs,
  registerPersona,
  hasPersona,
  getPersonaTypes,
} from './registry'

export { CPAPersona } from './personas/cpa'
export { TaxAccountantPersona } from './personas/tax-accountant'
export { CFOPersona } from './personas/cfo'
export { FinancialAnalystPersona } from './personas/financial-analyst'

export { AccountingExpertPersona, accountingExpertPersona } from './accounting-expert'

export { UNIVERSAL_CONSTRAINTS, CONSTRAINTS_EN, getConstraints } from './prompts/constraints'

export { JSON_OUTPUT_FORMAT, OUTPUT_FORMAT_EN, getOutputFormat } from './prompts/output-formats'

export { buildBasePrompt } from './prompts/templates/base'
export type { PersonaSection } from './prompts/templates/sections'
export {
  buildExpertiseSection,
  buildAnalysisFocusSection,
  buildConversationContext,
} from './prompts/templates/sections'

export {
  JOURNAL_PROPOSAL_SYSTEM_PROMPT_JA,
  JOURNAL_PROPOSAL_SYSTEM_PROMPT_EN,
  JOURNAL_PROPOSAL_OUTPUT_FORMAT,
  JUDGMENT_CRITERIA_JA,
  JUDGMENT_CRITERIA_EN,
  buildJournalProposalPrompt,
  getJournalProposalSystemPrompt,
} from './prompts/journal-proposal'

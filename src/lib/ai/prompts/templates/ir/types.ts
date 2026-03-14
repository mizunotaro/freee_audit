import type { PersonaType } from '@/lib/ai/personas/types'

export interface LocalizedText {
  readonly ja: string
  readonly en?: string
}

export type IRPromptSectionType =
  | 'TOP_MESSAGE'
  | 'FINANCIAL_HIGHLIGHTS'
  | 'DIVIDEND_POLICY'
  | 'MIDTERM_PLAN'
  | 'ESG_INFO'
  | 'RISK_FACTORS'

export type IRPromptPersona = Extract<PersonaType, 'cpa' | 'cfo' | 'financial_analyst'>

export interface IRPromptTemplate {
  readonly id: string
  readonly sectionType: IRPromptSectionType
  readonly persona: IRPromptPersona
  readonly systemPrompt: LocalizedText
  readonly userPromptTemplate: LocalizedText
  readonly variables: readonly string[]
  readonly outputFormat: 'markdown' | 'structured'
  readonly temperature: number
}

export interface IRPromptVariables {
  readonly companyName?: string
  readonly fiscalYear?: string | number
  readonly highlights?: string | readonly string[]
  readonly challenges?: string | readonly string[]
  readonly financialData?: Record<string, unknown> | string
  readonly previousYearData?: Record<string, unknown> | string
  readonly kpis?: Record<string, unknown> | string | readonly string[]
  readonly dividendHistory?: Record<string, unknown> | string
  readonly payoutRatio?: string | number
  readonly futurePolicy?: string
  readonly currentStatus?: string
  readonly marketTrend?: string
  readonly strategy?: string
  readonly targets?: string | readonly string[]
  readonly environmentalData?: Record<string, unknown> | string
  readonly socialData?: Record<string, unknown> | string
  readonly governanceData?: Record<string, unknown> | string
  readonly industryRisks?: string | readonly string[]
  readonly companyRisks?: string | readonly string[]
  readonly mitigationStrategies?: string | readonly string[]
}

export interface IRPromptRegistry {
  readonly templates: ReadonlyMap<string, IRPromptTemplate>
  readonly getBySectionType: (sectionType: IRPromptSectionType) => IRPromptTemplate | undefined
  readonly getAll: () => readonly IRPromptTemplate[]
}

export type IRPromptResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: Record<string, unknown> } }

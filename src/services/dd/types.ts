export type DDChecklistType = 'IPO_SHORT_REVIEW' | 'MA_FINANCIAL_DD' | 'TAX_DD' | 'COMPREHENSIVE'
export type DDSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type DDItemStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'N_A'
export type DDFindingStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACCEPTED'
export type DDCheckType = 'AUTOMATED' | 'MANUAL' | 'SEMI_AUTOMATED'
export type DDReportStatus = 'DRAFT' | 'REVIEW' | 'FINAL'
export type ConversionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ERROR'
export type AccountingStandard = 'JGAAP' | 'IFRS' | 'US_GAAP'

export type DDCategory =
  | 'REVENUE_RECOGNITION'
  | 'ACCOUNTS_RECEIVABLE'
  | 'INVENTORY'
  | 'FIXED_ASSETS'
  | 'INTANGIBLE_ASSETS'
  | 'DEFERRED_ASSETS'
  | 'ALLOWANCES'
  | 'LEASES'
  | 'RELATED_PARTY'
  | 'TAX'
  | 'CONTINGENCIES'
  | 'SUBSEQUENT_EVENTS'
  | 'INTERNAL_CONTROLS'
  | 'DISCLOSURES'
  | 'WORKING_CAPITAL'
  | 'SYNERGIES'
  | 'PRO_FORMA'
  | 'PURCHASE_PRICE_ALLOCATION'
  | 'GOODWILL'

export type ValidationRuleType =
  | 'COMPLETENESS'
  | 'CONSISTENCY'
  | 'CALCULATION'
  | 'COMPARISON'
  | 'HISTORICAL_RATIO'
  | 'ACCRUAL'
  | 'ACCRUAL_ADEQUACY'
  | 'AGING'
  | 'RATIO'
  | 'TREND'
  | 'ACTUAL_VS_ESTIMATED'
  | 'COVERAGE_RATIO'
  | 'POLICY_CHANGE'
  | 'COMPARABILITY'
  | 'SLOW_MOVING'
  | 'OBSOLESCENCE'
  | 'FREQUENCY'
  | 'VARIANCE'
  | 'ECONOMIC_LIFE'
  | 'SALVAGE_VALUE'
  | 'METHOD_CONSISTENCY'
  | 'INDICATOR_CHECK'
  | 'RECOVERABILITY'
  | 'CRITERIA_CHECK'
  | 'AMORTIZATION'
  | 'CATEGORY'
  | 'CAPITALIZATION_START'
  | 'ACCRUAL_RATIO'
  | 'TIMING'
  | 'ACTUARIAL'
  | 'DISCOUNT_RATE'
  | 'FUNDING_STATUS'
  | 'OWNERSHIP_TRANSFER'
  | 'BARGAIN_PURCHASE'
  | 'LEASE_TERM'
  | 'PRESENT_VALUE'
  | 'OWNERSHIP'
  | 'CONTROL'
  | 'KEY_MANAGEMENT'
  | 'COMPARABLE'
  | 'DISCLOSURE'
  | 'CLARITY'
  | 'RECONCILIATION'
  | 'TIMING_DIFFERENCES'
  | 'FUTURE_PROFITABILITY'
  | 'SCHEDULING'
  | 'VALUATION_ALLOWANCE'
  | 'PROVISION'
  | 'IDENTIFICATION'
  | 'CUTOFF'
  | 'CLASSIFICATION'
  | 'DOCUMENTATION'
  | 'TESTING'
  | 'NORMALIZATION'
  | 'EBITDA_ADJUSTMENT'
  | 'NORMALIZED'
  | 'SEASONALITY'
  | 'REALIZABILITY'
  | 'PURCHASE_PRICE_ALLOCATION'
  | 'GOODWILL'
  | 'SEARCH'
  | 'MARKET_RATE'
  | 'AUDIT_HISTORY'
  | 'EXPOSURE'
  | 'RELATED_PARTY'
  | 'PRO_FORMA'
  | 'SYNERGIES'
  | 'VALUATION'

export interface ValidationRule {
  type: ValidationRuleType
  field: string
  required?: boolean
  threshold?: number
  tolerance?: number
  lookback?: number
  comparison?: string
  method?: string
  values?: readonly string[]
  categories?: readonly string[]
  criteria?: readonly string[]
  min?: number
  max?: number
  annual?: boolean
  value?: string | number
  buckets?: readonly string[]
  years?: number
}

export interface DDChecklistItemDefinition {
  readonly code: string
  readonly category: DDCategory
  readonly title: string
  readonly titleEn?: string
  readonly description: string
  readonly descriptionEn?: string
  readonly severity: DDSeverity
  readonly checkType: DDCheckType
  readonly dataSource: readonly string[]
  readonly validationRules: readonly ValidationRule[]
  readonly aiCheckPrompt?: string
  readonly relatedStandards: readonly string[]
  readonly guidance: string
}

export interface DDFinding {
  id: string
  category: DDCategory
  title: string
  description: string
  impact: string
  impactAmount?: number
  recommendation: string
  relatedStandard?: string
  severity: DDSeverity
}

export interface DDEvidence {
  type: 'JOURNAL' | 'DOCUMENT' | 'CALCULATION' | 'EXTERNAL' | 'AI_ANALYSIS'
  reference: string
  summary: string
  confidence?: number
}

export interface DDCheckResult {
  itemCode: string
  status: DDItemStatus
  severity: DDSeverity
  findings: DDFinding[]
  evidence: DDEvidence[]
  checkedAt: Date
  checkedBy: string
}

export interface DDChecklistRunResult {
  checklistId: string
  companyId: string
  type: DDChecklistType
  fiscalYear: number
  totalItems: number
  passedItems: number
  failedItems: number
  pendingItems: number
  naItems: number
  criticalFindings: number
  highFindings: number
  mediumFindings: number
  lowFindings: number
  overallScore: number
  results: DDCheckResult[]
  runAt: Date
  runBy: string
}

export interface DDChecklistConfig {
  type: DDChecklistType
  fiscalYear: number
  companyId: string
  materialityThreshold?: number
  skipItems?: string[]
  focusCategories?: DDCategory[]
}

export interface DDReportSection {
  id: string
  title: string
  titleEn: string
  type: 'TEXT' | 'TABLE' | 'CHART' | 'TABLE_CHART'
  content: unknown
  subsections?: DDReportSection[]
}

export interface DDReport {
  id: string
  companyId: string
  type: DDChecklistType
  fiscalYears: number[]
  accountingStandard: AccountingStandard
  status: DDReportStatus
  sections: DDReportSection[]
  findings: DDFinding[]
  overallScore: number
  generatedAt: Date
  generatedBy: string
}

export interface DDReportGenerationOptions {
  companyId: string
  type: DDChecklistType
  fiscalYears: number[]
  accountingStandard?: AccountingStandard
  format: 'PDF' | 'EXCEL' | 'MARKDOWN' | 'CSV'
  includeAppendices?: boolean
  language?: 'ja' | 'en'
}

export interface TrialBalanceAccount {
  code: string
  name: string
  debitBalance: number
  creditBalance: number
}

export interface TrialBalance {
  asOfDate: Date
  accounts: TrialBalanceAccount[]
}

export interface ConversionAdjustment {
  id: string
  description: string
  descriptionEn: string
  sourceAccounts: TrialBalanceAccount[]
  targetAccounts: TrialBalanceAccount[]
  amount: number
  reason: string
  relatedStandard: string
}

export interface ReconciliationItem {
  category: string
  sourceAmount: number
  adjustments: number
  targetAmount: number
  notes: string
}

export interface ReconciliationTable {
  items: ReconciliationItem[]
}

export interface ConversionNote {
  type: 'IMPORTANT' | 'DISCLOSURE' | 'ASSUMPTION' | 'LIMITATION'
  title: string
  content: string
}

export interface AccountingStandardConversionResult {
  id: string
  companyId: string
  sourceStandard: 'JGAAP'
  targetStandard: 'IFRS' | 'US_GAAP'
  fiscalYear: number
  sourceTrialBalance: TrialBalance
  targetTrialBalance: TrialBalance
  adjustments: ConversionAdjustment[]
  reconciliation: ReconciliationTable
  notes: ConversionNote[]
  status: ConversionStatus
  qualityScore: number
  createdAt: Date
}

export interface ConversionOptions {
  companyId: string
  sourceStandard: 'JGAAP'
  targetStandard: 'IFRS' | 'US_GAAP'
  fiscalYear: number
  sourceTrialBalance: TrialBalance
  companyProfile?: {
    industry?: string
    size?: 'SMALL' | 'MEDIUM' | 'LARGE'
    hasSubsidiaries?: boolean
    hasOverseasOperations?: boolean
  }
}

export interface MaterialityCalculation {
  basis: 'REVENUE' | 'TOTAL_ASSETS' | 'NET_INCOME' | 'CUSTOM'
  basisAmount: number
  percentage: number
  calculatedAmount: number
  minimumThreshold: number
  finalAmount: number
}

export interface MaterialityOptions {
  companyId: string
  fiscalYear: number
  basis?: 'REVENUE' | 'TOTAL_ASSETS' | 'NET_INCOME' | 'CUSTOM'
  percentage?: number
  customBasisAmount?: number
  minimumThreshold?: number
}

export interface DDAnalyticsContext {
  companyId: string
  fiscalYears: number[]
  journals: DDJournalData[]
  trialBalances: TrialBalance[]
  accountItems: DDAccountItemData[]
  partners: DDPartnerData[]
}

export interface DDJournalData {
  id: string
  entryDate: Date
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  description: string
}

export interface DDAccountItemData {
  id: string
  code: string
  name: string
  category: string
  categoryName: string
}

export interface DDPartnerData {
  id: string
  name: string
  type: string
}

export const DD_SEVERITY_ORDER: Record<DDSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
} as const

export const DD_CATEGORY_NAMES_JA: Record<DDCategory, string> = {
  REVENUE_RECOGNITION: '収益認識',
  ACCOUNTS_RECEIVABLE: '売掛金',
  INVENTORY: '棚卸資産',
  FIXED_ASSETS: '固定資産',
  INTANGIBLE_ASSETS: '無形資産',
  DEFERRED_ASSETS: '繰延資産',
  ALLOWANCES: '引当金',
  LEASES: 'リース',
  RELATED_PARTY: '関連当事者',
  TAX: '税務',
  CONTINGENCIES: '偶発事象',
  SUBSEQUENT_EVENTS: '後発事象',
  INTERNAL_CONTROLS: '内部統制',
  DISCLOSURES: '開示',
  WORKING_CAPITAL: '運転資本',
  SYNERGIES: 'シナジー',
  PRO_FORMA: 'プロフォーマ',
  PURCHASE_PRICE_ALLOCATION: '買収価格配分',
  GOODWILL: 'のれん',
} as const

export const DD_CHECKLIST_TYPE_NAMES_JA: Record<DDChecklistType, string> = {
  IPO_SHORT_REVIEW: 'IPOショートレビュー',
  MA_FINANCIAL_DD: 'M&A財務DD',
  TAX_DD: '税務DD',
  COMPREHENSIVE: '包括的DD',
} as const

export const DEFAULT_MATERALITY_PERCENTAGES = {
  REVENUE: 0.5,
  TOTAL_ASSETS: 1.0,
  NET_INCOME: 5.0,
} as const

export const DEFAULT_MINIMUM_MATERALITY_THRESHOLD = 10_000_000

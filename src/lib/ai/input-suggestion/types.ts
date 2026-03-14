export type InputFieldType = 'number' | 'percentage' | 'currency' | 'date' | 'select' | 'text'

export interface InputFieldDefinition {
  key: string
  type: InputFieldType
  label: string
  labelEn: string
  description?: string
  descriptionEn?: string
  required: boolean
  unit?: string
  min?: number
  max?: number
  options?: Array<{ value: string; label: string }>
  defaultValue?: number | string
}

export type AnalysisType = 'valuation' | 'financial_dd' | 'audit' | 'budget' | 'kpi' | 'custom'

export interface CompanyInfoForSuggestion {
  name: string
  industry: string
  sector?: string
  revenue?: number
  employees?: number
  region?: string
  foundedYear?: number
  growthStage?: 'seed' | 'early' | 'growth' | 'mature'
}

export interface HistoricalDataForSuggestion {
  avgGrowthRate?: number
  avgMargin?: number
  avgRevenue?: number
  trend?: 'up' | 'down' | 'stable'
}

export interface PeerDataForSuggestion {
  name: string
  per?: number
  pbr?: number
  evEbitda?: number
  beta?: number
}

export interface IndustryBenchmarkForSuggestion {
  avgPer?: number
  avgPbr?: number
  avgEvEbitda?: number
  avgBeta?: number
  avgGrowthRate?: number
  avgMargin?: number
}

export interface InputSuggestionContext {
  analysisType: AnalysisType
  companyInfo: CompanyInfoForSuggestion
  historicalData?: HistoricalDataForSuggestion
  peerData?: PeerDataForSuggestion[]
  industryBenchmark?: IndustryBenchmarkForSuggestion
  language?: 'ja' | 'en'
}

export type SuggestionSource =
  | 'industry_average'
  | 'peer_data'
  | 'historical_data'
  | 'ai_estimate'
  | 'regulatory'

export interface InputSuggestion {
  fieldKey: string
  suggestedValue: number | string
  range: {
    min: number
    max: number
  }
  reasoning: string
  confidence: number
  source: SuggestionSource
  details?: {
    calculationMethod?: string
    dataSource?: string
    lastUpdated?: string
    assumptions?: string[]
  }
}

export interface InputSuggestionResult {
  success: boolean
  suggestions: Map<string, InputSuggestion>
  errors?: Array<{ fieldKey: string; message: string }>
  generatedAt: Date
  modelUsed: string
}

export interface AppError {
  code: string
  message: string
  details?: unknown
}

export type Result<T, E = AppError> = { success: true; data: T } | { success: false; error: E }

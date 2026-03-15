export type Result<T, E = ValuationError> =
  | { success: true; data: T }
  | { success: false; error: E }

export interface ValuationError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type Currency = 'JPY' | 'USD' | 'EUR'

export interface Money {
  amount: number
  currency: Currency
  unit: 'million' | 'thousand' | 'one'
}

export interface CalculationStep {
  id: string
  name: string
  description: string
  formula: string
  formulaWithValues: string
  inputs: Record<string, number>
  output: number
  unit: string
  children?: CalculationStep[]
}

export interface ValuationResult {
  enterpriseValue: number
  equityValue?: number
  currency: Currency
  unit: 'million' | 'thousand' | 'one'
  steps: CalculationStep[]
  metadata: {
    method: ValuationMethod
    calculatedAt: string
    version: string
  }
}

export type ValuationMethod =
  | 'dcf'
  | 'comparable'
  | 'asset_based'
  | 'black_scholes'
  | 'monte_carlo'
  | 'scenario'

export interface DCFInputs {
  freeCashFlow: number
  growthRate: number
  terminalGrowthRate: number
  discountRate: number
  projectionYears: number
  currency?: Currency
  unit?: 'million' | 'thousand' | 'one'
}

export interface DCFResult extends ValuationResult {
  metadata: ValuationResult['metadata'] & {
    method: 'dcf'
    presentValues: number[]
    terminalValue: number
    terminalPV: number
  }
}

export interface WACCInputs {
  mode: 'simple' | 'detailed'
  simpleWACC?: number
  detailed?: {
    riskFreeRate: number
    marketRiskPremium: number
    beta: number
    costOfDebt: number
    taxRate: number
    debtRatio: number
    equityRatio: number
  }
}

export interface WACCResult {
  wacc: number
  mode: 'simple' | 'detailed'
  steps: CalculationStep[]
  components?: {
    costOfEquity: number
    costOfDebt: number
    afterTaxCostOfDebt: number
    weightedCostOfEquity: number
    weightedCostOfDebt: number
  }
}

export interface ComparableInputs {
  targetRevenue: number
  targetEBITDA: number
  targetNetIncome: number
  targetBookValue?: number
  selectedMultiples: MultipleType[]
  comparableData?: ComparableCompany[]
  currency?: Currency
  unit?: 'million' | 'thousand' | 'one'
}

export type MultipleType = 'PE' | 'PB' | 'EV_EBITDA' | 'EV_REVENUE' | 'PS'

export interface ComparableCompany {
  name: string
  ticker?: string
  marketCap: number
  enterpriseValue: number
  revenue: number
  ebitda: number
  netIncome: number
  bookValue?: number
  per: number
  pbr?: number
  evEbitda: number
  evRevenue?: number
  psr: number
}

export interface ComparableResult extends ValuationResult {
  metadata: ValuationResult['metadata'] & {
    method: 'comparable'
    multiples: Record<MultipleType, { multiple: number; value: number }>
    averageMultiple: number
    medianMultiple: number
  }
}

export interface AssetBasedInputs {
  totalAssets: number
  totalLiabilities: number
  intangibleAssets?: number
  adjustments?: AssetAdjustment[]
  liquidationDiscount?: number
  currency?: Currency
  unit?: 'million' | 'thousand' | 'one'
}

export interface AssetAdjustment {
  name: string
  amount: number
  type: 'addition' | 'deduction'
}

export interface AssetBasedResult extends ValuationResult {
  metadata: ValuationResult['metadata'] & {
    method: 'asset_based'
    bookValue: number
    adjustedBookValue: number
    liquidationValue?: number
  }
}

export interface BlackScholesInputs {
  spotPrice: number
  strikePrice: number
  timeToMaturity: number
  riskFreeRate: number
  volatility: number
  dividendYield?: number
  optionType: 'call' | 'put'
}

export interface BlackScholesResult {
  optionValue: number
  optionType: 'call' | 'put'
  steps: CalculationStep[]
  greeks: {
    delta: number
    gamma: number
    theta: number
    vega: number
    rho: number
  }
  d1: number
  d2: number
}

export type DistributionType = 'normal' | 'lognormal' | 'uniform' | 'triangular'

export interface DistributionConfig {
  type: DistributionType
  params: {
    mean?: number
    stdDev?: number
    min?: number
    max?: number
    mode?: number
  }
}

export interface MonteCarloVariable {
  name: string
  distribution: DistributionConfig
}

export interface MonteCarloInputs {
  variables: MonteCarloVariable[]
  formula: string
  iterations: number
  seed?: number
  correlationMatrix?: number[][]
}

export interface MonteCarloResult {
  statistics: {
    mean: number
    median: number
    stdDev: number
    variance: number
    skewness: number
    kurtosis: number
    percentiles: {
      p1: number
      p5: number
      p10: number
      p25: number
      p50: number
      p75: number
      p90: number
      p95: number
      p99: number
    }
    min: number
    max: number
  }
  distribution: number[]
  histogram: { binStart: number; binEnd: number; count: number; frequency: number }[]
  steps: CalculationStep[]
  executionTimeMs: number
  iterations: number
  source: 'typescript' | 'r-service'
}

export interface ScenarioInputs {
  baseInputs: DCFInputs
  scenarios: {
    name: string
    type: 'optimistic' | 'base' | 'pessimistic'
    adjustments: Record<string, { factor: number; type: 'multiply' | 'add' | 'set' }>
  }[]
}

export interface ScenarioResult {
  scenarios: {
    name: string
    type: 'optimistic' | 'base' | 'pessimistic'
    value: number
    probability?: number
    inputs: Record<string, number>
  }[]
  weightedAverage: number
  range: {
    min: number
    max: number
  }
  steps: CalculationStep[]
}

export interface SensitivityInputs {
  baseInputs: DCFInputs
  variable1: {
    name: keyof DCFInputs
    min: number
    max: number
    steps: number
  }
  variable2: {
    name: keyof DCFInputs
    min: number
    max: number
    steps: number
  }
}

export interface SensitivityResult {
  matrix: {
    rowValue: number
    columnValue: number
    result: number
  }[][]
  rowVariable: string
  columnVariable: string
  rowValues: number[]
  columnValues: number[]
}

export interface WACCAdviceRequest {
  industry: string
  subIndustry?: string
  companySize?: 'large' | 'mid' | 'small'
  hasRating?: boolean
  debtEquityRatio?: number
  taxRate?: number
}

export interface WACCAdviceItem {
  suggested: number
  range: { min: number; max: number }
  rationale: string
  dataSource: string
}

export interface WACCAdviceResponse {
  riskFreeRate: WACCAdviceItem
  marketRiskPremium: WACCAdviceItem
  beta: WACCAdviceItem & {
    unleveredBeta: number
    suggestedLeveredBeta: number
    comparableCompanies: string[]
  }
  costOfDebt: WACCAdviceItem & {
    spreadOverRiskFree: number
  }
  taxRate: WACCAdviceItem & {
    statutory: number
  }
  optimalCapitalStructure: {
    suggestedDERatio: number
    industryAverage: number
    rationale: string
  }
  confidence: 'high' | 'medium' | 'low'
  lastUpdated: string
}

export const VALUATION_VERSION = '1.0.0'

export const DEFAULT_CURRENCY: Currency = 'JPY'
export const DEFAULT_UNIT: 'million' | 'thousand' | 'one' = 'million'

export const INDUSTRY_DEFAULTS: Record<
  string,
  {
    beta: { min: number; max: number; default: number }
    debtEquityRatio: { min: number; max: number; default: number }
  }
> = {
  software: {
    beta: { min: 1.0, max: 1.5, default: 1.2 },
    debtEquityRatio: { min: 0.1, max: 0.4, default: 0.2 },
  },
  manufacturing: {
    beta: { min: 0.8, max: 1.2, default: 1.0 },
    debtEquityRatio: { min: 0.3, max: 0.8, default: 0.5 },
  },
  retail: {
    beta: { min: 0.7, max: 1.1, default: 0.9 },
    debtEquityRatio: { min: 0.2, max: 0.6, default: 0.4 },
  },
  financial: {
    beta: { min: 0.6, max: 1.0, default: 0.8 },
    debtEquityRatio: { min: 1.0, max: 3.0, default: 2.0 },
  },
  healthcare: {
    beta: { min: 0.9, max: 1.3, default: 1.1 },
    debtEquityRatio: { min: 0.2, max: 0.5, default: 0.3 },
  },
  default: {
    beta: { min: 0.8, max: 1.3, default: 1.0 },
    debtEquityRatio: { min: 0.2, max: 0.8, default: 0.4 },
  },
}

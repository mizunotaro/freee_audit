export type RatioCategory = 'liquidity' | 'safety' | 'profitability' | 'efficiency' | 'growth'

export type RatioStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

export interface RatioDefinition {
  readonly id: string
  readonly name: string
  readonly nameEn: string
  readonly category: RatioCategory
  readonly formula: string
  readonly description: string
  readonly unit: 'ratio' | 'percentage' | 'days' | 'times' | 'number'
  readonly thresholds: {
    readonly excellent: number
    readonly good: number
    readonly fair: number
    readonly poor: number
  }
  readonly higherIsBetter: boolean
}

export interface CalculatedRatio {
  readonly definition: RatioDefinition
  readonly value: number
  readonly formattedValue: string
  readonly status: RatioStatus
  readonly trend?: {
    readonly direction: 'improving' | 'stable' | 'declining'
    readonly previousValue?: number
    readonly changePercent?: number
  }
  readonly percentile?: number
}

export interface RatioGroup {
  readonly category: RatioCategory
  readonly categoryName: string
  readonly ratios: readonly CalculatedRatio[]
  readonly averageScore: number
  readonly overallStatus: RatioStatus
}

export interface RatioAnalysisResult {
  readonly success: boolean
  readonly data?: {
    readonly groups: readonly RatioGroup[]
    readonly allRatios: readonly CalculatedRatio[]
    readonly summary: {
      readonly totalRatios: number
      readonly excellentCount: number
      readonly goodCount: number
      readonly fairCount: number
      readonly poorCount: number
      readonly criticalCount: number
      readonly overallScore: number
    }
    readonly calculatedAt: Date
  }
  readonly error?: {
    readonly code: string
    readonly message: string
  }
}

export type RatioResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

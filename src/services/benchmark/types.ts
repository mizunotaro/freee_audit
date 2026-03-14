export type IndustrySector =
  | 'manufacturing'
  | 'retail'
  | 'service'
  | 'technology'
  | 'finance'
  | 'real_estate'
  | 'construction'
  | 'healthcare'
  | 'education'
  | 'other'

export type CompanySize = 'micro' | 'small' | 'medium' | 'large'

export interface BenchmarkRange {
  readonly min: number
  readonly q1: number
  readonly median: number
  readonly q3: number
  readonly max: number
}

export interface IndustryBenchmarkData {
  readonly sector: IndustrySector
  readonly sectorName: string
  readonly ratios: Record<string, BenchmarkRange>
  readonly sampleSize: number
  readonly lastUpdated: Date
}

export interface CompanySizeBenchmarkData {
  readonly size: CompanySize
  readonly sizeName: string
  readonly employeeRange: { min: number; max: number }
  readonly revenueRange: { min: number; max: number }
  readonly ratios: Record<string, BenchmarkRange>
}

export interface BenchmarkComparison {
  readonly metricId: string
  readonly metricName: string
  readonly companyValue: number
  readonly benchmark: BenchmarkRange
  readonly percentile: number
  readonly status: 'above_median' | 'at_median' | 'below_median'
  readonly deviation: number
  readonly zScore?: number
}

export interface BenchmarkData {
  readonly industryComparisons: readonly BenchmarkComparison[]
  readonly sizeComparisons: readonly BenchmarkComparison[]
  readonly overallPercentile: number
  readonly strengths: readonly string[]
  readonly weaknesses: readonly string[]
}

export interface BenchmarkError {
  readonly code: string
  readonly message: string
}

export type BenchmarkResult =
  | { success: true; data: BenchmarkData }
  | { success: false; error: BenchmarkError }

export interface BenchmarkOptions {
  readonly sector?: IndustrySector
  readonly companySize?: CompanySize
  readonly employeeCount?: number
  readonly annualRevenue?: number
  readonly metrics?: readonly string[]
}

export type BenchmarkResultType<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

import type {
  BenchmarkResult,
  BenchmarkComparison,
  BenchmarkOptions,
  IndustrySector,
  BenchmarkRange,
} from './types'
import { getIndustryBenchmark } from './data/industry-ratios'
import { getCompanySizeBenchmark, determineCompanySize } from './data/company-size-benchmarks'

const METRIC_NAMES: Record<string, string> = {
  current_ratio: '流動比率',
  quick_ratio: '当座比率',
  equity_ratio: '自己資本比率',
  debt_to_equity: 'D/Eレシオ',
  gross_margin: '売上総利益率',
  operating_margin: '営業利益率',
  net_margin: '当期純利益率',
  roa: 'ROA',
  roe: 'ROE',
  asset_turnover: '総資産回転率',
  inventory_turnover: '棚卸資産回転率',
}

export class BenchmarkService {
  compare(ratios: Record<string, number>, options: BenchmarkOptions = {}): BenchmarkResult {
    try {
      const sector = options.sector ?? 'other'
      const size =
        options.companySize ?? determineCompanySize(options.employeeCount, options.annualRevenue)

      const industryBenchmark = getIndustryBenchmark(sector)
      const sizeBenchmark = getCompanySizeBenchmark(size)

      if (!industryBenchmark || !sizeBenchmark) {
        return {
          success: false,
          error: {
            code: 'benchmark_not_found',
            message: `Benchmark data not found for sector: ${sector}`,
          },
        }
      }

      const metricsToCompare = options.metrics ?? Object.keys(ratios)

      const industryComparisons: BenchmarkComparison[] = []
      const sizeComparisons: BenchmarkComparison[] = []

      for (const metricId of metricsToCompare) {
        const companyValue = ratios[metricId]
        if (companyValue === undefined || companyValue === null) continue

        const industryRange = industryBenchmark.ratios[metricId]
        if (industryRange) {
          industryComparisons.push(this.createComparison(metricId, companyValue, industryRange))
        }

        const sizeRange = sizeBenchmark.ratios[metricId]
        if (sizeRange) {
          sizeComparisons.push(this.createComparison(metricId, companyValue, sizeRange))
        }
      }

      const overallPercentile = this.calculateOverallPercentile(industryComparisons)
      const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(industryComparisons)

      return {
        success: true,
        data: {
          industryComparisons,
          sizeComparisons,
          overallPercentile,
          strengths,
          weaknesses,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'benchmark_comparison_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  private createComparison(
    metricId: string,
    companyValue: number,
    benchmark: BenchmarkRange
  ): BenchmarkComparison {
    const percentile = this.calculatePercentile(companyValue, benchmark)
    const deviation = companyValue - benchmark.median
    const zScore =
      benchmark.q3 !== benchmark.q1
        ? (companyValue - benchmark.median) / ((benchmark.q3 - benchmark.q1) / 1.35)
        : 0

    let status: 'above_median' | 'at_median' | 'below_median'
    if (companyValue > benchmark.median * 1.05) {
      status = 'above_median'
    } else if (companyValue < benchmark.median * 0.95) {
      status = 'below_median'
    } else {
      status = 'at_median'
    }

    return {
      metricId,
      metricName: METRIC_NAMES[metricId] ?? metricId,
      companyValue,
      benchmark,
      percentile,
      status,
      deviation,
      zScore,
    }
  }

  private calculatePercentile(value: number, benchmark: BenchmarkRange): number {
    if (value <= benchmark.min) return 0
    if (value >= benchmark.max) return 100

    if (value <= benchmark.q1) {
      return 25 * ((value - benchmark.min) / (benchmark.q1 - benchmark.min))
    }
    if (value <= benchmark.median) {
      return 25 + 25 * ((value - benchmark.q1) / (benchmark.median - benchmark.q1))
    }
    if (value <= benchmark.q3) {
      return 50 + 25 * ((value - benchmark.median) / (benchmark.q3 - benchmark.median))
    }
    return 75 + 25 * ((value - benchmark.q3) / (benchmark.max - benchmark.q3))
  }

  private calculateOverallPercentile(comparisons: BenchmarkComparison[]): number {
    if (comparisons.length === 0) return 50

    const percentiles = comparisons.map((c) => c.percentile)
    return Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length)
  }

  private identifyStrengthsWeaknesses(comparisons: BenchmarkComparison[]): {
    strengths: string[]
    weaknesses: string[]
  } {
    const strengths: string[] = []
    const weaknesses: string[] = []

    for (const comparison of comparisons) {
      if (comparison.percentile >= 75) {
        strengths.push(`${comparison.metricName}: 上位${100 - comparison.percentile}%`)
      } else if (comparison.percentile <= 25) {
        weaknesses.push(`${comparison.metricName}: 下位${comparison.percentile}%`)
      }
    }

    return {
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
    }
  }

  getAvailableSectors(): { sector: IndustrySector; name: string }[] {
    return [
      { sector: 'manufacturing', name: '製造業' },
      { sector: 'retail', name: '小売業' },
      { sector: 'service', name: 'サービス業' },
      { sector: 'technology', name: 'IT・技術サービス' },
      { sector: 'finance', name: '金融業' },
      { sector: 'real_estate', name: '不動産業' },
      { sector: 'construction', name: '建設業' },
      { sector: 'healthcare', name: '医療・福祉' },
      { sector: 'education', name: '教育・学習支援' },
      { sector: 'other', name: 'その他' },
    ]
  }
}

export function createBenchmarkService(): BenchmarkService {
  return new BenchmarkService()
}

export function compareWithBenchmark(
  ratios: Record<string, number>,
  options?: BenchmarkOptions
): BenchmarkResult {
  const service = new BenchmarkService()
  return service.compare(ratios, options)
}

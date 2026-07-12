import { describe, it, expect } from 'vitest'
import {
  transformFinancialAnalysisResult,
  transformRatioAnalysisResult,
  transformBenchmarkResult,
} from '@/app/api/analysis/types/output'
import type {
  FinancialAnalysisOutput,
  RatioAnalysisOutput,
  BenchmarkOutput,
  AnalysisOutput,
  AnalysisStatus,
  TrendOutput,
} from '@/app/api/analysis/types/output'
import type {
  FinancialAnalysisResult,
  CategoryAnalysis,
  AlertItem,
} from '@/services/ai/analyzers/types'
import type {
  RatioAnalysisResult,
  RatioGroup,
  CalculatedRatio,
} from '@/services/ai/analyzers/ratios/types'
import type { BenchmarkResult, BenchmarkComparison } from '@/services/benchmark/types'

const FIXED_DATE = new Date('2024-01-15T09:30:00.000Z')
const FIXED_DATE_ISO = '2024-01-15T09:30:00.000Z'
const FIXED_DATE_2 = new Date('2024-02-20T10:00:00.000Z')
const FIXED_DATE_2_ISO = '2024-02-20T10:00:00.000Z'

function makeFinancialData(): NonNullable<FinancialAnalysisResult['data']> {
  return {
    overallScore: 85,
    overallStatus: 'excellent',
    executiveSummary: 'Strong liquidity and profitability.',
    categoryAnalyses: [],
    allAlerts: [],
    topRecommendations: [],
    keyMetrics: [],
    processingTimeMs: 123,
    analyzedAt: FIXED_DATE,
  }
}

function makeRatioData(): NonNullable<RatioAnalysisResult['data']> {
  return {
    groups: [],
    allRatios: [],
    summary: {
      totalRatios: 0,
      excellentCount: 0,
      goodCount: 0,
      fairCount: 0,
      poorCount: 0,
      criticalCount: 0,
      overallScore: 0,
    },
    calculatedAt: FIXED_DATE_2,
  }
}

describe('analysis/types/output — transformFinancialAnalysisResult', () => {
  it('transforms a successful result into output with analyzedAt as ISO string', () => {
    const data = makeFinancialData()
    const result: FinancialAnalysisResult = { success: true, data }

    const output = transformFinancialAnalysisResult(result)

    expect(output).not.toBeNull()
    expect(output!.overallScore).toBe(85)
    expect(output!.overallStatus).toBe('excellent')
    expect(output!.executiveSummary).toBe('Strong liquidity and profitability.')
    expect(output!.processingTimeMs).toBe(123)
    expect(output!.analyzedAt).toBe(FIXED_DATE_ISO)
    expect(typeof output!.analyzedAt).toBe('string')
  })

  it('preserves all nested collections by reference', () => {
    const categoryAnalyses: CategoryAnalysis[] = [
      {
        category: 'liquidity',
        score: 90,
        status: 'excellent',
        summary: 'ok',
        trends: [],
        alerts: [],
        recommendations: [],
        metrics: [],
      },
    ]
    const allAlerts: AlertItem[] = [
      {
        id: 'alert-1',
        category: 'safety',
        severity: 'low',
        title: 't',
        description: 'd',
        metric: 'm',
        currentValue: 1,
        recommendation: 'r',
      },
    ]
    const data = {
      ...makeFinancialData(),
      categoryAnalyses,
      allAlerts,
    }
    const result: FinancialAnalysisResult = { success: true, data }

    const output = transformFinancialAnalysisResult(result)

    expect(output!.categoryAnalyses).toBe(categoryAnalyses)
    expect(output!.allAlerts).toBe(allAlerts)
  })

  it('does not mutate the input (analyzedAt stays a Date on the source)', () => {
    const data = makeFinancialData()
    const result: FinancialAnalysisResult = { success: true, data }

    transformFinancialAnalysisResult(result)

    expect(data.analyzedAt).toBeInstanceOf(Date)
    expect(data.analyzedAt).toEqual(FIXED_DATE)
  })

  it('returns a new object reference (not the input data)', () => {
    const data = makeFinancialData()
    const result: FinancialAnalysisResult = { success: true, data }

    const output = transformFinancialAnalysisResult(result)

    expect(output).not.toBe(data)
  })

  it('returns null when success is false', () => {
    const result: FinancialAnalysisResult = {
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: 'boom' },
    }

    expect(transformFinancialAnalysisResult(result)).toBeNull()
  })

  it('returns null when success is true but data is missing (fail-safe)', () => {
    const result: FinancialAnalysisResult = { success: true }

    expect(transformFinancialAnalysisResult(result)).toBeNull()
  })

  it('returns null when success is false even if data is present (success flag wins)', () => {
    const result: FinancialAnalysisResult = {
      success: false,
      data: makeFinancialData(),
      error: { code: 'PARTIAL', message: 'err' },
    }

    expect(transformFinancialAnalysisResult(result)).toBeNull()
  })

  it('handles boundary values without altering them', () => {
    const data: NonNullable<FinancialAnalysisResult['data']> = {
      overallScore: 0,
      overallStatus: 'critical',
      executiveSummary: '',
      categoryAnalyses: [],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      processingTimeMs: 0,
      analyzedAt: FIXED_DATE,
    }

    const output = transformFinancialAnalysisResult({ success: true, data })

    expect(output!.overallScore).toBe(0)
    expect(output!.overallStatus).toBe('critical')
    expect(output!.executiveSummary).toBe('')
    expect(output!.processingTimeMs).toBe(0)
    expect(output!.categoryAnalyses).toHaveLength(0)
    expect(output!.analyzedAt).toBe(FIXED_DATE_ISO)
  })
})

describe('analysis/types/output — transformRatioAnalysisResult', () => {
  it('transforms a successful result with calculatedAt as ISO string', () => {
    const data = makeRatioData()
    const result: RatioAnalysisResult = { success: true, data }

    const output = transformRatioAnalysisResult(result)

    expect(output).not.toBeNull()
    expect(output!.calculatedAt).toBe(FIXED_DATE_2_ISO)
    expect(typeof output!.calculatedAt).toBe('string')
    expect(output!.summary.overallScore).toBe(0)
    expect(output!.summary.totalRatios).toBe(0)
  })

  it('preserves groups, allRatios and summary by reference', () => {
    const groups: RatioGroup[] = [
      {
        category: 'liquidity',
        categoryName: '流動性',
        ratios: [],
        averageScore: 80,
        overallStatus: 'good',
      },
    ]
    const allRatios: CalculatedRatio[] = [
      {
        definition: {
          id: 'current_ratio',
          name: '当座',
          nameEn: 'Current Ratio',
          category: 'liquidity',
          formula: 'a/b',
          description: 'd',
          unit: 'ratio',
          thresholds: { excellent: 200, good: 150, fair: 100, poor: 80 },
          higherIsBetter: true,
        },
        value: 1.5,
        formattedValue: '1.50',
        status: 'good',
      },
    ]
    const data = { ...makeRatioData(), groups, allRatios }
    const result: RatioAnalysisResult = { success: true, data }

    const output = transformRatioAnalysisResult(result)

    expect(output!.groups).toBe(groups)
    expect(output!.allRatios).toBe(allRatios)
    expect(output!.summary).toBe(data.summary)
  })

  it('does not mutate the input (calculatedAt stays a Date on the source)', () => {
    const data = makeRatioData()
    const result: RatioAnalysisResult = { success: true, data }

    transformRatioAnalysisResult(result)

    expect(data.calculatedAt).toBeInstanceOf(Date)
    expect(data.calculatedAt).toEqual(FIXED_DATE_2)
  })

  it('returns a new object reference (not the input data)', () => {
    const data = makeRatioData()
    const result: RatioAnalysisResult = { success: true, data }

    const output = transformRatioAnalysisResult(result)

    expect(output).not.toBe(data)
  })

  it('returns null when success is false', () => {
    const result: RatioAnalysisResult = {
      success: false,
      error: { code: 'RATIO_FAILED', message: 'boom' },
    }

    expect(transformRatioAnalysisResult(result)).toBeNull()
  })

  it('returns null when success is true but data is missing (fail-safe)', () => {
    const result: RatioAnalysisResult = { success: true }

    expect(transformRatioAnalysisResult(result)).toBeNull()
  })

  it('returns null when success is false even if data is present (success flag wins)', () => {
    const result: RatioAnalysisResult = {
      success: false,
      data: makeRatioData(),
      error: { code: 'ERR', message: 'x' },
    }

    expect(transformRatioAnalysisResult(result)).toBeNull()
  })

  it('handles a fully-populated summary at boundary counts', () => {
    const data: NonNullable<RatioAnalysisResult['data']> = {
      groups: [],
      allRatios: [],
      summary: {
        totalRatios: 5,
        excellentCount: 1,
        goodCount: 1,
        fairCount: 1,
        poorCount: 1,
        criticalCount: 1,
        overallScore: 50,
      },
      calculatedAt: FIXED_DATE_2,
    }

    const output = transformRatioAnalysisResult({ success: true, data })

    expect(output!.summary).toEqual(data.summary)
    expect(output!.calculatedAt).toBe(FIXED_DATE_2_ISO)
  })
})

describe('analysis/types/output — transformBenchmarkResult', () => {
  function makeBenchmarkData() {
    return {
      industryComparisons: [],
      sizeComparisons: [],
      overallPercentile: 75,
      strengths: ['Current ratio above median'],
      weaknesses: ['Low inventory turnover'],
    }
  }

  it('returns the benchmark data as-is on success (referential identity)', () => {
    const data = makeBenchmarkData()
    const result: BenchmarkResult = { success: true, data }

    const output = transformBenchmarkResult(result)

    expect(output).toBe(data)
    expect(output!.overallPercentile).toBe(75)
    expect(output!.strengths).toEqual(['Current ratio above median'])
    expect(output!.weaknesses).toEqual(['Low inventory turnover'])
  })

  it('preserves comparison collections by reference', () => {
    const industryComparisons: BenchmarkComparison[] = [
      {
        metricId: 'current_ratio',
        metricName: 'Current Ratio',
        companyValue: 1.8,
        benchmark: { min: 0.5, q1: 1.0, median: 1.4, q3: 1.8, max: 3.0 },
        percentile: 75,
        status: 'above_median',
        deviation: 0.4,
      },
    ]
    const data = { ...makeBenchmarkData(), industryComparisons }
    const result: BenchmarkResult = { success: true, data }

    const output = transformBenchmarkResult(result)

    expect(output!.industryComparisons).toBe(industryComparisons)
  })

  it('returns null when success is false (discriminated union failure branch)', () => {
    const result: BenchmarkResult = {
      success: false,
      error: { code: 'NO_BENCHMARK', message: 'no data' },
    }

    expect(transformBenchmarkResult(result)).toBeNull()
  })

  it('handles boundary percentiles (0 and 100) without altering them', () => {
    const data = { ...makeBenchmarkData(), overallPercentile: 0 }
    expect(transformBenchmarkResult({ success: true, data })!.overallPercentile).toBe(0)

    const dataMax = { ...makeBenchmarkData(), overallPercentile: 100 }
    expect(transformBenchmarkResult({ success: true, data: dataMax })!.overallPercentile).toBe(100)
  })

  it('handles empty strength/weakness lists', () => {
    const data = {
      industryComparisons: [],
      sizeComparisons: [],
      overallPercentile: 50,
      strengths: [],
      weaknesses: [],
    }

    const output = transformBenchmarkResult({ success: true, data })

    expect(output!.strengths).toHaveLength(0)
    expect(output!.weaknesses).toHaveLength(0)
  })
})

describe('analysis/types/output — type-level contracts', () => {
  it('narrows return types to <Output> | null', () => {
    expectTypeOf(
      transformFinancialAnalysisResult
    ).returns.toEqualTypeOf<FinancialAnalysisOutput | null>()
    expectTypeOf(transformRatioAnalysisResult).returns.toEqualTypeOf<RatioAnalysisOutput | null>()
    expectTypeOf(transformBenchmarkResult).returns.toEqualTypeOf<BenchmarkOutput | null>()
  })

  it('AnalysisOutput union accepts each member shape', () => {
    const financial: FinancialAnalysisOutput = {
      overallScore: 1,
      overallStatus: 'good',
      executiveSummary: 's',
      categoryAnalyses: [],
      allAlerts: [],
      topRecommendations: [],
      keyMetrics: [],
      processingTimeMs: 0,
      analyzedAt: FIXED_DATE_ISO,
    }
    const ratio: RatioAnalysisOutput = {
      groups: [],
      allRatios: [],
      summary: {
        totalRatios: 0,
        excellentCount: 0,
        goodCount: 0,
        fairCount: 0,
        poorCount: 0,
        criticalCount: 0,
        overallScore: 0,
      },
      calculatedAt: FIXED_DATE_2_ISO,
    }
    const benchmark: BenchmarkOutput = {
      industryComparisons: [],
      sizeComparisons: [],
      overallPercentile: 0,
      strengths: [],
      weaknesses: [],
    }

    expectTypeOf(financial).toMatchTypeOf<AnalysisOutput>()
    expectTypeOf(ratio).toMatchTypeOf<AnalysisOutput>()
    expectTypeOf(benchmark).toMatchTypeOf<AnalysisOutput>()

    const a: AnalysisOutput = financial
    const b: AnalysisOutput = ratio
    const c: AnalysisOutput = benchmark
    expect([a, b, c]).toHaveLength(3)
  })

  it('AnalysisStatus is exactly the five expected literals', () => {
    expectTypeOf<AnalysisStatus>().toEqualTypeOf<
      'excellent' | 'good' | 'fair' | 'poor' | 'critical'
    >()
  })

  it('TrendOutput.direction covers the four trend literals', () => {
    expectTypeOf<TrendOutput['direction']>().toEqualTypeOf<
      'improving' | 'stable' | 'declining' | 'volatile'
    >()
  })
})

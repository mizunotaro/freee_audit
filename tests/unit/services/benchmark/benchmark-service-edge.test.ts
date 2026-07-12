import { describe, it, expect } from 'vitest'
import { BenchmarkService } from '@/services/benchmark/benchmark-service'
import { isSuccess } from '@/types/result'
import type { BenchmarkComparison } from '@/services/benchmark/types'

describe('BenchmarkService — edge branches', () => {
  const service = new BenchmarkService()

  const currentRatioAt = (value: number): BenchmarkComparison => {
    const result = service.compare(
      { current_ratio: value },
      { sector: 'manufacturing', metrics: ['current_ratio'] }
    )
    if (!isSuccess(result)) throw new Error('expected success')
    const comparison = result.data.industryComparisons.find((c) => c.metricId === 'current_ratio')
    if (!comparison) throw new Error('expected current_ratio comparison')
    return comparison
  }

  describe('calculatePercentile — exact branch values', () => {
    // manufacturing current_ratio: { min:80, q1:100, median:150, q3:200, max:280 }
    it('returns 0 at or below min', () => {
      expect(currentRatioAt(80).percentile).toBe(0)
      expect(currentRatioAt(0).percentile).toBe(0)
      expect(currentRatioAt(-10).percentile).toBe(0)
    })

    it('returns 100 at or above max', () => {
      expect(currentRatioAt(280).percentile).toBe(100)
      expect(currentRatioAt(999).percentile).toBe(100)
    })

    it('interpolates linearly in the (min, q1] band', () => {
      expect(currentRatioAt(100).percentile).toBe(25)
      expect(currentRatioAt(90).percentile).toBe(12.5)
    })

    it('interpolates linearly in the (q1, median] band', () => {
      expect(currentRatioAt(150).percentile).toBe(50)
      expect(currentRatioAt(125).percentile).toBe(37.5)
    })

    it('interpolates linearly in the (median, q3] band', () => {
      expect(currentRatioAt(200).percentile).toBe(75)
      expect(currentRatioAt(175).percentile).toBe(62.5)
    })

    it('interpolates linearly in the (q3, max) band', () => {
      expect(currentRatioAt(240).percentile).toBe(87.5)
    })
  })

  describe('createComparison — deviation and zScore', () => {
    it('deviation is companyValue minus median', () => {
      expect(currentRatioAt(150).deviation).toBe(0)
      expect(currentRatioAt(200).deviation).toBe(50)
      expect(currentRatioAt(80).deviation).toBe(-70)
    })

    it('zScore follows (value-median)/((q3-q1)/1.35) when q3 !== q1', () => {
      expect(currentRatioAt(200).zScore).toBeCloseTo(0.675, 6)
      expect(currentRatioAt(150).zScore).toBe(0)
      expect(currentRatioAt(80).zScore).toBeCloseTo(-0.945, 6)
    })

    it('zScore is 0 when q3 === q1 (degenerate range)', () => {
      // service.inventory_turnover is an all-zero range: min=q1=median=q3=max=0
      const result = service.compare(
        { inventory_turnover: 0 },
        { sector: 'service', metrics: ['inventory_turnover'] }
      )
      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.zScore).toBe(0)
        expect(comparison.deviation).toBe(0)
        expect(comparison.percentile).toBe(0)
        expect(comparison.status).toBe('at_median')
      }
    })
  })

  describe('status — 5% median band boundaries', () => {
    // median = 150 → band is [142.5, 157.5]
    it('is below_median strictly below median*0.95', () => {
      expect(currentRatioAt(142).status).toBe('below_median')
      expect(currentRatioAt(100).status).toBe('below_median')
    })

    it('is at_median inside the [median*0.95, median*1.05] band (inclusive)', () => {
      expect(currentRatioAt(143).status).toBe('at_median')
      expect(currentRatioAt(150).status).toBe('at_median')
      expect(currentRatioAt(157).status).toBe('at_median')
    })

    it('is above_median strictly above median*1.05', () => {
      expect(currentRatioAt(158).status).toBe('above_median')
      expect(currentRatioAt(280).status).toBe('above_median')
    })
  })

  describe('overallPercentile / strengths / weaknesses', () => {
    it('returns overallPercentile 50 and empty highlights when no metric matches', () => {
      const result = service.compare({ not_a_real_metric: 100 }, { sector: 'manufacturing' })
      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.industryComparisons).toHaveLength(0)
        expect(result.data.overallPercentile).toBe(50)
        expect(result.data.strengths).toEqual([])
        expect(result.data.weaknesses).toEqual([])
      }
    })

    it('averages per-metric percentiles into the overall percentile', () => {
      // current_ratio=200 → 75, roa at/above max → 100 ⇒ mean 87.5 rounds to 88
      const result = service.compare(
        { current_ratio: 200, roa: 18 },
        { sector: 'manufacturing', metrics: ['current_ratio', 'roa'] }
      )
      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.overallPercentile).toBe(88)
      }
    })

    it('flags a >=75th-percentile metric as a strength with exact wording', () => {
      const result = service.compare(
        { current_ratio: 200 },
        { sector: 'manufacturing', metrics: ['current_ratio'] }
      )
      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.strengths).toContain('流動比率: 上位25%')
      }
    })

    it('flags a <=25th-percentile metric as a weakness with exact wording', () => {
      const result = service.compare(
        { current_ratio: 100 },
        { sector: 'manufacturing', metrics: ['current_ratio'] }
      )
      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.weaknesses).toContain('流動比率: 下位25%')
      }
    })

    it('caps strengths and weaknesses at five entries each', () => {
      // Seven metrics all at/above their max ⇒ seven >=75th-percentile strengths.
      const result = service.compare(
        {
          current_ratio: 280,
          quick_ratio: 250,
          equity_ratio: 70,
          roa: 18,
          roe: 30,
          gross_margin: 50,
          operating_margin: 25,
        },
        { sector: 'manufacturing' }
      )
      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.strengths).toHaveLength(5)
        expect(result.data.weaknesses).toHaveLength(0)
      }
    })
  })

  describe('metric handling', () => {
    it('skips metrics requested via options.metrics that are absent from ratios', () => {
      const result = service.compare({}, { sector: 'manufacturing', metrics: ['current_ratio'] })
      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.industryComparisons).toHaveLength(0)
      }
    })

    it('defaults to the "other" sector when none is provided', () => {
      const explicit = service.compare({ current_ratio: 90 }, { sector: 'other' })
      const defaulted = service.compare({ current_ratio: 90 })
      expect(isSuccess(explicit)).toBe(true)
      expect(isSuccess(defaulted)).toBe(true)
      if (isSuccess(explicit) && isSuccess(defaulted)) {
        expect(defaulted.data.industryComparisons[0].percentile).toBe(
          explicit.data.industryComparisons[0].percentile
        )
      }
    })
  })
})

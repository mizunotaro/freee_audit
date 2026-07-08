import { describe, it, expect } from 'vitest'
import {
  INDUSTRY_BENCHMARKS,
  getIndustryBenchmark,
  getAllIndustryBenchmarks,
  getMetricBenchmark,
} from '@/services/benchmark/data/industry-ratios'
import type { IndustrySector, BenchmarkRange } from '@/services/benchmark/types'

const ALL_SECTORS: IndustrySector[] = [
  'manufacturing',
  'retail',
  'service',
  'technology',
  'finance',
  'real_estate',
  'construction',
  'healthcare',
  'education',
  'other',
]

const COMMON_METRICS = [
  'current_ratio',
  'equity_ratio',
  'debt_to_equity',
  'gross_margin',
  'operating_margin',
  'roa',
  'roe',
  'asset_turnover',
]

describe('benchmark/data/industry-ratios', () => {
  describe('getIndustryBenchmark', () => {
    it.each(ALL_SECTORS)('returns benchmark data for sector=%s', (sector) => {
      const data = getIndustryBenchmark(sector)

      expect(data).toBeDefined()
      expect(data?.sector).toBe(sector)
      expect(typeof data?.sectorName).toBe('string')
      expect(data?.sectorName.length).toBeGreaterThan(0)
      expect(data?.ratios).toBeDefined()
      expect(data?.sampleSize).toBeGreaterThan(0)
      expect(data?.lastUpdated).toBeInstanceOf(Date)
    })

    it('returns undefined for an unknown sector', () => {
      expect(getIndustryBenchmark('invalid' as IndustrySector)).toBeUndefined()
    })
  })

  describe('getAllIndustryBenchmarks', () => {
    it('returns one entry per sector', () => {
      const all = getAllIndustryBenchmarks()

      expect(all).toHaveLength(ALL_SECTORS.length)
      expect(all.map((d) => d.sector).sort()).toEqual([...ALL_SECTORS].sort())
    })
  })

  describe('getMetricBenchmark', () => {
    it('returns the benchmark range for a known sector and metric', () => {
      const range = getMetricBenchmark('manufacturing', 'current_ratio')

      expect(range).toBeDefined()
      expect(range?.min).toBeLessThanOrEqual(range!.max)
    })

    it('returns undefined for an unknown sector', () => {
      expect(getMetricBenchmark('invalid' as IndustrySector, 'current_ratio')).toBeUndefined()
    })

    it('returns undefined for an unknown metric in a known sector', () => {
      expect(getMetricBenchmark('manufacturing', 'does_not_exist')).toBeUndefined()
    })

    it('is consistent with the full sector lookup', () => {
      const direct = getMetricBenchmark('retail', 'roe')
      const viaSector = getIndustryBenchmark('retail')?.ratios.roe

      expect(direct).toEqual(viaSector)
    })
  })

  describe('INDUSTRY_BENCHMARKS', () => {
    it('contains an entry for every sector', () => {
      for (const sector of ALL_SECTORS) {
        expect(INDUSTRY_BENCHMARKS[sector]).toBeDefined()
        expect(INDUSTRY_BENCHMARKS[sector].sector).toBe(sector)
      }
    })

    it('exposes every common metric for every sector', () => {
      for (const sector of ALL_SECTORS) {
        for (const metricId of COMMON_METRICS) {
          expect(INDUSTRY_BENCHMARKS[sector].ratios[metricId]).toBeDefined()
        }
      }
    })

    it('produces sorted benchmark ranges (min <= q1 <= median <= q3 <= max)', () => {
      function assertSorted(range: BenchmarkRange): void {
        expect(range.min).toBeLessThanOrEqual(range.q1)
        expect(range.q1).toBeLessThanOrEqual(range.median)
        expect(range.median).toBeLessThanOrEqual(range.q3)
        expect(range.q3).toBeLessThanOrEqual(range.max)
      }

      for (const sector of ALL_SECTORS) {
        for (const range of Object.values(INDUSTRY_BENCHMARKS[sector].ratios)) {
          assertSorted(range)
        }
      }
    })

    it('reports a positive sample size for every sector', () => {
      for (const sector of ALL_SECTORS) {
        expect(INDUSTRY_BENCHMARKS[sector].sampleSize).toBeGreaterThan(0)
      }
    })
  })
})

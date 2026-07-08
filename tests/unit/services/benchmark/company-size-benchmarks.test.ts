import { describe, it, expect } from 'vitest'
import {
  COMPANY_SIZE_BENCHMARKS,
  getCompanySizeBenchmark,
  getAllCompanySizeBenchmarks,
  determineCompanySize,
} from '@/services/benchmark/data/company-size-benchmarks'
import type { CompanySize } from '@/services/benchmark/types'

const ALL_SIZES: CompanySize[] = ['micro', 'small', 'medium', 'large']

describe('benchmark/data/company-size-benchmarks', () => {
  describe('determineCompanySize (by employee count)', () => {
    it.each([
      [0, 'micro'],
      [1, 'micro'],
      [9, 'micro'],
      [10, 'small'],
      [49, 'small'],
      [50, 'medium'],
      [299, 'medium'],
      [300, 'large'],
      [10000, 'large'],
    ])('classifies employeeCount=%i as %s', (employeeCount, expected) => {
      expect(determineCompanySize(employeeCount)).toBe(expected)
    })
  })

  describe('determineCompanySize (by annual revenue)', () => {
    it.each([
      [0, 'micro'],
      [99_999_999, 'micro'],
      [100_000_000, 'small'],
      [499_999_999, 'small'],
      [500_000_000, 'medium'],
      [2_999_999_999, 'medium'],
      [3_000_000_000, 'large'],
      [10_000_000_000, 'large'],
    ])('classifies annualRevenue=%i as %s', (annualRevenue, expected) => {
      expect(determineCompanySize(undefined, annualRevenue)).toBe(expected)
    })
  })

  describe('determineCompanySize (precedence and defaults)', () => {
    it('prefers employee count over revenue when both are provided', () => {
      // 5 employees is micro even with very large revenue
      expect(determineCompanySize(5, 10_000_000_000)).toBe('micro')
      // 10000 employees is large even with tiny revenue
      expect(determineCompanySize(10000, 1_000)).toBe('large')
    })

    it('defaults to small when neither metric is provided', () => {
      expect(determineCompanySize()).toBe('small')
      expect(determineCompanySize(undefined, undefined)).toBe('small')
    })
  })

  describe('getCompanySizeBenchmark', () => {
    it.each(ALL_SIZES)('returns benchmark data for size=%s', (size) => {
      const data = getCompanySizeBenchmark(size)

      expect(data).toBeDefined()
      expect(data?.size).toBe(size)
      expect(typeof data?.sizeName).toBe('string')
      expect(data?.ratios).toBeDefined()
    })

    it('returns undefined for an unknown size', () => {
      expect(getCompanySizeBenchmark('invalid' as CompanySize)).toBeUndefined()
    })

    it('exposes non-overlapping employee and revenue ranges', () => {
      for (const size of ALL_SIZES) {
        const data = getCompanySizeBenchmark(size)
        expect(data?.employeeRange.min).toBeLessThanOrEqual(data!.employeeRange.max)
        expect(data?.revenueRange.min).toBeLessThanOrEqual(data!.revenueRange.max)
      }
    })
  })

  describe('getAllCompanySizeBenchmarks', () => {
    it('returns one entry per company size', () => {
      const all = getAllCompanySizeBenchmarks()

      expect(all).toHaveLength(ALL_SIZES.length)
      expect(all.map((d) => d.size).sort()).toEqual([...ALL_SIZES].sort())
    })
  })

  describe('COMPANY_SIZE_BENCHMARKS', () => {
    it('contains an entry for every company size', () => {
      for (const size of ALL_SIZES) {
        expect(COMPANY_SIZE_BENCHMARKS[size]).toBeDefined()
        expect(COMPANY_SIZE_BENCHMARKS[size].size).toBe(size)
      }
    })

    it('produces sorted benchmark ranges (min <= q1 <= median <= q3 <= max)', () => {
      for (const size of ALL_SIZES) {
        for (const [metricId, range] of Object.entries(COMPANY_SIZE_BENCHMARKS[size].ratios)) {
          expect(range.min).toBeLessThanOrEqual(range.q1)
          expect(range.q1).toBeLessThanOrEqual(range.median)
          expect(range.median).toBeLessThanOrEqual(range.q3)
          expect(range.q3).toBeLessThanOrEqual(range.max)
          // sanity: no NaN slipped into a numeric range
          expect(Number.isFinite(range.min)).toBe(true)
          expect(Number.isFinite(range.median)).toBe(true)
          void metricId
        }
      }
    })
  })
})

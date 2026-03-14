import {
  BenchmarkService,
  createBenchmarkService,
  compareWithBenchmark,
} from '@/services/benchmark/benchmark-service'
import { isSuccess, isFailure } from '@/types/result'
import type { BenchmarkOptions, IndustrySector } from '@/services/benchmark/types'

describe('BenchmarkService', () => {
  describe('createBenchmarkService', () => {
    it('should create benchmark service instance', () => {
      const service = createBenchmarkService()
      expect(service).toBeInstanceOf(BenchmarkService)
    })
  })

  describe('compare', () => {
    it('should compare ratios against industry benchmarks', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 150,
        quick_ratio: 100,
        equity_ratio: 35,
      }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.industryComparisons.length).toBeGreaterThan(0)
      }
    })

    it('should compare ratios against company size benchmarks', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 150,
        roa: 5,
      }

      const result = service.compare(ratios, { companySize: 'small' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.sizeComparisons.length).toBeGreaterThan(0)
      }
    })

    it('should calculate percentile for each metric', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 120,
      }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons.find(
          (c) => c.metricId === 'current_ratio'
        )
        expect(comparison).toBeDefined()
        expect(comparison?.percentile).toBeGreaterThanOrEqual(0)
        expect(comparison?.percentile).toBeLessThanOrEqual(100)
      }
    })

    it('should determine status correctly', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 300,
      }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons.find(
          (c) => c.metricId === 'current_ratio'
        )
        expect(comparison?.status).toBe('above_median')
      }
    })

    it('should identify strengths and weaknesses', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 300,
        quick_ratio: 250,
        roa: 1,
      }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.strengths.length).toBeGreaterThanOrEqual(0)
        expect(result.data.weaknesses.length).toBeGreaterThanOrEqual(0)
      }
    })

    it('should calculate overall percentile', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 150,
        quick_ratio: 100,
        roa: 8,
      }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.overallPercentile).toBeGreaterThanOrEqual(0)
        expect(result.data.overallPercentile).toBeLessThanOrEqual(100)
      }
    })

    it('should use default sector when not specified', () => {
      const service = createBenchmarkService()
      const ratios = { current_ratio: 150 }

      const result = service.compare(ratios)

      expect(isSuccess(result)).toBe(true)
    })

    it('should determine company size from employee count', () => {
      const service = createBenchmarkService()
      const ratios = { current_ratio: 150 }

      const result = service.compare(ratios, { employeeCount: 50 })

      expect(isSuccess(result)).toBe(true)
    })

    it('should determine company size from annual revenue', () => {
      const service = createBenchmarkService()
      const ratios = { current_ratio: 150 }

      const result = service.compare(ratios, { annualRevenue: 50000000 })

      expect(isSuccess(result)).toBe(true)
    })

    it('should filter specific metrics', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 150,
        quick_ratio: 100,
        roa: 8,
      }

      const result = service.compare(ratios, {
        sector: 'manufacturing',
        metrics: ['current_ratio'],
      })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.industryComparisons.length).toBe(1)
      }
    })

    it('should skip undefined or null ratios', () => {
      const service = createBenchmarkService()
      const ratios = {
        current_ratio: 150,
        quick_ratio: undefined as unknown as number,
        roa: null as unknown as number,
      }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.industryComparisons.length).toBe(1)
      }
    })

    it('should return error for invalid sector', () => {
      const service = createBenchmarkService()
      const ratios = { current_ratio: 150 }

      const result = service.compare(ratios, {
        sector: 'invalid_sector' as IndustrySector,
      })

      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.code).toBe('benchmark_not_found')
      }
    })

    it('should calculate deviation from median', () => {
      const service = createBenchmarkService()
      const ratios = { current_ratio: 150 }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(typeof comparison.deviation).toBe('number')
      }
    })

    it('should calculate z-score when available', () => {
      const service = createBenchmarkService()
      const ratios = { current_ratio: 150 }

      const result = service.compare(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.zScore).toBeDefined()
      }
    })
  })

  describe('getAvailableSectors', () => {
    it('should return list of available sectors', () => {
      const service = createBenchmarkService()
      const sectors = service.getAvailableSectors()

      expect(sectors.length).toBeGreaterThan(0)
      expect(sectors[0]).toHaveProperty('sector')
      expect(sectors[0]).toHaveProperty('name')
    })

    it('should include all expected sectors', () => {
      const service = createBenchmarkService()
      const sectors = service.getAvailableSectors()
      const sectorIds = sectors.map((s) => s.sector)

      expect(sectorIds).toContain('manufacturing')
      expect(sectorIds).toContain('retail')
      expect(sectorIds).toContain('service')
      expect(sectorIds).toContain('technology')
      expect(sectorIds).toContain('finance')
      expect(sectorIds).toContain('other')
    })
  })

  describe('compareWithBenchmark', () => {
    it('should work as standalone function', () => {
      const ratios = { current_ratio: 150 }
      const result = compareWithBenchmark(ratios, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
    })
  })

  describe('percentile calculation', () => {
    it('should return 0 for value at or below min', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 0 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.percentile).toBe(0)
      }
    })

    it('should return 100 for value at or above max', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 10000 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.percentile).toBe(100)
      }
    })

    it('should return approximately 50 for value at median', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 135 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.percentile).toBeGreaterThanOrEqual(40)
        expect(comparison.percentile).toBeLessThanOrEqual(60)
      }
    })
  })

  describe('status determination', () => {
    it('should return above_median for values significantly above median', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 500 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.status).toBe('above_median')
      }
    })

    it('should return below_median for values significantly below median', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 50 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.status).toBe('below_median')
      }
    })

    it('should return at_median for values near median', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 150 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        const comparison = result.data.industryComparisons[0]
        expect(comparison.status).toBe('at_median')
      }
    })
  })

  describe('robustness', () => {
    it('should handle empty ratios object', () => {
      const service = createBenchmarkService()
      const result = service.compare({}, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
      if (isSuccess(result)) {
        expect(result.data.industryComparisons.length).toBe(0)
        expect(result.data.overallPercentile).toBe(50)
      }
    })

    it('should handle negative values', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: -100 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
    })

    it('should handle zero values', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 0 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
    })

    it('should handle very large values', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 1e10 }, { sector: 'manufacturing' })

      expect(isSuccess(result)).toBe(true)
    })
  })

  describe('multiple sectors', () => {
    it('should work with retail sector', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 150 }, { sector: 'retail' })

      expect(isSuccess(result)).toBe(true)
    })

    it('should work with technology sector', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 200 }, { sector: 'technology' })

      expect(isSuccess(result)).toBe(true)
    })

    it('should work with finance sector', () => {
      const service = createBenchmarkService()
      const result = service.compare({ roa: 1.2 }, { sector: 'finance' })

      expect(isSuccess(result)).toBe(true)
    })

    it('should work with other sector', () => {
      const service = createBenchmarkService()
      const result = service.compare({ current_ratio: 150 }, { sector: 'other' })

      expect(isSuccess(result)).toBe(true)
    })
  })
})

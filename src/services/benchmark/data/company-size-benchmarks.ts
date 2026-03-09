import type { CompanySizeBenchmarkData, CompanySize, BenchmarkRange } from '../types'

const createBenchmark = (values: number[]): BenchmarkRange => {
  const sorted = [...values].sort((a, b) => a - b)
  const len = sorted.length

  return {
    min: sorted[0],
    q1: sorted[Math.floor(len * 0.25)],
    median: sorted[Math.floor(len * 0.5)],
    q3: sorted[Math.floor(len * 0.75)],
    max: sorted[len - 1],
  }
}

export const COMPANY_SIZE_BENCHMARKS: Record<CompanySize, CompanySizeBenchmarkData> = {
  micro: {
    size: 'micro',
    sizeName: 'マイクロ企業',
    employeeRange: { min: 1, max: 9 },
    revenueRange: { min: 0, max: 100_000_000 },
    ratios: {
      current_ratio: createBenchmark([60, 90, 120, 160, 220, 300]),
      equity_ratio: createBenchmark([5, 15, 28, 40, 52, 68]),
      debt_to_equity: createBenchmark([0.5, 1.0, 1.8, 3.0, 5.0, 8.0]),
      gross_margin: createBenchmark([10, 20, 32, 45, 58, 72]),
      operating_margin: createBenchmark([-5, 0, 5, 10, 16, 25]),
      net_margin: createBenchmark([-8, -2, 3, 8, 14, 22]),
      roa: createBenchmark([-2, 1, 4, 8, 13, 20]),
      roe: createBenchmark([-5, 2, 8, 15, 25, 40]),
      asset_turnover: createBenchmark([0.5, 0.9, 1.4, 2.0, 3.0, 4.5]),
    },
  },

  small: {
    size: 'small',
    sizeName: '小規模企業',
    employeeRange: { min: 10, max: 49 },
    revenueRange: { min: 100_000_000, max: 500_000_000 },
    ratios: {
      current_ratio: createBenchmark([80, 110, 140, 180, 240, 320]),
      equity_ratio: createBenchmark([10, 22, 35, 46, 58, 72]),
      debt_to_equity: createBenchmark([0.4, 0.8, 1.3, 2.0, 3.0, 4.5]),
      gross_margin: createBenchmark([15, 25, 35, 45, 55, 68]),
      operating_margin: createBenchmark([-2, 3, 7, 12, 18, 28]),
      net_margin: createBenchmark([-5, 0, 4, 9, 15, 24]),
      roa: createBenchmark([0, 3, 6, 10, 15, 22]),
      roe: createBenchmark([-2, 5, 10, 16, 24, 35]),
      asset_turnover: createBenchmark([0.6, 1.0, 1.5, 2.1, 2.9, 4.0]),
    },
  },

  medium: {
    size: 'medium',
    sizeName: '中規模企業',
    employeeRange: { min: 50, max: 299 },
    revenueRange: { min: 500_000_000, max: 3_000_000_000 },
    ratios: {
      current_ratio: createBenchmark([90, 120, 150, 190, 250, 340]),
      equity_ratio: createBenchmark([15, 28, 40, 50, 60, 75]),
      debt_to_equity: createBenchmark([0.3, 0.7, 1.1, 1.7, 2.5, 4.0]),
      gross_margin: createBenchmark([18, 28, 38, 48, 58, 70]),
      operating_margin: createBenchmark([0, 5, 9, 14, 20, 30]),
      net_margin: createBenchmark([-2, 2, 6, 11, 17, 26]),
      roa: createBenchmark([1, 4, 7, 11, 16, 24]),
      roe: createBenchmark([2, 7, 12, 18, 26, 38]),
      asset_turnover: createBenchmark([0.7, 1.1, 1.5, 2.0, 2.7, 3.8]),
    },
  },

  large: {
    size: 'large',
    sizeName: '大規模企業',
    employeeRange: { min: 300, max: 999999 },
    revenueRange: { min: 3_000_000_000, max: Infinity },
    ratios: {
      current_ratio: createBenchmark([100, 130, 160, 200, 260, 350]),
      equity_ratio: createBenchmark([20, 35, 48, 58, 68, 80]),
      debt_to_equity: createBenchmark([0.2, 0.5, 0.8, 1.2, 1.8, 2.8]),
      gross_margin: createBenchmark([22, 32, 42, 52, 62, 75]),
      operating_margin: createBenchmark([3, 7, 11, 16, 22, 32]),
      net_margin: createBenchmark([0, 4, 8, 13, 19, 28]),
      roa: createBenchmark([2, 5, 8, 12, 17, 25]),
      roe: createBenchmark([4, 8, 13, 19, 27, 38]),
      asset_turnover: createBenchmark([0.5, 0.8, 1.2, 1.6, 2.2, 3.2]),
    },
  },
}

export function getCompanySizeBenchmark(size: CompanySize): CompanySizeBenchmarkData | undefined {
  return COMPANY_SIZE_BENCHMARKS[size]
}

export function determineCompanySize(employeeCount?: number, annualRevenue?: number): CompanySize {
  if (employeeCount !== undefined) {
    if (employeeCount <= 9) return 'micro'
    if (employeeCount <= 49) return 'small'
    if (employeeCount <= 299) return 'medium'
    return 'large'
  }

  if (annualRevenue !== undefined) {
    if (annualRevenue < 100_000_000) return 'micro'
    if (annualRevenue < 500_000_000) return 'small'
    if (annualRevenue < 3_000_000_000) return 'medium'
    return 'large'
  }

  return 'small'
}

export function getAllCompanySizeBenchmarks(): CompanySizeBenchmarkData[] {
  return Object.values(COMPANY_SIZE_BENCHMARKS)
}

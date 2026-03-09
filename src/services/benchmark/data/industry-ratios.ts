import type { IndustryBenchmarkData, IndustrySector, BenchmarkRange } from '../types'

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

export const INDUSTRY_BENCHMARKS: Record<IndustrySector, IndustryBenchmarkData> = {
  manufacturing: {
    sector: 'manufacturing',
    sectorName: '製造業',
    ratios: {
      current_ratio: createBenchmark([80, 100, 120, 150, 200, 280]),
      quick_ratio: createBenchmark([50, 70, 100, 130, 180, 250]),
      equity_ratio: createBenchmark([15, 25, 35, 45, 55, 70]),
      debt_to_equity: createBenchmark([0.3, 0.6, 1.0, 1.5, 2.0, 3.0]),
      gross_margin: createBenchmark([10, 18, 25, 32, 40, 50]),
      operating_margin: createBenchmark([1, 4, 7, 11, 16, 25]),
      net_margin: createBenchmark([0, 2, 5, 8, 12, 18]),
      roa: createBenchmark([1, 3, 5, 8, 12, 18]),
      roe: createBenchmark([2, 6, 10, 15, 22, 30]),
      asset_turnover: createBenchmark([0.6, 0.9, 1.2, 1.6, 2.0, 2.8]),
      inventory_turnover: createBenchmark([3, 5, 7, 10, 14, 20]),
    },
    sampleSize: 2500,
    lastUpdated: new Date('2024-03-01'),
  },

  retail: {
    sector: 'retail',
    sectorName: '小売業',
    ratios: {
      current_ratio: createBenchmark([90, 110, 140, 180, 230, 300]),
      quick_ratio: createBenchmark([30, 50, 80, 120, 160, 220]),
      equity_ratio: createBenchmark([10, 20, 30, 40, 50, 65]),
      debt_to_equity: createBenchmark([0.4, 0.7, 1.1, 1.7, 2.5, 4.0]),
      gross_margin: createBenchmark([15, 22, 30, 38, 48, 60]),
      operating_margin: createBenchmark([1, 3, 5, 8, 12, 18]),
      net_margin: createBenchmark([0, 1, 3, 6, 10, 15]),
      roa: createBenchmark([1, 3, 5, 8, 12, 18]),
      roe: createBenchmark([2, 5, 9, 14, 20, 28]),
      asset_turnover: createBenchmark([1.0, 1.5, 2.2, 3.0, 4.0, 5.5]),
      inventory_turnover: createBenchmark([5, 8, 12, 18, 25, 35]),
    },
    sampleSize: 1800,
    lastUpdated: new Date('2024-03-01'),
  },

  service: {
    sector: 'service',
    sectorName: 'サービス業',
    ratios: {
      current_ratio: createBenchmark([100, 130, 160, 200, 260, 350]),
      quick_ratio: createBenchmark([80, 110, 140, 180, 230, 300]),
      equity_ratio: createBenchmark([20, 30, 40, 50, 60, 75]),
      debt_to_equity: createBenchmark([0.2, 0.5, 0.8, 1.2, 1.8, 2.5]),
      gross_margin: createBenchmark([25, 35, 45, 55, 65, 80]),
      operating_margin: createBenchmark([3, 7, 12, 18, 25, 35]),
      net_margin: createBenchmark([1, 4, 8, 13, 18, 25]),
      roa: createBenchmark([2, 5, 8, 12, 18, 25]),
      roe: createBenchmark([4, 8, 12, 18, 25, 35]),
      asset_turnover: createBenchmark([0.8, 1.2, 1.6, 2.2, 3.0, 4.0]),
      inventory_turnover: createBenchmark([0, 0, 0, 0, 0, 0]),
    },
    sampleSize: 2200,
    lastUpdated: new Date('2024-03-01'),
  },

  technology: {
    sector: 'technology',
    sectorName: 'IT・技術サービス',
    ratios: {
      current_ratio: createBenchmark([120, 160, 200, 260, 350, 500]),
      quick_ratio: createBenchmark([100, 140, 180, 240, 320, 450]),
      equity_ratio: createBenchmark([25, 40, 55, 65, 75, 85]),
      debt_to_equity: createBenchmark([0.1, 0.3, 0.5, 0.8, 1.2, 1.8]),
      gross_margin: createBenchmark([35, 50, 60, 70, 80, 90]),
      operating_margin: createBenchmark([5, 10, 15, 22, 30, 40]),
      net_margin: createBenchmark([2, 6, 12, 18, 25, 35]),
      roa: createBenchmark([3, 7, 12, 18, 25, 35]),
      roe: createBenchmark([5, 10, 16, 22, 30, 40]),
      asset_turnover: createBenchmark([0.6, 0.9, 1.2, 1.6, 2.2, 3.0]),
      inventory_turnover: createBenchmark([0, 0, 0, 0, 0, 0]),
    },
    sampleSize: 1500,
    lastUpdated: new Date('2024-03-01'),
  },

  finance: {
    sector: 'finance',
    sectorName: '金融業',
    ratios: {
      current_ratio: createBenchmark([100, 110, 120, 140, 180, 250]),
      quick_ratio: createBenchmark([100, 110, 120, 140, 180, 250]),
      equity_ratio: createBenchmark([5, 8, 12, 18, 25, 35]),
      debt_to_equity: createBenchmark([3.0, 5.0, 8.0, 12.0, 18.0, 25.0]),
      gross_margin: createBenchmark([40, 55, 70, 80, 88, 95]),
      operating_margin: createBenchmark([10, 18, 25, 35, 45, 55]),
      net_margin: createBenchmark([8, 15, 22, 30, 38, 48]),
      roa: createBenchmark([0.5, 0.8, 1.2, 1.8, 2.5, 3.5]),
      roe: createBenchmark([8, 12, 16, 22, 28, 35]),
      asset_turnover: createBenchmark([0.03, 0.05, 0.08, 0.12, 0.18, 0.25]),
      inventory_turnover: createBenchmark([0, 0, 0, 0, 0, 0]),
    },
    sampleSize: 800,
    lastUpdated: new Date('2024-03-01'),
  },

  real_estate: {
    sector: 'real_estate',
    sectorName: '不動産業',
    ratios: {
      current_ratio: createBenchmark([70, 100, 130, 170, 220, 300]),
      quick_ratio: createBenchmark([30, 50, 80, 120, 160, 220]),
      equity_ratio: createBenchmark([15, 25, 35, 45, 55, 70]),
      debt_to_equity: createBenchmark([1.5, 2.5, 4.0, 6.0, 9.0, 14.0]),
      gross_margin: createBenchmark([10, 20, 30, 40, 50, 65]),
      operating_margin: createBenchmark([5, 12, 20, 28, 38, 50]),
      net_margin: createBenchmark([3, 8, 15, 22, 30, 40]),
      roa: createBenchmark([1, 3, 5, 8, 12, 18]),
      roe: createBenchmark([3, 6, 10, 15, 22, 30]),
      asset_turnover: createBenchmark([0.1, 0.2, 0.3, 0.5, 0.7, 1.0]),
      inventory_turnover: createBenchmark([0.2, 0.4, 0.6, 0.9, 1.3, 2.0]),
    },
    sampleSize: 600,
    lastUpdated: new Date('2024-03-01'),
  },

  construction: {
    sector: 'construction',
    sectorName: '建設業',
    ratios: {
      current_ratio: createBenchmark([90, 110, 130, 160, 200, 260]),
      quick_ratio: createBenchmark([60, 80, 100, 130, 170, 220]),
      equity_ratio: createBenchmark([15, 25, 35, 45, 55, 70]),
      debt_to_equity: createBenchmark([0.8, 1.3, 2.0, 3.0, 4.5, 7.0]),
      gross_margin: createBenchmark([5, 10, 15, 20, 28, 38]),
      operating_margin: createBenchmark([1, 3, 5, 8, 12, 18]),
      net_margin: createBenchmark([0, 1, 3, 5, 8, 12]),
      roa: createBenchmark([1, 2, 4, 6, 9, 14]),
      roe: createBenchmark([2, 5, 8, 12, 18, 25]),
      asset_turnover: createBenchmark([0.8, 1.2, 1.6, 2.2, 3.0, 4.0]),
      inventory_turnover: createBenchmark([2, 4, 6, 9, 13, 18]),
    },
    sampleSize: 1200,
    lastUpdated: new Date('2024-03-01'),
  },

  healthcare: {
    sector: 'healthcare',
    sectorName: '医療・福祉',
    ratios: {
      current_ratio: createBenchmark([80, 110, 140, 180, 230, 300]),
      quick_ratio: createBenchmark([60, 90, 120, 160, 210, 280]),
      equity_ratio: createBenchmark([20, 35, 50, 60, 70, 80]),
      debt_to_equity: createBenchmark([0.3, 0.6, 1.0, 1.5, 2.2, 3.0]),
      gross_margin: createBenchmark([15, 25, 35, 45, 55, 70]),
      operating_margin: createBenchmark([2, 5, 8, 12, 18, 25]),
      net_margin: createBenchmark([1, 3, 6, 10, 15, 22]),
      roa: createBenchmark([2, 4, 7, 11, 16, 22]),
      roe: createBenchmark([3, 6, 10, 15, 22, 30]),
      asset_turnover: createBenchmark([0.5, 0.8, 1.1, 1.5, 2.0, 2.8]),
      inventory_turnover: createBenchmark([3, 5, 8, 12, 18, 25]),
    },
    sampleSize: 900,
    lastUpdated: new Date('2024-03-01'),
  },

  education: {
    sector: 'education',
    sectorName: '教育・学習支援',
    ratios: {
      current_ratio: createBenchmark([100, 140, 180, 240, 320, 450]),
      quick_ratio: createBenchmark([90, 130, 170, 230, 310, 430]),
      equity_ratio: createBenchmark([30, 45, 55, 65, 75, 85]),
      debt_to_equity: createBenchmark([0.1, 0.3, 0.6, 1.0, 1.5, 2.2]),
      gross_margin: createBenchmark([30, 45, 55, 65, 75, 85]),
      operating_margin: createBenchmark([5, 10, 15, 22, 30, 40]),
      net_margin: createBenchmark([2, 6, 10, 16, 22, 30]),
      roa: createBenchmark([3, 6, 10, 15, 22, 30]),
      roe: createBenchmark([5, 10, 15, 22, 30, 40]),
      asset_turnover: createBenchmark([0.4, 0.7, 1.0, 1.4, 2.0, 2.8]),
      inventory_turnover: createBenchmark([0, 0, 0, 0, 0, 0]),
    },
    sampleSize: 500,
    lastUpdated: new Date('2024-03-01'),
  },

  other: {
    sector: 'other',
    sectorName: 'その他',
    ratios: {
      current_ratio: createBenchmark([90, 120, 150, 190, 250, 350]),
      quick_ratio: createBenchmark([60, 90, 120, 160, 210, 280]),
      equity_ratio: createBenchmark([15, 28, 40, 52, 62, 75]),
      debt_to_equity: createBenchmark([0.4, 0.8, 1.3, 2.0, 3.0, 4.5]),
      gross_margin: createBenchmark([15, 25, 35, 45, 55, 70]),
      operating_margin: createBenchmark([2, 5, 9, 14, 20, 30]),
      net_margin: createBenchmark([0, 2, 5, 9, 14, 22]),
      roa: createBenchmark([1, 4, 7, 11, 16, 24]),
      roe: createBenchmark([3, 7, 11, 16, 23, 32]),
      asset_turnover: createBenchmark([0.6, 1.0, 1.4, 2.0, 2.8, 4.0]),
      inventory_turnover: createBenchmark([2, 4, 7, 11, 16, 24]),
    },
    sampleSize: 3000,
    lastUpdated: new Date('2024-03-01'),
  },
}

export function getIndustryBenchmark(sector: IndustrySector): IndustryBenchmarkData | undefined {
  return INDUSTRY_BENCHMARKS[sector]
}

export function getAllIndustryBenchmarks(): IndustryBenchmarkData[] {
  return Object.values(INDUSTRY_BENCHMARKS)
}

export function getMetricBenchmark(
  sector: IndustrySector,
  metricId: string
): BenchmarkRange | undefined {
  return INDUSTRY_BENCHMARKS[sector]?.ratios[metricId]
}

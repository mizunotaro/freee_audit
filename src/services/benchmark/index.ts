export type {
  IndustrySector,
  CompanySize,
  BenchmarkRange,
  IndustryBenchmarkData,
  CompanySizeBenchmarkData,
  BenchmarkComparison,
  BenchmarkResult,
  BenchmarkOptions,
  BenchmarkResultType,
} from './types'

export { BenchmarkService, createBenchmarkService, compareWithBenchmark } from './benchmark-service'

export {
  getIndustryBenchmark,
  getAllIndustryBenchmarks,
  getMetricBenchmark,
} from './data/industry-ratios'

export {
  getCompanySizeBenchmark,
  determineCompanySize,
  getAllCompanySizeBenchmarks,
} from './data/company-size-benchmarks'

export { INDUSTRY_BENCHMARKS } from './data/industry-ratios'
export { COMPANY_SIZE_BENCHMARKS } from './data/company-size-benchmarks'

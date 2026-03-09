import type { AnalysisOptions, BenchmarkOptions, ReportOptions } from '../types/input'

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  category: 'comprehensive',
  includeAlerts: true,
  includeRecommendations: true,
  includeBenchmark: false,
  language: 'ja',
  depth: 'standard',
}

export const DEFAULT_BENCHMARK_OPTIONS: BenchmarkOptions = {
  sector: 'other',
  companySize: 'medium',
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  companyName: 'Company',
  fiscalYear: new Date().getFullYear(),
  includeCharts: false,
}

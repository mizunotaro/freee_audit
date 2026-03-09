export interface FeatureFlags {
  readonly enableCaching: boolean
  readonly enableRateLimit: boolean
  readonly enableDetailedLogging: boolean
  readonly enableBenchmarkComparison: boolean
  readonly enableCircuitBreaker: boolean
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableCaching: true,
  enableRateLimit: true,
  enableDetailedLogging: process.env.NODE_ENV === 'development',
  enableBenchmarkComparison: true,
  enableCircuitBreaker: true,
}

export function getFeatureFlags(): FeatureFlags {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    enableCaching: process.env.ANALYSIS_CACHE_ENABLED !== 'false',
    enableRateLimit: process.env.ANALYSIS_RATE_LIMIT_ENABLED !== 'false',
    enableDetailedLogging: process.env.ANALYSIS_DEBUG === 'true',
    enableBenchmarkComparison: process.env.ANALYSIS_BENCHMARK_ENABLED !== 'false',
    enableCircuitBreaker: process.env.ANALYSIS_CIRCUIT_BREAKER !== 'false',
  }
}

export const CONFIG_VERSION = '1.0.0'

export const INPUT_SUGGESTION_CONFIG = {
  version: CONFIG_VERSION,
  ai: {
    maxQueryLength: 5000,
    maxContextLength: 10000,
    maxTokens: 1000,
    temperature: 0.3,
    defaultLanguage: 'ja' as const,
  },
  fallback: {
    enabled: true,
    minConfidence: 50,
  },
  rateLimit: {
    maxRequestsPerMinute: 10,
    cooldownMs: 6000,
  },
} as const

export const FIELD_DEFAULTS: Record<
  string,
  { value: number; min: number; max: number; source: string }
> = {
  growthRate: { value: 0.05, min: -0.2, max: 0.5, source: 'industry_average' },
  discountRate: { value: 0.1, min: 0.05, max: 0.2, source: 'industry_average' },
  terminalGrowthRate: { value: 0.02, min: 0.0, max: 0.03, source: 'regulatory' },
  riskFreeRate: { value: 0.01, min: 0.005, max: 0.03, source: 'regulatory' },
  beta: { value: 1.0, min: 0.3, max: 2.5, source: 'industry_average' },
  marketRiskPremium: { value: 0.06, min: 0.04, max: 0.08, source: 'industry_average' },
  volatility: { value: 0.3, min: 0.1, max: 0.8, source: 'industry_average' },
  per: { value: 15, min: 5, max: 50, source: 'industry_average' },
  pbr: { value: 1.5, min: 0.5, max: 5, source: 'industry_average' },
  evEbitda: { value: 10, min: 3, max: 25, source: 'industry_average' },
  psr: { value: 2, min: 0.5, max: 10, source: 'industry_average' },
  materialityThreshold: { value: 0.01, min: 0.001, max: 0.05, source: 'regulatory' },
} as const

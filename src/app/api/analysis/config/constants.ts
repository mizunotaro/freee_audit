export const CONFIG_VERSION = '1.0.0'

export const API_TIMEOUTS = {
  analysis: 30000,
  benchmark: 10000,
  reportGeneration: 60000,
  cacheLookup: 5000,
} as const

export const API_LIMITS = {
  maxArrayLength: 1000,
  maxStringLength: 10000,
  maxNestingDepth: 10,
  maxInputSize: 10 * 1024 * 1024,
  maxAmount: Number.MAX_SAFE_INTEGER,
  minAmount: -Number.MAX_SAFE_INTEGER,
} as const

export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
} as const

export const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 3,
} as const

export const RATE_LIMIT_CONFIG = {
  windowMs: 60000,
  maxRequests: 100,
  skipFailedRequests: false,
} as const

export const CACHE_CONFIG = {
  analysis: {
    ttl: 3600000,
    maxSize: 100,
  },
  benchmark: {
    ttl: 86400000,
    maxSize: 50,
  },
  report: {
    ttl: 1800000,
    maxSize: 50,
  },
} as const

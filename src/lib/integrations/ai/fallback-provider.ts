import {
  AIProvider,
  AIProviderType,
  DocumentAnalysisRequest,
  EntryValidationRequest,
} from './provider'
import { DocumentAnalysisResult, EntryValidationResult } from '@/types/audit'
import { CircuitBreaker, CircuitState } from './circuit-breaker'
import { DataResidency, filterProvidersBySecurity } from './provider-registry'

export type { DataResidency }

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeout: number
}

export interface FallbackConfig {
  providers: Array<{ provider: AIProvider; name: AIProviderType }>
  timeout?: number
  retries?: number
  requireZDR?: boolean
  allowedDataResidency?: DataResidency[]
  parallelMode?: boolean
  cacheResults?: boolean
  cacheTTL?: number
  circuitBreaker?: CircuitBreakerOptions
}

export interface ProviderMetrics {
  name: AIProviderType
  successCount: number
  failureCount: number
  totalLatency: number
  requestCount: number
  averageLatency: number
  lastSuccess: Date | null
  lastFailure: Date | null
  circuitState: CircuitState
  successRate: number
}

interface CacheEntry<T> {
  result: T
  timestamp: number
}

interface LatencyRecord {
  total: number
  count: number
}

const DEFAULT_TIMEOUT = 30000
const DEFAULT_RETRIES = 0
const DEFAULT_CACHE_TTL = 5 * 60 * 1000

export class FallbackAIProvider implements AIProvider {
  readonly name: AIProviderType
  private providers: Array<{ provider: AIProvider; name: AIProviderType }>
  private currentProviderIndex: number = 0
  private timeout: number
  private retries: number
  private parallelMode: boolean
  private cacheResults: boolean
  private cacheTTL: number
  private metrics: Map<AIProviderType, ProviderMetrics>
  private circuitBreakers: Map<AIProviderType, CircuitBreaker>
  private latencies: Map<AIProviderType, LatencyRecord>
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private readonly originalProviderNames: AIProviderType[]

  constructor(config: FallbackConfig) {
    if (!config.providers || config.providers.length === 0) {
      throw new Error('At least one provider must be specified')
    }

    this.timeout = config.timeout ?? DEFAULT_TIMEOUT
    this.retries = config.retries ?? DEFAULT_RETRIES
    this.parallelMode = config.parallelMode ?? false
    this.cacheResults = config.cacheResults ?? false
    this.cacheTTL = config.cacheTTL ?? DEFAULT_CACHE_TTL

    this.originalProviderNames = config.providers.map((p) => p.name)

    this.providers = this.filterProvidersBySecurity(config)

    if (this.providers.length === 0) {
      const securityInfo = []
      if (config.requireZDR) securityInfo.push('ZDR required')
      if (config.allowedDataResidency?.length) {
        securityInfo.push(`allowed regions: ${config.allowedDataResidency.join(', ')}`)
      }
      throw new Error(
        `No providers available after security filtering${securityInfo.length ? ` (${securityInfo.join('; ')})` : ''}`
      )
    }

    this.name = this.providers[0].name

    this.metrics = new Map()
    this.circuitBreakers = new Map()
    this.latencies = new Map()

    for (const { name } of this.providers) {
      this.metrics.set(name, {
        name,
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        requestCount: 0,
        averageLatency: 0,
        lastSuccess: null,
        lastFailure: null,
        circuitState: 'closed',
        successRate: 1,
      })

      this.latencies.set(name, { total: 0, count: 0 })

      if (config.circuitBreaker) {
        this.circuitBreakers.set(name, new CircuitBreaker(config.circuitBreaker))
      }
    }
  }

  private filterProvidersBySecurity(
    config: FallbackConfig
  ): Array<{ provider: AIProvider; name: AIProviderType }> {
    const providerNames = config.providers.map((p) => p.name)
    const securityOptions = {
      requireZDR: config.requireZDR,
      allowedDataResidency: config.allowedDataResidency,
    }

    if (!securityOptions.requireZDR && !securityOptions.allowedDataResidency?.length) {
      return [...config.providers]
    }

    const allowedNames = filterProvidersBySecurity(providerNames, securityOptions)

    return config.providers.filter((p) => allowedNames.includes(p.name))
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const cacheKey = this.getCacheKey('analyzeDocument', request)
    const cached = this.getFromCache<DocumentAnalysisResult>(cacheKey)
    if (cached) {
      return cached
    }

    if (this.parallelMode) {
      const result = await this.executeParallel(
        (p) => p.analyzeDocument(request),
        'analyzeDocument'
      )
      this.setCache(cacheKey, result)
      return result
    }

    const result = await this.executeSequential(
      (p) => p.analyzeDocument(request),
      'analyzeDocument'
    )
    this.setCache(cacheKey, result)
    return result
  }

  async validateEntry(request: EntryValidationRequest): Promise<EntryValidationResult> {
    const cacheKey = this.getCacheKey('validateEntry', request)
    const cached = this.getFromCache<EntryValidationResult>(cacheKey)
    if (cached) {
      return cached
    }

    if (this.parallelMode) {
      const result = await this.executeParallel((p) => p.validateEntry(request), 'validateEntry')
      this.setCache(cacheKey, result)
      return result
    }

    const result = await this.executeSequential((p) => p.validateEntry(request), 'validateEntry')
    this.setCache(cacheKey, result)
    return result
  }

  private async executeSequential<T>(
    operation: (provider: AIProvider) => Promise<T>,
    operationName: string
  ): Promise<T> {
    const errors: Array<{ provider: string; error: Error }> = []
    const sortedProviders = this.getSortedProviders()

    for (let retry = 0; retry <= this.retries; retry++) {
      for (const { provider, name } of sortedProviders) {
        const circuitBreaker = this.circuitBreakers.get(name)
        if (circuitBreaker && !circuitBreaker.canExecute()) {
          console.warn(`[AI] ${name} circuit breaker is open, skipping`)
          continue
        }

        try {
          const startTime = Date.now()
          const result = await this.executeWithTimeout(() => operation(provider), this.timeout)
          const latency = Date.now() - startTime

          this.recordSuccess(name, latency)
          if (circuitBreaker) circuitBreaker.recordSuccess()

          console.log(
            `[AI] ${operationName} success with ${name}${retry > 0 ? ` (retry ${retry})` : ''} (${latency}ms)`
          )
          this.currentProviderIndex = this.providers.findIndex((p) => p.name === name)
          return result
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          this.recordFailure(name)
          if (circuitBreaker) circuitBreaker.recordFailure()

          console.warn(
            `[AI] ${name} ${operationName} failed${retry > 0 ? ` (retry ${retry})` : ''}:`,
            err.message
          )
          errors.push({ provider: name, error: err })
          continue
        }
      }
    }

    const errorMessages = errors.map((e) => `${e.provider}: ${e.error.message}`).join('; ')
    throw new Error(`All AI providers failed ${operationName}. Errors: ${errorMessages}`)
  }

  private async executeParallel<T>(
    operation: (provider: AIProvider) => Promise<T>,
    operationName: string
  ): Promise<T> {
    const availableProviders = this.providers.filter(({ name }) => {
      const circuitBreaker = this.circuitBreakers.get(name)
      return !circuitBreaker || circuitBreaker.canExecute()
    })

    if (availableProviders.length === 0) {
      throw new Error(`No providers available (all circuit breakers open) for ${operationName}`)
    }

    const errors: Array<{ provider: string; error: Error }> = []

    const promises = availableProviders.map(async ({ provider, name }) => {
      try {
        const startTime = Date.now()
        const result = await this.executeWithTimeout(() => operation(provider), this.timeout)
        const latency = Date.now() - startTime

        this.recordSuccess(name, latency)
        const circuitBreaker = this.circuitBreakers.get(name)
        if (circuitBreaker) circuitBreaker.recordSuccess()

        console.log(`[AI] ${operationName} success with ${name} (${latency}ms)`)
        return { result, name }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        this.recordFailure(name)
        const circuitBreaker = this.circuitBreakers.get(name)
        if (circuitBreaker) circuitBreaker.recordFailure()

        console.warn(`[AI] ${name} ${operationName} failed:`, err.message)
        errors.push({ provider: name, error: err })
        return null
      }
    })

    const firstResult = await Promise.race(promises)

    if (firstResult && firstResult !== null) {
      this.currentProviderIndex = this.providers.findIndex((p) => p.name === firstResult.name)
      return firstResult.result
    }

    await Promise.all(promises)

    const errorMessages = errors.map((e) => `${e.provider}: ${e.error.message}`).join('; ')
    throw new Error(`All AI providers failed ${operationName}. Errors: ${errorMessages}`)
  }

  private getSortedProviders(): Array<{ provider: AIProvider; name: AIProviderType }> {
    return [...this.providers].sort((a, b) => {
      const metricsA = this.metrics.get(a.name)
      const metricsB = this.metrics.get(b.name)

      if (!metricsA || !metricsB) return 0

      const circuitA = this.circuitBreakers.get(a.name)
      const circuitB = this.circuitBreakers.get(b.name)

      if (circuitA && !circuitA.canExecute()) return 1
      if (circuitB && !circuitB.canExecute()) return -1

      return metricsB.successRate - metricsA.successRate
    })
  }

  private recordSuccess(name: AIProviderType, latency: number): void {
    const metrics = this.metrics.get(name)
    const latencyRecord = this.latencies.get(name)

    if (metrics && latencyRecord) {
      metrics.successCount++
      metrics.lastSuccess = new Date()
      metrics.totalLatency += latency
      metrics.requestCount++
      metrics.averageLatency = metrics.totalLatency / metrics.requestCount
      metrics.successRate = metrics.successCount / (metrics.successCount + metrics.failureCount)
      metrics.circuitState = this.circuitBreakers.get(name)?.getState() ?? 'closed'
    }
  }

  private recordFailure(name: AIProviderType): void {
    const metrics = this.metrics.get(name)

    if (metrics) {
      metrics.failureCount++
      metrics.lastFailure = new Date()
      metrics.successRate = metrics.successCount / (metrics.successCount + metrics.failureCount)
      metrics.circuitState = this.circuitBreakers.get(name)?.getState() ?? 'closed'
    }
  }

  private getCacheKey(operation: string, request: unknown): string {
    return `${operation}:${JSON.stringify(request)}`
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.cacheResults) return null

    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key)
      return null
    }

    return entry.result
  }

  private setCache<T>(key: string, result: T): void {
    if (!this.cacheResults) return

    this.cache.set(key, { result, timestamp: Date.now() })
  }

  clearCache(): void {
    this.cache.clear()
  }

  getMetrics(): Map<AIProviderType, ProviderMetrics> {
    const result = new Map<AIProviderType, ProviderMetrics>()

    for (const [name, metrics] of this.metrics) {
      result.set(name, { ...metrics })
    }

    return result
  }

  getMetricsForProvider(name: AIProviderType): ProviderMetrics | undefined {
    const metrics = this.metrics.get(name)
    return metrics ? { ...metrics } : undefined
  }

  getCircuitBreakerState(name: AIProviderType): CircuitState | undefined {
    return this.circuitBreakers.get(name)?.getState()
  }

  resetCircuitBreaker(name: AIProviderType): void {
    this.circuitBreakers.get(name)?.reset()
    const metrics = this.metrics.get(name)
    if (metrics) {
      metrics.circuitState = 'closed'
    }
  }

  getCurrentProvider(): AIProviderType {
    return this.providers[this.currentProviderIndex]?.name || this.providers[0].name
  }

  getProviderList(): AIProviderType[] {
    return this.providers.map((p) => p.name)
  }

  getOriginalProviderList(): AIProviderType[] {
    return [...this.originalProviderNames]
  }

  getAvailableProviders(): AIProviderType[] {
    return this.providers
      .filter(({ name }) => {
        const cb = this.circuitBreakers.get(name)
        return !cb || cb.canExecute()
      })
      .map((p) => p.name)
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      fn()
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }
}

export function createFallbackProvider(config: FallbackConfig): FallbackAIProvider {
  return new FallbackAIProvider(config)
}

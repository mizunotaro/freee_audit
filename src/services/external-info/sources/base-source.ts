import type {
  InfoSourceConfig,
  InfoSourceHealth,
  InfoSourceId,
  InfoSourceStatus,
  ExternalInfoQuery,
  ExternalInfoResult,
} from '../types'

export abstract class BaseInfoSource {
  protected config: InfoSourceConfig
  protected health: InfoSourceHealth

  constructor(config: InfoSourceConfig) {
    this.config = config
    this.health = {
      sourceId: config.id,
      status: 'active',
      consecutiveFailures: 0,
      averageLatencyMs: 0,
    }
  }

  abstract readonly sourceId: InfoSourceId
  abstract readonly displayName: string

  abstract fetch(query: ExternalInfoQuery): Promise<ExternalInfoResult>

  getConfig(): InfoSourceConfig {
    return this.config
  }

  getHealth(): InfoSourceHealth {
    return { ...this.health }
  }

  updateConfig(config: Partial<InfoSourceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  protected async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const result = await operation()
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  protected recordSuccess(latencyMs: number): void {
    const prevAvg = this.health.averageLatencyMs
    const prevCount = this.health.consecutiveFailures > 0 ? 0 : 1
    this.health = {
      ...this.health,
      status: 'active',
      lastSuccessAt: new Date(),
      consecutiveFailures: 0,
      averageLatencyMs: Math.round((prevAvg * prevCount + latencyMs) / (prevCount + 1)),
    }
  }

  protected recordFailure(error: string): void {
    const consecutiveFailures = this.health.consecutiveFailures + 1
    const status: InfoSourceStatus = consecutiveFailures >= 3 ? 'unavailable' : 'degraded'

    this.health = {
      ...this.health,
      status,
      lastFailureAt: new Date(),
      consecutiveFailures,
      lastError: error,
    }
  }

  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt)
          await this.sleep(delayMs)
        }
      }
    }

    throw lastError ?? new Error('Retry failed')
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  isEnabled(): boolean {
    return this.config.enabled && this.health.status !== 'unavailable'
  }

  isAvailable(): boolean {
    return this.health.status === 'active' || this.health.status === 'degraded'
  }
}

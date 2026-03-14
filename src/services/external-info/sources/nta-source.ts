import { BaseInfoSource } from './base-source'
import type {
  ExternalInfoQuery,
  ExternalInfoResult,
  ExternalInfoItem,
  InfoSourceId,
  InfoSourceConfig,
} from '../types'

export const NTA_CONFIG: InfoSourceConfig = {
  id: 'nta',
  name: 'National Tax Agency',
  description: 'Japan National Tax Agency (国税庁)',
  enabled: true,
  priority: 10,
  timeoutMs: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  cacheTtlMs: 86400000,
}

const _NTA_BASE_URL = 'https://www.nta.go.jp' // TODO: スクレイピング実装時に使用

export class NtaInfoSource extends BaseInfoSource {
  readonly sourceId: InfoSourceId = 'nta'
  readonly displayName = '国税庁'

  constructor(config?: Partial<InfoSourceConfig>) {
    super({ ...NTA_CONFIG, ...config })
  }

  async fetch(query: ExternalInfoQuery): Promise<ExternalInfoResult> {
    const startTime = Date.now()

    if (!this.isEnabled()) {
      return this.createDisabledResult(startTime)
    }

    try {
      const result = await this.retryWithBackoff(
        () => this.executeFetch(query),
        this.config.maxRetries,
        this.config.retryDelayMs
      )

      const latencyMs = Date.now() - startTime
      this.recordSuccess(latencyMs)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.recordFailure(errorMessage)

      return {
        success: false,
        items: [],
        totalFound: 0,
        source: this.sourceId,
        fetchedAt: new Date(),
        latencyMs: Date.now() - startTime,
        error: {
          code: 'nta_fetch_error',
          message: errorMessage,
        },
      }
    }
  }

  private async executeFetch(query: ExternalInfoQuery): Promise<ExternalInfoResult> {
    const startTime = Date.now()

    const items = await this.scrapeNtaSite(query)

    return {
      success: true,
      items,
      totalFound: items.length,
      source: this.sourceId,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    }
  }

  private async scrapeNtaSite(query: ExternalInfoQuery): Promise<ExternalInfoItem[]> {
    return this.executeWithTimeout(() => this.performScraping(query), this.config.timeoutMs)
  }

  private async performScraping(_query: ExternalInfoQuery): Promise<ExternalInfoItem[]> {
    throw new Error(
      'NTA scraping not implemented. Enable mock source for development or implement web_search source.'
    )
  }

  private createDisabledResult(startTime: number): ExternalInfoResult {
    return {
      success: false,
      items: [],
      totalFound: 0,
      source: this.sourceId,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
      error: {
        code: 'source_disabled',
        message: 'NTA source is disabled',
      },
    }
  }
}

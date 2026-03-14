import { BaseInfoSource } from './base-source'
import type {
  ExternalInfoQuery,
  ExternalInfoResult,
  ExternalInfoItem,
  InfoSourceId,
  InfoSourceConfig,
} from '../types'

export type WebSearchProvider = 'openai' | 'serpapi' | 'google' | 'bing'

export interface WebSearchConfig {
  provider: WebSearchProvider
  apiKey?: string
  searchEngineId?: string
  maxResults: number
}

export const WEB_SEARCH_CONFIG: InfoSourceConfig = {
  id: 'web_search',
  name: 'Web Search',
  description: 'General web search integration',
  enabled: false,
  priority: 50,
  timeoutMs: 15000,
  maxRetries: 2,
  retryDelayMs: 500,
  cacheTtlMs: 3600000,
}

export class WebSearchInfoSource extends BaseInfoSource {
  readonly sourceId: InfoSourceId = 'web_search'
  readonly displayName = 'Web検索'

  private searchConfig: WebSearchConfig

  constructor(config?: Partial<InfoSourceConfig>, searchConfig?: Partial<WebSearchConfig>) {
    super({ ...WEB_SEARCH_CONFIG, ...config })
    this.searchConfig = {
      provider: 'openai',
      maxResults: 10,
      ...searchConfig,
    }
  }

  async fetch(query: ExternalInfoQuery): Promise<ExternalInfoResult> {
    const startTime = Date.now()

    if (!this.isEnabled()) {
      return this.createDisabledResult(startTime)
    }

    try {
      const result = await this.retryWithBackoff(
        () => this.executeSearch(query),
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
          code: 'web_search_error',
          message: errorMessage,
        },
      }
    }
  }

  private async executeSearch(query: ExternalInfoQuery): Promise<ExternalInfoResult> {
    const startTime = Date.now()

    const items = await this.performSearch(query)

    return {
      success: true,
      items,
      totalFound: items.length,
      source: this.sourceId,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    }
  }

  private async performSearch(query: ExternalInfoQuery): Promise<ExternalInfoItem[]> {
    switch (this.searchConfig.provider) {
      case 'openai':
        return this.searchWithOpenAI(query)
      case 'serpapi':
        return this.searchWithSerpAPI(query)
      case 'google':
        return this.searchWithGoogle(query)
      case 'bing':
        return this.searchWithBing(query)
      default:
        throw new Error(`Unknown search provider: ${this.searchConfig.provider}`)
    }
  }

  private async searchWithOpenAI(_query: ExternalInfoQuery): Promise<ExternalInfoItem[]> {
    if (!this.searchConfig.apiKey) {
      throw new Error('OpenAI API key not configured. Set WEB_SEARCH_API_KEY environment variable.')
    }

    throw new Error('OpenAI web search not implemented. Configure mock source for development.')
  }

  private async searchWithSerpAPI(_query: ExternalInfoQuery): Promise<ExternalInfoItem[]> {
    if (!this.searchConfig.apiKey) {
      throw new Error('SerpAPI key not configured. Set SERPAPI_KEY environment variable.')
    }

    throw new Error('SerpAPI not implemented. Configure mock source for development.')
  }

  private async searchWithGoogle(_query: ExternalInfoQuery): Promise<ExternalInfoItem[]> {
    if (!this.searchConfig.apiKey || !this.searchConfig.searchEngineId) {
      throw new Error(
        'Google Custom Search not configured. Set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID.'
      )
    }

    throw new Error('Google Custom Search not implemented. Configure mock source for development.')
  }

  private async searchWithBing(_query: ExternalInfoQuery): Promise<ExternalInfoItem[]> {
    if (!this.searchConfig.apiKey) {
      throw new Error('Bing Search API key not configured. Set BING_API_KEY environment variable.')
    }

    throw new Error('Bing Search not implemented. Configure mock source for development.')
  }

  updateSearchConfig(config: Partial<WebSearchConfig>): void {
    this.searchConfig = { ...this.searchConfig, ...config }
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
        message: 'Web search source is disabled',
      },
    }
  }
}

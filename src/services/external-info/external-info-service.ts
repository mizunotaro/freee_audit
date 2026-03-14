import type {
  ExternalInfoQuery,
  ExternalInfoResult,
  ExternalInfoItem,
  InfoSourceConfig,
  InfoSourceId,
  ExternalInfoServiceResult,
} from './types'
import { BaseInfoSource, MockInfoSource, NtaInfoSource, WebSearchInfoSource } from './sources'
import { getInfoCache } from './cache'
import { DEFAULT_SOURCE_CONFIGS } from './types'

export interface ExternalInfoServiceConfig {
  enabledSources: InfoSourceId[]
  defaultTimeoutMs: number
  maxParallelSources: number
  useCache: boolean
  fallbackOrder: InfoSourceId[]
}

const DEFAULT_SERVICE_CONFIG: ExternalInfoServiceConfig = {
  enabledSources: ['mock'],
  defaultTimeoutMs: 30000,
  maxParallelSources: 3,
  useCache: true,
  fallbackOrder: ['mock', 'nta', 'web_search'],
}

export class ExternalInfoService {
  private sources: Map<InfoSourceId, BaseInfoSource>
  private config: ExternalInfoServiceConfig
  private cache: ReturnType<typeof getInfoCache>

  constructor(config: Partial<ExternalInfoServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config }
    this.sources = new Map()
    this.cache = getInfoCache()
    this.initializeSources()
  }

  private initializeSources(): void {
    for (const sourceId of this.config.enabledSources) {
      const sourceConfig = DEFAULT_SOURCE_CONFIGS[sourceId]
      if (!sourceConfig) {
        console.warn(`Unknown source: ${sourceId}`)
        continue
      }

      const source = this.createSource(sourceId, sourceConfig)
      if (source) {
        this.sources.set(sourceId, source)
      }
    }
  }

  private createSource(sourceId: InfoSourceId, config: InfoSourceConfig): BaseInfoSource | null {
    switch (sourceId) {
      case 'mock':
        return new MockInfoSource(config)
      case 'nta':
        return new NtaInfoSource(config)
      case 'web_search':
        return new WebSearchInfoSource(config)
      default:
        console.warn(`Source not implemented: ${sourceId}`)
        return null
    }
  }

  async fetch(query: ExternalInfoQuery): Promise<ExternalInfoServiceResult<ExternalInfoItem[]>> {
    if (!query.query || query.query.trim().length === 0) {
      return {
        success: false,
        error: { code: 'invalid_query', message: 'Query is required' },
      }
    }

    const sources = this.resolveSources(query.sources)
    if (sources.length === 0) {
      return {
        success: false,
        error: { code: 'no_sources', message: 'No enabled sources available' },
      }
    }

    if (this.config.useCache) {
      const cached = this.cache.get(query, sources)
      if (cached) {
        return { success: true, data: cached }
      }
    }

    const results = await this.fetchFromSources(query, sources)
    const mergedItems = this.mergeResults(results)

    if (this.config.useCache && mergedItems.length > 0) {
      this.cache.set(query, sources, mergedItems)
    }

    if (mergedItems.length === 0) {
      return {
        success: false,
        error: {
          code: 'no_results',
          message: 'No information found from any source',
        },
      }
    }

    return { success: true, data: mergedItems }
  }

  private resolveSources(requestedSources?: readonly InfoSourceId[]): InfoSourceId[] {
    if (requestedSources && requestedSources.length > 0) {
      return requestedSources.filter(
        (id) => this.sources.has(id) && this.sources.get(id)!.isEnabled()
      )
    }

    return this.config.fallbackOrder.filter(
      (id) => this.sources.has(id) && this.sources.get(id)!.isEnabled()
    )
  }

  private async fetchFromSources(
    query: ExternalInfoQuery,
    sourceIds: InfoSourceId[]
  ): Promise<ExternalInfoResult[]> {
    const parallelLimit = this.config.maxParallelSources
    const results: ExternalInfoResult[] = []

    for (let i = 0; i < sourceIds.length; i += parallelLimit) {
      const batch = sourceIds.slice(i, i + parallelLimit)
      const batchResults = await Promise.all(batch.map((id) => this.fetchFromSource(id, query)))
      results.push(...batchResults)

      const hasSuccess = batchResults.some((r) => r.success && r.items.length > 0)
      const limit = query.limit ?? 10
      if (hasSuccess && results.some((r) => r.items.length >= limit)) {
        break
      }
    }

    return results
  }

  private async fetchFromSource(
    sourceId: InfoSourceId,
    query: ExternalInfoQuery
  ): Promise<ExternalInfoResult> {
    const source = this.sources.get(sourceId)
    if (!source) {
      return {
        success: false,
        items: [],
        totalFound: 0,
        source: sourceId,
        fetchedAt: new Date(),
        latencyMs: 0,
        error: { code: 'source_not_found', message: `Source not found: ${sourceId}` },
      }
    }

    try {
      return await source.fetch(query)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        items: [],
        totalFound: 0,
        source: sourceId,
        fetchedAt: new Date(),
        latencyMs: 0,
        error: { code: 'fetch_error', message: errorMessage },
      }
    }
  }

  private mergeResults(results: ExternalInfoResult[]): ExternalInfoItem[] {
    const allItems: ExternalInfoItem[] = []

    for (const result of results) {
      if (result.success && result.items.length > 0) {
        allItems.push(...result.items)
      }
    }

    const deduped = this.deduplicateItems(allItems)
    deduped.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return deduped
  }

  private deduplicateItems(items: ExternalInfoItem[]): ExternalInfoItem[] {
    const seen = new Map<string, ExternalInfoItem>()

    for (const item of items) {
      const key = `${item.source}:${item.title}`
      if (!seen.has(key) || seen.get(key)!.relevanceScore < item.relevanceScore) {
        seen.set(key, item)
      }
    }

    return Array.from(seen.values())
  }

  addSource(source: BaseInfoSource): void {
    this.sources.set(source.sourceId, source)
  }

  removeSource(sourceId: InfoSourceId): boolean {
    return this.sources.delete(sourceId)
  }

  getSource(sourceId: InfoSourceId): BaseInfoSource | undefined {
    return this.sources.get(sourceId)
  }

  getEnabledSources(): InfoSourceId[] {
    return Array.from(this.sources.entries())
      .filter(([_, source]) => source.isEnabled())
      .map(([id]) => id)
  }

  invalidateCache(query?: ExternalInfoQuery, sources?: InfoSourceId[]): void {
    if (query && sources) {
      this.cache.invalidate(query, sources)
    } else {
      this.cache.invalidateAll()
    }
  }

  getCacheStats(): ReturnType<ExternalInfoService['cache']['getStats']> {
    return this.cache.getStats()
  }

  updateConfig(config: Partial<ExternalInfoServiceConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

let globalService: ExternalInfoService | null = null

export function getExternalInfoService(
  config?: Partial<ExternalInfoServiceConfig>
): ExternalInfoService {
  if (!globalService) {
    globalService = new ExternalInfoService(config)
  }
  return globalService
}

export function resetExternalInfoService(): void {
  globalService = null
}

export function createExternalInfoService(
  config?: Partial<ExternalInfoServiceConfig>
): ExternalInfoService {
  return new ExternalInfoService(config)
}

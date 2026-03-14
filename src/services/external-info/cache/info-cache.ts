import type { ExternalInfoItem, ExternalInfoQuery, InfoSourceId } from '../types'

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
}

export interface InfoCacheConfig {
  maxSize: number
  defaultTtlMs: number
  cleanupIntervalMs: number
}

const DEFAULT_CACHE_CONFIG: InfoCacheConfig = {
  maxSize: 1000,
  defaultTtlMs: 3600000,
  cleanupIntervalMs: 300000,
}

export class ExternalInfoCache {
  private cache: Map<string, CacheEntry<ExternalInfoItem[]>>
  private config: InfoCacheConfig
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private hits: number = 0
  private misses: number = 0

  constructor(config: Partial<InfoCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    this.cache = new Map()
    this.startCleanupTimer()
  }

  generateKey(query: ExternalInfoQuery, sources: InfoSourceId[]): string {
    const normalizedQuery = query.query.toLowerCase().trim()
    const categories = [...(query.categories ?? [])].sort().join(',')
    const sourceList = sources.sort().join(',')
    const dateRange = `${query.fromDate?.getTime() ?? 0}-${query.toDate?.getTime() ?? 0}`
    const limit = query.limit ?? 10
    const minRelevance = query.minRelevance ?? 0

    return `${normalizedQuery}|${categories}|${sourceList}|${dateRange}|${limit}|${minRelevance}`
  }

  get(query: ExternalInfoQuery, sources: InfoSourceId[]): ExternalInfoItem[] | null {
    const key = this.generateKey(query, sources)
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    this.hits++
    return entry.data
  }

  set(
    query: ExternalInfoQuery,
    sources: InfoSourceId[],
    data: ExternalInfoItem[],
    ttlMs?: number
  ): void {
    const key = this.generateKey(query, sources)

    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }

    const now = Date.now()
    this.cache.set(key, {
      data,
      createdAt: now,
      expiresAt: now + (ttlMs ?? this.config.defaultTtlMs),
    })
  }

  invalidate(query: ExternalInfoQuery, sources: InfoSourceId[]): boolean {
    const key = this.generateKey(query, sources)
    return this.cache.delete(key)
  }

  invalidateBySource(sourceId: InfoSourceId): number {
    let count = 0
    for (const [key, entry] of this.cache) {
      if (entry.data.some((item) => item.source === sourceId)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  invalidateAll(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats(): {
    size: number
    maxSize: number
    hits: number
    misses: number
    hitRate: number
  } {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupIntervalMs)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
  }
}

let globalCache: ExternalInfoCache | null = null

export function getInfoCache(config?: Partial<InfoCacheConfig>): ExternalInfoCache {
  if (!globalCache) {
    globalCache = new ExternalInfoCache(config)
  }
  return globalCache
}

export function resetInfoCache(): void {
  if (globalCache) {
    globalCache.destroy()
    globalCache = null
  }
}

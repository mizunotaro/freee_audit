import { CACHE_CONFIG } from '../config/constants'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  hash: string
}

export class AnalysisCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private accessOrder: string[] = []

  constructor(private readonly maxSize: number = 100) {}

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) return undefined

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter((k) => k !== key)
      return undefined
    }

    return entry.data as T
  }

  set<T>(key: string, data: T, ttl: number = CACHE_CONFIG.analysis.ttl): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift()
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    const hash = this.generateHash(data)

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hash,
    })

    this.accessOrder = this.accessOrder.filter((k) => k !== key)
    this.accessOrder.push(key)
  }

  invalidate(pattern: RegExp): void {
    const keysToDelete: string[] = []

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter((k) => k !== key)
    }
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter((k) => k !== key)
      return false
    }

    return true
  }

  size(): number {
    return this.cache.size
  }

  private generateHash(data: unknown): string {
    const json = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(16)
  }
}

let globalCache: AnalysisCache | null = null

export function getAnalysisCache(): AnalysisCache {
  if (!globalCache) {
    globalCache = new AnalysisCache()
  }
  return globalCache
}

export function clearAnalysisCache(): void {
  if (globalCache) {
    globalCache.clear()
  }
}

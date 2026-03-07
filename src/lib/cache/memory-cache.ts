export interface CacheEntry<T> {
  value: T
  cachedAt: number
  ttl: number
}

export class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private defaultTTL: number

  constructor(defaultTTL: number = 3600000) {
    this.defaultTTL = defaultTTL
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.cachedAt > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      cachedAt: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() - entry.cachedAt > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  cleanup(): number {
    let removed = 0
    const now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > entry.ttl) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }

  keys(): string[] {
    const validKeys: string[] = []
    const now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt <= entry.ttl) {
        validKeys.push(key)
      }
    }

    return validKeys
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: this.keys(),
    }
  }
}

const DEFAULT_EXCHANGE_RATE_TTL = parseInt(process.env.CACHE_TTL_EXCHANGE_RATE || '3600000', 10)
const DEFAULT_KPI_TTL = parseInt(process.env.CACHE_TTL_KPI || '1800000', 10)

export const exchangeRateCache = new MemoryCache<number>(DEFAULT_EXCHANGE_RATE_TTL)
export const kpiCache = new MemoryCache<Record<string, unknown>>(DEFAULT_KPI_TTL)

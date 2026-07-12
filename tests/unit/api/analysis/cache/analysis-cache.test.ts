import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AnalysisCache,
  getAnalysisCache,
  clearAnalysisCache,
  type CacheEntry,
} from '@/app/api/analysis/cache/analysis-cache'
import { CACHE_CONFIG } from '@/app/api/analysis/config/constants'

describe('AnalysisCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('defaults maxSize to 100', () => {
      const cache = new AnalysisCache()
      for (let i = 0; i < 100; i++) {
        cache.set(`k${i}`, i)
      }
      expect(cache.size()).toBe(100)

      cache.set('overflow', 'v')
      expect(cache.size()).toBe(100)
      expect(cache.get('k0')).toBeUndefined()
      expect(cache.get('overflow')).toBe('v')
    })

    it('honors a custom maxSize', () => {
      const cache = new AnalysisCache(3)
      expect((cache as unknown as { maxSize: number }).maxSize).toBe(3)
    })
  })

  describe('get', () => {
    it('returns stored data for a live key', () => {
      const cache = new AnalysisCache()
      cache.set('key', { value: 42 })

      expect(cache.get('key')).toEqual({ value: 42 })
    })

    it('returns undefined for a missing key', () => {
      const cache = new AnalysisCache()

      expect(cache.get('missing')).toBeUndefined()
    })

    it('preserves the stored type through the generic', () => {
      const cache = new AnalysisCache()
      cache.set('n', 7)

      const result = cache.get<number>('n')
      expect(result).toBe(7)
      expect(typeof result).toBe('number')
    })

    it('handles every JSON-serializable data type', () => {
      const cache = new AnalysisCache()
      cache.set('str', 'hello')
      cache.set('num', 123.45)
      cache.set('bool', true)
      cache.set('null', null)
      cache.set('arr', [1, 2, 3])
      cache.set('obj', { nested: { deep: [true, false] } })

      expect(cache.get('str')).toBe('hello')
      expect(cache.get('num')).toBe(123.45)
      expect(cache.get('bool')).toBe(true)
      expect(cache.get('null')).toBeNull()
      expect(cache.get('arr')).toEqual([1, 2, 3])
      expect(cache.get('obj')).toEqual({ nested: { deep: [true, false] } })
    })

    it('returns the value while within the TTL window', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v', 1000)

      vi.advanceTimersByTime(999)
      expect(cache.get('key')).toBe('v')
    })

    it('still returns the value at exactly the TTL boundary', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v', 1000)

      vi.advanceTimersByTime(1000)
      expect(cache.get('key')).toBe('v')
    })

    it('returns undefined once elapsed exceeds TTL', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v', 1000)

      vi.advanceTimersByTime(1001)
      expect(cache.get('key')).toBeUndefined()
    })

    it('evicts the expired entry lazily on read (fail-safe: stale data is dropped)', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v', 1000)

      vi.advanceTimersByTime(1001)
      expect(cache.size()).toBe(1)

      cache.get('key')
      expect(cache.size()).toBe(0)
    })
  })

  describe('set', () => {
    it('stores data retrievable via get', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'value')

      expect(cache.get('key')).toBe('value')
    })

    it('applies the default TTL from CACHE_CONFIG when none is given', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'value')

      const entry = (cache as unknown as { cache: Map<string, CacheEntry<unknown>> }).cache.get(
        'key'
      )
      expect(entry?.ttl).toBe(CACHE_CONFIG.analysis.ttl)
    })

    it('applies a custom TTL', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'value', 5000)

      const entry = (cache as unknown as { cache: Map<string, CacheEntry<unknown>> }).cache.get(
        'key'
      )
      expect(entry?.ttl).toBe(5000)
    })

    it('stamps the entry with the current time', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'value')

      const entry = (cache as unknown as { cache: Map<string, CacheEntry<unknown>> }).cache.get(
        'key'
      )
      expect(entry?.timestamp).toBe(Date.now())
    })

    it('overwrites an existing key with new data and a refreshed timestamp', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'old')
      vi.advanceTimersByTime(500)
      cache.set('key', 'new')

      expect(cache.get('key')).toBe('new')
      expect(cache.size()).toBe(1)
    })

    it('refreshing a key resets its TTL window (fail-safe against premature expiry)', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v1', 1000)

      vi.advanceTimersByTime(800)
      cache.set('key', 'v2', 1000)

      vi.advanceTimersByTime(900)
      expect(cache.get('key')).toBe('v2')
    })

    it('records a deterministic hash on the entry', () => {
      const cache = new AnalysisCache()
      cache.set('a', { x: 1 })
      cache.set('b', { x: 1 })
      cache.set('c', { x: 2 })

      const internal = (cache as unknown as { cache: Map<string, CacheEntry<unknown>> }).cache
      const entryA = internal.get('a')
      const entryB = internal.get('b')
      const entryC = internal.get('c')

      expect(entryA?.hash).toMatch(/^-?[0-9a-f]+$/)
      expect(entryA?.hash).toBe(entryB?.hash)
      expect(entryA?.hash).not.toBe(entryC?.hash)
    })

    it('throws when given non-serializable data (undefined)', () => {
      const cache = new AnalysisCache()

      expect(() => cache.set('key', undefined)).toThrow(TypeError)
    })

    it('throws when given circular data (hash generation failure)', () => {
      const cache = new AnalysisCache()
      const circular: Record<string, unknown> = {}
      circular.self = circular

      expect(() => cache.set('key', circular)).toThrow(TypeError)
    })
  })

  describe('eviction (maxSize)', () => {
    it('evicts the oldest key when capacity is exceeded by a new key', () => {
      const cache = new AnalysisCache(2)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      expect(cache.size()).toBe(2)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
      expect(cache.get('c')).toBe(3)
    })

    it('does not evict when updating an existing key at capacity', () => {
      const cache = new AnalysisCache(1)
      cache.set('a', 1)
      cache.set('a', 2)

      expect(cache.size()).toBe(1)
      expect(cache.get('a')).toBe(2)
    })

    it('treats maxSize=1 as a single-slot cache', () => {
      const cache = new AnalysisCache(1)
      cache.set('a', 1)
      expect(cache.get('a')).toBe(1)

      cache.set('b', 2)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
    })

    it('re-setting a key promotes it to newest, changing eviction order', () => {
      const cache = new AnalysisCache(2)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('a', 11)

      cache.set('c', 3)
      expect(cache.get('a')).toBe(11)
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBe(3)
    })

    it('does NOT reorder on get (eviction follows insertion/re-insertion order, not access)', () => {
      const cache = new AnalysisCache(2)
      cache.set('a', 1)
      cache.set('b', 2)

      cache.get('a')
      cache.set('c', 3)

      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
      expect(cache.get('c')).toBe(3)
    })

    it('stores an entry even when maxSize=0 (no prior entry to evict)', () => {
      const cache = new AnalysisCache(0)
      cache.set('a', 1)

      expect(cache.size()).toBe(1)
      expect(cache.get('a')).toBe(1)
    })
  })

  describe('invalidate', () => {
    it('removes only keys matching the pattern', () => {
      const cache = new AnalysisCache()
      cache.set('analysis:1', 'a')
      cache.set('analysis:2', 'b')
      cache.set('report:1', 'r')

      cache.invalidate(/^analysis:/)

      expect(cache.size()).toBe(1)
      expect(cache.get('analysis:1')).toBeUndefined()
      expect(cache.get('analysis:2')).toBeUndefined()
      expect(cache.get('report:1')).toBe('r')
    })

    it('is a no-op when nothing matches', () => {
      const cache = new AnalysisCache()
      cache.set('a', 1)
      cache.set('b', 2)

      cache.invalidate(/^nomatch/)

      expect(cache.size()).toBe(2)
    })

    it('clears every key when the pattern matches all', () => {
      const cache = new AnalysisCache()
      cache.set('a', 1)
      cache.set('b', 2)

      cache.invalidate(/.*/)

      expect(cache.size()).toBe(0)
    })

    it('matches anywhere in the key (unanchored regex)', () => {
      const cache = new AnalysisCache()
      cache.set('foo:bar', 1)
      cache.set('baz:bar', 2)
      cache.set('foo:qux', 3)

      cache.invalidate(/bar/)

      expect(cache.size()).toBe(1)
      expect(cache.get('foo:qux')).toBe(3)
    })

    it('keeps accessOrder consistent so eviction still works afterwards', () => {
      const cache = new AnalysisCache(2)
      cache.set('a', 1)
      cache.set('b', 2)

      cache.invalidate(/a/)

      cache.set('c', 3)
      cache.set('d', 4)
      expect(cache.size()).toBe(2)
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBe(3)
      expect(cache.get('d')).toBe(4)
    })

    it('is safe to run against an empty cache', () => {
      const cache = new AnalysisCache()
      expect(() => cache.invalidate(/.*/)).not.toThrow()
      expect(cache.size()).toBe(0)
    })
  })

  describe('clear', () => {
    it('removes every entry', () => {
      const cache = new AnalysisCache()
      cache.set('a', 1)
      cache.set('b', 2)

      cache.clear()

      expect(cache.size()).toBe(0)
      expect(cache.get('a')).toBeUndefined()
    })

    it('is safe to run against an empty cache', () => {
      const cache = new AnalysisCache()
      expect(() => cache.clear()).not.toThrow()
      expect(cache.size()).toBe(0)
    })

    it('allows the cache to be repopulated after clearing', () => {
      const cache = new AnalysisCache()
      cache.set('a', 1)
      cache.clear()
      cache.set('a', 2)

      expect(cache.get('a')).toBe(2)
      expect(cache.size()).toBe(1)
    })
  })

  describe('has', () => {
    it('returns true for a live key', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v')

      expect(cache.has('key')).toBe(true)
    })

    it('returns false for a missing key', () => {
      const cache = new AnalysisCache()

      expect(cache.has('missing')).toBe(false)
    })

    it('returns false for an expired key and drops it (fail-safe)', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v', 1000)

      vi.advanceTimersByTime(1001)
      expect(cache.has('key')).toBe(false)
      expect(cache.size()).toBe(0)
    })

    it('returns true at exactly the TTL boundary', () => {
      const cache = new AnalysisCache()
      cache.set('key', 'v', 1000)

      vi.advanceTimersByTime(1000)
      expect(cache.has('key')).toBe(true)
    })
  })

  describe('size', () => {
    it('is zero on a fresh cache', () => {
      const cache = new AnalysisCache()
      expect(cache.size()).toBe(0)
    })

    it('reflects the number of live entries', () => {
      const cache = new AnalysisCache()
      cache.set('a', 1)
      cache.set('b', 2)

      expect(cache.size()).toBe(2)
    })

    it('decrements after invalidation', () => {
      const cache = new AnalysisCache()
      cache.set('a', 1)
      cache.set('b', 2)

      cache.invalidate(/a/)
      expect(cache.size()).toBe(1)
    })
  })
})

describe('AnalysisCache singleton (getAnalysisCache / clearAnalysisCache)', () => {
  beforeEach(() => {
    clearAnalysisCache()
  })

  afterEach(() => {
    clearAnalysisCache()
  })

  it('returns an AnalysisCache instance', () => {
    expect(getAnalysisCache()).toBeInstanceOf(AnalysisCache)
  })

  it('returns the same instance on every call', () => {
    const a = getAnalysisCache()
    const b = getAnalysisCache()

    expect(a).toBe(b)
  })

  it('persists data across calls until cleared', () => {
    getAnalysisCache().set('shared', 'value')

    expect(getAnalysisCache().get('shared')).toBe('value')
  })

  it('clearAnalysisCache empties the shared instance', () => {
    getAnalysisCache().set('shared', 'value')
    expect(getAnalysisCache().size()).toBe(1)

    clearAnalysisCache()

    expect(getAnalysisCache().get('shared')).toBeUndefined()
    expect(getAnalysisCache().size()).toBe(0)
  })

  it('keeps the same instance after clearing (singleton identity is stable)', () => {
    const before = getAnalysisCache()
    clearAnalysisCache()
    const after = getAnalysisCache()

    expect(before).toBe(after)
  })

  it('clearAnalysisCache is safe when no instance exists yet', () => {
    expect(() => clearAnalysisCache()).not.toThrow()
  })
})

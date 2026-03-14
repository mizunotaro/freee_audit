import { describe, it, expect, beforeEach } from 'vitest'
import { ExternalInfoCache } from '@/services/external-info/cache/info-cache'
import type { ExternalInfoQuery, InfoSourceId } from '@/services/external-info/types'

describe('ExternalInfoCache', () => {
  let cache: ExternalInfoCache

  const mockQuery: ExternalInfoQuery = {
    query: 'test query',
    limit: 10,
  }

  const mockSources: InfoSourceId[] = ['mock']

  const mockItems = [
    {
      id: 'test-1',
      source: 'mock' as const,
      category: 'tax_law' as const,
      title: 'Test Item',
      summary: 'Test summary',
      content: 'Test content',
      tags: ['test'],
      relevanceScore: 0.9,
      fetchedAt: new Date(),
    },
  ]

  beforeEach(() => {
    cache = new ExternalInfoCache({ defaultTtlMs: 1000 })
  })

  describe('get and set', () => {
    it('should cache and retrieve items', () => {
      cache.set(mockQuery, mockSources, mockItems)
      const result = cache.get(mockQuery, mockSources)

      expect(result).not.toBeNull()
      expect(result?.length).toBe(1)
      expect(result?.[0].id).toBe('test-1')
    })

    it('should return null for cache miss', () => {
      const result = cache.get(mockQuery, mockSources)
      expect(result).toBeNull()
    })

    it('should respect TTL', async () => {
      const shortCache = new ExternalInfoCache({ defaultTtlMs: 10 })
      shortCache.set(mockQuery, mockSources, mockItems)

      await new Promise((resolve) => setTimeout(resolve, 20))

      const result = shortCache.get(mockQuery, mockSources)
      expect(result).toBeNull()
    })
  })

  describe('key generation', () => {
    it('should generate consistent keys for same queries', () => {
      const key1 = cache.generateKey(mockQuery, mockSources)
      const key2 = cache.generateKey(mockQuery, mockSources)
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different queries', () => {
      const key1 = cache.generateKey({ query: 'test1' }, mockSources)
      const key2 = cache.generateKey({ query: 'test2' }, mockSources)
      expect(key1).not.toBe(key2)
    })
  })

  describe('invalidation', () => {
    it('should invalidate specific cache entry', () => {
      cache.set(mockQuery, mockSources, mockItems)
      const invalidated = cache.invalidate(mockQuery, mockSources)

      expect(invalidated).toBe(true)
      expect(cache.get(mockQuery, mockSources)).toBeNull()
    })

    it('should invalidate all entries', () => {
      cache.set(mockQuery, mockSources, mockItems)
      cache.set({ query: 'other' }, mockSources, mockItems)

      cache.invalidateAll()

      expect(cache.get(mockQuery, mockSources)).toBeNull()
      expect(cache.get({ query: 'other' }, mockSources)).toBeNull()
    })

    it('should invalidate by source', () => {
      cache.set(mockQuery, mockSources, mockItems)

      const count = cache.invalidateBySource('mock')

      expect(count).toBeGreaterThan(0)
      expect(cache.get(mockQuery, mockSources)).toBeNull()
    })
  })

  describe('stats', () => {
    it('should track cache stats', () => {
      cache.set(mockQuery, mockSources, mockItems)
      cache.get(mockQuery, mockSources)
      cache.get({ query: 'miss' }, mockSources)

      const stats = cache.getStats()

      expect(stats.size).toBe(1)
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })
  })

  describe('eviction', () => {
    it('should evict oldest entry when max size reached', () => {
      const smallCache = new ExternalInfoCache({ maxSize: 2 })

      smallCache.set({ query: '1' }, mockSources, mockItems)
      smallCache.set({ query: '2' }, mockSources, mockItems)
      smallCache.set({ query: '3' }, mockSources, mockItems)

      const stats = smallCache.getStats()
      expect(stats.size).toBe(2)
      expect(smallCache.get({ query: '1' }, mockSources)).toBeNull()
    })
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryCache } from '@/lib/cache/memory-cache'

describe('MemoryCache', () => {
  let cache: MemoryCache<string>

  beforeEach(() => {
    cache = new MemoryCache(1000)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return null for missing keys', () => {
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('should delete entries', () => {
      cache.set('key1', 'value1')
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeNull()
      expect(cache.delete('key1')).toBe(false)
    })

    it('should clear all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()
      expect(cache.size()).toBe(0)
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })

    it('should return correct size', () => {
      expect(cache.size()).toBe(0)
      cache.set('key1', 'value1')
      expect(cache.size()).toBe(1)
      cache.set('key2', 'value2')
      expect(cache.size()).toBe(2)
    })
  })

  describe('TTL functionality', () => {
    it('should expire entries after default TTL', () => {
      cache.set('key1', 'value1')

      vi.advanceTimersByTime(500)
      expect(cache.get('key1')).toBe('value1')

      vi.advanceTimersByTime(501)
      expect(cache.get('key1')).toBeNull()
    })

    it('should support custom TTL per entry', () => {
      cache.set('key1', 'value1', 500)
      cache.set('key2', 'value2', 2000)

      vi.advanceTimersByTime(1000)
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBe('value2')
    })

    it('should remove expired entry on access', () => {
      cache.set('key1', 'value1', 500)

      expect(cache.size()).toBe(1)

      vi.advanceTimersByTime(600)
      cache.get('key1')

      expect(cache.size()).toBe(0)
    })
  })

  describe('has method', () => {
    it('should return true for existing non-expired entries', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)
    })

    it('should return false for missing entries', () => {
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('should return false for expired entries', () => {
      cache.set('key1', 'value1', 500)

      vi.advanceTimersByTime(600)
      expect(cache.has('key1')).toBe(false)
    })
  })

  describe('cleanup method', () => {
    it('should remove expired entries and return count', () => {
      cache.set('key1', 'value1', 500)
      cache.set('key2', 'value2', 2000)

      vi.advanceTimersByTime(1000)
      const removed = cache.cleanup()

      expect(removed).toBe(1)
      expect(cache.size()).toBe(1)
      expect(cache.get('key2')).toBe('value2')
    })

    it('should return 0 when no entries are expired', () => {
      cache.set('key1', 'value1', 2000)
      cache.set('key2', 'value2', 2000)

      vi.advanceTimersByTime(1000)
      const removed = cache.cleanup()

      expect(removed).toBe(0)
      expect(cache.size()).toBe(2)
    })
  })

  describe('keys method', () => {
    it('should return all non-expired keys', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const keys = cache.keys()
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys.length).toBe(2)
    })

    it('should not return expired keys', () => {
      cache.set('key1', 'value1', 500)
      cache.set('key2', 'value2', 2000)

      vi.advanceTimersByTime(1000)
      const keys = cache.keys()

      expect(keys).not.toContain('key1')
      expect(keys).toContain('key2')
      expect(keys.length).toBe(1)
    })
  })

  describe('getStats method', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const stats = cache.getStats()

      expect(stats.size).toBe(2)
      expect(stats.keys).toContain('key1')
      expect(stats.keys).toContain('key2')
    })
  })

  describe('different value types', () => {
    it('should handle number values', () => {
      const numberCache = new MemoryCache<number>(1000)
      numberCache.set('num', 42)
      expect(numberCache.get('num')).toBe(42)
    })

    it('should handle object values', () => {
      const objectCache = new MemoryCache<{ name: string; value: number }>(1000)
      const obj = { name: 'test', value: 123 }
      objectCache.set('obj', obj)
      expect(objectCache.get('obj')).toEqual(obj)
    })

    it('should handle array values', () => {
      const arrayCache = new MemoryCache<number[]>(1000)
      const arr = [1, 2, 3, 4, 5]
      arrayCache.set('arr', arr)
      expect(arrayCache.get('arr')).toEqual(arr)
    })
  })

  describe('edge cases', () => {
    it('should handle overwriting existing keys', () => {
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')
      expect(cache.get('key1')).toBe('value2')
      expect(cache.size()).toBe(1)
    })

    it('should handle empty string values', () => {
      cache.set('empty', '')
      expect(cache.get('empty')).toBe('')
    })

    it('should handle zero values', () => {
      const numberCache = new MemoryCache<number>(1000)
      numberCache.set('zero', 0)
      expect(numberCache.get('zero')).toBe(0)
    })

    it('should handle null values', () => {
      const nullableCache = new MemoryCache<string | null>(1000)
      nullableCache.set('null', null)
      expect(nullableCache.get('null')).toBeNull()
    })
  })
})

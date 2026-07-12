import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConversionCache, conversionCache } from '@/lib/cache/conversion-cache'
import type { AccountMapping } from '@/types/conversion'

function makeMapping(overrides: Partial<AccountMapping> = {}): AccountMapping {
  return {
    id: 'mapping-1',
    sourceAccountId: 'src-acct-1',
    sourceAccountCode: '1000',
    sourceAccountName: '現金',
    targetAccountId: 'tgt-acct-1',
    targetAccountCode: '1010',
    targetAccountName: 'Cash',
    mappingType: '1to1',
    confidence: 0.92,
    isManualReview: false,
    ...overrides,
  }
}

describe('ConversionCache', () => {
  let cache: ConversionCache

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new ConversionCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('singleton', () => {
    it('exports a ConversionCache instance', () => {
      expect(conversionCache).toBeInstanceOf(ConversionCache)
    })
  })

  describe('mapping cache', () => {
    it('returns null when no mapping is cached', () => {
      expect(cache.getMapping('1000', 'coa-1')).toBeNull()
    })

    it('stores and retrieves a mapping by sourceCode + targetCoaId', () => {
      const mapping = makeMapping()
      cache.setMapping('1000', 'coa-1', mapping)
      expect(cache.getMapping('1000', 'coa-1')).toEqual(mapping)
    })

    it('caches a negative result (null) distinctly from "uncached"', () => {
      cache.setMapping('1000', 'coa-1', null)
      expect(cache.getMapping('1000', 'coa-1')).toBeNull()
    })

    it('isolates mappings by sourceCode', () => {
      cache.setMapping('1000', 'coa-1', makeMapping({ id: 'm-1000' }))
      cache.setMapping('2000', 'coa-1', makeMapping({ id: 'm-2000' }))
      expect(cache.getMapping('1000', 'coa-1')?.id).toBe('m-1000')
      expect(cache.getMapping('2000', 'coa-1')?.id).toBe('m-2000')
    })

    it('isolates mappings by targetCoaId', () => {
      cache.setMapping('1000', 'coa-1', makeMapping({ id: 'm-a' }))
      cache.setMapping('1000', 'coa-2', makeMapping({ id: 'm-b' }))
      expect(cache.getMapping('1000', 'coa-1')?.id).toBe('m-a')
      expect(cache.getMapping('1000', 'coa-2')?.id).toBe('m-b')
    })

    it('overwrites a previously cached mapping', () => {
      cache.setMapping('1000', 'coa-1', makeMapping({ confidence: 0.1 }))
      cache.setMapping('1000', 'coa-1', makeMapping({ confidence: 0.9 }))
      expect(cache.getMapping('1000', 'coa-1')?.confidence).toBe(0.9)
    })

    it('expires mappings after the mapping TTL (300000ms)', () => {
      cache.setMapping('1000', 'coa-1', makeMapping())
      expect(cache.getMapping('1000', 'coa-1')).not.toBeNull()

      vi.advanceTimersByTime(300001)
      expect(cache.getMapping('1000', 'coa-1')).toBeNull()
    })

    it('still serves a mapping just before its TTL elapses', () => {
      cache.setMapping('1000', 'coa-1', makeMapping())
      vi.advanceTimersByTime(300000)
      expect(cache.getMapping('1000', 'coa-1')).not.toBeNull()
    })
  })

  describe('target account cache', () => {
    const account = {
      id: 'acct-1',
      code: '1010',
      name: '現金',
      nameEn: 'Cash',
      category: 'current_asset',
    }

    it('returns null when no target account is cached', () => {
      expect(cache.getTargetAccount('coa-1', '1010')).toBeNull()
    })

    it('stores and retrieves a target account by coaId + code', () => {
      cache.setTargetAccount('coa-1', '1010', account)
      expect(cache.getTargetAccount('coa-1', '1010')).toEqual(account)
    })

    it('isolates target accounts by coaId and code', () => {
      cache.setTargetAccount('coa-1', '1010', account)
      cache.setTargetAccount('coa-2', '1010', { ...account, id: 'acct-2' })
      cache.setTargetAccount('coa-1', '2020', { ...account, id: 'acct-3' })
      expect(cache.getTargetAccount('coa-1', '1010')?.id).toBe('acct-1')
      expect(cache.getTargetAccount('coa-2', '1010')?.id).toBe('acct-2')
      expect(cache.getTargetAccount('coa-1', '2020')?.id).toBe('acct-3')
    })

    it('expires target accounts after 600000ms', () => {
      cache.setTargetAccount('coa-1', '1010', account)
      vi.advanceTimersByTime(600001)
      expect(cache.getTargetAccount('coa-1', '1010')).toBeNull()
    })
  })

  describe('cash flow mapping cache', () => {
    it('returns null when no cash flow mapping is cached', () => {
      expect(cache.getCashFlowMapping('co-1', '1000')).toBeNull()
    })

    it.each(['operating', 'investing', 'financing'] as const)(
      'stores and retrieves the %s section',
      (section) => {
        cache.setCashFlowMapping('co-1', '1000', { section })
        expect(cache.getCashFlowMapping('co-1', '1000')).toEqual({ section })
      }
    )

    it('isolates cash flow mappings by company and account code', () => {
      cache.setCashFlowMapping('co-1', '1000', { section: 'operating' })
      cache.setCashFlowMapping('co-2', '1000', { section: 'financing' })
      expect(cache.getCashFlowMapping('co-1', '1000')?.section).toBe('operating')
      expect(cache.getCashFlowMapping('co-2', '1000')?.section).toBe('financing')
    })

    it('expires cash flow mappings after 600000ms', () => {
      cache.setCashFlowMapping('co-1', '1000', { section: 'operating' })
      vi.advanceTimersByTime(600001)
      expect(cache.getCashFlowMapping('co-1', '1000')).toBeNull()
    })
  })

  describe('clearAll', () => {
    it('removes entries from every sub-cache', () => {
      cache.setMapping('1000', 'coa-1', makeMapping())
      cache.setTargetAccount('coa-1', '1010', {
        id: 'a',
        code: '1010',
        name: 'n',
        nameEn: 'e',
        category: 'c',
      })
      cache.setCashFlowMapping('co-1', '1000', { section: 'operating' })

      cache.clearAll()

      expect(cache.getMapping('1000', 'coa-1')).toBeNull()
      expect(cache.getTargetAccount('coa-1', '1010')).toBeNull()
      expect(cache.getCashFlowMapping('co-1', '1000')).toBeNull()
      const stats = cache.getStats()
      expect(stats.mappingCache.size).toBe(0)
      expect(stats.targetAccountCache.size).toBe(0)
      expect(stats.cashFlowMappingCache.size).toBe(0)
    })
  })

  describe('getStats', () => {
    it('reports per-cache size and valid (non-expired) keys', () => {
      cache.setMapping('1000', 'coa-1', makeMapping())
      cache.setMapping('2000', 'coa-1', makeMapping())
      cache.setTargetAccount('coa-1', '1010', {
        id: 'a',
        code: '1010',
        name: 'n',
        nameEn: 'e',
        category: 'c',
      })

      const stats = cache.getStats()

      expect(stats.mappingCache.size).toBe(2)
      expect(stats.mappingCache.keys).toContain('mapping:1000:coa-1')
      expect(stats.mappingCache.keys).toContain('mapping:2000:coa-1')
      expect(stats.targetAccountCache.size).toBe(1)
      expect(stats.targetAccountCache.keys).toContain('targetAccount:coa-1:1010')
      expect(stats.cashFlowMappingCache.size).toBe(0)
      expect(stats.cashFlowMappingCache.keys).toEqual([])
    })

    it('keeps the three sub-caches independent', () => {
      cache.setMapping('1000', 'coa-1', makeMapping())
      cache.setTargetAccount('coa-1', '1010', {
        id: 'a',
        code: '1010',
        name: 'n',
        nameEn: 'e',
        category: 'c',
      })

      const stats = cache.getStats()

      expect(stats.mappingCache.keys).not.toContain('targetAccount:coa-1:1010')
      expect(stats.targetAccountCache.keys).not.toContain('mapping:1000:coa-1')
    })
  })

  describe('edge cases and fail-safe behavior', () => {
    it('round-trips entries when key components are empty strings', () => {
      cache.setMapping('', '', makeMapping())
      expect(cache.getMapping('', '')).toEqual(makeMapping())

      const acct = { id: 'a', code: '', name: '', nameEn: '', category: '' }
      cache.setTargetAccount('', '', acct)
      expect(cache.getTargetAccount('', '')).toEqual(acct)

      cache.setCashFlowMapping('', '', { section: 'financing' })
      expect(cache.getCashFlowMapping('', '')).toEqual({ section: 'financing' })
    })

    it('reports an empty snapshot via getStats on a fresh cache', () => {
      const stats = cache.getStats()
      expect(stats.mappingCache.size).toBe(0)
      expect(stats.mappingCache.keys).toEqual([])
      expect(stats.targetAccountCache.size).toBe(0)
      expect(stats.targetAccountCache.keys).toEqual([])
      expect(stats.cashFlowMappingCache.size).toBe(0)
      expect(stats.cashFlowMappingCache.keys).toEqual([])
    })

    it('can be repopulated after clearAll', () => {
      cache.setMapping('1000', 'coa-1', makeMapping({ id: 'before' }))
      cache.clearAll()
      cache.setMapping('1000', 'coa-1', makeMapping({ id: 'after' }))
      expect(cache.getMapping('1000', 'coa-1')?.id).toBe('after')
    })

    it('serves a target account up to the exact TTL boundary (600000ms)', () => {
      const acct = { id: 'a', code: '1010', name: 'n', nameEn: 'e', category: 'c' }
      cache.setTargetAccount('coa-1', '1010', acct)
      vi.advanceTimersByTime(600000)
      expect(cache.getTargetAccount('coa-1', '1010')).toEqual(acct)
    })

    it('serves a cash flow mapping up to the exact TTL boundary (600000ms)', () => {
      cache.setCashFlowMapping('co-1', '1000', { section: 'operating' })
      vi.advanceTimersByTime(600000)
      expect(cache.getCashFlowMapping('co-1', '1000')).toEqual({ section: 'operating' })
    })

    // Characterization: getStats().size reads the raw Map size and does not lazily
    // evict expired entries, while keys() filters them out. After the TTL elapses
    // without a get(), size can therefore exceed keys.length.
    it('getStats size counts expired-but-unread entries while keys excludes them', () => {
      cache.setMapping('1000', 'coa-1', makeMapping())

      vi.advanceTimersByTime(300001)

      const stats = cache.getStats()
      expect(stats.mappingCache.size).toBe(1)
      expect(stats.mappingCache.keys).toEqual([])
    })

    // Characterization: keys are built with ':' as a delimiter, so arguments that
    // contain a ':' can collide. Both lookups below resolve to the same key.
    it('collides when key components contain the ":" delimiter', () => {
      cache.setMapping('a', 'b:c', makeMapping({ id: 'first' }))
      cache.setMapping('a:b', 'c', makeMapping({ id: 'second' }))

      expect(cache.getMapping('a', 'b:c')?.id).toBe('second')
      expect(cache.getMapping('a:b', 'c')?.id).toBe('second')
    })
  })
})

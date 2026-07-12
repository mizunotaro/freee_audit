import { describe, it, expect, afterEach, vi } from 'vitest'
import { createExternalInfoService, BaseInfoSource, resetInfoCache } from '@/services/external-info'
import type {
  ExternalInfoItem,
  ExternalInfoQuery,
  ExternalInfoResult,
  ExternalInfoServiceResult,
} from '@/services/external-info/types'

function makeItem(overrides: Partial<ExternalInfoItem> = {}): ExternalInfoItem {
  return {
    id: overrides.id ?? 'id',
    source: overrides.source ?? 'mock',
    category: overrides.category ?? 'general',
    title: overrides.title ?? 'title',
    summary: overrides.summary ?? '',
    content: overrides.content ?? '',
    tags: overrides.tags ?? [],
    relevanceScore: overrides.relevanceScore ?? 0.5,
    fetchedAt: overrides.fetchedAt ?? new Date(),
  }
}

// A controllable source used to drive merge/dedup/sort branches that the
// fixed mock-data source cannot exercise on its own.
class FakeSource extends BaseInfoSource {
  readonly sourceId = 'mof'
  readonly displayName = 'Fake Source'
  private items: ExternalInfoItem[]

  constructor(items: ExternalInfoItem[], enabled = true) {
    super({
      id: 'mof',
      name: 'Fake Source',
      description: '',
      enabled,
      priority: 1,
      timeoutMs: 1000,
      maxRetries: 0,
      retryDelayMs: 0,
      cacheTtlMs: 1000,
    })
    this.items = items
  }

  async fetch(_query: ExternalInfoQuery): Promise<ExternalInfoResult> {
    return {
      success: true,
      items: this.items,
      totalFound: this.items.length,
      source: this.sourceId,
      fetchedAt: new Date(),
      latencyMs: 1,
    }
  }
}

describe('ExternalInfoService — edge branches', () => {
  afterEach(() => {
    resetInfoCache()
  })

  describe('fetch — input validation', () => {
    it('rejects a whitespace-only query as invalid_query', async () => {
      const service = createExternalInfoService({
        enabledSources: ['mock'],
        useCache: false,
      })
      const result = await service.fetch({ query: '   \t  ' })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('invalid_query')
    })

    it('rejects an explicit source list when none of the sources are enabled', async () => {
      const service = createExternalInfoService({
        enabledSources: ['mock'],
        useCache: false,
      })
      // 'nta' is a valid id but was not enabled at construction time.
      const result = await service.fetch({ query: '税制', sources: ['nta'] })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('no_sources')
    })
  })

  describe('fetch — no results', () => {
    it('returns no_results when sources yield no matching items', async () => {
      const service = createExternalInfoService({
        enabledSources: ['mock'],
        useCache: false,
      })
      const result = await service.fetch({ query: 'zzzqqqxx-no-such-term' })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('no_results')
    })
  })

  describe('fetch — cache', () => {
    it('serves the second identical query from cache without re-calling the source', async () => {
      resetInfoCache()
      const service = createExternalInfoService({
        enabledSources: ['mock'],
        useCache: true,
      })
      const mockSource = service.getSource('mock')
      expect(mockSource).toBeDefined()
      const fetchSpy = vi.spyOn(mockSource!, 'fetch')

      const query: ExternalInfoQuery = { query: '税制改正', limit: 5 }
      const first = await service.fetch(query)
      const second = await service.fetch(query)

      expect(first.success).toBe(true)
      expect(second.success).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      if (first.success && second.success) {
        expect(second.data.map((i) => i.id)).toEqual(first.data.map((i) => i.id))
      }
    })
  })

  describe('mergeResults — dedup and ordering', () => {
    it('keeps the higher-relevance duplicate and sorts by relevance desc', async () => {
      const service = createExternalInfoService({
        enabledSources: [],
        useCache: false,
      })
      const items = [
        makeItem({ id: 'low', source: 'mock', title: 'Same Title', relevanceScore: 0.5 }),
        makeItem({ id: 'high', source: 'mock', title: 'Same Title', relevanceScore: 0.9 }),
        makeItem({ id: 'other', source: 'mock', title: 'Other Title', relevanceScore: 0.7 }),
      ]
      service.addSource(new FakeSource(items))

      const result: ExternalInfoServiceResult<ExternalInfoItem[]> = await service.fetch({
        query: 'anything',
        sources: ['mof'],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // duplicate title collapsed to the higher-scoring entry, then sorted desc
        expect(result.data).toHaveLength(2)
        expect(result.data[0].id).toBe('high')
        expect(result.data[0].relevanceScore).toBe(0.9)
        expect(result.data[1].id).toBe('other')
        expect(result.data[1].relevanceScore).toBe(0.7)
      }
    })

    it('returns no_results when the only source returns zero items', async () => {
      const service = createExternalInfoService({
        enabledSources: [],
        useCache: false,
      })
      service.addSource(new FakeSource([]))

      const result = await service.fetch({ query: 'anything', sources: ['mof'] })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('no_results')
    })
  })

  describe('source registry', () => {
    it('removeSource drops a registered source and resolves it away', async () => {
      const service = createExternalInfoService({
        enabledSources: [],
        useCache: false,
      })
      service.addSource(new FakeSource([makeItem({ id: 'x', relevanceScore: 0.9 })]))
      expect(service.getSource('mof')).toBeDefined()

      const removed = service.removeSource('mof')
      expect(removed).toBe(true)
      expect(service.getSource('mof')).toBeUndefined()

      const result = await service.fetch({ query: 'anything', sources: ['mof'] })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('no_sources')
    })

    it('skips sources that are configured disabled when resolving', async () => {
      const service = createExternalInfoService({
        enabledSources: [],
        useCache: false,
      })
      service.addSource(new FakeSource([makeItem({ id: 'x', relevanceScore: 0.9 })], false))
      // source exists in the registry but isEnabled() is false
      expect(service.getSource('mof')).toBeDefined()
      const result = await service.fetch({ query: 'anything', sources: ['mof'] })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.code).toBe('no_sources')
    })
  })
})

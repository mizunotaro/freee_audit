import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExternalInfoService, createExternalInfoService } from '@/services/external-info'
import type { ExternalInfoQuery } from '@/services/external-info/types'

describe('ExternalInfoService', () => {
  let service: ExternalInfoService

  beforeEach(() => {
    service = createExternalInfoService({
      enabledSources: ['mock'],
      useCache: false,
    })
  })

  describe('fetch', () => {
    it('should return success with items for valid query', async () => {
      const query: ExternalInfoQuery = {
        query: '税制改正',
        limit: 5,
      }

      const result = await service.fetch(query)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0)
        expect(result.data[0].source).toBe('mock')
      }
    })

    it('should return error for empty query', async () => {
      const query: ExternalInfoQuery = {
        query: '',
      }

      const result = await service.fetch(query)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_query')
      }
    })

    it('should filter by categories', async () => {
      const query: ExternalInfoQuery = {
        query: '税制',
        categories: ['tax_law'],
        limit: 10,
      }

      const result = await service.fetch(query)

      expect(result.success).toBe(true)
      if (result.success) {
        result.data.forEach((item) => {
          expect(item.category).toBe('tax_law')
        })
      }
    })

    it('should limit results', async () => {
      const query: ExternalInfoQuery = {
        query: '保険',
        limit: 2,
      }

      const result = await service.fetch(query)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBeLessThanOrEqual(2)
      }
    })

    it('should return error when no sources available', async () => {
      const emptyService = createExternalInfoService({
        enabledSources: [],
        useCache: false,
      })

      const query: ExternalInfoQuery = {
        query: 'test',
      }

      const result = await emptyService.fetch(query)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('no_sources')
      }
    })
  })

  describe('source management', () => {
    it('should return enabled sources', () => {
      const enabledSources = service.getEnabledSources()
      expect(enabledSources).toContain('mock')
    })

    it('should get source by id', () => {
      const source = service.getSource('mock')
      expect(source).toBeDefined()
      expect(source?.sourceId).toBe('mock')
    })

    it('should return undefined for unknown source', () => {
      const source = service.getSource('mof' as 'mock')
      expect(source).toBeUndefined()
    })
  })

  describe('cache', () => {
    it('should return cache stats', () => {
      const stats = service.getCacheStats()
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('hitRate')
    })
  })
})

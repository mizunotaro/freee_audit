import { describe, it, expect, beforeEach } from 'vitest'
import { MockInfoSource } from '@/services/external-info/sources/mock-source'
import type { ExternalInfoQuery } from '@/services/external-info/types'

describe('MockInfoSource', () => {
  let source: MockInfoSource

  beforeEach(() => {
    source = new MockInfoSource({
      customConfig: {
        simulateDelay: false,
      },
    })
  })

  describe('fetch', () => {
    it('should return mock data', async () => {
      const query: ExternalInfoQuery = {
        query: '税制',
        limit: 10,
      }

      const result = await source.fetch(query)

      expect(result.success).toBe(true)
      expect(result.source).toBe('mock')
      expect(result.items.length).toBeGreaterThan(0)
    })

    it('should filter by categories', async () => {
      const query: ExternalInfoQuery = {
        query: '',
        categories: ['tax_law'],
        limit: 10,
      }

      const result = await source.fetch(query)

      expect(result.success).toBe(true)
      result.items.forEach((item) => {
        expect(item.category).toBe('tax_law')
      })
    })

    it('should calculate relevance score based on query', async () => {
      const query: ExternalInfoQuery = {
        query: '2024年度税制改正',
        limit: 10,
      }

      const result = await source.fetch(query)

      expect(result.success).toBe(true)
      expect(result.items.length).toBeGreaterThan(0)
      expect(result.items[0].relevanceScore).toBeGreaterThan(0)
    })

    it('should limit results', async () => {
      const query: ExternalInfoQuery = {
        query: '',
        limit: 1,
      }

      const result = await source.fetch(query)

      expect(result.success).toBe(true)
      expect(result.items.length).toBeLessThanOrEqual(1)
    })

    it('should filter by date range', async () => {
      const query: ExternalInfoQuery = {
        query: '',
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-12-31'),
        limit: 10,
      }

      const result = await source.fetch(query)

      expect(result.success).toBe(true)
      result.items.forEach((item) => {
        if (item.publishedAt) {
          expect(item.publishedAt >= new Date('2024-01-01')).toBe(true)
          expect(item.publishedAt <= new Date('2024-12-31')).toBe(true)
        }
      })
    })

    it('should filter by minimum relevance', async () => {
      const query: ExternalInfoQuery = {
        query: '税制',
        minRelevance: 0.5,
        limit: 10,
      }

      const result = await source.fetch(query)

      expect(result.success).toBe(true)
      result.items.forEach((item) => {
        expect(item.relevanceScore).toBeGreaterThanOrEqual(0.5)
      })
    })
  })

  describe('config', () => {
    it('should return correct source id', () => {
      expect(source.sourceId).toBe('mock')
    })

    it('should return display name', () => {
      expect(source.displayName).toBe('Mock Data Source')
    })

    it('should be enabled by default', () => {
      expect(source.isEnabled()).toBe(true)
    })
  })

  describe('health', () => {
    it('should track health status', async () => {
      const query: ExternalInfoQuery = {
        query: 'test',
        limit: 1,
      }

      await source.fetch(query)
      const health = source.getHealth()

      expect(health.sourceId).toBe('mock')
      expect(health.status).toBe('active')
      expect(health.consecutiveFailures).toBe(0)
    })
  })
})

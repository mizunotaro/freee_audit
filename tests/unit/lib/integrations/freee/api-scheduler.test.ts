import { describe, it, expect, vi, beforeEach } from 'vitest'
import { freeeApiScheduler } from '@/lib/integrations/freee/api-scheduler'
import { CATEGORY_QUOTA_COST, PRIORITY_WEIGHTS } from '@/lib/integrations/freee/quota-manager'
import type {
  ApiCallRequest,
  ApiCallPriority,
  ApiCallCategory,
} from '@/lib/integrations/freee/quota-manager'

vi.mock('@/lib/integrations/freee/quota-manager', () => ({
  freeeApiQuotaManager: {
    getQuotaStatus: vi.fn().mockReturnValue({
      plan: 'advice',
      dailyLimit: 5000,
      usedToday: 0,
      remaining: 5000,
      utilizationRate: 0,
      resetAt: new Date(),
    }),
    getQuotaStatusForTest: vi.fn(),
  },
  CATEGORY_QUOTA_COST: {
    auth: 0,
    companies: 1,
    account_items: 1,
    journals: 1,
    deals: 1,
    documents: 1,
    receipts: 1,
    trial_balance: 2,
    reports: 2,
  },
  PRIORITY_WEIGHTS: {
    critical: 100,
    high: 75,
    normal: 50,
    low: 25,
    background: 10,
  },
}))

describe('FreeeApiScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    freeeApiScheduler.clearPendingBatches()
  })

  describe('createBatch', () => {
    it('should create a batch with requests', () => {
      const batch = freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
        {
          companyId: 'company1',
          endpoint: '/api/1/deals',
          method: 'GET',
          priority: 'high',
          category: 'deals',
          maxRetries: 3,
        },
      ])

      expect(batch.id).toBeTruthy()
      expect(batch.requests).toHaveLength(2)
      expect(batch.companyId).toBe('company1')
      expect(batch.estimatedQuotaCost).toBe(2)
    })

    it('should assign IDs to requests', () => {
      const batch = freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      expect(batch.requests[0].id).toBeTruthy()
      expect(batch.requests[0].createdAt).toBeInstanceOf(Date)
      expect(batch.requests[0].retryCount).toBe(0)
    })

    it('should calculate estimated quota cost', () => {
      const batch = freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
        {
          companyId: 'company1',
          endpoint: '/api/1/trial_balance',
          method: 'GET',
          priority: 'normal',
          category: 'trial_balance',
          maxRetries: 3,
        },
      ])

      expect(batch.estimatedQuotaCost).toBe(3)
    })

    it('should use default priority when not specified', () => {
      const batch = freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      expect(batch.priority).toBe('normal')
    })

    it('should determine batch category from request categories', () => {
      const batch = freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/deals',
          method: 'GET',
          priority: 'normal',
          category: 'deals',
          maxRetries: 3,
        },
      ])

      expect(batch.category).toBe('deals')
    })

    it('should use default maxRetries when not provided', () => {
      const batch = freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      expect(batch.requests[0].maxRetries).toBe(3)
    })
  })

  describe('planSchedule', () => {
    it('should plan schedule for batches', () => {
      freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      const plan = freeeApiScheduler.planSchedule('company1')

      expect(plan.companyId).toBe('company1')
      expect(plan.totalCalls).toBe(1)
      expect(plan.quotaAvailable).toBe(5000)
      expect(plan.batches).toHaveLength(1)
      expect(plan.estimatedDuration).toBeGreaterThan(0)
      expect(plan.warnings).toEqual([])
    })

    it('should return empty plan when no pending batches', () => {
      const plan = freeeApiScheduler.planSchedule('company1')

      expect(plan.totalCalls).toBe(0)
      expect(plan.batches).toHaveLength(0)
    })

    it('should sort batches by priority', () => {
      freeeApiScheduler.createBatch(
        'company1',
        [
          {
            companyId: 'company1',
            endpoint: '/api/1/journals',
            method: 'GET',
            priority: 'normal',
            category: 'journals',
            maxRetries: 3,
          },
        ],
        'normal'
      )

      freeeApiScheduler.createBatch(
        'company1',
        [
          {
            companyId: 'company1',
            endpoint: '/api/1/journals',
            method: 'GET',
            priority: 'high',
            category: 'journals',
            maxRetries: 3,
          },
        ],
        'high'
      )

      const plan = freeeApiScheduler.planSchedule('company1')

      expect(plan.batches[0].id).toBeTruthy()
    })

    it('should calculate estimated duration based on call count', () => {
      freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      const plan = freeeApiScheduler.planSchedule('company1')
      expect(plan.estimatedDuration).toBe(400)
    })
  })

  describe('optimizeBatchOrder', () => {
    it('should group and order requests by category priority', () => {
      const requests: ApiCallRequest[] = [
        {
          id: '1',
          companyId: 'company1',
          endpoint: '/api/journals',
          method: 'GET',
          priority: 'normal',
          category: 'reports',
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
        {
          id: '2',
          companyId: 'company1',
          endpoint: '/api/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
        {
          id: '3',
          companyId: 'company1',
          endpoint: '/api/companies',
          method: 'GET',
          priority: 'high',
          category: 'companies',
          createdAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
        },
      ]

      const optimized = freeeApiScheduler.optimizeBatchOrder(requests)

      expect(optimized[0].category).toBe('companies')
      expect(optimized[1].category).toBe('journals')
      expect(optimized[2].category).toBe('reports')
    })

    it('should handle empty requests array', () => {
      const result = freeeApiScheduler.optimizeBatchOrder([])
      expect(result).toEqual([])
    })
  })

  describe('getPendingBatchCount', () => {
    it('should return 0 when no batches', () => {
      expect(freeeApiScheduler.getPendingBatchCount('company1')).toBe(0)
    })

    it('should return count of pending batches', () => {
      freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      expect(freeeApiScheduler.getPendingBatchCount('company1')).toBe(1)
    })
  })

  describe('getNextBatch', () => {
    it('should return null when no batches', () => {
      expect(freeeApiScheduler.getNextBatch('company1')).toBeNull()
    })

    it('should return highest priority batch', () => {
      freeeApiScheduler.createBatch(
        'company1',
        [
          {
            companyId: 'company1',
            endpoint: '/api/1/journals',
            method: 'GET',
            priority: 'normal',
            category: 'journals',
            maxRetries: 3,
          },
        ],
        'normal'
      )

      freeeApiScheduler.createBatch(
        'company1',
        [
          {
            companyId: 'company1',
            endpoint: '/api/1/journals',
            method: 'GET',
            priority: 'critical',
            category: 'journals',
            maxRetries: 3,
          },
        ],
        'critical'
      )

      const next = freeeApiScheduler.getNextBatch('company1')
      expect(next).not.toBeNull()
      expect(next!.priority).toBe('critical')
    })
  })

  describe('removeBatch', () => {
    it('should remove a batch by id', () => {
      const batch = freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      expect(freeeApiScheduler.removeBatch('company1', batch.id)).toBe(true)
      expect(freeeApiScheduler.getPendingBatchCount('company1')).toBe(0)
    })

    it('should return false for non-existent batch', () => {
      expect(freeeApiScheduler.removeBatch('company1', 'non-existent')).toBe(false)
    })

    it('should return false for non-existent company', () => {
      expect(freeeApiScheduler.removeBatch('unknown', 'any')).toBe(false)
    })
  })

  describe('clearPendingBatches', () => {
    it('should clear batches for specific company', () => {
      freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])
      freeeApiScheduler.createBatch('company2', [
        {
          companyId: 'company2',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      freeeApiScheduler.clearPendingBatches('company1')

      expect(freeeApiScheduler.getPendingBatchCount('company1')).toBe(0)
      expect(freeeApiScheduler.getPendingBatchCount('company2')).toBe(1)
    })

    it('should clear all batches when no company specified', () => {
      freeeApiScheduler.createBatch('company1', [
        {
          companyId: 'company1',
          endpoint: '/api/1/journals',
          method: 'GET',
          priority: 'normal',
          category: 'journals',
          maxRetries: 3,
        },
      ])

      freeeApiScheduler.clearPendingBatches()
      expect(freeeApiScheduler.getPendingBatchCount('company1')).toBe(0)
    })
  })

  describe('getBatchStatus', () => {
    it('should return status for empty batches', () => {
      const status = freeeApiScheduler.getBatchStatus('company1')
      expect(status.pending).toBe(0)
      expect(status.totalCalls).toBe(0)
      expect(status.estimatedQuotaCost).toBe(0)
    })

    it('should return aggregated status', () => {
      freeeApiScheduler.createBatch(
        'company1',
        [
          {
            companyId: 'company1',
            endpoint: '/api/1/journals',
            method: 'GET',
            priority: 'normal',
            category: 'journals',
            maxRetries: 3,
          },
          {
            companyId: 'company1',
            endpoint: '/api/1/journals',
            method: 'GET',
            priority: 'high',
            category: 'journals',
            maxRetries: 3,
          },
        ],
        'high'
      )

      const status = freeeApiScheduler.getBatchStatus('company1')
      expect(status.pending).toBe(1)
      expect(status.totalCalls).toBe(2)
      expect(status.estimatedQuotaCost).toBe(2)
      expect(status.byPriority.high).toBe(1)
    })
  })
})

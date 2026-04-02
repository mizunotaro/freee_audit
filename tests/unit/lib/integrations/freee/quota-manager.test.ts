import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  freeeApiQuotaManager,
  prioritizeApiCall,
  PRIORITY_WEIGHTS,
  CATEGORY_QUOTA_COST,
  RECOMMENDED_DAILY_ALLOCATION,
} from '@/lib/integrations/freee/quota-manager'

describe('FreeeApiQuotaManager', () => {
  const testCompany = 'test-company-quota-mgr'

  beforeEach(() => {
    freeeApiQuotaManager.clearQueue(testCompany)
    freeeApiQuotaManager.setPlan(testCompany, 'advice')
  })

  describe('setPlan', () => {
    it('should set plan for a company', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'enterprise')
      const status = freeeApiQuotaManager.getQuotaStatus(testCompany)
      expect(status.plan).toBe('enterprise')
      expect(status.dailyLimit).toBe(10000)
    })

    it('should use default plan when not set', () => {
      const status = freeeApiQuotaManager.getQuotaStatus('unknown-company-xyz')
      expect(status.plan).toBe('advice')
    })
  })

  describe('getQuotaStatus', () => {
    it('should return quota status with defaults', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      const status = freeeApiQuotaManager.getQuotaStatus(testCompany)
      expect(status.dailyLimit).toBe(5000)
      expect(status.usedToday).toBe(0)
      expect(status.remaining).toBe(5000)
      expect(status.utilizationRate).toBe(0)
      expect(status.resetAt).toBeInstanceOf(Date)
    })

    it('should reflect usage in status', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      freeeApiQuotaManager.recordUsage(testCompany, 'journals', 10)
      const status = freeeApiQuotaManager.getQuotaStatus(testCompany)
      expect(status.usedToday).toBe(10)
      expect(status.remaining).toBe(4990)
    })
  })

  describe('canMakeCall', () => {
    it('should always allow auth calls', () => {
      expect(freeeApiQuotaManager.canMakeCall(testCompany, 'auth')).toBe(true)
    })

    it('should allow calls when quota available', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      expect(freeeApiQuotaManager.canMakeCall(testCompany, 'journals')).toBe(true)
    })
  })

  describe('reserveQuota', () => {
    it('should reserve quota when available', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      expect(freeeApiQuotaManager.reserveQuota(testCompany, 100)).toBe(true)
    })

    it('should fail when not enough quota', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'starter')
      expect(freeeApiQuotaManager.reserveQuota(testCompany, 5000)).toBe(false)
    })
  })

  describe('releaseReservedQuota', () => {
    it('should release reserved quota', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      freeeApiQuotaManager.reserveQuota(testCompany, 100)
      freeeApiQuotaManager.releaseReservedQuota(testCompany, 50)
      const status = freeeApiQuotaManager.getQuotaStatus(testCompany)
      expect(status.remaining).toBe(4940)
    })
  })

  describe('recordUsage', () => {
    it('should track usage', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      freeeApiQuotaManager.recordUsage(testCompany, 'journals', 5)
      const status = freeeApiQuotaManager.getQuotaStatus(testCompany)
      expect(status.usedToday).toBeGreaterThanOrEqual(5)
    })

    it('should account for category cost multiplier', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      freeeApiQuotaManager.recordUsage(testCompany, 'trial_balance', 3)
      const status = freeeApiQuotaManager.getQuotaStatus(testCompany)
      expect(status.usedToday).toBeGreaterThanOrEqual(6)
    })
  })

  describe('enqueue / dequeue', () => {
    it('should enqueue a request and return id', () => {
      const id = freeeApiQuotaManager.enqueue({
        companyId: testCompany,
        endpoint: '/api/journals',
        method: 'GET',
        priority: 'normal',
        category: 'journals',
        maxRetries: 3,
      })
      expect(id).toBeTruthy()
      expect(freeeApiQuotaManager.getQueueLength(testCompany)).toBe(1)
    })

    it('should dequeue a request', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      freeeApiQuotaManager.enqueue({
        companyId: testCompany,
        endpoint: '/api/journals',
        method: 'GET',
        priority: 'normal',
        category: 'journals',
        maxRetries: 3,
      })
      const request = freeeApiQuotaManager.dequeue(testCompany)
      expect(request).not.toBeNull()
      expect(freeeApiQuotaManager.getQueueLength(testCompany)).toBe(0)
    })

    it('should return null when queue is empty', () => {
      expect(freeeApiQuotaManager.dequeue(testCompany)).toBeNull()
    })
  })

  describe('requeue', () => {
    it('should requeue a request', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      freeeApiQuotaManager.enqueue({
        companyId: testCompany,
        endpoint: '/api/journals',
        method: 'GET',
        priority: 'high',
        category: 'journals',
        maxRetries: 3,
      })
      const request = freeeApiQuotaManager.dequeue(testCompany)
      freeeApiQuotaManager.requeue(request!)
      expect(freeeApiQuotaManager.getQueueLength(testCompany)).toBe(1)
    })
  })

  describe('getQueueStats', () => {
    it('should return stats for empty queue', () => {
      const stats = freeeApiQuotaManager.getQueueStats(testCompany)
      expect(stats.total).toBe(0)
    })
  })

  describe('clearQueue', () => {
    it('should clear queue for a company', () => {
      freeeApiQuotaManager.enqueue({
        companyId: testCompany,
        endpoint: '/test',
        method: 'GET',
        priority: 'normal',
        category: 'journals',
        maxRetries: 3,
      })
      freeeApiQuotaManager.clearQueue(testCompany)
      expect(freeeApiQuotaManager.getQueueLength(testCompany)).toBe(0)
    })
  })

  describe('getOptimalBatchSize', () => {
    it('should return batch size within limits', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      const size = freeeApiQuotaManager.getOptimalBatchSize(testCompany, 'journals')
      expect(size).toBeLessThanOrEqual(100)
      expect(size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getRecommendedSchedule', () => {
    it('should return a schedule', () => {
      freeeApiQuotaManager.setPlan(testCompany, 'advice')
      const schedule = freeeApiQuotaManager.getRecommendedSchedule(testCompany)
      expect(schedule).toHaveProperty('immediateCalls')
      expect(schedule).toHaveProperty('deferredCalls')
      expect(schedule).toHaveProperty('suggestedDelay')
    })
  })

  describe('getCategoryUsage', () => {
    it('should return empty usage for unknown company', () => {
      const usage = freeeApiQuotaManager.getCategoryUsage('unknown-company-cat')
      expect(usage.journals).toBe(0)
    })
  })
})

describe('prioritizeApiCall', () => {
  it('should return critical when isCritical is true', () => {
    expect(prioritizeApiCall('journals', false, true)).toBe('critical')
  })

  it('should return critical for auth when user initiated', () => {
    expect(prioritizeApiCall('auth', true)).toBe('critical')
  })

  it('should return critical for companies when user initiated', () => {
    expect(prioritizeApiCall('companies', true)).toBe('critical')
  })

  it('should return high for journals when user initiated', () => {
    expect(prioritizeApiCall('journals', true)).toBe('high')
  })

  it('should return high for trial_balance when user initiated', () => {
    expect(prioritizeApiCall('trial_balance', true)).toBe('high')
  })

  it('should return normal for deals when user initiated', () => {
    expect(prioritizeApiCall('deals', true)).toBe('normal')
  })

  it('should return normal for journals when not user initiated', () => {
    expect(prioritizeApiCall('journals', false)).toBe('normal')
  })

  it('should return high for account_items when not user initiated', () => {
    expect(prioritizeApiCall('account_items', false)).toBe('high')
  })

  it('should return high for companies when not user initiated', () => {
    expect(prioritizeApiCall('companies', false)).toBe('high')
  })

  it('should return low for reports when not user initiated', () => {
    expect(prioritizeApiCall('reports', false)).toBe('low')
  })

  it('should return low for trial_balance when not user initiated', () => {
    expect(prioritizeApiCall('trial_balance', false)).toBe('low')
  })

  it('should return background for unknown categories when not user initiated', () => {
    expect(prioritizeApiCall('deals' as any, false)).toBe('background')
  })
})

describe('PRIORITY_WEIGHTS', () => {
  it('should have weights for all priorities', () => {
    expect(PRIORITY_WEIGHTS.critical).toBe(100)
    expect(PRIORITY_WEIGHTS.high).toBe(75)
    expect(PRIORITY_WEIGHTS.normal).toBe(50)
    expect(PRIORITY_WEIGHTS.low).toBe(25)
    expect(PRIORITY_WEIGHTS.background).toBe(10)
  })
})

describe('CATEGORY_QUOTA_COST', () => {
  it('should have cost 0 for auth', () => {
    expect(CATEGORY_QUOTA_COST.auth).toBe(0)
  })

  it('should have cost 1 for standard categories', () => {
    expect(CATEGORY_QUOTA_COST.journals).toBe(1)
    expect(CATEGORY_QUOTA_COST.deals).toBe(1)
    expect(CATEGORY_QUOTA_COST.documents).toBe(1)
  })

  it('should have cost 2 for heavy categories', () => {
    expect(CATEGORY_QUOTA_COST.trial_balance).toBe(2)
    expect(CATEGORY_QUOTA_COST.reports).toBe(2)
  })
})

describe('RECOMMENDED_DAILY_ALLOCATION', () => {
  it('should have 0 for auth', () => {
    expect(RECOMMENDED_DAILY_ALLOCATION.auth).toBe(0)
  })

  it('should have allocations for all categories', () => {
    expect(RECOMMENDED_DAILY_ALLOCATION.journals).toBe(1500)
    expect(RECOMMENDED_DAILY_ALLOCATION.companies).toBe(10)
    expect(RECOMMENDED_DAILY_ALLOCATION.account_items).toBe(50)
  })
})

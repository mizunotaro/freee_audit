import type { FreeePlanType } from '@/lib/integrations/freee/types'
import { FREEE_PLAN_DAILY_LIMITS } from '@/lib/integrations/freee/types'

export type ApiCallPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

export interface ApiCallRequest {
  id: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, unknown>
  body?: unknown
  priority: ApiCallPriority
  category: ApiCallCategory
  createdAt: Date
  retryCount: number
  maxRetries: number
  companyId: string
}

export type ApiCallCategory =
  | 'auth'
  | 'journals'
  | 'documents'
  | 'trial_balance'
  | 'account_items'
  | 'companies'
  | 'deals'
  | 'receipts'
  | 'reports'

export interface QuotaStatus {
  plan: FreeePlanType
  dailyLimit: number
  usedToday: number
  remaining: number
  resetAt: Date
  utilizationRate: number
}

export interface ScheduledCall {
  request: ApiCallRequest
  scheduledFor: Date
  estimatedQuotaCost: number
}

export const PRIORITY_WEIGHTS: Record<ApiCallPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  background: 10,
}

export const CATEGORY_QUOTA_COST: Record<ApiCallCategory, number> = {
  auth: 0,
  companies: 1,
  account_items: 1,
  journals: 1,
  deals: 1,
  documents: 1,
  receipts: 1,
  trial_balance: 2,
  reports: 2,
}

export const RECOMMENDED_DAILY_ALLOCATION: Record<ApiCallCategory, number> = {
  auth: 0,
  companies: 10,
  account_items: 50,
  journals: 1500,
  deals: 500,
  documents: 300,
  receipts: 200,
  trial_balance: 100,
  reports: 100,
}

class FreeeApiQuotaManager {
  private dailyUsage: Map<string, { count: number; date: string; plan: FreeePlanType }> = new Map()
  private callQueue: Map<string, ApiCallRequest[]> = new Map()
  private reservedQuota: Map<string, number> = new Map()
  private categoryUsage: Map<string, Record<ApiCallCategory, number>> = new Map()

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0]
  }

  private getTomorrowResetTime(): Date {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow
  }

  setPlan(companyId: string, plan: FreeePlanType): void {
    const today = this.getTodayString()
    const current = this.dailyUsage.get(companyId)

    if (current && current.date === today) {
      current.plan = plan
    } else {
      this.dailyUsage.set(companyId, { count: 0, date: today, plan })
    }
  }

  getQuotaStatus(companyId: string): QuotaStatus {
    const today = this.getTodayString()
    const usage = this.dailyUsage.get(companyId)
    const plan = usage?.plan || 'advice'
    const dailyLimit = FREEE_PLAN_DAILY_LIMITS[plan]

    const usedToday =
      (usage?.date === today ? usage.count : 0) + (this.reservedQuota.get(companyId) || 0)
    const remaining = Math.max(0, dailyLimit - usedToday)

    return {
      plan,
      dailyLimit,
      usedToday,
      remaining,
      resetAt: this.getTomorrowResetTime(),
      utilizationRate: dailyLimit > 0 ? usedToday / dailyLimit : 0,
    }
  }

  canMakeCall(companyId: string, category: ApiCallCategory, count: number = 1): boolean {
    if (category === 'auth') return true

    const status = this.getQuotaStatus(companyId)
    const cost = CATEGORY_QUOTA_COST[category] * count

    return status.remaining >= cost
  }

  reserveQuota(companyId: string, count: number): boolean {
    const status = this.getQuotaStatus(companyId)

    if (status.remaining < count) {
      return false
    }

    const current = this.reservedQuota.get(companyId) || 0
    this.reservedQuota.set(companyId, current + count)
    return true
  }

  releaseReservedQuota(companyId: string, count: number): void {
    const current = this.reservedQuota.get(companyId) || 0
    this.reservedQuota.set(companyId, Math.max(0, current - count))
  }

  recordUsage(companyId: string, category: ApiCallCategory, count: number = 1): void {
    const today = this.getTodayString()
    const usage = this.dailyUsage.get(companyId)
    const cost = CATEGORY_QUOTA_COST[category] * count

    if (usage && usage.date === today) {
      usage.count += cost
    } else {
      const plan = usage?.plan || 'advice'
      this.dailyUsage.set(companyId, { count: cost, date: today, plan })
    }

    const currentReserved = this.reservedQuota.get(companyId) || 0
    this.reservedQuota.set(companyId, Math.max(0, currentReserved - cost))

    const catUsage = this.categoryUsage.get(companyId) || this.createEmptyCategoryUsage()
    catUsage[category] += count
    this.categoryUsage.set(companyId, catUsage)
  }

  private createEmptyCategoryUsage(): Record<ApiCallCategory, number> {
    return {
      auth: 0,
      companies: 0,
      account_items: 0,
      journals: 0,
      deals: 0,
      documents: 0,
      receipts: 0,
      trial_balance: 0,
      reports: 0,
    }
  }

  getCategoryUsage(companyId: string): Record<ApiCallCategory, number> {
    return this.categoryUsage.get(companyId) || this.createEmptyCategoryUsage()
  }

  enqueue(request: Omit<ApiCallRequest, 'id' | 'createdAt' | 'retryCount'>): string {
    const id = `${request.companyId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const fullRequest: ApiCallRequest = {
      ...request,
      id,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: request.maxRetries ?? 3,
    }

    const companyQueue = this.callQueue.get(request.companyId) || []

    const insertIndex = this.findInsertIndex(companyQueue, fullRequest.priority)
    companyQueue.splice(insertIndex, 0, fullRequest)

    this.callQueue.set(request.companyId, companyQueue)
    return id
  }

  private findInsertIndex(queue: ApiCallRequest[], priority: ApiCallPriority): number {
    const priorityWeight = PRIORITY_WEIGHTS[priority]

    for (let i = 0; i < queue.length; i++) {
      if (PRIORITY_WEIGHTS[queue[i].priority] < priorityWeight) {
        return i
      }
    }
    return queue.length
  }

  dequeue(companyId: string): ApiCallRequest | null {
    const queue = this.callQueue.get(companyId)
    if (!queue || queue.length === 0) return null

    for (let i = 0; i < queue.length; i++) {
      const request = queue[i]
      const cost = CATEGORY_QUOTA_COST[request.category]

      if (this.canMakeCall(companyId, request.category, 1)) {
        queue.splice(i, 1)
        this.reserveQuota(companyId, cost)
        return request
      }
    }

    return null
  }

  requeue(request: ApiCallRequest): void {
    const updatedRequest: ApiCallRequest = {
      ...request,
      retryCount: request.retryCount + 1,
    }

    const companyQueue = this.callQueue.get(request.companyId) || []

    if (updatedRequest.retryCount < updatedRequest.maxRetries) {
      const lowerPriority = this.getLowerPriority(request.priority)
      if (lowerPriority) {
        updatedRequest.priority = lowerPriority
      }

      const insertIndex = this.findInsertIndex(companyQueue, updatedRequest.priority)
      companyQueue.splice(insertIndex, 0, updatedRequest)
      this.callQueue.set(request.companyId, companyQueue)
    }
  }

  private getLowerPriority(current: ApiCallPriority): ApiCallPriority | null {
    const levels: ApiCallPriority[] = ['critical', 'high', 'normal', 'low', 'background']
    const currentIndex = levels.indexOf(current)
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null
  }

  getQueueLength(companyId: string): number {
    return this.callQueue.get(companyId)?.length || 0
  }

  getQueueStats(companyId: string): {
    total: number
    byPriority: Record<ApiCallPriority, number>
    byCategory: Record<ApiCallCategory, number>
  } {
    const queue = this.callQueue.get(companyId) || []

    const byPriority: Record<ApiCallPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0,
    }

    const byCategory: Record<ApiCallCategory, number> = this.createEmptyCategoryUsage()

    queue.forEach((req) => {
      byPriority[req.priority]++
      byCategory[req.category]++
    })

    return { total: queue.length, byPriority, byCategory }
  }

  clearQueue(companyId: string): void {
    this.callQueue.delete(companyId)
    this.reservedQuota.delete(companyId)
  }

  getOptimalBatchSize(companyId: string, category: ApiCallCategory): number {
    const status = this.getQuotaStatus(companyId)
    const catUsage = this.getCategoryUsage(companyId)
    const recommendedAllocation = RECOMMENDED_DAILY_ALLOCATION[category]

    if (status.utilizationRate < 0.3) {
      return Math.min(100, status.remaining)
    }

    if (status.utilizationRate < 0.6) {
      const usedRatio = catUsage[category] / recommendedAllocation
      if (usedRatio < 0.5) {
        return Math.min(50, Math.floor(status.remaining * 0.3))
      }
      return Math.min(30, Math.floor(status.remaining * 0.2))
    }

    if (status.utilizationRate < 0.8) {
      return Math.min(20, Math.floor(status.remaining * 0.15))
    }

    return Math.min(10, Math.floor(status.remaining * 0.1))
  }

  getRecommendedSchedule(companyId: string): {
    immediateCalls: ApiCallCategory[]
    deferredCalls: ApiCallCategory[]
    suggestedDelay: number
  } {
    const status = this.getQuotaStatus(companyId)
    const catUsage = this.getCategoryUsage(companyId)

    const immediateCalls: ApiCallCategory[] = []
    const deferredCalls: ApiCallCategory[] = []

    for (const [category, recommended] of Object.entries(RECOMMENDED_DAILY_ALLOCATION)) {
      if (recommended === 0) continue

      const used = catUsage[category as ApiCallCategory] || 0
      const usageRatio = used / recommended

      if (usageRatio < 0.5 && status.utilizationRate < 0.7) {
        immediateCalls.push(category as ApiCallCategory)
      } else if (usageRatio < 0.8) {
        deferredCalls.push(category as ApiCallCategory)
      }
    }

    let suggestedDelay = 0
    if (status.utilizationRate > 0.7) {
      suggestedDelay = Math.floor((status.utilizationRate - 0.7) * 60000)
    }

    return { immediateCalls, deferredCalls, suggestedDelay }
  }
}

export const freeeApiQuotaManager = new FreeeApiQuotaManager()

export function prioritizeApiCall(
  category: ApiCallCategory,
  isUserInitiated: boolean = false,
  isCritical: boolean = false
): ApiCallPriority {
  if (isCritical) return 'critical'

  if (isUserInitiated) {
    switch (category) {
      case 'auth':
      case 'companies':
        return 'critical'
      case 'journals':
      case 'trial_balance':
        return 'high'
      default:
        return 'normal'
    }
  }

  switch (category) {
    case 'journals':
      return 'normal'
    case 'account_items':
    case 'companies':
      return 'high'
    case 'reports':
    case 'trial_balance':
      return 'low'
    default:
      return 'background'
  }
}

import type {
  ApiCallRequest,
  ApiCallPriority,
  ApiCallCategory,
  ScheduledCall,
} from './quota-manager'
import { freeeApiQuotaManager, CATEGORY_QUOTA_COST, PRIORITY_WEIGHTS } from './quota-manager'

export interface BatchRequest {
  id: string
  requests: ApiCallRequest[]
  priority: ApiCallPriority
  category: ApiCallCategory
  companyId: string
  createdAt: Date
  estimatedQuotaCost: number
}

export interface BatchResult {
  batchId: string
  successful: number
  failed: number
  skipped: number
  results: Array<{
    requestId: string
    success: boolean
    data?: unknown
    error?: string
  }>
  quotaUsed: number
  quotaRemaining: number
}

export interface SchedulePlan {
  companyId: string
  totalCalls: number
  quotaAvailable: number
  batches: ScheduledBatch[]
  estimatedDuration: number
  warnings: string[]
}

export interface ScheduledBatch {
  id: string
  calls: ApiCallRequest[]
  scheduledFor: Date
  estimatedQuotaCost: number
}

const MAX_BATCH_SIZE = 50
const MIN_CALL_INTERVAL_MS = 200
const HOUR_IN_MS = 60 * 60 * 1000

class FreeeApiScheduler {
  private pendingBatches: Map<string, BatchRequest[]> = new Map()
  private processingBatches: Map<string, BatchRequest> = new Map()
  private scheduledCalls: Map<string, ScheduledCall[]> = new Map()

  createBatch(
    companyId: string,
    requests: Omit<ApiCallRequest, 'id' | 'createdAt' | 'retryCount'>[],
    priority: ApiCallPriority = 'normal'
  ): BatchRequest {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const category = this.determineBatchCategory(requests.map((r) => r.category))

    const fullRequests: ApiCallRequest[] = requests.map((r, index) => ({
      ...r,
      id: `${batchId}-${index}`,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: r.maxRetries ?? 3,
    }))

    const batch: BatchRequest = {
      id: batchId,
      requests: fullRequests,
      priority,
      category,
      companyId,
      createdAt: new Date(),
      estimatedQuotaCost: this.calculateBatchQuotaCost(fullRequests),
    }

    if (!this.pendingBatches.has(companyId)) {
      this.pendingBatches.set(companyId, [])
    }
    this.pendingBatches.get(companyId)!.push(batch)

    return batch
  }

  private determineBatchCategory(categories: ApiCallCategory[]): ApiCallCategory {
    const priorityOrder: ApiCallCategory[] = [
      'auth',
      'journals',
      'deals',
      'documents',
      'receipts',
      'trial_balance',
      'reports',
      'account_items',
      'companies',
    ]

    for (const cat of priorityOrder) {
      if (categories.includes(cat)) return cat
    }
    return 'journals'
  }

  private calculateBatchQuotaCost(requests: ApiCallRequest[]): number {
    return requests.reduce((sum, req) => sum + CATEGORY_QUOTA_COST[req.category], 0)
  }

  planSchedule(companyId: string): SchedulePlan {
    const warnings: string[] = []
    const quotaStatus = freeeApiQuotaManager.getQuotaStatus(companyId)
    const batches = this.pendingBatches.get(companyId) || []

    const sortedBatches = [...batches].sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    let remainingQuota = quotaStatus.remaining
    const scheduledBatches: ScheduledBatch[] = []
    let totalCalls = 0

    for (const batch of sortedBatches) {
      if (remainingQuota < batch.estimatedQuotaCost) {
        if (batch.priority === 'critical') {
          warnings.push(`重要なバッチ ${batch.id} のクォータが不足しています`)
        } else {
          const partialSize = Math.floor(remainingQuota / CATEGORY_QUOTA_COST[batch.category])
          if (partialSize > 0) {
            const partialCalls = batch.requests.slice(0, partialSize)
            scheduledBatches.push({
              id: `${batch.id}-partial`,
              calls: partialCalls,
              scheduledFor: new Date(),
              estimatedQuotaCost: partialSize * CATEGORY_QUOTA_COST[batch.category],
            })
            remainingQuota = 0
            totalCalls += partialSize
            warnings.push(
              `バッチ ${batch.id} は部分的に実行されます (${partialSize}/${batch.requests.length})`
            )
          }
        }
        break
      }

      const scheduledFor = this.calculateScheduledTime(
        scheduledBatches.length,
        batch.requests.length
      )

      scheduledBatches.push({
        id: batch.id,
        calls: batch.requests,
        scheduledFor,
        estimatedQuotaCost: batch.estimatedQuotaCost,
      })

      remainingQuota -= batch.estimatedQuotaCost
      totalCalls += batch.requests.length
    }

    const estimatedDuration = totalCalls * MIN_CALL_INTERVAL_MS

    return {
      companyId,
      totalCalls,
      quotaAvailable: quotaStatus.remaining,
      batches: scheduledBatches,
      estimatedDuration,
      warnings,
    }
  }

  private calculateScheduledTime(batchIndex: number, callCount: number): Date {
    const now = new Date()
    const delayMs = batchIndex * HOUR_IN_MS + callCount * MIN_CALL_INTERVAL_MS
    return new Date(now.getTime() + delayMs)
  }

  optimizeBatchOrder(requests: ApiCallRequest[]): ApiCallRequest[] {
    const grouped = this.groupByCategory(requests)
    const optimized: ApiCallRequest[] = []

    const categoryPriority: ApiCallCategory[] = [
      'companies',
      'account_items',
      'journals',
      'deals',
      'documents',
      'receipts',
      'trial_balance',
      'reports',
    ]

    for (const category of categoryPriority) {
      if (grouped[category]) {
        const sorted = grouped[category].sort((a, b) => {
          const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
          if (priorityDiff !== 0) return priorityDiff
          return a.createdAt.getTime() - b.createdAt.getTime()
        })
        optimized.push(...sorted)
      }
    }

    return optimized
  }

  private groupByCategory(requests: ApiCallRequest[]): Record<ApiCallCategory, ApiCallRequest[]> {
    return requests.reduce(
      (acc, req) => {
        if (!acc[req.category]) {
          acc[req.category] = []
        }
        acc[req.category].push(req)
        return acc
      },
      {} as Record<ApiCallCategory, ApiCallRequest[]>
    )
  }

  getPendingBatchCount(companyId: string): number {
    return this.pendingBatches.get(companyId)?.length || 0
  }

  getNextBatch(companyId: string): BatchRequest | null {
    const batches = this.pendingBatches.get(companyId)
    if (!batches || batches.length === 0) return null

    return batches.reduce((highest, batch) => {
      if (!highest) return batch
      const priorityDiff = PRIORITY_WEIGHTS[batch.priority] - PRIORITY_WEIGHTS[highest.priority]
      if (priorityDiff > 0) return batch
      if (priorityDiff === 0 && batch.createdAt < highest.createdAt) return batch
      return highest
    }, batches[0])
  }

  removeBatch(companyId: string, batchId: string): boolean {
    const batches = this.pendingBatches.get(companyId)
    if (!batches) return false

    const index = batches.findIndex((b) => b.id === batchId)
    if (index === -1) return false

    batches.splice(index, 1)
    return true
  }

  clearPendingBatches(companyId?: string): void {
    if (companyId) {
      this.pendingBatches.delete(companyId)
    } else {
      this.pendingBatches.clear()
    }
  }

  getBatchStatus(companyId: string): {
    pending: number
    totalCalls: number
    estimatedQuotaCost: number
    byPriority: Record<ApiCallPriority, number>
  } {
    const batches = this.pendingBatches.get(companyId) || []

    return {
      pending: batches.length,
      totalCalls: batches.reduce((sum, b) => sum + b.requests.length, 0),
      estimatedQuotaCost: batches.reduce((sum, b) => sum + b.estimatedQuotaCost, 0),
      byPriority: batches.reduce(
        (acc, b) => {
          acc[b.priority] = (acc[b.priority] || 0) + 1
          return acc
        },
        {} as Record<ApiCallPriority, number>
      ),
    }
  }
}

export const freeeApiScheduler = new FreeeApiScheduler()

import { MemoryCache } from './memory-cache'
import type { AccountMapping } from '@/types/conversion'

export interface CachedMapping {
  mapping: AccountMapping | null
  timestamp: number
}

export class ConversionCache {
  private mappingCache: MemoryCache<AccountMapping | null>
  private targetAccountCache: MemoryCache<{
    id: string
    code: string
    name: string
    nameEn: string
    category: string
  }>
  private cashFlowMappingCache: MemoryCache<{ section: 'operating' | 'investing' | 'financing' }>

  constructor() {
    this.mappingCache = new MemoryCache<AccountMapping | null>(300000)
    this.targetAccountCache = new MemoryCache(600000)
    this.cashFlowMappingCache = new MemoryCache(600000)
  }

  getMapping(sourceCode: string, targetCoaId: string): AccountMapping | null | undefined {
    const key = `mapping:${sourceCode}:${targetCoaId}`
    return this.mappingCache.get(key)
  }

  setMapping(sourceCode: string, targetCoaId: string, mapping: AccountMapping | null): void {
    const key = `mapping:${sourceCode}:${targetCoaId}`
    this.mappingCache.set(key, mapping)
  }

  getTargetAccount(
    coaId: string,
    code: string
  ): {
    id: string
    code: string
    name: string
    nameEn: string
    category: string
  } | null {
    const key = `targetAccount:${coaId}:${code}`
    return this.targetAccountCache.get(key)
  }

  setTargetAccount(
    coaId: string,
    code: string,
    account: {
      id: string
      code: string
      name: string
      nameEn: string
      category: string
    }
  ): void {
    const key = `targetAccount:${coaId}:${code}`
    this.targetAccountCache.set(key, account)
  }

  getCashFlowMapping(
    companyId: string,
    accountCode: string
  ): { section: 'operating' | 'investing' | 'financing' } | null {
    const key = `cashFlow:${companyId}:${accountCode}`
    return this.cashFlowMappingCache.get(key)
  }

  setCashFlowMapping(
    companyId: string,
    accountCode: string,
    mapping: { section: 'operating' | 'investing' | 'financing' }
  ): void {
    const key = `cashFlow:${companyId}:${accountCode}`
    this.cashFlowMappingCache.set(key, mapping)
  }

  clearAll(): void {
    this.mappingCache.clear()
    this.targetAccountCache.clear()
    this.cashFlowMappingCache.clear()
  }

  getStats(): {
    mappingCache: { size: number; keys: string[] }
    targetAccountCache: { size: number; keys: string[] }
    cashFlowMappingCache: { size: number; keys: string[] }
  } {
    return {
      mappingCache: this.mappingCache.getStats(),
      targetAccountCache: this.targetAccountCache.getStats(),
      cashFlowMappingCache: this.cashFlowMappingCache.getStats(),
    }
  }
}

export const conversionCache = new ConversionCache()

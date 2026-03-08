import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JournalConverter, getOptimalBatchSize } from '@/services/conversion/journal-converter'
import type { AccountMapping, ConversionSettings } from '@/types/conversion'

const PERFORMANCE_THRESHOLD_10K_MS = 30000
const MEMORY_THRESHOLD_MB = 1024

function generateMockJournals(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `journal-${i}`,
    companyId: 'company-1',
    freeeJournalId: `freee-${i}`,
    entryDate: new Date(2024, Math.floor(i / 1000), (i % 30) + 1),
    description: `Transaction ${i}`,
    debitAccount: `D${String((i % 100) + 1).padStart(4, '0')}`,
    creditAccount: `C${String((i % 100) + 1).padStart(4, '0')}`,
    amount: Math.floor(Math.random() * 100000) + 1000,
    taxAmount: 0,
    taxType: null,
  }))
}

function generateMockMappings(count: number): Map<string, AccountMapping> {
  const mappings = new Map<string, AccountMapping>()
  for (let i = 1; i <= count; i++) {
    const code = `${String(i).padStart(4, '0')}`
    mappings.set(`D${code}`, {
      id: `mapping-d-${i}`,
      sourceAccountCode: `D${code}`,
      sourceAccountName: `Debit Account ${i}`,
      targetAccountId: `target-${i}`,
      targetAccountCode: `T${code}`,
      targetAccountName: `Target Account ${i}`,
      mappingType: '1to1',
      confidence: 0.9,
      isManualReview: false,
      conversionRule: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mappings.set(`C${code}`, {
      id: `mapping-c-${i}`,
      sourceAccountCode: `C${code}`,
      sourceAccountName: `Credit Account ${i}`,
      targetAccountId: `target-${i}`,
      targetAccountCode: `T${code}`,
      targetAccountName: `Target Account ${i}`,
      mappingType: '1to1',
      confidence: 0.9,
      isManualReview: false,
      conversionRule: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
  return mappings
}

describe('Conversion Performance', () => {
  let converter: JournalConverter
  const mockSettings: ConversionSettings = {
    sourceStandard: 'jp-gaap',
    targetStandard: 'ifrs',
    includeFinancialStatements: true,
    generateAdjustingEntries: true,
    fiscalYearStartMonth: 4,
  }

  beforeEach(() => {
    converter = new JournalConverter()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getOptimalBatchSize', () => {
    it('should return 100 for less than 1000 journals', () => {
      expect(getOptimalBatchSize(500)).toBe(100)
      expect(getOptimalBatchSize(999)).toBe(100)
    })

    it('should return 500 for 1000-9999 journals', () => {
      expect(getOptimalBatchSize(1000)).toBe(500)
      expect(getOptimalBatchSize(5000)).toBe(500)
      expect(getOptimalBatchSize(9999)).toBe(500)
    })

    it('should return 1000 for 10000 or more journals', () => {
      expect(getOptimalBatchSize(10000)).toBe(1000)
      expect(getOptimalBatchSize(100000)).toBe(1000)
    })
  })

  describe('Batch conversion performance', () => {
    it('should convert 1000 journals within 3 seconds', async () => {
      const journals = generateMockJournals(1000)
      const mappings = generateMockMappings(100)

      const start = Date.now()

      const conversions = []
      for await (const batchResult of converter.convertBatch(journals, mappings, 100)) {
        conversions.push(...batchResult.conversions)
      }

      const duration = Date.now() - start

      expect(conversions.length).toBe(1000)
      expect(duration).toBeLessThan(3000)
    })

    it('should convert 5000 journals within 10 seconds', async () => {
      const journals = generateMockJournals(5000)
      const mappings = generateMockMappings(100)

      const start = Date.now()

      const conversions = []
      for await (const batchResult of converter.convertBatch(journals, mappings, 500)) {
        conversions.push(...batchResult.conversions)
      }

      const duration = Date.now() - start

      expect(conversions.length).toBe(5000)
      expect(duration).toBeLessThan(10000)
    })
  })

  describe('Memory efficiency', () => {
    it('should process large batches without memory issues', async () => {
      const journals = generateMockJournals(10000)
      const mappings = generateMockMappings(100)

      const initialMemory = process.memoryUsage().heapUsed

      const conversions = []
      for await (const batchResult of converter.convertBatch(journals, mappings, 1000)) {
        conversions.push(...batchResult.conversions)
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncreaseMB = (finalMemory - initialMemory) / (1024 * 1024)

      expect(conversions.length).toBe(10000)
      expect(memoryIncreaseMB).toBeLessThan(MEMORY_THRESHOLD_MB)
    })
  })

  describe('Error handling performance', () => {
    it('should handle partial failures efficiently', async () => {
      const journals = generateMockJournals(1000)
      const mappings = generateMockMappings(50)

      const start = Date.now()

      const results = { success: 0, failed: 0 }
      for await (const batchResult of converter.convertBatch(journals, mappings, 100)) {
        results.success += batchResult.successCount
        results.failed += batchResult.failedCount
      }

      const duration = Date.now() - start

      expect(results.success + results.failed).toBe(1000)
      expect(duration).toBeLessThan(5000)
    })
  })
})

describe('Performance Benchmark - 10,000 Journals', () => {
  it.skip('should convert 10,000 journals within 30 seconds (requires database)', async () => {
    const converter = new JournalConverter()

    const journals = generateMockJournals(10000)
    const mappings = generateMockMappings(100)
    const settings: ConversionSettings = {
      sourceStandard: 'jp-gaap',
      targetStandard: 'ifrs',
      includeFinancialStatements: true,
      generateAdjustingEntries: true,
      fiscalYearStartMonth: 4,
    }

    const start = Date.now()

    const conversions = []
    for await (const batchResult of converter.convertBatch(
      journals,
      mappings,
      getOptimalBatchSize(10000)
    )) {
      conversions.push(...batchResult.conversions)
    }

    const duration = Date.now() - start

    console.log(`10,000 journals converted in ${duration}ms`)
    console.log(`Average time per journal: ${(duration / 10000).toFixed(2)}ms`)

    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_10K_MS)
    expect(conversions.length).toBe(10000)
  })
})

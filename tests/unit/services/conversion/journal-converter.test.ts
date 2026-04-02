import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JournalConverter, getOptimalBatchSize } from '@/services/conversion/journal-converter'
import type { AccountMapping } from '@/types/conversion'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

vi.mock('@/services/conversion/mapping-rule-engine', () => ({
  MappingRuleEngine: vi.fn().mockImplementation(function (this: any) {
    this.evaluateConditions = vi.fn().mockReturnValue(null)
    this.calculateAmount = vi.fn().mockReturnValue({ success: true, data: 5000 })
  }),
}))

function makeMapping(overrides: Partial<AccountMapping> = {}): AccountMapping {
  return {
    id: 'map-1',
    sourceAccountId: 'sa-1',
    sourceAccountCode: '1001',
    sourceAccountName: '現金',
    targetAccountId: 'ta-1',
    targetAccountCode: '1100',
    targetAccountName: 'Cash',
    mappingType: '1to1',
    confidence: 0.95,
    isManualReview: false,
    conversionRule: undefined,
    ...overrides,
  }
}

function makeJournal(overrides = {}) {
  return {
    id: 'j-1',
    companyId: 'co-1',
    freeeJournalId: 'fj-1',
    entryDate: new Date('2024-01-15'),
    description: 'Test entry',
    debitAccount: '1001',
    creditAccount: '4001',
    amount: 10000,
    taxAmount: 1000,
    taxType: 'taxable_10',
    ...overrides,
  }
}

describe('getOptimalBatchSize', () => {
  it('should return MIN_BATCH_SIZE for small datasets', function () {
    expect(getOptimalBatchSize(500)).toBe(100)
  })

  it('should return 500 for medium datasets', function () {
    expect(getOptimalBatchSize(5000)).toBe(500)
  })

  it('should return MAX_BATCH_SIZE for large datasets', function () {
    expect(getOptimalBatchSize(50000)).toBe(1000)
  })
})

describe('JournalConverter', () => {
  let converter: JournalConverter

  beforeEach(() => {
    vi.clearAllMocks()
    converter = new JournalConverter()
  })

  describe('convertSingle', () => {
    it('should convert a journal with 1to1 mapping', async function () {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('1001', makeMapping({ sourceAccountCode: '1001', targetAccountCode: '1100' }))
      mappings.set(
        '4001',
        makeMapping({
          id: 'map-2',
          sourceAccountCode: '4001',
          sourceAccountName: '売上',
          targetAccountCode: '7100',
          targetAccountName: 'Revenue',
        })
      )

      const journal = makeJournal()
      const result = await converter.convertSingle(journal, mappings)

      expect(result.sourceJournalId).toBe('j-1')
      expect(result.lines).toHaveLength(2)
      expect(result.lines[0].debitAmount).toBe(10000)
      expect(result.lines[1].creditAmount).toBe(10000)
    })

    it('should mark unmapped accounts as requiring review', async function () {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('1001', makeMapping())

      const journal = makeJournal()
      const result = await converter.convertSingle(journal, mappings)

      expect(result.requiresReview).toBe(true)
      expect(result.reviewNotes).toContain('Unmapped account')
    })

    it('should calculate average confidence', async function () {
      const mappings = new Map<string, AccountMapping>()
      mappings.set('1001', makeMapping({ confidence: 0.9 }))
      mappings.set('4001', makeMapping({ id: 'map-2', sourceAccountCode: '4001', confidence: 0.7 }))

      const journal = makeJournal()
      const result = await converter.convertSingle(journal, mappings)

      expect(result.mappingConfidence).toBeCloseTo(0.8, 1)
    })
  })

  describe('findUnmappedAccounts', () => {
    it('should find accounts not in mappings', async function () {
      const { prisma } = await import('@/lib/db')
      ;(prisma.journal.groupBy as any).mockImplementation(function (args: any) {
        if (args.by[0] === 'debitAccount') {
          return Promise.resolve([
            {
              debitAccount: '1001',
              _count: { debitAccount: 5 },
              _sum: { amount: 50000 },
              _min: { description: 'test' },
            },
            {
              debitAccount: '9999',
              _count: { debitAccount: 3 },
              _sum: { amount: 30000 },
              _min: { description: 'unmapped' },
            },
          ])
        }
        return Promise.resolve([
          {
            creditAccount: '4001',
            _count: { creditAccount: 5 },
            _sum: { amount: 50000 },
            _min: { description: 'test' },
          },
        ])
      })

      const mappings = new Map<string, AccountMapping>()
      mappings.set('1001', makeMapping())
      mappings.set('4001', makeMapping({ id: 'map-2', sourceAccountCode: '4001' }))

      const unmapped = await converter.findUnmappedAccounts('co-1', mappings)

      expect(unmapped).toHaveLength(1)
      expect(unmapped[0].accountCode).toBe('9999')
    })
  })

  describe('streamJournals', () => {
    it('should yield journal batches', async function () {
      const { prisma } = await import('@/lib/db')

      const journals = [makeJournal(), makeJournal({ id: 'j-2' })]
      vi.mocked(prisma.journal.findMany)
        .mockResolvedValueOnce(journals as any)
        .mockResolvedValueOnce([])

      const batches = []
      for await (const batch of converter.streamJournals(
        'co-1',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )) {
        batches.push(batch)
      }

      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(2)
    })
  })
})

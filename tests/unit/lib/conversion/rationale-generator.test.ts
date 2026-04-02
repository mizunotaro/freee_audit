import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RationaleGenerator } from '@/lib/conversion/rationale-generator'
import type {
  ChartOfAccountItem,
  AdjustingEntry,
  JournalConversion,
  ConvertedBalanceSheet,
  AccountMapping,
} from '@/types/conversion'

vi.mock('@/lib/integrations/ai', function () {
  return {
    createAIProviderFromEnv: vi.fn().mockReturnValue(null),
    AIProvider: undefined,
  }
})

vi.mock('@/lib/integrations/ai', function () {
  return {
    createAIProviderFromEnv: vi.fn().mockReturnValue(null),
    AIProvider: undefined,
  }
})

function makeAccountItem(overrides?: Partial<ChartOfAccountItem>): ChartOfAccountItem {
  return {
    id: 'acc-1',
    code: '1100',
    name: '現金',
    nameEn: 'Cash',
    standard: 'JGAAP' as const,
    category: 'current_asset',
    normalBalance: 'debit',
    level: 0,
    isConvertible: true,
    ...overrides,
  }
}

function makeAdjustingEntry(): AdjustingEntry {
  return {
    id: 'adj-1',
    projectId: 'proj-1',
    type: 'lease_classification',
    description: 'リース調整',
    descriptionEn: 'Lease adjustment',
    lines: [
      { accountCode: '2100', accountName: '建物', debit: 100000, credit: 0 },
      { accountCode: '3100', accountName: '買掛金', debit: 0, credit: 100000 },
    ],
    ifrsReference: 'IFRS 16',
    usgaapReference: 'ASC 842',
    aiSuggested: false,
    isApproved: true,
  }
}

function makeJournalConversion(): JournalConversion {
  return {
    sourceJournalId: 'sj-1',
    sourceDate: new Date('2024-01-15'),
    sourceDescription: '売上計上',
    lines: [
      {
        sourceAccountCode: '1100',
        sourceAccountName: '現金',
        targetAccountCode: '1100',
        targetAccountName: 'Cash',
        debitAmount: 100000,
        creditAmount: 0,
        mappingId: 'map-1',
      },
    ],
    mappingConfidence: 0.95,
    requiresReview: false,
  }
}

function makeBalanceSheet(): ConvertedBalanceSheet {
  return {
    asOfDate: new Date('2024-12-31'),
    assets: [{ code: '1100', name: '現金', nameEn: 'Cash', amount: 1000000 }],
    liabilities: [{ code: '3100', name: '買掛金', nameEn: 'Payables', amount: 300000 }],
    equity: [{ code: '5100', name: '資本金', nameEn: 'Capital', amount: 700000 }],
    totalAssets: 1000000,
    totalLiabilities: 300000,
    totalEquity: 700000,
  }
}

describe('RationaleGenerator', function () {
  let generator: RationaleGenerator

  beforeEach(function () {
    vi.stubEnv('AI_MOCK_MODE', 'true')
    generator = new RationaleGenerator()
  })

  describe('generateMappingRationale (mock mode)', function () {
    it('should return rationale with mapping summary', async function () {
      const source = makeAccountItem()
      const target = makeAccountItem({
        id: 't1',
        code: '1100',
        name: 'Cash',
        nameEn: 'Cash',
        standard: 'USGAAP' as const,
      })
      const result = await generator.generateMappingRationale(source, target, 'USGAAP')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('summaryEn')
      expect(result).toHaveProperty('confidence')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should work with IFRS target standard', async function () {
      const source = makeAccountItem()
      const target = makeAccountItem({ standard: 'IFRS' as const })
      const result = await generator.generateMappingRationale(source, target, 'IFRS')
      expect(result).toHaveProperty('summary')
    })
  })

  describe('generateAdjustmentRationale (mock mode)', function () {
    it('should return rationale for adjustment', async function () {
      const adjustment = makeAdjustingEntry()
      const sourceData = { balanceSheet: makeBalanceSheet() }
      const result = await generator.generateAdjustmentRationale(adjustment, sourceData)
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('detailedExplanation')
      expect(result).toHaveProperty('impactAmount')
    })

    it('should handle adjustment with no source data', async function () {
      const adjustment = makeAdjustingEntry()
      const result = await generator.generateAdjustmentRationale(adjustment, {})
      expect(result).toHaveProperty('summary')
    })

    it('should handle adjustment with net zero impact', async function () {
      const adjustment = makeAdjustingEntry()
      const result = await generator.generateAdjustmentRationale(adjustment, {})
      expect(result).toHaveProperty('impactAmount')
      expect(result.impactAmount).toBe(1000000)
    })
  })

  describe('generateJournalConversionRationale (mock mode)', function () {
    it('should return rationale for journal conversion', async function () {
      const journal = makeJournalConversion()
      const mappings: AccountMapping[] = []
      const result = await generator.generateJournalConversionRationale(journal, mappings)
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('confidence')
    })
  })

  describe('generateFSConversionRationale (mock mode)', function () {
    it('should return rationale for balance sheet conversion', async function () {
      const bs = makeBalanceSheet()
      const differences = [
        { code: '1100', sourceAmount: 1000000, targetAmount: 900000, difference: -100000 },
      ]
      const result = await generator.generateFSConversionRationale(bs, bs, differences)
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('impactAmount')
    })

    it('should handle empty differences', async function () {
      const bs = makeBalanceSheet()
      const result = await generator.generateFSConversionRationale(bs, bs, [])
      expect(result).toHaveProperty('summary')
    })

    it('should handle positive total difference', async function () {
      const bs = makeBalanceSheet()
      const differences = [{ code: '1100', sourceAmount: 100, targetAmount: 200, difference: 100 }]
      const result = await generator.generateFSConversionRationale(bs, bs, differences)
      expect(result).toHaveProperty('impactDirection')
    })

    it('should handle negative total difference', async function () {
      const bs = makeBalanceSheet()
      const differences = [{ code: '1100', sourceAmount: 200, targetAmount: 100, difference: -100 }]
      const result = await generator.generateFSConversionRationale(bs, bs, differences)
      expect(result).toHaveProperty('impactDirection')
    })
  })
})

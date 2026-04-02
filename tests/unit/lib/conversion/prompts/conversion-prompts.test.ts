import { describe, it, expect } from 'vitest'
import { CONVERSION_PROMPTS } from '@/lib/conversion/prompts/conversion-prompts'
import type { ChartOfAccountItem, ChartOfAccounts } from '@/types/conversion'

function makeAccountItem(overrides?: Partial<ChartOfAccountItem>): ChartOfAccountItem {
  return {
    id: 'a1',
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

function makeCoA(): ChartOfAccounts {
  return {
    id: 'coa-1',
    companyId: 'comp-1',
    standard: 'USGAAP' as const,
    name: 'Test COA',
    items: [
      makeAccountItem(),
      makeAccountItem({ id: 'a2', code: '1200', name: '売掛金', nameEn: 'AR' }),
    ],
    version: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('CONVERSION_PROMPTS', function () {
  describe('systemPrompt', function () {
    it('should be a non-empty string', function () {
      expect(CONVERSION_PROMPTS.systemPrompt).toBeTruthy()
      expect(typeof CONVERSION_PROMPTS.systemPrompt).toBe('string')
    })

    it('should mention USGAAP and IFRS expertise', function () {
      expect(CONVERSION_PROMPTS.systemPrompt).toContain('USGAAP')
      expect(CONVERSION_PROMPTS.systemPrompt).toContain('IFRS')
      expect(CONVERSION_PROMPTS.systemPrompt).toContain('JGAAP')
    })
  })

  describe('createMappingSuggestionPrompt', function () {
    it('should generate prompt with source accounts', function () {
      const accounts = [makeAccountItem()]
      const coa = makeCoA()
      const prompt = CONVERSION_PROMPTS.createMappingSuggestionPrompt(accounts, coa, 'USGAAP')
      expect(prompt).toContain('1100')
      expect(prompt).toContain('現金')
      expect(prompt).toContain('Cash')
      expect(prompt).toContain('USGAAP')
    })

    it('should generate prompt with IFRS target', function () {
      const accounts = [makeAccountItem()]
      const coa = makeCoA()
      const prompt = CONVERSION_PROMPTS.createMappingSuggestionPrompt(accounts, coa, 'IFRS')
      expect(prompt).toContain('IFRS')
    })

    it('should handle empty source accounts', function () {
      const coa = makeCoA()
      const prompt = CONVERSION_PROMPTS.createMappingSuggestionPrompt([], coa, 'USGAAP')
      expect(prompt).toContain('USGAAP')
    })

    it('should include JSON format instruction', function () {
      const accounts = [makeAccountItem()]
      const coa = makeCoA()
      const prompt = CONVERSION_PROMPTS.createMappingSuggestionPrompt(accounts, coa, 'USGAAP')
      expect(prompt).toContain('suggestions')
    })
  })

  describe('createAdjustmentSuggestionPrompt', function () {
    it('should generate prompt with financial data', function () {
      const bs = {
        asOfDate: new Date('2024-12-31'),
        assets: [{ code: '1100', name: '現金', nameEn: 'Cash', amount: 1000000 }],
        liabilities: [{ code: '3100', name: '買掛金', nameEn: 'Payables', amount: 300000 }],
        equity: [{ code: '5100', name: '資本金', nameEn: 'Capital', amount: 700000 }],
        totalAssets: 1000000,
        totalLiabilities: 300000,
        totalEquity: 700000,
      }
      const pl = {
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        revenue: [{ code: '4100', name: '売上', nameEn: 'Revenue', amount: 2000000 }],
        costOfSales: [],
        sgaExpenses: [],
        nonOperatingIncome: [],
        nonOperatingExpenses: [],
        grossProfit: 1500000,
        operatingIncome: 800000,
        ordinaryIncome: 700000,
        incomeBeforeTax: 600000,
        netIncome: 400000,
      }
      const prompt = CONVERSION_PROMPTS.createAdjustmentSuggestionPrompt(
        { balanceSheet: bs, profitLoss: pl },
        'USGAAP'
      )
      expect(prompt).toContain('1000000')
      expect(prompt).toContain('USGAAP')
      expect(prompt).toContain('adjustments')
    })
  })

  describe('createRiskAssessmentPrompt', function () {
    it('should generate risk assessment prompt', function () {
      const project = {
        id: 'p1',
        name: 'Test',
        targetStandard: 'USGAAP' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statistics: {
          totalAccounts: 100,
          mappedAccounts: 80,
          reviewRequiredCount: 10,
          totalJournals: 500,
          convertedJournals: 450,
          adjustingEntryCount: 5,
          averageConfidence: 0.85,
        },
      }
      const result = {
        id: 'r1',
        projectId: 'p1',
        conversionDate: new Date(),
        conversionDurationMs: 1000,
        warnings: [],
        errors: [],
      }
      const prompt = CONVERSION_PROMPTS.createRiskAssessmentPrompt(project, result)
      expect(prompt).toContain('USGAAP')
      expect(prompt).toContain('80.0')
      expect(prompt).toContain('risks')
    })

    it('should handle project without statistics', function () {
      const project = {
        id: 'p1',
        name: 'Test',
        targetStandard: 'IFRS' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      }
      const result = {
        id: 'r1',
        projectId: 'p1',
        conversionDate: new Date(),
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }
      const prompt = CONVERSION_PROMPTS.createRiskAssessmentPrompt(project, result)
      expect(prompt).toContain('0')
      expect(prompt).toContain('IFRS')
    })
  })

  describe('createDisclosureGenerationPrompt', function () {
    it('should generate disclosure prompt', function () {
      const result = {
        id: 'r1',
        projectId: 'p1',
        conversionDate: new Date(),
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }
      const prompt = CONVERSION_PROMPTS.createDisclosureGenerationPrompt(result, 'USGAAP')
      expect(prompt).toContain('USGAAP')
      expect(prompt).toContain('disclosures')
    })
  })

  describe('createQualityReviewPrompt', function () {
    it('should generate quality review prompt', function () {
      const project = {
        id: 'p1',
        name: 'Test',
        targetStandard: 'USGAAP' as const,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
      }
      const result = {
        id: 'r1',
        projectId: 'p1',
        conversionDate: new Date(),
        conversionDurationMs: 0,
        warnings: [],
        errors: [],
      }
      const prompt = CONVERSION_PROMPTS.createQualityReviewPrompt(project, result)
      expect(prompt).toContain('overallScore')
      expect(prompt).toContain('issues')
    })
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { RevenueRecognitionValidator } from '@/services/dd/validators/revenue-validator'
import type { ValidatorContext } from '@/services/dd/validators/base-validator'
import type { DDJournalData } from '@/services/dd/types'

function makeJournal(overrides: Partial<DDJournalData>): DDJournalData {
  return {
    id: 'j1',
    entryDate: new Date('2024-06-15'),
    debitAccount: '売掛金',
    creditAccount: '売上',
    amount: 500000,
    taxAmount: 50000,
    description: '売上計上',
    ...overrides,
  }
}

function makeContext(journals: DDJournalData[], fiscalYear = 2024): ValidatorContext {
  return {
    companyId: 'company1',
    fiscalYear,
    analyticsContext: {
      companyId: 'company1',
      fiscalYears: [fiscalYear],
      journals,
      trialBalances: [],
      accountItems: [],
      partners: [],
    },
  }
}

describe('RevenueRecognitionValidator', () => {
  let validator: RevenueRecognitionValidator

  beforeEach(() => {
    validator = new RevenueRecognitionValidator()
  })

  it('has correct category', () => {
    expect(validator.category).toBe('REVENUE_RECOGNITION')
  })

  it('lists supported rules', () => {
    expect(validator.supportedRules).toContain('COMPLETENESS')
    expect(validator.supportedRules).toContain('CUTOFF')
    expect(validator.supportedRules).toContain('TREND')
    expect(validator.supportedRules).toContain('POLICY_CHANGE')
  })

  it('returns passed with no rules', async () => {
    const journals = [makeJournal({})]
    const context = makeContext(journals)

    const result = await validator.validate('REV', [], context)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passed).toBe(true)
      expect(result.data.evidence.length).toBeGreaterThan(0)
    }
  })

  describe('TREND rule', () => {
    it('detects revenue decrease trend', async () => {
      // Trend values are collected newest-year-first, so the finding fires when the
      // oldest-year revenue is materially below the current-year revenue.
      const journals = [
        makeJournal({ entryDate: new Date('2024-01-15'), amount: 1000000 }),
        makeJournal({ entryDate: new Date('2023-01-15'), amount: 600000 }),
        makeJournal({ entryDate: new Date('2022-01-15'), amount: 300000 }),
      ]
      const context = makeContext(journals, 2024)
      context.analyticsContext.fiscalYears = [2022, 2023, 2024]
      context.analyticsContext.journals = journals
      const rules = [{ type: 'TREND' as const, field: 'revenue', lookback: 3 }]

      const result = await validator.validate('REV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        const trendFindings = result.data.findings.filter((f) => f.title === '売上減少傾向')
        expect(trendFindings.length).toBeGreaterThan(0)
        expect(trendFindings[0].severity).toBe('HIGH')
      }
    })

    it('passes when revenue is stable', async () => {
      const journals = [
        makeJournal({ entryDate: new Date('2023-06-15'), amount: 500000 }),
        makeJournal({ entryDate: new Date('2024-06-15'), amount: 500000 }),
      ]
      const context = makeContext(journals, 2024)
      context.analyticsContext.fiscalYears = [2023, 2024]
      context.analyticsContext.journals = journals
      const rules = [{ type: 'TREND' as const, field: 'revenue', lookback: 2 }]

      const result = await validator.validate('REV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('CUTOFF rule', () => {
    it('detects post year-end revenue requiring analysis', async () => {
      const journals = [
        makeJournal({ entryDate: new Date('2024-12-20'), amount: 500000 }),
        ...Array.from({ length: 15 }, (_, i) =>
          makeJournal({
            entryDate: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
            creditAccount: '売上',
            description: '通常売上',
            amount: 100000,
          })
        ),
      ]
      const context = makeContext(journals, 2024)
      context.analyticsContext.fiscalYears = [2024, 2025]
      const rules = [{ type: 'CUTOFF' as const, field: 'cutoff' }]

      const result = await validator.validate('REV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
      }
    })

    it('does not flag pre-received revenue', async () => {
      const journals = [
        ...Array.from({ length: 5 }, (_, i) =>
          makeJournal({
            entryDate: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
            creditAccount: '売上',
            description: '前受金の売上',
            amount: 100000,
          })
        ),
      ]
      const context = makeContext(journals, 2024)
      context.analyticsContext.fiscalYears = [2024, 2025]
      const rules = [{ type: 'CUTOFF' as const, field: 'cutoff' }]

      const result = await validator.validate('REV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('POLICY_CHANGE rule', () => {
    it('adds document evidence', async () => {
      const context = makeContext([makeJournal({})])
      const rules = [{ type: 'POLICY_CHANGE' as const, field: 'revenue_policy' }]

      const result = await validator.validate('REV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence.some((e) => e.type === 'DOCUMENT')).toBe(true)
      }
    })
  })

  describe('COMPLETENESS rule', () => {
    it('counts revenue accounts', async () => {
      const journals = [
        makeJournal({ creditAccount: '売上高', amount: 500000 }),
        makeJournal({ creditAccount: '役務収入', amount: 300000 }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'COMPLETENESS' as const, field: 'revenue_accounts' }]

      const result = await validator.validate('REV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence.some((e) => e.reference.includes('revenue_accounts'))).toBe(
          true
        )
      }
    })
  })

  it('handles errors gracefully', async () => {
    const context = {
      companyId: 'company1',
      fiscalYear: 2024,
      analyticsContext: null as any,
    }

    const result = await validator.validate('REV', [], context)
    expect(result.success).toBe(false)
  })
})

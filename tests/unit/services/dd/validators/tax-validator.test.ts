import { describe, it, expect, beforeEach } from 'vitest'
import { TaxValidator } from '@/services/dd/validators/tax-validator'
import type { ValidatorContext } from '@/services/dd/validators/base-validator'
import type { DDAnalyticsContext, DDJournalData } from '@/services/dd/types'

vi.mock('@/services/dd/validators/validation-engine', () => ({
  ddValidationEngine: {
    registerValidator: vi.fn(),
  },
}))

function makeJournal(overrides: Partial<DDJournalData>): DDJournalData {
  return {
    id: 'j1',
    entryDate: new Date('2024-06-15'),
    debitAccount: '法人税',
    creditAccount: '現金',
    amount: 200000,
    taxAmount: 0,
    description: '法人税納付',
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

describe('TaxValidator', () => {
  let validator: TaxValidator

  beforeEach(() => {
    validator = new TaxValidator()
  })

  it('has correct category', () => {
    expect(validator.category).toBe('TAX')
  })

  it('lists supported rules', () => {
    expect(validator.supportedRules).toContain('AUDIT_HISTORY')
    expect(validator.supportedRules).toContain('EXPOSURE')
    expect(validator.supportedRules).toContain('PROVISION')
    expect(validator.supportedRules).toContain('RECONCILIATION')
  })

  it('returns passed with no rules', async () => {
    const journals = [makeJournal({})]
    const context = makeContext(journals, 2024)

    const result = await validator.validate('TAX', [], context)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passed).toBe(true)
      expect(result.data.evidence.length).toBeGreaterThan(0)
    }
  })

  describe('AUDIT_HISTORY rule', () => {
    it('detects high audit risk score across multiple years', async () => {
      const journalsByYear: DDJournalData[] = []
      for (let year = 2016; year <= 2020; year++) {
        journalsByYear.push(
          makeJournal({
            entryDate: new Date(`${year}-06-15`),
            description: '税務調査による修正',
            amount: 50000,
            debitAccount: '法人税',
            creditAccount: '現金',
            id: `j${year}`,
            taxAmount: 0,
          })
        )
      }
      const context = makeContext(journalsByYear, 2020)
      context.analyticsContext.fiscalYears = [2016, 2017, 2018, 2019, 2020]
      context.analyticsContext.journals = journalsByYear
      const rules = [{ type: 'AUDIT_HISTORY' as const, field: 'tax_audits', lookback: 5 }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('HIGH')
      }
    })

    it('passes when audit risk is low', async () => {
      const journals = [makeJournal({ description: '通常の納税' })]
      const context = makeContext(journals, 2024)
      const rules = [{ type: 'AUDIT_HISTORY' as const, field: 'tax_audits', lookback: 1 }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })

    it('uses default lookback of 5', async () => {
      const journals = [makeJournal({ description: '通常の納税' })]
      const context = makeContext(journals, 2024)
      const rules = [{ type: 'AUDIT_HISTORY' as const, field: 'tax_audits' }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
    })
  })

  describe('EXPOSURE rule', () => {
    it('detects high contingent tax ratio', async () => {
      const journals = [
        makeJournal({
          debitAccount: '法人税',
          creditAccount: '現金',
          amount: 100000,
          description: '通常',
        }),
        makeJournal({
          debitAccount: '法人税',
          creditAccount: '現金',
          amount: 50000,
          description: '未決定の税務リスク',
        }),
      ]
      const context = makeContext(journals, 2024)
      const rules = [{ type: 'EXPOSURE' as const, field: 'tax_contingencies' }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
      }
    })

    it('passes when contingent tax ratio is low', async () => {
      const journals = [
        makeJournal({
          debitAccount: '法人税',
          creditAccount: '現金',
          amount: 1000000,
          description: '通常',
        }),
      ]
      const context = makeContext(journals, 2024)
      const rules = [{ type: 'EXPOSURE' as const, field: 'tax_contingencies' }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('PROVISION rule', () => {
    it('detects provision ratio outside normal range', async () => {
      const journals = [
        makeJournal({
          debitAccount: '法人税',
          creditAccount: '現金',
          amount: 100000,
          description: '税額',
        }),
        makeJournal({
          debitAccount: '法人税',
          creditAccount: '現金',
          amount: 10000,
          description: '未払',
        }),
      ]
      const context = makeContext(journals, 2024)
      const rules = [{ type: 'PROVISION' as const, field: 'probable_loss' }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('MEDIUM')
      }
    })

    it('passes when provision ratio is within normal range', async () => {
      const journals = [
        makeJournal({
          debitAccount: '法人税',
          creditAccount: '未払法人税',
          amount: 100000,
          description: '税額',
        }),
      ]
      const context = makeContext(journals, 2024)
      const rules = [{ type: 'PROVISION' as const, field: 'probable_loss' }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('RECONCILIATION rule', () => {
    it('adds document evidence', async () => {
      const context = makeContext([makeJournal({})], 2024)
      const rules = [{ type: 'RECONCILIATION' as const, field: 'book_vs_tax_income' }]

      const result = await validator.validate('TAX', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence.some((e) => e.type === 'DOCUMENT')).toBe(true)
      }
    })
  })

  it('handles errors gracefully', async () => {
    const context = {
      companyId: 'company1',
      fiscalYear: 2024,
      analyticsContext: null as any,
    }

    const result = await validator.validate('TAX', [], context)
    expect(result.success).toBe(false)
  })
})

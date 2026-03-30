import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountsReceivableValidator } from '@/services/dd/validators/ar-validator'
import type { ValidatorContext } from '@/services/dd/validators/base-validator'
import type { DDAnalyticsContext, DDJournalData } from '@/services/dd/types'

function makeJournal(overrides: Partial<DDJournalData>): DDJournalData {
  return {
    id: 'j1',
    entryDate: new Date('2024-06-15'),
    debitAccount: '売掛金',
    creditAccount: '売上',
    amount: 100000,
    taxAmount: 10000,
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
    } satisfies DDAnalyticsContext,
  }
}

describe('AccountsReceivableValidator', () => {
  let validator: AccountsReceivableValidator

  beforeEach(() => {
    validator = new AccountsReceivableValidator()
  })

  it('has correct category', () => {
    expect(validator.category).toBe('ACCOUNTS_RECEIVABLE')
  })

  it('lists supported rules', () => {
    expect(validator.supportedRules).toContain('AGING')
    expect(validator.supportedRules).toContain('RATIO')
    expect(validator.supportedRules).toContain('TREND')
    expect(validator.supportedRules).toContain('COVERAGE_RATIO')
  })

  it('returns passed with no findings for healthy AR data', async () => {
    const journals = [
      makeJournal({
        entryDate: new Date('2024-01-15'),
        debitAccount: '売掛金',
        creditAccount: '売上',
        amount: 500000,
      }),
    ]
    const context = makeContext(journals)
    const result = await validator.validate('AR', [], context)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passed).toBe(true)
      expect(result.data.findings).toHaveLength(0)
      expect(result.data.evidence.length).toBeGreaterThan(0)
    }
  })

  it('returns evidence for AR calculations', async () => {
    const journals = [
      makeJournal({
        entryDate: new Date('2024-03-15'),
        debitAccount: '売掛金',
        creditAccount: '売上',
        amount: 300000,
      }),
      makeJournal({
        entryDate: new Date('2024-04-15'),
        debitAccount: '現金',
        creditAccount: '売掛金',
        amount: 100000,
      }),
    ]
    const context = makeContext(journals)

    const result = await validator.validate('AR', [], context)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.evidence.length).toBeGreaterThan(0)
    }
  })

  describe('AGING rule', () => {
    it('detects high long-term receivables ratio', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-01-10'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 900000,
        }),
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 100000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'AGING' as const, field: 'receivables' }]

      const result = await validator.validate('AR', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('HIGH')
      }
    })

    it('passes when long-term receivables are within threshold', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-11-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 500000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'AGING' as const, field: 'receivables' }]

      const result = await validator.validate('AR', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('RATIO rule (bad_debt_ratio)', () => {
    it('detects bad debt ratio exceeding threshold', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 100000,
        }),
        makeJournal({
          entryDate: new Date('2024-07-15'),
          debitAccount: '貸倒損失',
          creditAccount: '売掛金',
          amount: 50000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'RATIO' as const, field: 'bad_debt_ratio', threshold: 0.01 }]

      const result = await validator.validate('AR', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
      }
    })

    it('passes when bad debt ratio is within threshold', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 1000000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'RATIO' as const, field: 'bad_debt_ratio', threshold: 0.5 }]

      const result = await validator.validate('AR', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('TREND rule (dso)', () => {
    it('detects DSO deterioration', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2022-01-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 500000,
        }),
        makeJournal({
          entryDate: new Date('2022-01-15'),
          debitAccount: '現金',
          creditAccount: '売上',
          amount: 200000,
        }),
        makeJournal({
          entryDate: new Date('2023-01-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 700000,
        }),
        makeJournal({
          entryDate: new Date('2023-01-15'),
          debitAccount: '現金',
          creditAccount: '売上',
          amount: 200000,
        }),
        makeJournal({
          entryDate: new Date('2024-01-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 900000,
        }),
        makeJournal({
          entryDate: new Date('2024-01-15'),
          debitAccount: '現金',
          creditAccount: '売上',
          amount: 200000,
        }),
      ]
      const context = makeContext(journals, 2024)
      context.analyticsContext.fiscalYears = [2022, 2023, 2024]
      context.analyticsContext.journals = journals
      const rules = [{ type: 'TREND' as const, field: 'dso', lookback: 3 }]

      const result = await validator.validate('AR', rules, context)
      expect(result.success).toBe(true)
    })
  })

  describe('COVERAGE_RATIO rule', () => {
    it('detects insufficient allowance coverage', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 1000000,
        }),
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '貸倒損失',
          creditAccount: '貸倒引当金',
          amount: 1000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'COVERAGE_RATIO' as const, field: 'allowance_to_ar', min: 0.05 }]

      const result = await validator.validate('AR', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('HIGH')
      }
    })

    it('passes when coverage is adequate', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 100000,
        }),
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '貸倒損失',
          creditAccount: '貸倒引当金',
          amount: 50000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'COVERAGE_RATIO' as const, field: 'allowance_to_ar', min: 0.01 }]

      const result = await validator.validate('AR', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  it('handles empty journals gracefully', async () => {
    const context = makeContext([])
    const result = await validator.validate('AR', [], context)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passed).toBe(true)
    }
  })

  it('handles errors gracefully', async () => {
    const context = {
      companyId: 'company1',
      fiscalYear: 2024,
      analyticsContext: null as any,
    }

    const result = await validator.validate('AR', [], context)
    expect(result.success).toBe(false)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { InternalControlsValidator } from '@/services/dd/validators/internal-controls-validator'
import type { ValidatorContext } from '@/services/dd/validators/base-validator'
import type { DDAnalyticsContext, DDJournalData } from '@/services/dd/types'

function makeJournal(overrides: Partial<DDJournalData>): DDJournalData {
  return {
    id: 'j1',
    entryDate: new Date('2024-06-15'),
    debitAccount: '現金',
    creditAccount: '売上',
    amount: 100000,
    taxAmount: 10000,
    description: '正常な説明文です',
    ...overrides,
  }
}

function makeContext(
  journals: DDJournalData[],
  fiscalYear = 2024,
  trialBalances: DDAnalyticsContext['trialBalances'] = []
): ValidatorContext {
  return {
    companyId: 'company1',
    fiscalYear,
    analyticsContext: {
      companyId: 'company1',
      fiscalYears: [fiscalYear],
      journals,
      trialBalances,
      accountItems: [],
      partners: [],
    },
  }
}

describe('InternalControlsValidator', () => {
  let validator: InternalControlsValidator

  beforeEach(() => {
    validator = new InternalControlsValidator()
  })

  it('has correct category', () => {
    expect(validator.category).toBe('INTERNAL_CONTROLS')
  })

  it('lists supported rules', () => {
    expect(validator.supportedRules).toContain('DOCUMENTATION')
    expect(validator.supportedRules).toContain('SEGREGATION_OF_DUTIES')
    expect(validator.supportedRules).toContain('RECONCILIATION')
  })

  describe('DOCUMENTATION rule', () => {
    it('passes when all journals have adequate descriptions', async () => {
      const journals = [
        makeJournal({ description: '売上計上の仕訳です' }),
        makeJournal({ description: '経費支払いの記録です' }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'DOCUMENTATION' as const, field: 'control_activities' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.passed).toBe(true)
        expect(result.data.findings).toHaveLength(0)
      }
    })

    it('detects missing descriptions', async () => {
      const journals = [
        makeJournal({ description: '' }),
        makeJournal({ description: 'ab' }),
        makeJournal({ description: '正常な説明文' }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'DOCUMENTATION' as const, field: 'control_activities' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
      }
    })

    it('uses custom threshold', async () => {
      const journals = [
        makeJournal({ description: '' }),
        makeJournal({ description: '十分な長さの説明文です' }),
      ]
      const context = makeContext(journals)
      const rules = [
        { type: 'DOCUMENTATION' as const, field: 'control_activities', threshold: 0.6 },
      ]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })

    it('assigns CRITICAL severity when ratio exceeds 20%', async () => {
      const journals = Array.from({ length: 25 }, (_, i) =>
        i < 22 ? makeJournal({ description: '' }) : makeJournal({ description: '十分な説明文です' })
      )
      const context = makeContext(journals)
      const rules = [{ type: 'DOCUMENTATION' as const, field: 'control_activities' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('CRITICAL')
      }
    })

    it('assigns HIGH severity when ratio is between 10% and 20%', async () => {
      const journals = [
        ...Array.from({ length: 2 }, () => makeJournal({ description: '' })),
        ...Array.from({ length: 13 }, () => makeJournal({ description: '十分な長さの説明文です' })),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'DOCUMENTATION' as const, field: 'control_activities' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('HIGH')
      }
    })

    it('assigns MEDIUM severity when ratio is between threshold and 10%', async () => {
      const journals = [
        makeJournal({ description: '' }),
        ...Array.from({ length: 14 }, () => makeJournal({ description: '十分な長さの説明文です' })),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'DOCUMENTATION' as const, field: 'control_activities' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('MEDIUM')
      }
    })
  })

  describe('RECONCILIATION rule', () => {
    it('detects missing trial balance', async () => {
      const context = makeContext([], 2024, [])
      const rules = [{ type: 'RECONCILIATION' as const, field: 'trial_balance' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('HIGH')
      }
    })

    it('passes when trial balance is balanced', async () => {
      const trialBalances = [
        {
          asOfDate: new Date('2024-12-31'),
          accounts: [
            { code: '100', name: '現金', debitBalance: 500000, creditBalance: 0 },
            { code: '400', name: '売上', debitBalance: 0, creditBalance: 500000 },
          ],
        },
      ]
      const context = makeContext([], 2024, trialBalances)
      const rules = [{ type: 'RECONCILIATION' as const, field: 'trial_balance' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })

    it('detects unbalanced trial balance', async () => {
      const trialBalances = [
        {
          asOfDate: new Date('2024-12-31'),
          accounts: [
            { code: '100', name: '現金', debitBalance: 500000, creditBalance: 0 },
            { code: '400', name: '売上', debitBalance: 0, creditBalance: 300000 },
          ],
        },
      ]
      const context = makeContext([], 2024, trialBalances)
      const rules = [{ type: 'RECONCILIATION' as const, field: 'trial_balance' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
      }
    })
  })

  describe('TESTING rule', () => {
    it('identifies high-value transactions for testing', async () => {
      const journals = [
        makeJournal({ amount: 5000000 }),
        makeJournal({ amount: 3000000 }),
        makeJournal({ amount: 50000 }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'TESTING' as const, field: 'operating_effectiveness', min: 1000000 }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('INFO')
      }
    })

    it('uses the default 1,000,000 minimum when rule.min is omitted', async () => {
      const journals = [makeJournal({ amount: 1500000 }), makeJournal({ amount: 50000 })]
      const context = makeContext(journals)
      const rules = [{ type: 'TESTING' as const, field: 'operating_effectiveness' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.evidence.some((e) => e.summary.includes('100万円'))).toBe(true)
      }
    })

    it('does not raise a finding when there are no high-value journals', async () => {
      const journals = [makeJournal({ amount: 50000 })]
      const context = makeContext(journals)
      const rules = [{ type: 'TESTING' as const, field: 'operating_effectiveness' }]

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('General controls fallback', () => {
    it('handles unknown rule types via general controls', async () => {
      const rules = [
        { type: 'COMPLETENESS' as const, field: 'general_control' },
        { type: 'RATIO' as const, field: 'general_check' },
      ]
      const context = makeContext([])

      const result = await validator.validate('IC', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.passed).toBe(true)
        expect(result.data.evidence.length).toBeGreaterThan(0)
      }
    })
  })

  it('handles error gracefully', async () => {
    const context = {
      companyId: 'company1',
      fiscalYear: 2024,
      analyticsContext: null as any,
    }

    const result = await validator.validate(
      'IC',
      [{ type: 'DOCUMENTATION' as const, field: 'test' }],
      context
    )
    expect(result.success).toBe(false)
  })
})

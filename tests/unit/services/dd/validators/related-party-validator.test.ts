import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RelatedPartyValidator } from '@/services/dd/validators/related-party-validator'
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
    debitAccount: '現金',
    creditAccount: '売上',
    amount: 100000,
    taxAmount: 10000,
    description: '通常取引',
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

describe('RelatedPartyValidator', () => {
  let validator: RelatedPartyValidator

  beforeEach(() => {
    validator = new RelatedPartyValidator()
  })

  it('has correct category', () => {
    expect(validator.category).toBe('RELATED_PARTY')
  })

  it('lists supported rules', () => {
    expect(validator.supportedRules).toContain('OWNERSHIP')
    expect(validator.supportedRules).toContain('CONTROL')
    expect(validator.supportedRules).toContain('KEY_MANAGEMENT')
    expect(validator.supportedRules).toContain('DISCLOSURE')
  })

  it('returns passed with no related party journals', async () => {
    const journals = [makeJournal({ description: '通常の売上取引' })]
    const context = makeContext(journals)
    const result = await validator.validate('RP', [], context)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passed).toBe(true)
    }
  })

  describe('OWNERSHIP rule', () => {
    it('detects high related party ratio', async () => {
      const journals = [
        makeJournal({
          description: '関連会社への売上',
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 800000,
        }),
        makeJournal({
          description: '通常取引',
          debitAccount: '現金',
          creditAccount: '売上',
          amount: 200000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'OWNERSHIP' as const, field: 'voting_rights', threshold: 0.1 }]

      const result = await validator.validate('RP', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('HIGH')
      }
    })

    it('passes when related party ratio is within threshold', async () => {
      const journals = [
        makeJournal({ description: '関連会社取引', amount: 5000 }),
        makeJournal({ description: '通常取引', amount: 995000 }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'OWNERSHIP' as const, field: 'voting_rights', threshold: 0.5 }]

      const result = await validator.validate('RP', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        const ownershipFindings = result.data.findings.filter(
          (f) => f.title === '関連当事者取引比率が高い'
        )
        expect(ownershipFindings).toHaveLength(0)
      }
    })
  })

  describe('DISCLOSURE rule', () => {
    it('requires disclosure when rp ratio exceeds 5%', async () => {
      const journals = [
        makeJournal({
          description: '関連会社への売上',
          debitAccount: '売掛金',
          creditAccount: '売上',
          amount: 800000,
        }),
        makeJournal({
          description: '通常取引',
          debitAccount: '現金',
          creditAccount: '売上',
          amount: 200000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'DISCLOSURE' as const, field: 'transaction_details', required: true }]

      const result = await validator.validate('RP', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence.some((e) => e.type === 'DOCUMENT')).toBe(true)
      }
    })

    it('does not require disclosure for low rp ratio', async () => {
      const journals = [makeJournal({ description: '通常取引', amount: 1000000 })]
      const context = makeContext(journals)
      const rules = [{ type: 'DISCLOSURE' as const, field: 'transaction_details', required: true }]

      const result = await validator.validate('RP', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence.every((e) => e.type !== 'DOCUMENT')).toBe(true)
      }
    })
  })

  describe('KEY_MANAGEMENT rule', () => {
    it('identifies key management compensation', async () => {
      const journals = [
        makeJournal({
          description: '役員への報酬支払い',
          debitAccount: '給与',
          creditAccount: '現金',
          amount: 500000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'KEY_MANAGEMENT' as const, field: 'directors_and_officers' }]

      const result = await validator.validate('RP', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence.some((e) => e.reference.includes('key_management'))).toBe(true)
      }
    })

    it('no evidence when no key management journals', async () => {
      const journals = [
        makeJournal({
          description: '関連会社取引',
          debitAccount: '現金',
          creditAccount: '売上',
          amount: 100000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'KEY_MANAGEMENT' as const, field: 'directors_and_officers' }]

      const result = await validator.validate('RP', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.evidence.every((e) => !e.reference.includes('key_management'))).toBe(
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

    const result = await validator.validate('RP', [], context)
    expect(result.success).toBe(false)
  })
})

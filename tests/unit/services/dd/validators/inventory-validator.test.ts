import { describe, it, expect, beforeEach } from 'vitest'
import { InventoryValidator } from '@/services/dd/validators/inventory-validator'
import type { ValidatorContext } from '@/services/dd/validators/base-validator'
import type { DDAnalyticsContext, DDJournalData } from '@/services/dd/types'

function makeJournal(overrides: Partial<DDJournalData>): DDJournalData {
  return {
    id: 'j1',
    entryDate: new Date('2024-06-15'),
    debitAccount: '棚卸資産',
    creditAccount: '現金',
    amount: 500000,
    taxAmount: 50000,
    description: '仕入',
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

describe('InventoryValidator', () => {
  let validator: InventoryValidator

  beforeEach(() => {
    validator = new InventoryValidator()
  })

  it('has correct category', () => {
    expect(validator.category).toBe('INVENTORY')
  })

  it('lists supported rules', () => {
    expect(validator.supportedRules).toContain('SLOW_MOVING')
    expect(validator.supportedRules).toContain('RATIO')
    expect(validator.supportedRules).toContain('OBSOLESCENCE')
    expect(validator.supportedRules).toContain('METHOD_CONSISTENCY')
  })

  it('returns passed with no rules', async () => {
    const journals = [makeJournal({})]
    const context = makeContext(journals)
    const result = await validator.validate('INV', [], context)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passed).toBe(true)
    }
  })

  describe('SLOW_MOVING rule', () => {
    it('detects slow-moving inventory above threshold', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-01-10'),
          debitAccount: '棚卸資産',
          creditAccount: '現金',
          amount: 900000,
        }),
        makeJournal({
          entryDate: new Date('2024-11-15'),
          debitAccount: '棚卸資産',
          creditAccount: '現金',
          amount: 100000,
        }),
        makeJournal({
          entryDate: new Date('2024-12-20'),
          debitAccount: '売上原価',
          creditAccount: '棚卸資産',
          amount: 200000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'SLOW_MOVING' as const, field: 'inventory_aging', threshold: 180 }]

      const result = await validator.validate('INV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('HIGH')
      }
    })

    it('passes when slow-moving ratio is low', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2024-11-15'),
          debitAccount: '棚卸資産',
          creditAccount: '現金',
          amount: 100000,
        }),
        makeJournal({
          entryDate: new Date('2024-12-20'),
          debitAccount: '売上原価',
          creditAccount: '棚卸資産',
          amount: 80000,
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'SLOW_MOVING' as const, field: 'inventory_aging', threshold: 365 }]

      const result = await validator.validate('INV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('RATIO rule (inventory_turnover)', () => {
    it('detects low inventory turnover', async () => {
      const journals = [
        makeJournal({ debitAccount: '棚卸資産', creditAccount: '現金', amount: 1000000 }),
        makeJournal({ debitAccount: '売上原価', creditAccount: '棚卸資産', amount: 500000 }),
        makeJournal({ debitAccount: '仕入', creditAccount: '現金', amount: 500000 }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'RATIO' as const, field: 'inventory_turnover', min: 5 }]

      const result = await validator.validate('INV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
        expect(result.data.findings[0].severity).toBe('MEDIUM')
      }
    })
  })

  describe('TREND rule', () => {
    it('detects increasing inventory trend', async () => {
      const journals = [
        makeJournal({
          entryDate: new Date('2022-06-15'),
          debitAccount: '棚卸資産',
          creditAccount: '現金',
          amount: 100000,
        }),
        makeJournal({
          entryDate: new Date('2022-06-15'),
          debitAccount: '売上原価',
          creditAccount: '棚卸資産',
          amount: 50000,
        }),
        makeJournal({
          entryDate: new Date('2023-06-15'),
          debitAccount: '棚卸資産',
          creditAccount: '現金',
          amount: 500000,
        }),
        makeJournal({
          entryDate: new Date('2023-06-15'),
          debitAccount: '売上原価',
          creditAccount: '棚卸資産',
          amount: 100000,
        }),
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '棚卸資産',
          creditAccount: '現金',
          amount: 900000,
        }),
        makeJournal({
          entryDate: new Date('2024-06-15'),
          debitAccount: '売上原価',
          creditAccount: '棚卸資産',
          amount: 100000,
        }),
      ]
      const context = makeContext(journals, 2024)
      context.analyticsContext.fiscalYears = [2022, 2023, 2024]
      context.analyticsContext.journals = journals
      const rules = [{ type: 'TREND' as const, field: 'inventory', lookback: 3 }]

      const result = await validator.validate('INV', rules, context)
      expect(result.success).toBe(true)
    })
  })

  describe('OBSOLESCENCE rule', () => {
    it('detects high write-down ratio', async () => {
      const journals = [
        makeJournal({ debitAccount: '棚卸資産', creditAccount: '現金', amount: 500000 }),
        makeJournal({
          debitAccount: '棚卸資産評価損',
          creditAccount: '棚卸資産',
          amount: 200000,
          description: '陳腐化による評価損',
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'OBSOLESCENCE' as const, field: 'aging' }]

      const result = await validator.validate('INV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings.length).toBeGreaterThan(0)
      }
    })

    it('passes when write-down ratio is acceptable', async () => {
      const journals = [
        makeJournal({ debitAccount: '棚卸資産', creditAccount: '現金', amount: 1000000 }),
        makeJournal({
          debitAccount: '棚卸資産評価損',
          creditAccount: '棚卸資産',
          amount: 50000,
          description: '評価損',
        }),
      ]
      const context = makeContext(journals)
      const rules = [{ type: 'OBSOLESCENCE' as const, field: 'aging' }]

      const result = await validator.validate('INV', rules, context)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.findings).toHaveLength(0)
      }
    })
  })

  describe('METHOD_CONSISTENCY rule', () => {
    it('adds document evidence for method consistency', async () => {
      const context = makeContext([makeJournal({})])
      const rules = [{ type: 'METHOD_CONSISTENCY' as const, field: 'valuation_method' }]

      const result = await validator.validate('INV', rules, context)
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

    const result = await validator.validate('INV', [], context)
    expect(result.success).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import {
  attributeVariance,
  isPeriodBoundary,
  type AttributionInput,
  type AccountAttributionInput,
  type JournalEntry,
  type VarianceAttribution,
} from '@/services/budget/variance-attribution'

/**
 * EDGE-01 — error / edge-case deepening for the variance-attribution pure core.
 *
 * These cases cover branches left uncovered by the golden suite
 * (variance-attribution.test.ts): malformed period dates, a neutral-direction
 * journal (deviation exactly 0), a null freeeJournalId, an sga-only input (no
 * revenue/COGS to trigger the category-mapping warning), and the `mock`
 * actuals-source synthetic-data warning.
 *
 * Every assertion checks a real computed value — no toBeDefined() cop-outs.
 */

const FY = 2025
const MO = 6

function expenseJournal(
  id: string,
  amount: number,
  entryDate: string,
  freeeJournalId: string | null = id
): JournalEntry {
  return {
    journalId: id,
    freeeJournalId,
    entryDate,
    description: '',
    amount,
    side: 'debit',
  }
}

function run(input: AttributionInput): VarianceAttribution {
  const result = attributeVariance(input)
  if (!result.success) {
    throw new Error(`attributeVariance failed: ${result.error.message}`)
  }
  return result.data
}

/** A revenue account that doubles as the materiality base (totalRevenue = actual). */
function revenueAccount(
  budget: number,
  actual: number,
  journals: JournalEntry[]
): AccountAttributionInput {
  return {
    accountCode: '400',
    accountName: '売上高',
    category: 'revenue',
    budget,
    actual,
    journals,
  }
}

describe('isPeriodBoundary — malformed / non-numeric dates (§6.3)', () => {
  it('returns false for a date with fewer than 3 dash-parts', () => {
    expect(isPeriodBoundary('2025-06', FY, MO)).toBe(false) // 2 parts
    expect(isPeriodBoundary('2025', FY, MO)).toBe(false) // 1 part
    expect(isPeriodBoundary('', FY, MO)).toBe(false) // empty
  })

  it('returns false when the date parts are non-numeric', () => {
    expect(isPeriodBoundary('abcd-ef-gh', FY, MO)).toBe(false)
    expect(isPeriodBoundary('YYYY-MM-DD', FY, MO)).toBe(false)
  })

  it('still validates a well-formed boundary date after the malformed cases', () => {
    expect(isPeriodBoundary('2025-06-01', FY, MO)).toBe(true)
    expect(isPeriodBoundary('2025-06-30', FY, MO)).toBe(true)
  })
})

describe('journal direction — neutral when deviation is exactly 0', () => {
  it('tags a journal whose signed amount equals the M0 expected as neutral', () => {
    // Revenue account, budget 100,000; 2 credit journals 50,000 + 75,000.
    // expected = 100,000 / 2 = 50,000.
    //   journal A (50,000): deviation 0 → neutral.
    //   journal B (75,000): deviation +25,000, revenue → favorable.
    // actual = 125,000; variance = 25,000; material (threshold 10,000).
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        revenueAccount(100000, 125000, [
          {
            journalId: 'a',
            freeeJournalId: 'a',
            entryDate: '2025-06-10',
            description: '',
            amount: 50000,
            side: 'credit',
          },
          {
            journalId: 'b',
            freeeJournalId: 'b',
            entryDate: '2025-06-15',
            description: '',
            amount: 75000,
            side: 'credit',
          },
        ]),
      ],
    }).accounts[0]

    const a = acc.journals.find((j) => j.journalId === 'a')!
    const b = acc.journals.find((j) => j.journalId === 'b')!
    expect(a.deviation).toBe(0)
    expect(a.direction).toBe('neutral')
    expect(b.deviation).toBe(25000)
    expect(b.direction).toBe('favorable')
  })
})

describe('null freeeJournalId is preserved as null', () => {
  it('renders freeeJournalId null when the input journal omits/provides null', () => {
    const acc = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        revenueAccount(10000000, 10000000, []),
        {
          accountCode: '600',
          accountName: '給与手当',
          category: 'sga_expense',
          budget: 800000,
          actual: 940000,
          journals: [expenseJournal('j1', 940000, '2025-06-15', null)],
        },
      ],
    }).accounts.find((a) => a.accountCode === '600')!

    // The single 940,000 journal had freeeJournalId null → output preserves null.
    expect(acc.journals).toHaveLength(1)
    expect(acc.journals[0].freeeJournalId).toBeNull()
  })
})

describe('data-quality warnings — sga-only input', () => {
  it('omits the category-mapping warning when no revenue or COGS account is present', () => {
    // Only an sga_expense account (material, variance 20,000 ≥ 10,000 floor with no revenue).
    const out = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [
        {
          accountCode: '600',
          accountName: '給与手当',
          category: 'sga_expense',
          budget: 100000,
          actual: 120000,
          journals: [expenseJournal('j', 120000, '2025-06-15')],
        },
      ],
    })

    expect(out.dataQuality.warnings).not.toContain('category_mapping_unverified_freee_path')
    // The PVVM warning is always present (Journal stores no partner/segment/quantity).
    expect(out.dataQuality.warnings).toContain('pvvm_not_computable_no_dimensions')
  })
})

describe('data-quality warnings — synthetic actuals source', () => {
  it('flags actualsSource mock with the actuals_are_synthetic warning', () => {
    const out = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'mock',
      accounts: [revenueAccount(10000000, 10000000, [])],
    })

    expect(out.dataQuality.actualsSource).toBe('mock')
    expect(out.dataQuality.warnings).toContain('actuals_are_synthetic')
  })

  it('does not flag actuals_are_synthetic for monthly_balance source', () => {
    const out = run({
      fiscalYear: FY,
      month: MO,
      actualsSource: 'monthly_balance',
      accounts: [revenueAccount(10000000, 10000000, [])],
    })

    expect(out.dataQuality.warnings).not.toContain('actuals_are_synthetic')
  })
})

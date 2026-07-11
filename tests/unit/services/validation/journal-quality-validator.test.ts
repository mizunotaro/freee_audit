import { describe, it, expect } from 'vitest'
import type { Journal } from '@/types'
import {
  findDuplicateJournals,
  findDateGaps,
  findUnbalancedEntries,
  computeMissingCounterpartyStats,
  analyzeJournalQuality,
} from '@/services/validation/journal-quality-validator'

function day(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`)
}

function makeJournal(overrides: Partial<Journal> & Pick<Journal, 'id'>): Journal {
  return {
    companyId: 'company-1',
    freeeJournalId: `freee-${overrides.id}`,
    entryDate: day('2024-01-15'),
    description: '取引先A',
    debitAccount: '現金',
    creditAccount: '売上',
    amount: 1000,
    taxAmount: 0,
    auditStatus: 'PENDING',
    syncedAt: day('2024-01-15'),
    createdAt: day('2024-01-15'),
    ...overrides,
  }
}

describe('findDuplicateJournals', () => {
  it('groups exact duplicates by date/amount/accounts', () => {
    const entries = [
      makeJournal({ id: 'd1', amount: 5000 }),
      makeJournal({ id: 'd2', amount: 5000 }),
      makeJournal({ id: 'd3', amount: 5000 }),
    ]
    const result = findDuplicateJournals(entries)
    if (!result.success) throw new Error('expected success')

    expect(result.data).toEqual({
      kind: 'duplicate',
      severity: 'warning',
      groups: [
        {
          signature: '2024-01-15|現金|売上|5000',
          count: 3,
          journalIds: ['d1', 'd2', 'd3'],
          entryDate: '2024-01-15',
          amount: 5000,
          debitAccount: '現金',
          creditAccount: '売上',
          taxAmount: undefined,
          description: undefined,
        },
      ],
      totalGroups: 1,
      entriesInvolved: 3,
      redundantEntries: 2,
    })
  })

  it('returns no groups when amounts differ', () => {
    const entries = [makeJournal({ id: 'a', amount: 5000 }), makeJournal({ id: 'b', amount: 6000 })]
    const result = findDuplicateJournals(entries)
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalGroups).toBe(0)
    expect(result.data.severity).toBe('info')
    expect(result.data.redundantEntries).toBe(0)
  })

  it('returns no groups when entry dates differ', () => {
    const entries = [
      makeJournal({ id: 'a', entryDate: day('2024-01-15') }),
      makeJournal({ id: 'b', entryDate: day('2024-01-16') }),
    ]
    const result = findDuplicateJournals(entries)
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalGroups).toBe(0)
  })

  it('distinguishes entries differing only by tax when includeTaxAmount is set', () => {
    const entries = [
      makeJournal({ id: 'a', amount: 1000, taxAmount: 100 }),
      makeJournal({ id: 'b', amount: 1000, taxAmount: 0 }),
    ]
    const separated = findDuplicateJournals(entries, { includeTaxAmount: true })
    if (!separated.success) throw new Error('expected success')
    expect(separated.data.totalGroups).toBe(0)
    const collapsed = findDuplicateJournals(entries)
    if (!collapsed.success) throw new Error('expected success')
    expect(collapsed.data.totalGroups).toBe(1)
  })

  it('distinguishes entries differing only by description when includeDescription is set', () => {
    const entries = [
      makeJournal({ id: 'a', description: '取引先A' }),
      makeJournal({ id: 'b', description: '取引先B' }),
    ]
    const separated = findDuplicateJournals(entries, { includeDescription: true })
    if (!separated.success) throw new Error('expected success')
    expect(separated.data.totalGroups).toBe(0)
    const collapsed = findDuplicateJournals(entries)
    if (!collapsed.success) throw new Error('expected success')
    expect(collapsed.data.totalGroups).toBe(1)
  })

  it('clusters near-equal amounts within amountTolerance', () => {
    const entries = [
      makeJournal({ id: 'a', amount: 1000 }),
      makeJournal({ id: 'b', amount: 1001 }),
      makeJournal({ id: 'c', amount: 2000 }),
    ]
    const result = findDuplicateJournals(entries, { amountTolerance: 1 })
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalGroups).toBe(1)
    expect(result.data.groups[0]).toMatchObject({
      count: 2,
      journalIds: ['a', 'b'],
      amount: 1000,
    })
  })

  it('respects minGroupSize option', () => {
    const entries = [
      makeJournal({ id: 'a', amount: 1000 }),
      makeJournal({ id: 'b', amount: 1000 }),
      makeJournal({ id: 'c', amount: 1000 }),
    ]
    const result = findDuplicateJournals(entries, { minGroupSize: 3 })
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalGroups).toBe(1)
    expect(result.data.groups[0].count).toBe(3)
  })

  it('returns no groups for an empty input', () => {
    const result = findDuplicateJournals([])
    if (!result.success) throw new Error('expected success')
    expect(result.data).toMatchObject({
      totalGroups: 0,
      severity: 'info',
      groups: [],
    })
  })

  it('fails with a validation error for invalid options', () => {
    const result = findDuplicateJournals([], { amountTolerance: -1 })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('fails with a validation error for malformed journal entries', () => {
    const malformed = [{ id: 'x', entryDate: 'not-a-date' }] as unknown as Journal[]
    const result = findDuplicateJournals(malformed)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('findDateGaps', () => {
  it('reports no gap for consecutive days', () => {
    const entries = [
      makeJournal({ id: 'g1', entryDate: day('2024-01-15') }),
      makeJournal({ id: 'g2', entryDate: day('2024-01-16') }),
      makeJournal({ id: 'g3', entryDate: day('2024-01-17') }),
    ]
    const result = findDateGaps(entries)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toMatchObject({
      gaps: [],
      severity: 'info',
      periodStart: '2024-01-15',
      periodEnd: '2024-01-17',
      uniqueEntryDays: 3,
      totalJournals: 3,
      maxGapDays: 7,
    })
  })

  it('detects a gap larger than maxGapDays', () => {
    const entries = [
      makeJournal({ id: 'g1', entryDate: day('2024-01-15') }),
      makeJournal({ id: 'g2', entryDate: day('2024-01-25') }),
    ]
    const result = findDateGaps(entries)
    if (!result.success) throw new Error('expected success')
    expect(result.data.gaps).toEqual([{ from: '2024-01-15', to: '2024-01-25', gapDays: 10 }])
    expect(result.data.severity).toBe('warning')
  })

  it('honours a custom maxGapDays threshold', () => {
    const entries = [
      makeJournal({ id: 'g1', entryDate: day('2024-01-15') }),
      makeJournal({ id: 'g2', entryDate: day('2024-01-25') }),
    ]
    const result = findDateGaps(entries, { maxGapDays: 15 })
    if (!result.success) throw new Error('expected success')
    expect(result.data.gaps).toEqual([])
    expect(result.data.severity).toBe('info')
  })

  it('treats a weekend (Fri to Mon) as a non-gap with default threshold', () => {
    const entries = [
      makeJournal({ id: 'fri', entryDate: day('2024-01-19') }),
      makeJournal({ id: 'mon', entryDate: day('2024-01-22') }),
    ]
    const result = findDateGaps(entries)
    if (!result.success) throw new Error('expected success')
    expect(result.data.gaps).toEqual([])
  })

  it('detects multiple gaps within a period', () => {
    const entries = [
      makeJournal({ id: 'g1', entryDate: day('2024-01-15') }),
      makeJournal({ id: 'g2', entryDate: day('2024-01-25') }),
      makeJournal({ id: 'g3', entryDate: day('2024-01-27') }),
      makeJournal({ id: 'g4', entryDate: day('2024-02-10') }),
    ]
    const result = findDateGaps(entries)
    if (!result.success) throw new Error('expected success')
    expect(result.data.gaps).toEqual([
      { from: '2024-01-15', to: '2024-01-25', gapDays: 10 },
      { from: '2024-01-27', to: '2024-02-10', gapDays: 14 },
    ])
  })

  it('handles a single entry (no gap, equal start/end)', () => {
    const result = findDateGaps([makeJournal({ id: 'solo', entryDate: day('2024-03-03') })])
    if (!result.success) throw new Error('expected success')
    expect(result.data).toMatchObject({
      gaps: [],
      periodStart: '2024-03-03',
      periodEnd: '2024-03-03',
      uniqueEntryDays: 1,
    })
  })

  it('handles an empty input', () => {
    const result = findDateGaps([])
    if (!result.success) throw new Error('expected success')
    expect(result.data).toMatchObject({
      gaps: [],
      periodStart: null,
      periodEnd: null,
      uniqueEntryDays: 0,
      totalJournals: 0,
    })
  })

  it('rejects entries with an invalid date as a validation error', () => {
    const entries = [
      makeJournal({ id: 'good', entryDate: day('2024-01-15') }),
      makeJournal({ id: 'bad', entryDate: new Date('not-a-date') }),
    ]
    const result = findDateGaps(entries)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('fails with a validation error for invalid options', () => {
    const result = findDateGaps([], { maxGapDays: 0 })
    expect(result.success).toBe(false)
  })
})

describe('findUnbalancedEntries', () => {
  it('flags a zero amount as non_positive_amount', () => {
    const result = findUnbalancedEntries([makeJournal({ id: 'u1', amount: 0 })])
    if (!result.success) throw new Error('expected success')
    expect(result.data.entries[0]).toEqual({
      journalId: 'u1',
      reasons: ['non_positive_amount'],
      amount: 0,
      taxAmount: 0,
      debitAccount: '現金',
      creditAccount: '売上',
    })
    expect(result.data.severity).toBe('warning')
  })

  it('flags a negative amount as non_positive_amount', () => {
    const result = findUnbalancedEntries([makeJournal({ id: 'u2', amount: -500 })])
    if (!result.success) throw new Error('expected success')
    expect(result.data.entries[0].reasons).toEqual(['non_positive_amount'])
  })

  it('flags a non-finite amount', () => {
    const result = findUnbalancedEntries([makeJournal({ id: 'u3', amount: Number.NaN })])
    if (!result.success) throw new Error('expected success')
    expect(result.data.entries[0].reasons).toEqual(['non_finite_amount'])
  })

  it('flags an infinite amount (accepted by the numeric schema but not finite)', () => {
    const result = findUnbalancedEntries([
      makeJournal({ id: 'u3b', amount: Number.POSITIVE_INFINITY }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.entries[0].reasons).toEqual(['non_finite_amount'])
  })

  it('flags a self-offsetting entry where debit equals credit', () => {
    const result = findUnbalancedEntries([
      makeJournal({ id: 'u4', amount: 1000, debitAccount: '現金', creditAccount: '現金' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.entries[0].reasons).toEqual(['self_offsetting'])
  })

  it('flags a negative tax amount', () => {
    const result = findUnbalancedEntries([makeJournal({ id: 'u5', amount: 1000, taxAmount: -100 })])
    if (!result.success) throw new Error('expected success')
    expect(result.data.entries[0].reasons).toEqual(['negative_tax'])
  })

  it('records multiple reasons on a single defective entry', () => {
    const result = findUnbalancedEntries([
      makeJournal({ id: 'u6', amount: 0, debitAccount: 'X', creditAccount: 'X' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.entries[0].reasons).toEqual(['non_positive_amount', 'self_offsetting'])
  })

  it('returns nothing for clean entries with byReason all zero', () => {
    const result = findUnbalancedEntries([
      makeJournal({ id: 'ok1', amount: 1000, taxAmount: 100 }),
      makeJournal({ id: 'ok2', amount: 2500, taxAmount: 0 }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({
      kind: 'unbalanced',
      severity: 'info',
      entries: [],
      total: 0,
      byReason: {
        non_finite_amount: 0,
        non_positive_amount: 0,
        non_finite_tax: 0,
        negative_tax: 0,
        self_offsetting: 0,
      },
    })
  })

  it('aggregates byReason counts across entries', () => {
    const result = findUnbalancedEntries([
      makeJournal({ id: 'a', amount: 0 }),
      makeJournal({ id: 'b', amount: 100, debitAccount: 'X', creditAccount: 'X' }),
      makeJournal({ id: 'c', amount: 100, taxAmount: -50 }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.total).toBe(3)
    expect(result.data.byReason).toEqual({
      non_finite_amount: 0,
      non_positive_amount: 1,
      non_finite_tax: 0,
      negative_tax: 1,
      self_offsetting: 1,
    })
  })
})

describe('computeMissingCounterpartyStats', () => {
  it('flags a counterparty account with a blank description', () => {
    const result = computeMissingCounterpartyStats([
      makeJournal({ id: 'm1', debitAccount: '売掛金', creditAccount: '売上', description: '' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({
      kind: 'missing_counterparty',
      severity: 'warning',
      totalEntriesOnCounterpartyAccounts: 1,
      totalMissing: 1,
      missingRatio: 1,
      byAccount: [
        { account: '売掛金', count: 1, sampleJournalIds: ['m1'], sampleDescriptions: [''] },
      ],
    })
  })

  it('does not flag a counterparty account that has a description', () => {
    const result = computeMissingCounterpartyStats([
      makeJournal({
        id: 'm2',
        debitAccount: '費用',
        creditAccount: '買掛金',
        description: '取引先B',
      }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data).toMatchObject({
      totalEntriesOnCounterpartyAccounts: 1,
      totalMissing: 0,
      missingRatio: 0,
      severity: 'info',
      byAccount: [],
    })
  })

  it('ignores non-counterparty accounts even when the description is blank', () => {
    const result = computeMissingCounterpartyStats([
      makeJournal({ id: 'm3', debitAccount: '現金', creditAccount: '売上', description: '' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalEntriesOnCounterpartyAccounts).toBe(0)
    expect(result.data.totalMissing).toBe(0)
  })

  it('flags placeholder description tokens', () => {
    const result = computeMissingCounterpartyStats([
      makeJournal({ id: 'm4', debitAccount: '売掛金', creditAccount: '売上', description: 'test' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalMissing).toBe(1)
  })

  it('flags descriptions shorter than minDescriptionLength', () => {
    const result = computeMissingCounterpartyStats([
      makeJournal({ id: 'm5', debitAccount: '売掛金', description: 'A' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalMissing).toBe(1)
  })

  it('attributes an entry to the debit account when both sides are counterparty accounts', () => {
    const result = computeMissingCounterpartyStats([
      makeJournal({ id: 'm6', debitAccount: '売掛金', creditAccount: '買掛金', description: '' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.byAccount).toEqual([
      { account: '売掛金', count: 1, sampleJournalIds: ['m6'], sampleDescriptions: [''] },
    ])
  })

  it('computes a ratio from a mixed set', () => {
    const result = computeMissingCounterpartyStats([
      makeJournal({ id: 'p1', debitAccount: '売掛金', description: '取引先A' }),
      makeJournal({ id: 'p2', debitAccount: '売掛金', description: '' }),
    ])
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalEntriesOnCounterpartyAccounts).toBe(2)
    expect(result.data.totalMissing).toBe(1)
    expect(result.data.missingRatio).toBe(0.5)
  })

  it('caps sample collection at maxSamples while keeping an accurate count', () => {
    const entries = [
      makeJournal({ id: 's1', debitAccount: '売掛金', description: '' }),
      makeJournal({ id: 's2', debitAccount: '売掛金', description: '' }),
      makeJournal({ id: 's3', debitAccount: '売掛金', description: '' }),
      makeJournal({ id: 's4', debitAccount: '売掛金', description: '' }),
    ]
    const result = computeMissingCounterpartyStats(entries, { maxSamples: 2 })
    if (!result.success) throw new Error('expected success')
    expect(result.data.byAccount[0].count).toBe(4)
    expect(result.data.byAccount[0].sampleJournalIds).toEqual(['s1', 's2'])
    expect(result.data.byAccount[0].sampleDescriptions).toEqual(['', ''])
  })

  it('honours custom counterpartyAccountPatterns', () => {
    const result = computeMissingCounterpartyStats(
      [makeJournal({ id: 'c1', debitAccount: '立替金', description: '' })],
      { counterpartyAccountPatterns: ['立替金'] }
    )
    if (!result.success) throw new Error('expected success')
    expect(result.data.totalEntriesOnCounterpartyAccounts).toBe(1)
    expect(result.data.totalMissing).toBe(1)
  })

  it('fails with a validation error for an empty pattern list', () => {
    const result = computeMissingCounterpartyStats([], { counterpartyAccountPatterns: [] })
    expect(result.success).toBe(false)
  })
})

describe('analyzeJournalQuality', () => {
  it('aggregates all four validators into a single report', () => {
    const entries = [
      makeJournal({ id: 'a1', amount: 1000, entryDate: day('2024-01-15') }),
      makeJournal({ id: 'a2', amount: 1000, entryDate: day('2024-01-15') }),
      makeJournal({ id: 'a3', amount: 0, entryDate: day('2024-01-15') }),
      makeJournal({
        id: 'a4',
        debitAccount: '売掛金',
        description: '',
        entryDate: day('2024-01-30'),
      }),
    ]
    const result = analyzeJournalQuality(entries)
    if (!result.success) throw new Error('expected success')

    expect(result.data.duplicates.totalGroups).toBe(1)
    expect(result.data.duplicates.redundantEntries).toBe(1)
    expect(result.data.dateGaps.gaps).toEqual([
      { from: '2024-01-15', to: '2024-01-30', gapDays: 15 },
    ])
    expect(result.data.unbalanced.total).toBe(1)
    expect(result.data.missingCounterparty.totalMissing).toBe(1)
    expect(result.data.hasIssues).toBe(true)
    expect(result.data.totalFlaggedEntries).toBe(3)
  })

  it('reports no issues for a clean dataset', () => {
    const entries = [
      makeJournal({ id: 'c1', amount: 1000, entryDate: day('2024-01-15'), description: '取引先A' }),
      makeJournal({ id: 'c2', amount: 2000, entryDate: day('2024-01-16'), description: '取引先B' }),
    ]
    const result = analyzeJournalQuality(entries)
    if (!result.success) throw new Error('expected success')
    expect(result.data.hasIssues).toBe(false)
    expect(result.data.totalFlaggedEntries).toBe(0)
  })

  it('does not mutate the input journals', () => {
    const entries = [makeJournal({ id: 'n1', amount: 1000 }), makeJournal({ id: 'n2', amount: 0 })]
    const snapshot = entries.map((entry) => ({ ...entry }))
    const result = analyzeJournalQuality(entries)
    expect(result.success).toBe(true)
    expect(entries).toEqual(snapshot)
  })
})

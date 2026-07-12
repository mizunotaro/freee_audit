import { z } from 'zod'
import { roundToDecimal } from '@/lib/utils'
import type { Journal } from '@/types'
import {
  success,
  failure,
  createAppError,
  ERROR_CODES,
  type Result,
  type AppError,
} from '@/types/result'

export type QualitySeverity = 'info' | 'warning'

const numericSchema = z.number().or(z.nan())

const journalEntrySchema = z
  .object({
    id: z.string().min(1),
    entryDate: z.date(),
    description: z.string(),
    debitAccount: z.string(),
    creditAccount: z.string(),
    amount: numericSchema,
    taxAmount: numericSchema,
  })
  .passthrough()

const journalArraySchema = z.array(journalEntrySchema)

type ParsedJournal = z.infer<typeof journalEntrySchema>

const DEFAULT_COUNTERPARTY_ACCOUNTS: string[] = [
  '売掛金',
  '買掛金',
  '未収入金',
  '未払金',
  '未収金',
  '前受金',
  '前払金',
  '受取手形',
  '支払手形',
  '借入金',
  '貸付金',
]

const DEFAULT_PLACEHOLDER_TOKENS: string[] = [
  'dummy',
  'test',
  'temp',
  '仮',
  '未定',
  '未入力',
  '要確認',
  '不明',
  'xxx',
  '-',
  'ー',
  'n/a',
  'na',
]

const duplicateOptionsSchema = z.object({
  includeTaxAmount: z.boolean().default(false),
  includeDescription: z.boolean().default(false),
  amountTolerance: z.number().nonnegative().default(0),
  minGroupSize: z.number().int().min(2).default(2),
})

const dateGapOptionsSchema = z.object({
  maxGapDays: z.number().int().min(1).default(7),
})

const unbalancedOptionsSchema = z.object({}).default({})

const missingCounterpartyOptionsSchema = z.object({
  counterpartyAccountPatterns: z
    .array(z.string().min(1))
    .min(1)
    .default(DEFAULT_COUNTERPARTY_ACCOUNTS),
  minDescriptionLength: z.number().int().min(1).default(2),
  placeholderTokens: z.array(z.string().min(1)).default(DEFAULT_PLACEHOLDER_TOKENS),
  maxSamples: z.number().int().min(0).default(3),
})

export type DuplicateOptions = z.input<typeof duplicateOptionsSchema>
export type DateGapOptions = z.input<typeof dateGapOptionsSchema>
export type UnbalancedOptions = z.input<typeof unbalancedOptionsSchema>
export type MissingCounterpartyOptions = z.input<typeof missingCounterpartyOptionsSchema>

export interface DuplicateGroup {
  signature: string
  count: number
  journalIds: string[]
  entryDate: string
  amount: number
  debitAccount: string
  creditAccount: string
  taxAmount?: number
  description?: string
}

export interface DuplicateFinding {
  kind: 'duplicate'
  severity: QualitySeverity
  groups: DuplicateGroup[]
  totalGroups: number
  entriesInvolved: number
  redundantEntries: number
}

export interface DateGap {
  from: string
  to: string
  gapDays: number
}

export interface DateGapFinding {
  kind: 'date_gap'
  severity: QualitySeverity
  gaps: DateGap[]
  periodStart: string | null
  periodEnd: string | null
  totalJournals: number
  uniqueEntryDays: number
  maxGapDays: number
}

export type UnbalancedReason =
  | 'non_finite_amount'
  | 'non_positive_amount'
  | 'non_finite_tax'
  | 'negative_tax'
  | 'self_offsetting'

export interface UnbalancedEntry {
  journalId: string
  reasons: UnbalancedReason[]
  amount: number
  taxAmount: number
  debitAccount: string
  creditAccount: string
}

export interface UnbalancedFinding {
  kind: 'unbalanced'
  severity: QualitySeverity
  entries: UnbalancedEntry[]
  total: number
  byReason: Record<UnbalancedReason, number>
}

export interface MissingCounterpartyStat {
  account: string
  count: number
  sampleJournalIds: string[]
  sampleDescriptions: string[]
}

export interface MissingCounterpartyStats {
  kind: 'missing_counterparty'
  severity: QualitySeverity
  totalEntriesOnCounterpartyAccounts: number
  totalMissing: number
  missingRatio: number
  byAccount: MissingCounterpartyStat[]
}

export interface JournalQualityReport {
  duplicates: DuplicateFinding
  dateGaps: DateGapFinding
  unbalanced: UnbalancedFinding
  missingCounterparty: MissingCounterpartyStats
  hasIssues: boolean
  totalFlaggedEntries: number
}

export interface JournalQualityOptions {
  duplicates?: DuplicateOptions
  dateGaps?: DateGapOptions
  missingCounterparty?: MissingCounterpartyOptions
}

function zodToAppError(message: string, result: { success: false; error: z.ZodError }): AppError {
  return createAppError(ERROR_CODES.VALIDATION_ERROR, message, {
    details: {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
  })
}

function formatDay(date: Date): string {
  if (!Number.isFinite(date.getTime())) return 'invalid-date'
  return date.toISOString().slice(0, 10)
}

function dayDiff(aDay: string, bDay: string): number {
  const a = Date.UTC(
    Number(aDay.slice(0, 4)),
    Number(aDay.slice(5, 7)) - 1,
    Number(aDay.slice(8, 10))
  )
  const b = Date.UTC(
    Number(bDay.slice(0, 4)),
    Number(bDay.slice(5, 7)) - 1,
    Number(bDay.slice(8, 10))
  )
  return Math.round((b - a) / 86_400_000)
}

function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, ' ')
}

function clusterByAmount<T extends { amount: number }>(items: T[], tolerance: number): T[][] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => a.amount - b.amount)
  const clusters: T[][] = []
  let current: T[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]
    const item = sorted[i]
    if (Math.abs(item.amount - previous.amount) <= tolerance) {
      current.push(item)
    } else {
      clusters.push(current)
      current = [item]
    }
  }
  clusters.push(current)
  return clusters
}

/**
 * Detects duplicate journal entries grouped by date/accounts (and optionally tax
 * amount / description), clustering within an amount tolerance.
 *
 * @param journals - Journal entries to scan.
 * @param options - Grouping toggles and tolerances (all optional, with defaults).
 * @returns success with a DuplicateFinding (severity `warning` when groups exist),
 *   or failure with VALIDATION_ERROR if options or journals fail schema validation.
 */
export function findDuplicateJournals(
  journals: Journal[],
  options: DuplicateOptions = {}
): Result<DuplicateFinding, AppError> {
  const optionResult = duplicateOptionsSchema.safeParse(options)
  if (!optionResult.success) {
    return failure(zodToAppError('重複仕訳検出オプションが無効です', optionResult))
  }
  const opts = optionResult.data
  const journalResult = journalArraySchema.safeParse(journals)
  if (!journalResult.success) {
    return failure(zodToAppError('仕訳データの形式が無効です', journalResult))
  }
  const entries = journalResult.data

  const buckets = new Map<string, ParsedJournal[]>()
  for (const entry of entries) {
    const key = [
      formatDay(entry.entryDate),
      entry.debitAccount,
      entry.creditAccount,
      opts.includeTaxAmount ? String(roundToDecimal(entry.taxAmount, 2)) : '',
      opts.includeDescription ? normalizeDescription(entry.description) : '',
    ].join('')
    const bucket = buckets.get(key) ?? []
    bucket.push(entry)
    buckets.set(key, bucket)
  }

  const groups: DuplicateGroup[] = []
  for (const bucket of buckets.values()) {
    if (bucket.length < opts.minGroupSize) continue
    for (const cluster of clusterByAmount(bucket, opts.amountTolerance)) {
      if (cluster.length < opts.minGroupSize) continue
      const representative = cluster[0]
      const signature = [
        formatDay(representative.entryDate),
        representative.debitAccount,
        representative.creditAccount,
        String(roundToDecimal(representative.amount, 2)),
        opts.includeTaxAmount ? `tax=${roundToDecimal(representative.taxAmount, 2)}` : '',
        opts.includeDescription ? `desc=${normalizeDescription(representative.description)}` : '',
      ]
        .filter((part) => part !== '')
        .join('|')
      groups.push({
        signature,
        count: cluster.length,
        journalIds: cluster.map((entry) => entry.id),
        entryDate: formatDay(representative.entryDate),
        amount: roundToDecimal(representative.amount, 2),
        debitAccount: representative.debitAccount,
        creditAccount: representative.creditAccount,
        taxAmount: opts.includeTaxAmount ? roundToDecimal(representative.taxAmount, 2) : undefined,
        description: opts.includeDescription ? representative.description : undefined,
      })
    }
  }

  groups.sort(
    (a, b) =>
      (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0) ||
      a.amount - b.amount ||
      a.debitAccount.localeCompare(b.debitAccount) ||
      a.creditAccount.localeCompare(b.creditAccount)
  )

  const totalGroups = groups.length
  const entriesInvolved = groups.reduce((sum, group) => sum + group.count, 0)
  const redundantEntries = groups.reduce((sum, group) => sum + (group.count - 1), 0)

  return success({
    kind: 'duplicate',
    severity: totalGroups > 0 ? 'warning' : 'info',
    groups,
    totalGroups,
    entriesInvolved,
    redundantEntries,
  })
}

/**
 * Finds gaps between consecutive journal entry dates exceeding a threshold.
 *
 * @param journals - Journal entries to scan.
 * @param options - `maxGapDays` threshold (default 7).
 * @returns success with a DateGapFinding (severity `warning` when gaps exceed the
 *   threshold), or failure with VALIDATION_ERROR on schema failure.
 */
export function findDateGaps(
  journals: Journal[],
  options: DateGapOptions = {}
): Result<DateGapFinding, AppError> {
  const optionResult = dateGapOptionsSchema.safeParse(options)
  if (!optionResult.success) {
    return failure(zodToAppError('日付ギャップ検出オプションが無効です', optionResult))
  }
  const opts = optionResult.data
  const journalResult = journalArraySchema.safeParse(journals)
  if (!journalResult.success) {
    return failure(zodToAppError('仕訳データの形式が無効です', journalResult))
  }
  const entries = journalResult.data

  const days = new Set<string>()
  for (const entry of entries) {
    if (Number.isFinite(entry.entryDate.getTime())) {
      days.add(formatDay(entry.entryDate))
    }
  }
  const sortedDays = [...days].sort()

  const gaps: DateGap[] = []
  for (let i = 1; i < sortedDays.length; i++) {
    const previous = sortedDays[i - 1]
    const next = sortedDays[i]
    const gap = dayDiff(previous, next)
    if (gap > opts.maxGapDays) {
      gaps.push({ from: previous, to: next, gapDays: gap })
    }
  }

  return success({
    kind: 'date_gap',
    severity: gaps.length > 0 ? 'warning' : 'info',
    gaps,
    periodStart: sortedDays[0] ?? null,
    periodEnd: sortedDays[sortedDays.length - 1] ?? null,
    totalJournals: entries.length,
    uniqueEntryDays: sortedDays.length,
    maxGapDays: opts.maxGapDays,
  })
}

/**
 * Flags journal entries that are structurally unbalanced: non-finite/non-positive
 * amounts, negative tax, or self-offsetting (debit === credit) accounts.
 *
 * @param journals - Journal entries to scan.
 * @param options - Reserved options object (no tunables currently).
 * @returns success with an UnbalancedFinding (severity `warning` when any entry is
 *   flagged), or failure with VALIDATION_ERROR on schema failure.
 */
export function findUnbalancedEntries(
  journals: Journal[],
  options: UnbalancedOptions = {}
): Result<UnbalancedFinding, AppError> {
  const optionResult = unbalancedOptionsSchema.safeParse(options)
  if (!optionResult.success) {
    return failure(zodToAppError('不整合仕訳検出オプションが無効です', optionResult))
  }
  const journalResult = journalArraySchema.safeParse(journals)
  if (!journalResult.success) {
    return failure(zodToAppError('仕訳データの形式が無効です', journalResult))
  }
  const entries = journalResult.data

  const flagged: UnbalancedEntry[] = []
  const byReason: Record<UnbalancedReason, number> = {
    non_finite_amount: 0,
    non_positive_amount: 0,
    non_finite_tax: 0,
    negative_tax: 0,
    self_offsetting: 0,
  }

  for (const entry of entries) {
    const reasons: UnbalancedReason[] = []
    if (!Number.isFinite(entry.amount)) {
      reasons.push('non_finite_amount')
    } else if (entry.amount <= 0) {
      reasons.push('non_positive_amount')
    }
    if (!Number.isFinite(entry.taxAmount)) {
      reasons.push('non_finite_tax')
    } else if (entry.taxAmount < 0) {
      reasons.push('negative_tax')
    }
    if (entry.debitAccount.trim().length > 0 && entry.debitAccount === entry.creditAccount) {
      reasons.push('self_offsetting')
    }
    if (reasons.length === 0) continue
    for (const reason of reasons) {
      byReason[reason] += 1
    }
    flagged.push({
      journalId: entry.id,
      reasons,
      amount: entry.amount,
      taxAmount: entry.taxAmount,
      debitAccount: entry.debitAccount,
      creditAccount: entry.creditAccount,
    })
  }

  return success({
    kind: 'unbalanced',
    severity: flagged.length > 0 ? 'warning' : 'info',
    entries: flagged,
    total: flagged.length,
    byReason,
  })
}

/**
 * Summarizes counterparty accounts (e.g. 売掛金/買掛金) whose journal descriptions
 * are missing or placeholder, grouped by account with sample entries.
 *
 * @param journals - Journal entries to scan.
 * @param options - Counterparty patterns, description length floor, placeholder
 *   tokens, and max samples per account (all optional, with defaults).
 * @returns success with a MissingCounterpartyStats (severity `warning` when any
 *   missing counterparty is found), or failure with VALIDATION_ERROR on schema failure.
 */
export function computeMissingCounterpartyStats(
  journals: Journal[],
  options: MissingCounterpartyOptions = {}
): Result<MissingCounterpartyStats, AppError> {
  const optionResult = missingCounterpartyOptionsSchema.safeParse(options)
  if (!optionResult.success) {
    return failure(zodToAppError('取引先欠損統計オプションが無効です', optionResult))
  }
  const opts = optionResult.data
  const journalResult = journalArraySchema.safeParse(journals)
  if (!journalResult.success) {
    return failure(zodToAppError('仕訳データの形式が無効です', journalResult))
  }
  const entries = journalResult.data

  const matchCounterpartyAccount = (account: string): string | null => {
    for (const pattern of opts.counterpartyAccountPatterns) {
      if (account.includes(pattern)) return account
    }
    return null
  }
  const isCounterpartyMissing = (description: string): boolean => {
    const trimmed = description.trim()
    if (trimmed.length < opts.minDescriptionLength) return true
    return opts.placeholderTokens.includes(trimmed.toLowerCase())
  }

  const byAccountMap = new Map<
    string,
    { count: number; sampleJournalIds: string[]; sampleDescriptions: string[] }
  >()
  let totalEntriesOnCounterpartyAccounts = 0
  let totalMissing = 0

  for (const entry of entries) {
    const matched =
      matchCounterpartyAccount(entry.debitAccount) ?? matchCounterpartyAccount(entry.creditAccount)
    if (matched === null) continue
    totalEntriesOnCounterpartyAccounts += 1
    if (!isCounterpartyMissing(entry.description)) continue
    totalMissing += 1
    const stat = byAccountMap.get(matched) ?? {
      count: 0,
      sampleJournalIds: [],
      sampleDescriptions: [],
    }
    stat.count += 1
    if (stat.sampleJournalIds.length < opts.maxSamples) {
      stat.sampleJournalIds.push(entry.id)
      stat.sampleDescriptions.push(entry.description)
    }
    byAccountMap.set(matched, stat)
  }

  const byAccount = [...byAccountMap.entries()]
    .map(([account, stat]) => ({
      account,
      count: stat.count,
      sampleJournalIds: stat.sampleJournalIds,
      sampleDescriptions: stat.sampleDescriptions,
    }))
    .sort((a, b) => b.count - a.count || a.account.localeCompare(b.account))

  const missingRatio =
    totalEntriesOnCounterpartyAccounts > 0
      ? roundToDecimal(totalMissing / totalEntriesOnCounterpartyAccounts, 4)
      : 0

  return success({
    kind: 'missing_counterparty',
    severity: totalMissing > 0 ? 'warning' : 'info',
    totalEntriesOnCounterpartyAccounts,
    totalMissing,
    missingRatio,
    byAccount,
  })
}

/**
 * Runs all journal-quality checks (duplicates, date gaps, unbalanced entries,
 * missing counterparty) and aggregates them into a single report.
 *
 * @param journals - Journal entries to analyze.
 * @param options - Per-check option overrides (all optional).
 * @returns success with a JournalQualityReport, or failure forwarding the first
 *   check's VALIDATION_ERROR.
 */
export function analyzeJournalQuality(
  journals: Journal[],
  options: JournalQualityOptions = {}
): Result<JournalQualityReport, AppError> {
  const duplicates = findDuplicateJournals(journals, options.duplicates ?? {})
  if (!duplicates.success) return failure(duplicates.error)
  const dateGaps = findDateGaps(journals, options.dateGaps ?? {})
  if (!dateGaps.success) return failure(dateGaps.error)
  const unbalanced = findUnbalancedEntries(journals)
  if (!unbalanced.success) return failure(unbalanced.error)
  const missingCounterparty = computeMissingCounterpartyStats(
    journals,
    options.missingCounterparty ?? {}
  )
  if (!missingCounterparty.success) return failure(missingCounterparty.error)

  return success({
    duplicates: duplicates.data,
    dateGaps: dateGaps.data,
    unbalanced: unbalanced.data,
    missingCounterparty: missingCounterparty.data,
    hasIssues:
      duplicates.data.totalGroups > 0 ||
      dateGaps.data.gaps.length > 0 ||
      unbalanced.data.total > 0 ||
      missingCounterparty.data.totalMissing > 0,
    totalFlaggedEntries:
      duplicates.data.redundantEntries +
      unbalanced.data.total +
      missingCounterparty.data.totalMissing,
  })
}

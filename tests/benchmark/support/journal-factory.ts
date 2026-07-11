import { z } from 'zod'
import type { Journal } from '@/types'
import {
  failure,
  success,
  type Result,
  type AppError,
  createAppError,
  ERROR_CODES,
} from '@/types/result'
import { createRng } from './rng'
import {
  REVENUE_ACCOUNTS,
  COST_OF_SALES_ACCOUNTS,
  SGA_ACCOUNTS,
  ASSET_LIABILITY_ACCOUNTS,
  type CatalogAccount,
} from './accounts'

export const GenerateJournalsSchema = z.object({
  count: z.number().int().min(1).max(1_000_000),
  companyId: z.string().min(1),
  fiscalYear: z.number().int().min(2000).max(2100),
  seed: z.number().int().min(0).max(0xffffffff),
})

export type GenerateJournalsInput = z.infer<typeof GenerateJournalsSchema>

const REVENUE_DESCRIPTIONS = [
  '売上計上',
  'サービス提供収入',
  '研究助成金受領',
  '共同研究収入',
  'ライセンス収入',
]

const COST_DESCRIPTIONS = ['原料仕入', '外注費計上', '購買費用', '製造経費']

const SGA_DESCRIPTIONS = [
  '給与支給',
  '賞与支給',
  '源泉徴収税納付',
  '法人税中間申告',
  '消費税預り計上',
  '減価償却費計上',
  '会議費',
  '旅費交通費',
  '専門サービス費用',
  '施設費',
]

const TAX_TYPES = ['taxable_10', 'taxable_8', 'non_taxable'] as const
const AUDIT_STATUSES = ['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PASSED', 'FAILED'] as const

type TxKind = 'revenue' | 'costOfSales' | 'sga'

function pickTransaction(rng: { next: () => number; pick: <T>(i: readonly T[]) => T }): {
  kind: TxKind
  debit: CatalogAccount
  credit: CatalogAccount
  descriptions: readonly string[]
} {
  const roll = rng.next()
  if (roll < 0.25) {
    return {
      kind: 'revenue',
      debit: rng.pick(ASSET_LIABILITY_ACCOUNTS),
      credit: rng.pick(REVENUE_ACCOUNTS),
      descriptions: REVENUE_DESCRIPTIONS,
    }
  }
  if (roll < 0.45) {
    return {
      kind: 'costOfSales',
      debit: rng.pick(COST_OF_SALES_ACCOUNTS),
      credit: rng.pick(ASSET_LIABILITY_ACCOUNTS),
      descriptions: COST_DESCRIPTIONS,
    }
  }
  return {
    kind: 'sga',
    debit: rng.pick(SGA_ACCOUNTS),
    credit: rng.pick(ASSET_LIABILITY_ACCOUNTS),
    descriptions: SGA_DESCRIPTIONS,
  }
}

function roundToHundreds(value: number): number {
  return Math.round(value / 100) * 100
}

/**
 * Deterministic synthetic journal generator. Produces `count` double-entry
 * `Journal` records from a seeded RNG (mulberry32) so every run with the same
 * seed yields byte-identical data. Account selection follows the catalog in
 * `./accounts`, keeping budget-prefix and report-category conventions intact.
 *
 * @param input - { count, companyId, fiscalYear, seed } validated with Zod.
 * @returns success with the journal array, or failure on invalid input.
 */
export function generateJournals(input: GenerateJournalsInput): Result<Journal[], AppError> {
  const parsed = GenerateJournalsSchema.safeParse(input)
  if (!parsed.success) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, parsed.error.message))
  }

  const { count, companyId, fiscalYear, seed } = parsed.data
  const rng = createRng(seed)
  const journals: Journal[] = []

  for (let i = 0; i < count; i++) {
    const tx = pickTransaction(rng)
    const month = rng.int(1, 12)
    const day = rng.int(1, 28)
    const entryDate = new Date(fiscalYear, month - 1, day, 12, 0, 0, 0)

    const gross = roundToHundreds(rng.int(1000, 500000))
    const taxRoll = rng.next()
    const taxType = taxRoll < 0.7 ? TAX_TYPES[0] : taxRoll < 0.85 ? TAX_TYPES[1] : TAX_TYPES[2]
    const amount = taxType === 'non_taxable' ? gross : Math.round(gross / 1.1)
    const taxAmount = taxType === 'non_taxable' ? 0 : gross - amount

    const description = `${tx.descriptions[i % tx.descriptions.length]} #${i}`

    journals.push({
      id: `j-${seed.toString(36)}-${i.toString(36)}`,
      companyId,
      freeeJournalId: `fj-${seed}-${i}`,
      entryDate,
      description,
      debitAccount: tx.debit.code,
      creditAccount: tx.credit.code,
      amount,
      taxAmount,
      taxType,
      auditStatus: AUDIT_STATUSES[i % AUDIT_STATUSES.length],
      syncedAt: entryDate,
      createdAt: entryDate,
    })
  }

  return success(journals)
}

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { performance } from 'node:perf_hooks'

vi.mock('@/services/budget/budget-service', () => ({
  getBudgetsByMonth: vi.fn(),
  getBudgetsByFiscalYear: vi.fn(),
}))

import { getBudgetsByMonth } from '@/services/budget/budget-service'
import { calculateActualVsBudget, analyzeBudgetVariance } from '@/services/budget/actual-vs-budget'
import { generateJournals } from './support/journal-factory'
import { journalsToProfitLoss } from './support/derive'
import { recordBench } from './support/bench-reporter'
import type { ProfitLoss } from '@/types'
import type { Budget } from '@prisma/client'

const SEED = 0x12345678
const COUNT = 100_000
const FISCAL_YEAR = 2024
const MONTH = 6
const COMPANY_ID = 'bench-co-1'
const WARMUP = 1
const ITERATIONS = 5

function buildBudgetRows(pl: ProfitLoss): Budget[] {
  const rows: Budget[] = []
  const allItems = [...pl.revenue, ...pl.costOfSales, ...pl.sgaExpenses]
  const stamped = new Date(0)
  allItems.forEach((item, idx) => {
    const factor = 0.9 + (idx % 5) * 0.05
    rows.push({
      id: `bud-${item.code}`,
      companyId: COMPANY_ID,
      fiscalYear: FISCAL_YEAR,
      month: MONTH,
      departmentId: null,
      accountCode: item.code,
      accountName: item.name,
      amount: Math.round(item.amount * factor),
      note: null,
      createdAt: stamped,
      updatedAt: stamped,
    })
  })
  return rows
}

describe('benchmark: budget variance computation', () => {
  let pl: ProfitLoss

  beforeAll(() => {
    const journals = generateJournals({
      count: COUNT,
      companyId: COMPANY_ID,
      fiscalYear: FISCAL_YEAR,
      seed: SEED,
    })
    if (!journals.success) throw journals.error
    const plResult = journalsToProfitLoss(journals.data, FISCAL_YEAR, MONTH)
    if (!plResult.success) throw plResult.error
    pl = plResult.data
    vi.mocked(getBudgetsByMonth).mockResolvedValue(buildBudgetRows(pl))
  })

  it('computes actual-vs-budget and extracts significant variances', async () => {
    for (let w = 0; w < WARMUP; w++) {
      const avb = await calculateActualVsBudget(COMPANY_ID, FISCAL_YEAR, MONTH, pl)
      analyzeBudgetVariance(avb, 10)
    }

    const samples: number[] = []
    let lastItems = 0
    let lastSignificant = 0
    let varianceFinite = false
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now()
      const avb = await calculateActualVsBudget(COMPANY_ID, FISCAL_YEAR, MONTH, pl)
      const variance = analyzeBudgetVariance(avb, 10)
      const end = performance.now()
      samples.push(end - start)

      lastItems = avb.items.length
      lastSignificant = variance.significantVariances.length
      varianceFinite = Number.isFinite(variance.summary.totalVariance)
    }

    const ok = lastItems > 0 && varianceFinite
    expect(ok).toBe(true)

    const recorded = recordBench({
      name: 'budget-variance',
      inputSize: pl.revenue.length + pl.costOfSales.length + pl.sgaExpenses.length,
      iterations: ITERATIONS,
      samplesMs: samples,
      assertion: ok ? 'passed' : 'failed',
      meta: {
        target: 'calculateActualVsBudget + analyzeBudgetVariance',
        lineItems: lastItems,
        significantVariances: lastSignificant,
      },
    })
    expect(recorded.success).toBe(true)

    const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]
    console.log(
      `[bench] budget-variance: median=${median.toFixed(2)}ms over ${ITERATIONS} runs ` +
        `(${lastItems} line items, ${lastSignificant} significant variances)`
    )
  })
})

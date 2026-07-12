import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateDetailedActualVsBudget } from '@/services/budget/detailed-actual-vs-budget'
import { getBudgetsByMonth } from '@/services/budget/budget-service'
import type { ProfitLoss } from '@/types'

/**
 * EDGE-01 — error / edge-case deepening for detailed-actual-vs-budget.
 *
 * The existing suite asserts `toBeDefined()` for the zero-budget rate path but
 * never exercises the two `budget === 0` status branches:
 *   - getRevenueStatus: budget 0, actual < 0 → 'bad' (a revenue account with no
 *     budget that is actually negative — e.g. net returns exceeding sales).
 *   - getExpenseStatus: budget 0, actual === 0 → 'good' (an expense account with
 *     no budget and no actual spend).
 * Both are reached through the public calculateDetailedActualVsBudget with an
 * empty budget set, so every stage budget is 0.
 */

vi.mock('@/services/budget/budget-service', () => ({
  getBudgetsByMonth: vi.fn(),
}))

function makePL(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  return {
    fiscalYear: 2024,
    month: 12,
    revenue: [],
    costOfSales: [],
    grossProfit: 0,
    grossProfitMargin: 0,
    sgaExpenses: [],
    operatingIncome: 0,
    operatingMargin: 0,
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    ordinaryIncome: 0,
    extraordinaryIncome: [],
    extraordinaryLoss: [],
    incomeBeforeTax: 0,
    incomeTax: 0,
    netIncome: 0,
    depreciation: 0,
    ...overrides,
  }
}

describe('DetailedActualVsBudgetService — zero-budget status boundaries', () => {
  const companyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rates a negative actual against a zero revenue budget as bad', async () => {
    // No budgets → every stage budget is 0. Revenue actual −500,000 (returns > sales).
    vi.mocked(getBudgetsByMonth).mockResolvedValue([])
    const pl = makePL({
      revenue: [{ code: '400', name: '売上高', amount: -500000 }],
      grossProfit: -500000,
      operatingIncome: -500000,
      netIncome: -500000,
    })

    const result = await calculateDetailedActualVsBudget(companyId, 2024, 12, pl)

    const revenueStage = result.stageLevel.find((s) => s.stage === '売上高')!
    expect(revenueStage.budget).toBe(0)
    expect(revenueStage.actual).toBe(-500000)
    expect(revenueStage.status).toBe('bad')
    // Account-level mirrors the stage-level status for the same inputs.
    expect(result.accountLevel.find((a) => a.code === '400')!.status).toBe('bad')
  })

  it('rates a zero actual against a zero expense budget as good', async () => {
    // No budgets → cost-of-sales budget 0; empty costOfSales → actual 0.
    vi.mocked(getBudgetsByMonth).mockResolvedValue([])
    const pl = makePL({
      revenue: [{ code: '400', name: '売上高', amount: 1000000 }],
      costOfSales: [],
      grossProfit: 1000000,
      operatingIncome: 1000000,
      netIncome: 700000,
    })

    const result = await calculateDetailedActualVsBudget(companyId, 2024, 12, pl)

    const costStage = result.stageLevel.find((s) => s.stage === '売上原価')!
    expect(costStage.budget).toBe(0)
    expect(costStage.actual).toBe(0)
    expect(costStage.status).toBe('good')
  })

  it('rates a positive actual against a zero revenue budget as good (non-negative path)', async () => {
    // Covers the `actual >= 0 → good` arm of getRevenueStatus when budget is 0.
    vi.mocked(getBudgetsByMonth).mockResolvedValue([])
    const pl = makePL({
      revenue: [{ code: '400', name: '売上高', amount: 300000 }],
      grossProfit: 300000,
      operatingIncome: 300000,
      netIncome: 210000,
    })

    const result = await calculateDetailedActualVsBudget(companyId, 2024, 12, pl)

    const revenueStage = result.stageLevel.find((s) => s.stage === '売上高')!
    expect(revenueStage.budget).toBe(0)
    expect(revenueStage.actual).toBe(300000)
    expect(revenueStage.status).toBe('good')
  })
})

import { z } from 'zod'
import { safeDivide } from '@/lib/utils'
import { createAppError, ERROR_CODES, success, failure, type Result } from '@/types/result'
import type {
  ManagerialMetrics,
  VarianceBridge,
  VarianceBridgeDriver,
} from '@/types/reports/managerial'

/**
 * 管理会計（CVP分析）サービス
 *
 * 限界利益・損益分岐点など、管理会計の財務計算式を UI 層から分離して保持する。
 * すべて純粋関数で DB に依存せず、Result<T, E> を返し、入力は Zod safeParse で検証する。
 * 売上原価を変動費、販売管理費を固定費とみなす簡易分類を採用（分類の決定は API ルート層）。
 */

export const managerialMetricsInputSchema = z.object({
  revenue: z.number(),
  variableCosts: z.number().min(0),
  fixedCosts: z.number().min(0),
})

export type ManagerialMetricsInput = z.infer<typeof managerialMetricsInputSchema>

/**
 * 限界利益・損益分岐点売上高・安全余裕率を計算する。
 *
 * - 限界利益 = 売上高 − 変動費
 * - 限界利益率 = 限界利益 / 売上高
 * - 損益分岐点売上高 = 固定費 / 限界利益率（限界利益率 <= 0 の場合は算出不可 = null）
 * - 安全余裕額 = 売上高 − 損益分岐点売上高
 * - 安全余裕率 = 安全余裕額 / 売上高
 *
 * @param input - { revenue, variableCosts, fixedCosts }
 * @returns Result<ManagerialMetrics>。入力不正時は VALIDATION_ERROR。
 */
export function computeManagerialMetrics(input: unknown): Result<ManagerialMetrics> {
  const parsed = managerialMetricsInputSchema.safeParse(input)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, '管理会計指標の入力が不正です', {
        details: { issues: parsed.error.issues },
      })
    )
  }

  const { revenue, variableCosts, fixedCosts } = parsed.data
  const contributionMargin = revenue - variableCosts
  const contributionMarginRatio = safeDivide(contributionMargin, revenue) * 100
  const operatingIncome = contributionMargin - fixedCosts

  const achievable = revenue > 0 && contributionMargin > 0
  const breakEvenSales = achievable ? fixedCosts / (contributionMargin / revenue) : null
  const marginOfSafetySales = breakEvenSales !== null ? revenue - breakEvenSales : null
  const marginOfSafetyRatio =
    marginOfSafetySales !== null ? safeDivide(marginOfSafetySales, revenue) * 100 : null

  return success({
    revenue,
    variableCosts,
    fixedCosts,
    contributionMargin,
    contributionMarginRatio,
    breakEvenSales,
    marginOfSafetySales,
    marginOfSafetyRatio,
    operatingIncome,
  })
}

const stageItemSchema = z.object({
  stage: z.string(),
  budget: z.number(),
  actual: z.number(),
  variance: z.number(),
})

export const varianceBridgeInputSchema = z.object({
  startLabel: z.string().default('営業利益（予算）'),
  endLabel: z.string().default('営業利益（実績）'),
  stages: z.array(stageItemSchema).min(1),
})

export type VarianceBridgeInput = z.infer<typeof varianceBridgeInputSchema>

const STAGE_NAMES = {
  revenue: '売上高',
  costOfSales: '売上原価',
  sga: '販売管理費',
  operatingIncome: '営業利益',
} as const

function findStage(
  stages: z.infer<typeof stageItemSchema>[],
  name: string
): z.infer<typeof stageItemSchema> | undefined {
  return stages.find((s) => s.stage === name)
}

/**
 * 段階損益（stageLevel）から営業利益の予算→実績ブリッジ（ウォーターフォール）を構築する。
 *
 * 符号規約（営業利益ブリッジ）:
 *  - 売上高差異: actual − budget をそのまま追加（正=利益増）
 *  - 売上原価差異: −(actual − budget)（費用の増加は利益減）
 *  - 販売管理費差異: −(actual − budget)（同上）
 *
 * 営業利益の予算 = start、実績 = end とし、start + Σdrivers.amount = end となる（reconciliationGap で検証）。
 * 売上高・売上原価・販売管理費・営業利益の各ステージがすべて存在することが前提。
 *
 * @param input - { startLabel?, endLabel?, stages: StageLevelComparison[] 互換 }
 * @returns Result<VarianceBridge>。必須ステージ欠落時は VALIDATION_ERROR。
 */
export function buildVarianceBridge(input: unknown): Result<VarianceBridge> {
  const parsed = varianceBridgeInputSchema.safeParse(input)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, '差異ブリッジの入力が不正です', {
        details: { issues: parsed.error.issues },
      })
    )
  }

  const { startLabel, endLabel, stages } = parsed.data
  const revenueStage = findStage(stages, STAGE_NAMES.revenue)
  const cogsStage = findStage(stages, STAGE_NAMES.costOfSales)
  const sgaStage = findStage(stages, STAGE_NAMES.sga)
  const operatingIncomeStage = findStage(stages, STAGE_NAMES.operatingIncome)

  if (!revenueStage || !cogsStage || !sgaStage || !operatingIncomeStage) {
    const missing: string[] = []
    if (!revenueStage) missing.push(STAGE_NAMES.revenue)
    if (!cogsStage) missing.push(STAGE_NAMES.costOfSales)
    if (!sgaStage) missing.push(STAGE_NAMES.sga)
    if (!operatingIncomeStage) missing.push(STAGE_NAMES.operatingIncome)
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, '差異ブリッジに必要なステージが欠落しています', {
        details: { missing },
      })
    )
  }

  const drivers: VarianceBridgeDriver[] = [
    {
      label: '売上高差異',
      amount: revenueStage.variance,
      category: 'revenue',
    },
    {
      label: '売上原価差異',
      amount: -cogsStage.variance,
      category: 'cost_of_sales',
    },
    {
      label: '販売管理費差異',
      amount: -sgaStage.variance,
      category: 'sga_expense',
    },
  ]

  const start = operatingIncomeStage.budget
  const end = operatingIncomeStage.actual
  const driversSum = drivers.reduce((sum, d) => sum + d.amount, 0)
  const reconciliationGap = end - (start + driversSum)

  return success({
    startLabel,
    start,
    drivers,
    endLabel,
    end,
    reconciliationGap,
  })
}

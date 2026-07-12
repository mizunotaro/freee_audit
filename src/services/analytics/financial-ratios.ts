// ============================================================================
// FIN-IMPL-04 — Strengthened financial-ratio set.
//
// Additive surface: the legacy calculateFinancialKPIs / calculateExtendedKPIs
// (in financial-kpi.ts) are intentionally untouched (consumed by monthly-report
// / reports+kpi / analysis routes). Everything here returns Result<T, AppError>,
// validates inputs with Zod safeParse, and cites a standard definition per
// docs/proposals/fin-design-03-accounting-metrics.md §5. Judgemental treatments
// are marked `// PENDING HUMAN DETERMINATION` and default to the most
// conservative / most standard option.
//
// Module-wide convention (matches existing safeDivide usage): a zero
// denominator yields 0, never Infinity/NaN. "Not computable" outcomes that are
// NOT a zero-denominator (e.g. a missing prior period for a growth metric) are
// surfaced as a Result failure (helper) or null (aggregator field).
// ============================================================================

import type { BalanceSheet, ProfitLoss, IndustrySector } from '@/types'
import { safeDivide, calculateGrowthRate } from '@/lib/utils'
import { z } from 'zod'
import {
  success,
  failure,
  createAppError,
  ERROR_CODES,
  type Result,
  type AppError,
} from '@/types/result'
import {
  roundTo2,
  roundTo4,
  getTotalRevenue,
  getTotalInventory,
  getTotalReceivables,
  getTotalPayables,
} from './financial-statement-helpers'

const DAYS_IN_YEAR = 365

const balanceSheetItemSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
  })
  .passthrough()

const profitLossItemSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
  })
  .passthrough()

const balanceSheetSchema = z
  .object({
    fiscalYear: z.number(),
    month: z.number(),
    assets: z.object({
      current: z.array(balanceSheetItemSchema),
      fixed: z.array(balanceSheetItemSchema),
      total: z.number(),
    }),
    liabilities: z.object({
      current: z.array(balanceSheetItemSchema),
      fixed: z.array(balanceSheetItemSchema),
      total: z.number(),
    }),
    equity: z.object({
      items: z.array(balanceSheetItemSchema),
      total: z.number(),
    }),
    totalAssets: z.number(),
    totalLiabilities: z.number(),
    totalEquity: z.number(),
  })
  .passthrough()

const profitLossSchema = z
  .object({
    fiscalYear: z.number(),
    month: z.number(),
    revenue: z.array(profitLossItemSchema),
    costOfSales: z.array(profitLossItemSchema),
    grossProfit: z.number(),
    grossProfitMargin: z.number(),
    sgaExpenses: z.array(profitLossItemSchema),
    operatingIncome: z.number(),
    operatingMargin: z.number(),
    nonOperatingIncome: z.array(profitLossItemSchema),
    nonOperatingExpenses: z.array(profitLossItemSchema),
    ordinaryIncome: z.number(),
    extraordinaryIncome: z.array(profitLossItemSchema),
    extraordinaryLoss: z.array(profitLossItemSchema),
    incomeBeforeTax: z.number(),
    incomeTax: z.number(),
    netIncome: z.number(),
    depreciation: z.number(),
  })
  .passthrough()

function parseOrFail<T>(schema: z.ZodType<T>, value: unknown, field: string): Result<T, AppError> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, `Invalid ${field}: schema validation failed`, {
        details: {
          field,
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      })
    )
  }
  return success(parsed.data)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function averageOf(current: number, previous?: number): number {
  return previous === undefined ? current : (current + previous) / 2
}

function grow(r: Result<number, AppError>): number | null {
  return r.success ? r.data : null
}

// Interest-bearing debt: short + long-term borrowings, bonds, leases by name.
// PENDING HUMAN DETERMINATION: scope (include leases / short-term bonds?).
function getInterestBearingDebt(bs: BalanceSheet): number {
  return [...bs.liabilities.current, ...bs.liabilities.fixed]
    .filter((l) => l.name.includes('借入') || l.name.includes('社債') || l.name.includes('リース'))
    .reduce((sum, l) => sum + l.amount, 0)
}

// Cash & deposits only.
// PENDING HUMAN DETERMINATION: include marketable securities (有価証券)?
function getCashAndEquivalents(bs: BalanceSheet): number {
  return bs.assets.current
    .filter((a) => a.name.includes('現金') || a.name.includes('預金'))
    .reduce((sum, a) => sum + a.amount, 0)
}

// Net fixed assets = sum of fixed-asset items (accumulated depreciation is a
// negative contra-asset line, so the sum is already net).
function getNetFixedAssets(bs: BalanceSheet): number {
  return bs.assets.fixed.reduce((sum, a) => sum + a.amount, 0)
}

// EBIT = operating income (operating-only view; standard for ROIC/NOPAT which
// measure return on operating capital).
// PENDING HUMAN DETERMINATION: alternative EBIT = ordinaryIncome + interestExpense.
function getEBIT(pl: ProfitLoss): number {
  return pl.operatingIncome
}

// EBITDA = operating income + depreciation + amortization. Amortization is not
// carried on the ProfitLoss model (always 0), so this collapses to opInc + dep.
function getEBITDA(pl: ProfitLoss): number {
  return pl.operatingIncome + (pl.depreciation || 0)
}

// Interest expense MUST be read from nonOperatingExpenses (支払利息), NOT
// sgaExpenses — fixes the bucket bug noted in fin-design-03 §4 (the legacy
// bank KPIs read sgaExpenses, which yields 0/wrong).
function getInterestExpense(pl: ProfitLoss): number {
  return pl.nonOperatingExpenses
    .filter((e) => e.name.includes('支払利息') || e.name.includes('利息'))
    .reduce((sum, e) => sum + e.amount, 0)
}

function validateOptionalBS(previousBS?: BalanceSheet): Result<void, AppError> {
  if (!previousBS) return success(undefined)
  const parsed = parseOrFail(balanceSheetSchema, previousBS, 'previousBalanceSheet')
  if (!parsed.success) return parsed
  return success(undefined)
}

// ----------------------------------------------------------------------------
// Profitability
// ----------------------------------------------------------------------------

export interface NOPATResult {
  ebit: number
  effectiveTaxRate: number
  nopat: number
}

export interface ROICResult {
  roic: number
  nopat: number
  ebit: number
  effectiveTaxRate: number
  investedCapital: number
}

/**
 * NOPAT = EBIT × (1 − effectiveTaxRate). Cited: standard NOPAT definition.
 * effectiveTaxRate = incomeTax / incomeBeforeTax, clamped to [0, 1].
 * PENDING HUMAN DETERMINATION: when incomeBeforeTax ≤ 0 the effective rate is
 * not meaningful; defaults to 0 (NOPAT = EBIT, i.e. assumes no tax shield).
 */
export function calcNOPAT(pl: ProfitLoss): Result<NOPATResult, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const ebit = getEBIT(plOk.data)
  const effectiveTaxRate =
    plOk.data.incomeBeforeTax > 0 ? clamp(plOk.data.incomeTax / plOk.data.incomeBeforeTax, 0, 1) : 0
  const nopat = ebit * (1 - effectiveTaxRate)
  return success({ ebit: roundTo2(ebit), effectiveTaxRate: roundTo4(effectiveTaxRate), nopat })
}

/**
 * ROE = Net Income / Average Shareholders' Equity × 100. Cited: standard ROE
 * (average-equity is the GAAP-correct form). Uses (current+previous)/2 when a
 * prior balance sheet is supplied, else period-end equity.
 * PENDING HUMAN DETERMINATION: average vs period-end denominator.
 */
export function calcROE(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk
  const equity = averageOf(bsOk.data.totalEquity, previousBS?.totalEquity)
  return success(roundTo2(safeDivide(plOk.data.netIncome, equity) * 100))
}

/**
 * ROA = Net Income / Average Total Assets × 100. Cited: standard ROA.
 * PENDING HUMAN DETERMINATION: average vs period-end denominator.
 */
export function calcROA(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk
  const assets = averageOf(bsOk.data.totalAssets, previousBS?.totalAssets)
  return success(roundTo2(safeDivide(plOk.data.netIncome, assets) * 100))
}

/**
 * ROIC = NOPAT / Average Invested Capital × 100. Cited: standard ROIC.
 * Invested capital (financing approach) = equity + interestBearingDebt − cash.
 * PENDING HUMAN DETERMINATION: (a) invested-capital definition (financing vs
 * operating NWC+netFA approach); (b) average vs period-end; (c) whether to net
 * cash (netting raises ROIC — the non-netting alternative is more conservative).
 */
export function calcROIC(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<ROICResult, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk

  const nopatResult = calcNOPAT(plOk.data)
  if (!nopatResult.success) return nopatResult
  const { nopat, ebit, effectiveTaxRate } = nopatResult.data

  const currentIC =
    bsOk.data.totalEquity + getInterestBearingDebt(bsOk.data) - getCashAndEquivalents(bsOk.data)
  const previousIC = previousBS
    ? previousBS.totalEquity +
      getInterestBearingDebt(previousBS) -
      getCashAndEquivalents(previousBS)
    : undefined
  const investedCapital = averageOf(currentIC, previousIC)
  const roic = safeDivide(nopat, investedCapital) * 100
  return success({
    roic: roundTo2(roic),
    nopat: roundTo2(nopat),
    ebit,
    effectiveTaxRate,
    investedCapital: roundTo2(investedCapital),
  })
}

/** Gross profit margin = Gross Profit / Revenue × 100. */
export function calcGrossMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(plOk.data.grossProfit, getTotalRevenue(plOk.data)) * 100))
}

/** Operating margin = Operating Income / Revenue × 100. */
export function calcOperatingMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(plOk.data.operatingIncome, getTotalRevenue(plOk.data)) * 100))
}

/** Net margin = Net Income / Revenue × 100. */
export function calcNetMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(plOk.data.netIncome, getTotalRevenue(plOk.data)) * 100))
}

/** EBIT margin = EBIT / Revenue × 100. EBIT = operatingIncome (see getEBIT). */
export function calcEBITMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBIT(plOk.data), getTotalRevenue(plOk.data)) * 100))
}

/** EBITDA margin = EBITDA / Revenue × 100. */
export function calcEBITDAMargin(pl: ProfitLoss): Result<number, AppError> {
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBITDA(plOk.data), getTotalRevenue(plOk.data)) * 100))
}

// ----------------------------------------------------------------------------
// Liquidity
// ----------------------------------------------------------------------------

/** Current ratio = Current Assets / Current Liabilities × 100 (%). */
export function calcCurrentRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const ca = bsOk.data.assets.current.reduce((s, a) => s + a.amount, 0)
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(ca, cl) * 100))
}

/** Quick ratio = (Current Assets − Inventory) / Current Liabilities × 100 (%). */
export function calcQuickRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const ca = bsOk.data.assets.current.reduce((s, a) => s + a.amount, 0)
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(ca - getTotalInventory(bsOk.data), cl) * 100))
}

/** Cash ratio = Cash & equivalents / Current Liabilities × 100 (%). */
export function calcCashRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(getCashAndEquivalents(bsOk.data), cl) * 100))
}

/** Working capital = Current Assets − Current Liabilities. */
export function calcWorkingCapital(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const ca = bsOk.data.assets.current.reduce((s, a) => s + a.amount, 0)
  const cl = bsOk.data.liabilities.current.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(ca - cl))
}

/**
 * Days Inventory Outstanding = Inventory / COGS × 365.
 * PENDING HUMAN DETERMINATION: 365 vs 360 day convention.
 */
export function calcDIO(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(getTotalInventory(bsOk.data), cogs) * DAYS_IN_YEAR))
}

/**
 * Days Sales Outstanding = Receivables / Revenue × 365.
 * PENDING HUMAN DETERMINATION: revenue vs credit-sales denominator.
 */
export function calcDSO(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const revenue = getTotalRevenue(plOk.data)
  return success(roundTo2(safeDivide(getTotalReceivables(bsOk.data), revenue) * DAYS_IN_YEAR))
}

/**
 * Days Payable Outstanding = Payables / COGS × 365.
 * PENDING HUMAN DETERMINATION: COGS vs purchases denominator.
 */
export function calcDPO(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(getTotalPayables(bsOk.data), cogs) * DAYS_IN_YEAR))
}

/**
 * Cash Conversion Cycle = DIO + DSO − DPO (days). Cited: standard CCC.
 * Demanded by DD checklist MA-WC-001. For inventory-less sectors DIO is 0 and
 * the cycle reflects only the receivables/payables gap.
 */
export function calcCCC(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const dio = calcDIO(bs, pl)
  if (!dio.success) return dio
  const dso = calcDSO(bs, pl)
  if (!dso.success) return dso
  const dpo = calcDPO(bs, pl)
  if (!dpo.success) return dpo
  return success(roundTo2(dio.data + dso.data - dpo.data))
}

// ----------------------------------------------------------------------------
// Leverage / safety
// ----------------------------------------------------------------------------

/** Debt-to-equity = Total Liabilities / Equity. */
export function calcDebtToEquity(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalLiabilities, bsOk.data.totalEquity)))
}

/** Equity ratio = Equity / Total Assets × 100 (%). */
export function calcEquityRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalEquity, bsOk.data.totalAssets) * 100))
}

/** Debt ratio = Total Liabilities / Total Assets × 100 (%). */
export function calcDebtRatio(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalLiabilities, bsOk.data.totalAssets) * 100))
}

/** Long-term debt-to-equity = Fixed Liabilities / Equity. */
export function calcLongTermDebtToEquity(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const fixedLiab = bsOk.data.liabilities.fixed.reduce((s, l) => s + l.amount, 0)
  return success(roundTo2(safeDivide(fixedLiab, bsOk.data.totalEquity)))
}

/** Equity multiplier = Total Assets / Equity (also the DuPont leverage factor). */
export function calcEquityMultiplier(bs: BalanceSheet): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  return success(roundTo2(safeDivide(bsOk.data.totalAssets, bsOk.data.totalEquity)))
}

/** Debt-to-EBITDA = Interest-bearing debt / EBITDA (covenant-common). */
export function calcDebtToEBITDA(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getInterestBearingDebt(bsOk.data), getEBITDA(plOk.data))))
}

/** Net debt-to-EBITDA = (IBD − cash) / EBITDA. */
export function calcNetDebtToEBITDA(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const netDebt = getInterestBearingDebt(bsOk.data) - getCashAndEquivalents(bsOk.data)
  return success(roundTo2(safeDivide(netDebt, getEBITDA(plOk.data))))
}

/**
 * Times Interest Earned = EBIT / Interest Expense.
 * Interest read from nonOperatingExpenses (支払利息). Returns 0 when there is
 * no interest expense (module-wide zero-denominator convention).
 * PENDING HUMAN DETERMINATION: 0 vs null/∞ when interest = 0.
 */
export function calcTimesInterestEarned(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBIT(plOk.data), getInterestExpense(plOk.data))))
}

/**
 * Interest coverage ratio = EBITDA / Interest Expense (EBITDA-based coverage).
 * Interest read from nonOperatingExpenses (支払利息). Returns 0 when no interest.
 * PENDING HUMAN DETERMINATION: EBIT vs EBITDA base; 0 vs null when interest = 0.
 */
export function calcInterestCoverageRatio(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getEBITDA(plOk.data), getInterestExpense(plOk.data))))
}

// ----------------------------------------------------------------------------
// Efficiency turnovers
// ----------------------------------------------------------------------------

/**
 * Asset turnover = Revenue / Average Total Assets.
 * PENDING HUMAN DETERMINATION: average vs period-end denominator.
 */
export function calcAssetTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk
  const assets = averageOf(bsOk.data.totalAssets, previousBS?.totalAssets)
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), assets)))
}

/**
 * Inventory turnover = COGS / Inventory. Forced to 0 for inventory-less sectors
 * (service/technology/finance), matching the legacy calculateEfficiencyKPIs
 * sector gating.
 */
export function calcInventoryTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss,
  sector?: IndustrySector
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  if (sector && ['service', 'technology', 'finance'].includes(sector)) {
    return success(0)
  }
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(cogs, getTotalInventory(bsOk.data))))
}

/** Receivables turnover = Revenue / Receivables. */
export function calcReceivablesTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), getTotalReceivables(bsOk.data))))
}

/** Payables turnover = COGS / Payables. */
export function calcPayablesTurnover(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const cogs = plOk.data.costOfSales.reduce((s, c) => s + c.amount, 0)
  return success(roundTo2(safeDivide(cogs, getTotalPayables(bsOk.data))))
}

/** Fixed-asset turnover = Revenue / Net Fixed Assets. */
export function calcFixedAssetTurnover(bs: BalanceSheet, pl: ProfitLoss): Result<number, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), getNetFixedAssets(bsOk.data))))
}

/** Working-capital turnover = Revenue / Working Capital. */
export function calcWorkingCapitalTurnover(
  bs: BalanceSheet,
  pl: ProfitLoss
): Result<number, AppError> {
  const wc = calcWorkingCapital(bs)
  if (!wc.success) return wc
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  return success(roundTo2(safeDivide(getTotalRevenue(plOk.data), wc.data)))
}

// ----------------------------------------------------------------------------
// Growth (period-over-period). Returns failure when the prior period is absent.
// PENDING HUMAN DETERMINATION: sign convention for loss-making bases — the
// shared calculateGrowthRate divides by |previous|, so a negative base yields a
// sign-misleading % (a halved loss shows −50%). Consumers should treat growth
// as non-meaningful when previous ≤ 0.
// ----------------------------------------------------------------------------

export function calcRevenueGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, 'Previous-period P&L is required for revenue growth')
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(
    roundTo2(calculateGrowthRate(getTotalRevenue(plOk.data), getTotalRevenue(prevOk.data)))
  )
}

export function calcProfitGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, 'Previous-period P&L is required for profit growth')
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(plOk.data.netIncome, prevOk.data.netIncome)))
}

export function calcGrossProfitGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period P&L is required for gross-profit growth'
      )
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(plOk.data.grossProfit, prevOk.data.grossProfit)))
}

export function calcOperatingIncomeGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period P&L is required for operating-income growth'
      )
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(
    roundTo2(calculateGrowthRate(plOk.data.operatingIncome, prevOk.data.operatingIncome))
  )
}

export function calcOrdinaryIncomeGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period P&L is required for ordinary-income growth'
      )
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(
    roundTo2(calculateGrowthRate(plOk.data.ordinaryIncome, prevOk.data.ordinaryIncome))
  )
}

export function calcEBITDAGrowth(
  pl: ProfitLoss,
  previousPL?: ProfitLoss
): Result<number, AppError> {
  if (!previousPL) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, 'Previous-period P&L is required for EBITDA growth')
    )
  }
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = parseOrFail(profitLossSchema, previousPL, 'previousProfitLoss')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(getEBITDA(plOk.data), getEBITDA(prevOk.data))))
}

export function calcAssetGrowth(
  bs: BalanceSheet,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  if (!previousBS) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period balance sheet is required for asset growth'
      )
    )
  }
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const prevOk = parseOrFail(balanceSheetSchema, previousBS, 'previousBalanceSheet')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(bsOk.data.totalAssets, prevOk.data.totalAssets)))
}

export function calcEquityGrowth(
  bs: BalanceSheet,
  previousBS?: BalanceSheet
): Result<number, AppError> {
  if (!previousBS) {
    return failure(
      createAppError(
        ERROR_CODES.NOT_FOUND,
        'Previous-period balance sheet is required for equity growth'
      )
    )
  }
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const prevOk = parseOrFail(balanceSheetSchema, previousBS, 'previousBalanceSheet')
  if (!prevOk.success) return prevOk
  return success(roundTo2(calculateGrowthRate(bsOk.data.totalEquity, prevOk.data.totalEquity)))
}

// ----------------------------------------------------------------------------
// DuPont decomposition
// ----------------------------------------------------------------------------

export interface DuPontResult {
  /** ROE (percent) = netMargin × assetTurnover × equityMultiplier × 100. */
  roe: number
  /** Net income / revenue (decimal). */
  netMargin: number
  /** Revenue / average total assets (ratio). */
  assetTurnover: number
  /** Average total assets / average equity (ratio). */
  equityMultiplier: number
  /** Net income / income before tax (5-step tax burden; null if not computable). */
  taxBurden: number | null
  /** Income before tax / EBIT (5-step interest burden; null if not computable). */
  interestBurden: number | null
  /** EBIT / revenue (5-step operating margin; null if not computable). */
  ebitMargin: number | null
}

/**
 * DuPont decomposition of ROE. 3-step: ROE = netMargin × assetTurnover ×
 * equityMultiplier (all on average balances). 5-step factors are populated when
 * EBIT and income-before-tax are positive.
 * PENDING HUMAN DETERMINATION: average vs period-end balances.
 */
export function calcDuPont(
  bs: BalanceSheet,
  pl: ProfitLoss,
  previousBS?: BalanceSheet
): Result<DuPontResult, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  const prevOk = validateOptionalBS(previousBS)
  if (!prevOk.success) return prevOk

  const revenue = getTotalRevenue(plOk.data)
  const avgAssets = averageOf(bsOk.data.totalAssets, previousBS?.totalAssets)
  const avgEquity = averageOf(bsOk.data.totalEquity, previousBS?.totalEquity)

  const netMargin = safeDivide(plOk.data.netIncome, revenue)
  const assetTurnover = safeDivide(revenue, avgAssets)
  const equityMultiplier = safeDivide(avgAssets, avgEquity)
  const roe = roundTo2(netMargin * assetTurnover * equityMultiplier * 100)

  const ebit = getEBIT(plOk.data)
  const taxBurden =
    plOk.data.incomeBeforeTax !== 0
      ? roundTo4(safeDivide(plOk.data.netIncome, plOk.data.incomeBeforeTax))
      : null
  const interestBurden = ebit !== 0 ? roundTo4(safeDivide(plOk.data.incomeBeforeTax, ebit)) : null
  const ebitMargin = revenue !== 0 ? roundTo4(safeDivide(ebit, revenue)) : null

  return success({
    roe,
    netMargin: roundTo4(netMargin),
    assetTurnover: roundTo4(assetTurnover),
    equityMultiplier: roundTo4(equityMultiplier),
    taxBurden,
    interestBurden,
    ebitMargin,
  })
}

// ----------------------------------------------------------------------------
// Aggregator
// ----------------------------------------------------------------------------

export interface FinancialRatioSet {
  fiscalYear: number
  month: number
  profitability: {
    roe: number
    roa: number
    roic: number
    nopat: number
    ebit: number
    ebitda: number
    grossMargin: number
    operatingMargin: number
    netMargin: number
    ebitMargin: number
    ebitdaMargin: number
  }
  liquidity: {
    currentRatio: number
    quickRatio: number
    cashRatio: number
    workingCapital: number
    dio: number
    dso: number
    dpo: number
    ccc: number
  }
  leverage: {
    debtToEquity: number
    equityRatio: number
    debtRatio: number
    longTermDebtToEquity: number
    equityMultiplier: number
    debtToEBITDA: number
    netDebtToEBITDA: number
    timesInterestEarned: number
    interestCoverageRatio: number
  }
  efficiency: {
    assetTurnover: number
    inventoryTurnover: number
    receivablesTurnover: number
    payablesTurnover: number
    fixedAssetTurnover: number
    workingCapitalTurnover: number
  }
  growth: {
    revenueGrowth: number | null
    profitGrowth: number | null
    grossProfitGrowth: number | null
    operatingIncomeGrowth: number | null
    ordinaryIncomeGrowth: number | null
    ebitdaGrowth: number | null
    assetGrowth: number | null
    equityGrowth: number | null
  }
  dupont: DuPontResult
}

export interface FinancialRatioOptions {
  previousBS?: BalanceSheet
  previousPL?: ProfitLoss
  sector?: IndustrySector
}

/**
 * Computes the complete strengthened financial-ratio set (profitability incl.
 * ROE/ROA/ROIC/NOPAT/EBIT/EBITDA + margins, liquidity incl. CCC, leverage incl.
 * debt/EBITDA + coverage, efficiency turnovers, growth, DuPont). All inputs are
 * Zod-validated; a validation failure short-circuits with a Result failure.
 * Growth fields are null when the prior period is not supplied.
 */
export function calculateFinancialRatios(
  bs: BalanceSheet,
  pl: ProfitLoss,
  options: FinancialRatioOptions = {}
): Result<FinancialRatioSet, AppError> {
  const bsOk = parseOrFail(balanceSheetSchema, bs, 'balanceSheet')
  if (!bsOk.success) return bsOk
  const plOk = parseOrFail(profitLossSchema, pl, 'profitLoss')
  if (!plOk.success) return plOk
  if (options.previousBS) {
    const prevBSOk = parseOrFail(balanceSheetSchema, options.previousBS, 'previousBalanceSheet')
    if (!prevBSOk.success) return prevBSOk
  }
  if (options.previousPL) {
    const prevPLOk = parseOrFail(profitLossSchema, options.previousPL, 'previousProfitLoss')
    if (!prevPLOk.success) return prevPLOk
  }

  const { previousBS, previousPL, sector } = options

  const roe = calcROE(bsOk.data, plOk.data, previousBS)
  if (!roe.success) return roe
  const roa = calcROA(bsOk.data, plOk.data, previousBS)
  if (!roa.success) return roa
  const roic = calcROIC(bsOk.data, plOk.data, previousBS)
  if (!roic.success) return roic
  const nopat = calcNOPAT(plOk.data)
  if (!nopat.success) return nopat
  const grossMargin = calcGrossMargin(plOk.data)
  if (!grossMargin.success) return grossMargin
  const operatingMargin = calcOperatingMargin(plOk.data)
  if (!operatingMargin.success) return operatingMargin
  const netMargin = calcNetMargin(plOk.data)
  if (!netMargin.success) return netMargin
  const ebitMargin = calcEBITMargin(plOk.data)
  if (!ebitMargin.success) return ebitMargin
  const ebitdaMargin = calcEBITDAMargin(plOk.data)
  if (!ebitdaMargin.success) return ebitdaMargin

  const currentRatio = calcCurrentRatio(bsOk.data)
  if (!currentRatio.success) return currentRatio
  const quickRatio = calcQuickRatio(bsOk.data)
  if (!quickRatio.success) return quickRatio
  const cashRatio = calcCashRatio(bsOk.data)
  if (!cashRatio.success) return cashRatio
  const workingCapital = calcWorkingCapital(bsOk.data)
  if (!workingCapital.success) return workingCapital
  const dio =
    sector && ['service', 'technology', 'finance'].includes(sector)
      ? success(0)
      : calcDIO(bsOk.data, plOk.data)
  if (!dio.success) return dio
  const dso = calcDSO(bsOk.data, plOk.data)
  if (!dso.success) return dso
  const dpo = calcDPO(bsOk.data, plOk.data)
  if (!dpo.success) return dpo
  const ccc = roundTo2(dio.data + dso.data - dpo.data)

  const debtToEquity = calcDebtToEquity(bsOk.data)
  if (!debtToEquity.success) return debtToEquity
  const equityRatio = calcEquityRatio(bsOk.data)
  if (!equityRatio.success) return equityRatio
  const debtRatio = calcDebtRatio(bsOk.data)
  if (!debtRatio.success) return debtRatio
  const longTermDebtToEquity = calcLongTermDebtToEquity(bsOk.data)
  if (!longTermDebtToEquity.success) return longTermDebtToEquity
  const equityMultiplier = calcEquityMultiplier(bsOk.data)
  if (!equityMultiplier.success) return equityMultiplier
  const debtToEBITDA = calcDebtToEBITDA(bsOk.data, plOk.data)
  if (!debtToEBITDA.success) return debtToEBITDA
  const netDebtToEBITDA = calcNetDebtToEBITDA(bsOk.data, plOk.data)
  if (!netDebtToEBITDA.success) return netDebtToEBITDA
  const timesInterestEarned = calcTimesInterestEarned(bsOk.data, plOk.data)
  if (!timesInterestEarned.success) return timesInterestEarned
  const interestCoverageRatio = calcInterestCoverageRatio(bsOk.data, plOk.data)
  if (!interestCoverageRatio.success) return interestCoverageRatio

  const assetTurnover = calcAssetTurnover(bsOk.data, plOk.data, previousBS)
  if (!assetTurnover.success) return assetTurnover
  const inventoryTurnover = calcInventoryTurnover(bsOk.data, plOk.data, sector)
  if (!inventoryTurnover.success) return inventoryTurnover
  const receivablesTurnover = calcReceivablesTurnover(bsOk.data, plOk.data)
  if (!receivablesTurnover.success) return receivablesTurnover
  const payablesTurnover = calcPayablesTurnover(bsOk.data, plOk.data)
  if (!payablesTurnover.success) return payablesTurnover
  const fixedAssetTurnover = calcFixedAssetTurnover(bsOk.data, plOk.data)
  if (!fixedAssetTurnover.success) return fixedAssetTurnover
  const workingCapitalTurnover = calcWorkingCapitalTurnover(bsOk.data, plOk.data)
  if (!workingCapitalTurnover.success) return workingCapitalTurnover

  const dupont = calcDuPont(bsOk.data, plOk.data, previousBS)
  if (!dupont.success) return dupont

  return success({
    fiscalYear: plOk.data.fiscalYear,
    month: plOk.data.month,
    profitability: {
      roe: roe.data,
      roa: roa.data,
      roic: roic.data.roic,
      nopat: roic.data.nopat,
      ebit: roic.data.ebit,
      ebitda: roundTo2(getEBITDA(plOk.data)),
      grossMargin: grossMargin.data,
      operatingMargin: operatingMargin.data,
      netMargin: netMargin.data,
      ebitMargin: ebitMargin.data,
      ebitdaMargin: ebitdaMargin.data,
    },
    liquidity: {
      currentRatio: currentRatio.data,
      quickRatio: quickRatio.data,
      cashRatio: cashRatio.data,
      workingCapital: workingCapital.data,
      dio: dio.data,
      dso: dso.data,
      dpo: dpo.data,
      ccc,
    },
    leverage: {
      debtToEquity: debtToEquity.data,
      equityRatio: equityRatio.data,
      debtRatio: debtRatio.data,
      longTermDebtToEquity: longTermDebtToEquity.data,
      equityMultiplier: equityMultiplier.data,
      debtToEBITDA: debtToEBITDA.data,
      netDebtToEBITDA: netDebtToEBITDA.data,
      timesInterestEarned: timesInterestEarned.data,
      interestCoverageRatio: interestCoverageRatio.data,
    },
    efficiency: {
      assetTurnover: assetTurnover.data,
      inventoryTurnover: inventoryTurnover.data,
      receivablesTurnover: receivablesTurnover.data,
      payablesTurnover: payablesTurnover.data,
      fixedAssetTurnover: fixedAssetTurnover.data,
      workingCapitalTurnover: workingCapitalTurnover.data,
    },
    growth: {
      revenueGrowth: previousPL ? grow(calcRevenueGrowth(plOk.data, previousPL)) : null,
      profitGrowth: previousPL ? grow(calcProfitGrowth(plOk.data, previousPL)) : null,
      grossProfitGrowth: previousPL ? grow(calcGrossProfitGrowth(plOk.data, previousPL)) : null,
      operatingIncomeGrowth: previousPL
        ? grow(calcOperatingIncomeGrowth(plOk.data, previousPL))
        : null,
      ordinaryIncomeGrowth: previousPL
        ? grow(calcOrdinaryIncomeGrowth(plOk.data, previousPL))
        : null,
      ebitdaGrowth: previousPL ? grow(calcEBITDAGrowth(plOk.data, previousPL)) : null,
      assetGrowth: previousBS ? grow(calcAssetGrowth(bsOk.data, previousBS)) : null,
      equityGrowth: previousBS ? grow(calcEquityGrowth(bsOk.data, previousBS)) : null,
    },
    dupont: dupont.data,
  })
}

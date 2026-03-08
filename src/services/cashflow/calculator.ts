import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'
import type { AccountingStandard } from '@/types/accounting-standard'
import { getAccountingStandardConfig } from '@/types/accounting-standard'

export interface CashFlowCalculationOptions {
  standard?: AccountingStandard
  includeDeferredTax?: boolean
  interestPaidAsOperating?: boolean
}

interface OperatingActivities {
  netIncome: number
  depreciation: number
  amortization: number
  deferredTaxChange: number
  increaseInReceivables: number
  decreaseInInventory: number
  increaseInPayables: number
  otherNonCash: number
  netCashFromOperating: number
}

interface InvestingActivities {
  purchaseOfFixedAssets: number
  saleOfFixedAssets: number
  netCashFromInvesting: number
}

interface FinancingActivities {
  proceedsFromBorrowing: number
  repaymentOfBorrowing: number
  dividendPaid: number
  interestPaid: number
  netCashFromFinancing: number
}

/**
 * キャッシュフロー計算書を間接法で作成する
 *
 * @param pl - 損益計算書
 * @param currentBS - 当期末貸借対照表
 * @param previousBS - 前期末貸借対照表（nullの場合は期首0として計算）
 * @param options - 計算オプション（会計基準等）
 * @returns キャッシュフロー計算書
 *
 * @example
 * ```typescript
 * const cf = calculateCashFlow(pl, currentBS, previousBS, { standard: 'JGAAP' })
 * ```
 *
 * @remarks
 * - JGAAP: 利息は営業外（財務CFに含まない）
 * - USGAAP: 利息は営業活動
 * - IFRS: 利息は財務活動
 */
export function calculateCashFlow(
  pl: ProfitLoss,
  currentBS: BalanceSheet,
  previousBS: BalanceSheet | null,
  options: CashFlowCalculationOptions = {}
): CashFlowStatement {
  const standard = options.standard ?? 'JGAAP'
  const config = getAccountingStandardConfig(standard)

  const interestAsOperating =
    options.interestPaidAsOperating ?? config.cashFlow.interestClassification === 'operating'

  const operatingActivities = calculateOperatingCF(pl, currentBS, previousBS, standard, {
    interestAsOperating,
  })
  const investingActivities = calculateInvestingCF(currentBS, previousBS)
  const financingActivities = calculateFinancingCF(currentBS, previousBS, pl, {
    interestAsOperating,
  })

  const netChangeInCash =
    operatingActivities.netCashFromOperating +
    investingActivities.netCashFromInvesting +
    financingActivities.netCashFromFinancing

  const beginningCash = previousBS ? getTotalCash(previousBS) : 0
  const endingCash = getTotalCash(currentBS)

  return {
    fiscalYear: pl.fiscalYear,
    month: pl.month,
    operatingActivities,
    investingActivities,
    financingActivities,
    netChangeInCash,
    beginningCash,
    endingCash,
  }
}

function calculateOperatingCF(
  pl: ProfitLoss,
  currentBS: BalanceSheet,
  previousBS: BalanceSheet | null,
  _standard: AccountingStandard,
  options: { interestAsOperating: boolean }
): OperatingActivities {
  const netIncome = pl.netIncome
  const depreciation = pl.depreciation || 0
  const amortization = 0

  const currentReceivables = getTotalReceivables(currentBS)
  const previousReceivables = previousBS ? getTotalReceivables(previousBS) : 0
  const increaseInReceivables = previousReceivables - currentReceivables

  const currentInventory = getTotalInventory(currentBS)
  const previousInventory = previousBS ? getTotalInventory(previousBS) : 0
  const decreaseInInventory = previousInventory - currentInventory

  const currentPayables = getTotalPayables(currentBS)
  const previousPayables = previousBS ? getTotalPayables(previousBS) : 0
  const increaseInPayables = currentPayables - previousPayables

  const deferredTaxChange = calculateDeferredTaxChange(currentBS, previousBS)

  const otherNonCash = calculateOtherNonCashItems(pl, currentBS, previousBS)

  let interestAdjustment = 0
  if (!options.interestAsOperating) {
    const interestExpense = getInterestExpense(pl)
    interestAdjustment = interestExpense
  }

  const netCashFromOperating =
    netIncome +
    depreciation +
    amortization +
    deferredTaxChange +
    increaseInReceivables +
    decreaseInInventory +
    increaseInPayables +
    otherNonCash +
    interestAdjustment

  return {
    netIncome,
    depreciation,
    amortization,
    deferredTaxChange,
    increaseInReceivables,
    decreaseInInventory,
    increaseInPayables,
    otherNonCash,
    netCashFromOperating,
  }
}

function calculateDeferredTaxChange(
  currentBS: BalanceSheet,
  previousBS: BalanceSheet | null
): number {
  const currentDeferred = getDeferredTax(currentBS)
  const previousDeferred = previousBS ? getDeferredTax(previousBS) : 0
  return previousDeferred - currentDeferred
}

function getDeferredTax(bs: BalanceSheet): number {
  const deferredTaxAsset = bs.assets.current
    .filter((item) => item.name.includes('繰延税金資産'))
    .reduce((sum, item) => sum + item.amount, 0)

  const deferredTaxLiability = bs.liabilities.current
    .concat(bs.liabilities.fixed)
    .filter((item) => item.name.includes('繰延税金負債'))
    .reduce((sum, item) => sum + item.amount, 0)

  return deferredTaxAsset - deferredTaxLiability
}

function getInterestExpense(pl: ProfitLoss): number {
  return pl.nonOperatingExpenses
    .filter((e) => e.name.includes('支払利息') || e.name.includes('利息'))
    .reduce((sum, e) => sum + e.amount, 0)
}

function calculateInvestingCF(
  currentBS: BalanceSheet,
  previousBS: BalanceSheet | null
): InvestingActivities {
  const currentFixedAssets = getTotalFixedAssets(currentBS)
  const previousFixedAssets = previousBS ? getTotalFixedAssets(previousBS) : 0

  const purchaseOfFixedAssets = Math.min(0, previousFixedAssets - currentFixedAssets)
  const saleOfFixedAssets = Math.max(0, previousFixedAssets - currentFixedAssets)

  const netCashFromInvesting = -purchaseOfFixedAssets + saleOfFixedAssets

  return {
    purchaseOfFixedAssets,
    saleOfFixedAssets,
    netCashFromInvesting,
  }
}

function calculateFinancingCF(
  currentBS: BalanceSheet,
  previousBS: BalanceSheet | null,
  pl: ProfitLoss,
  options: { interestAsOperating: boolean }
): FinancingActivities {
  const currentBorrowing = getTotalBorrowing(currentBS)
  const previousBorrowing = previousBS ? getTotalBorrowing(previousBS) : 0

  const borrowingChange = currentBorrowing - previousBorrowing
  const proceedsFromBorrowing = Math.max(0, borrowingChange)
  const repaymentOfBorrowing = Math.max(0, -borrowingChange)

  const dividendPaid = 0

  let interestPaid = 0
  if (!options.interestAsOperating) {
    interestPaid = getInterestExpense(pl)
  }

  const netCashFromFinancing =
    proceedsFromBorrowing - repaymentOfBorrowing - dividendPaid - interestPaid

  return {
    proceedsFromBorrowing,
    repaymentOfBorrowing,
    dividendPaid,
    interestPaid,
    netCashFromFinancing,
  }
}

function getTotalCash(bs: BalanceSheet): number {
  const cashItem = bs.assets.current.find(
    (item) => item.code === '100' || item.name.includes('現金') || item.name.includes('預金')
  )
  return cashItem?.amount || 0
}

function getTotalReceivables(bs: BalanceSheet): number {
  return bs.assets.current
    .filter((item) => item.name.includes('売掛金') || item.name.includes('受取手形'))
    .reduce((sum, item) => sum + item.amount, 0)
}

function getTotalInventory(bs: BalanceSheet): number {
  return bs.assets.current
    .filter(
      (item) =>
        item.name.includes('棚卸資産') || item.name.includes('商品') || item.name.includes('製品')
    )
    .reduce((sum, item) => sum + item.amount, 0)
}

function getTotalPayables(bs: BalanceSheet): number {
  return bs.liabilities.current
    .filter((item) => item.name.includes('買掛金') || item.name.includes('支払手形'))
    .reduce((sum, item) => sum + item.amount, 0)
}

function getTotalFixedAssets(bs: BalanceSheet): number {
  return bs.assets.fixed.reduce((sum, item) => sum + item.amount, 0)
}

function getTotalBorrowing(bs: BalanceSheet): number {
  const shortTerm = bs.liabilities.current
    .filter((item) => item.name.includes('借入金') || item.name.includes('短期借入'))
    .reduce((sum, item) => sum + item.amount, 0)

  const longTerm = bs.liabilities.fixed
    .filter((item) => item.name.includes('借入金') || item.name.includes('長期借入'))
    .reduce((sum, item) => sum + item.amount, 0)

  return shortTerm + longTerm
}

function calculateOtherNonCashItems(
  pl: ProfitLoss,
  currentBS: BalanceSheet,
  previousBS: BalanceSheet | null
): number {
  let other = 0

  const currentPrepaid = currentBS.assets.current
    .filter((item) => item.name.includes('前払') || item.name.includes('前渡'))
    .reduce((sum, item) => sum + item.amount, 0)
  const previousPrepaid = previousBS
    ? previousBS.assets.current
        .filter((item) => item.name.includes('前払') || item.name.includes('前渡'))
        .reduce((sum, item) => sum + item.amount, 0)
    : 0
  other -= currentPrepaid - previousPrepaid

  const currentAccrued = currentBS.liabilities.current
    .filter((item) => item.name.includes('未払') || item.name.includes('未収'))
    .reduce((sum, item) => sum + item.amount, 0)
  const previousAccrued = previousBS
    ? previousBS.liabilities.current
        .filter((item) => item.name.includes('未払') || item.name.includes('未収'))
        .reduce((sum, item) => sum + item.amount, 0)
    : 0
  other += currentAccrued - previousAccrued

  return other
}

export function calculateFreeCashFlow(cf: CashFlowStatement): number {
  return (
    (cf.operatingActivities?.netCashFromOperating ?? 0) +
    (cf.investingActivities?.netCashFromInvesting ?? 0)
  )
}

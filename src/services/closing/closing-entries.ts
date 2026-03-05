import { prisma } from '@/lib/db'

export interface ClosingEntry {
  type: ClosingEntryType
  debitAccount: string
  creditAccount: string
  amount: number
  description: string
  fiscalYear: number
  month: number
}

export type ClosingEntryType =
  | 'depreciation'
  | 'allowance_doubtful'
  | 'accrued_bonus'
  | 'prepaid_expense'
  | 'accrued_expense'
  | 'deferred_revenue'
  | 'inventory_adjustment'
  | 'tax_effect'

export interface DepreciationEntry {
  assetName: string
  annualDepreciation: number
  accumulatedDepreciation: number
  bookValue: number
}

export interface AllowanceDoubtfulCalc {
  receivablesBalance: number
  badDebtRate: number
  calculatedAllowance: number
  currentAllowance: number
  adjustmentAmount: number
}

export interface AccruedBonusCalc {
  targetPeriod: { start: Date; end: Date }
  estimatedBonusAmount: number
  accruedMonths: number
  totalMonths: number
  accruedAmount: number
  currentAccrued: number
  adjustmentAmount: number
}

export interface TaxEffectCalc {
  fiscalYear: number
  timingDifferences: TimingDifference[]
  deferredTaxAsset: number
  deferredTaxLiability: number
  netDeferredTax: number
  effectiveTaxRate: number
}

export interface TimingDifference {
  item: string
  bookValue: number
  taxValue: number
  difference: number
  type: 'asset' | 'liability'
}

export async function generateClosingEntries(
  companyId: string,
  fiscalYear: number,
  closingMonth: number
): Promise<ClosingEntry[]> {
  const entries: ClosingEntry[] = []

  const depreciationEntries = await calculateDepreciationEntries(companyId, fiscalYear)
  for (const entry of depreciationEntries) {
    entries.push({
      type: 'depreciation',
      debitAccount: '減価償却費',
      creditAccount: '減価償却累計額',
      amount: entry.annualDepreciation,
      description: `${entry.assetName} 減価償却費`,
      fiscalYear,
      month: closingMonth,
    })
  }

  const allowanceCalc = await calculateAllowanceDoubtful(companyId, fiscalYear, closingMonth)
  if (allowanceCalc.adjustmentAmount !== 0) {
    entries.push({
      type: 'allowance_doubtful',
      debitAccount: allowanceCalc.adjustmentAmount > 0 ? '貸倒引当金繰入' : '貸倒引当金',
      creditAccount: allowanceCalc.adjustmentAmount > 0 ? '貸倒引当金' : '貸倒引当金戻入',
      amount: Math.abs(allowanceCalc.adjustmentAmount),
      description: `貸倒引当金 ${fiscalYear}年度末調整`,
      fiscalYear,
      month: closingMonth,
    })
  }

  const accruedBonusCalc = await calculateAccruedBonus(companyId, fiscalYear, closingMonth)
  if (accruedBonusCalc.adjustmentAmount !== 0) {
    entries.push({
      type: 'accrued_bonus',
      debitAccount: accruedBonusCalc.adjustmentAmount > 0 ? '役員賞与' : '未払役員賞与',
      creditAccount: accruedBonusCalc.adjustmentAmount > 0 ? '未払役員賞与' : '役員賞与',
      amount: Math.abs(accruedBonusCalc.adjustmentAmount),
      description: `役員賞与引当金 ${fiscalYear}年度末調整`,
      fiscalYear,
      month: closingMonth,
    })
  }

  return entries
}

async function calculateDepreciationEntries(
  companyId: string,
  fiscalYear: number
): Promise<DepreciationEntry[]> {
  const assets = await prisma.fixedAsset.findMany({
    where: { companyId },
  })

  const entries: DepreciationEntry[] = []

  for (const asset of assets) {
    const depreciableAmount = asset.acquisitionCost - asset.salvageValue
    const annualDepreciation = depreciableAmount / asset.usefulLife

    entries.push({
      assetName: asset.name,
      annualDepreciation: Math.round(annualDepreciation),
      accumulatedDepreciation: Math.round(asset.accumulatedDep),
      bookValue: Math.round(asset.bookValue),
    })
  }

  return entries
}

async function calculateAllowanceDoubtful(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<AllowanceDoubtfulCalc> {
  const balances = await prisma.monthlyBalance.findMany({
    where: {
      companyId,
      fiscalYear,
      month,
      category: 'current_assets',
    },
  })

  const receivables = balances
    .filter((b) => b.accountName.includes('売掛') || b.accountName.includes('受取手形'))
    .reduce((sum, b) => sum + b.amount, 0)

  const badDebtRate = 0.01
  const calculatedAllowance = receivables * badDebtRate

  const currentAllowance = balances
    .filter((b) => b.accountName.includes('貸倒引当金'))
    .reduce((sum, b) => sum + b.amount, 0)

  const adjustmentAmount = calculatedAllowance - currentAllowance

  return {
    receivablesBalance: receivables,
    badDebtRate,
    calculatedAllowance: Math.round(calculatedAllowance),
    currentAllowance: Math.round(currentAllowance),
    adjustmentAmount: Math.round(adjustmentAmount),
  }
}

async function calculateAccruedBonus(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<AccruedBonusCalc> {
  const fiscalYearStart = new Date(fiscalYear, 0, 1)
  const fiscalYearEnd = new Date(fiscalYear, 11, 31)

  const estimatedBonusAmount = 6000000
  const accruedMonths = month
  const totalMonths = 12
  const accruedAmount = (estimatedBonusAmount / totalMonths) * accruedMonths

  const currentAccrued = 0

  const adjustmentAmount = accruedAmount - currentAccrued

  return {
    targetPeriod: { start: fiscalYearStart, end: fiscalYearEnd },
    estimatedBonusAmount,
    accruedMonths,
    totalMonths,
    accruedAmount: Math.round(accruedAmount),
    currentAccrued: Math.round(currentAccrued),
    adjustmentAmount: Math.round(adjustmentAmount),
  }
}

export async function calculateTaxEffectAccounting(
  companyId: string,
  fiscalYear: number,
  effectiveTaxRate: number = 0.3
): Promise<TaxEffectCalc> {
  const timingDifferences: TimingDifference[] = []

  const assets = await prisma.fixedAsset.findMany({
    where: { companyId },
  })

  for (const asset of assets) {
    const bookDepreciation = (asset.acquisitionCost - asset.salvageValue) / asset.usefulLife
    const taxDepreciation = bookDepreciation * 1.5
    const difference = bookDepreciation - taxDepreciation

    timingDifferences.push({
      item: `減価償却差異 - ${asset.name}`,
      bookValue: asset.bookValue,
      taxValue: asset.bookValue - difference * 2,
      difference: Math.round(difference),
      type: difference > 0 ? 'liability' : 'asset',
    })
  }

  const balances = await prisma.monthlyBalance.findMany({
    where: {
      companyId,
      fiscalYear,
      month: 12,
    },
  })

  const allowanceDoubtful = balances
    .filter((b) => b.accountName.includes('貸倒引当金'))
    .reduce((sum, b) => sum + b.amount, 0)

  if (allowanceDoubtful > 0) {
    timingDifferences.push({
      item: '貸倒引当金',
      bookValue: 0,
      taxValue: allowanceDoubtful,
      difference: allowanceDoubtful,
      type: 'asset',
    })
  }

  const accruedBonus = balances
    .filter((b) => b.accountName.includes('未払役員賞与'))
    .reduce((sum, b) => sum + b.amount, 0)

  if (accruedBonus > 0) {
    timingDifferences.push({
      item: '役員賞与引当金',
      bookValue: 0,
      taxValue: accruedBonus,
      difference: accruedBonus,
      type: 'asset',
    })
  }

  const assetDifferences = timingDifferences
    .filter((td) => td.type === 'asset')
    .reduce((sum, td) => sum + td.difference, 0)

  const liabilityDifferences = timingDifferences
    .filter((td) => td.type === 'liability')
    .reduce((sum, td) => sum + td.difference, 0)

  const deferredTaxAsset = assetDifferences * effectiveTaxRate
  const deferredTaxLiability = liabilityDifferences * effectiveTaxRate
  const netDeferredTax = deferredTaxAsset - deferredTaxLiability

  const taxEffect = await prisma.taxEffectAccounting.upsert({
    where: {
      companyId_fiscalYear: {
        companyId,
        fiscalYear,
      },
    },
    update: {
      deferredTaxAsset: Math.round(deferredTaxAsset),
      deferredTaxLiability: Math.round(deferredTaxLiability),
      netDeferredTax: Math.round(netDeferredTax),
    },
    create: {
      companyId,
      fiscalYear,
      deferredTaxAsset: Math.round(deferredTaxAsset),
      deferredTaxLiability: Math.round(deferredTaxLiability),
      netDeferredTax: Math.round(netDeferredTax),
    },
  })

  return {
    fiscalYear,
    timingDifferences,
    deferredTaxAsset: taxEffect.deferredTaxAsset,
    deferredTaxLiability: taxEffect.deferredTaxLiability,
    netDeferredTax: taxEffect.netDeferredTax,
    effectiveTaxRate,
  }
}

export async function getTaxEffectHistory(
  companyId: string,
  startYear: number,
  endYear: number
): Promise<TaxEffectCalc[]> {
  const records = await prisma.taxEffectAccounting.findMany({
    where: {
      companyId,
      fiscalYear: {
        gte: startYear,
        lte: endYear,
      },
    },
    orderBy: {
      fiscalYear: 'asc',
    },
  })

  return records.map((r) => ({
    fiscalYear: r.fiscalYear,
    timingDifferences: [],
    deferredTaxAsset: r.deferredTaxAsset,
    deferredTaxLiability: r.deferredTaxLiability,
    netDeferredTax: r.netDeferredTax,
    effectiveTaxRate: 0.3,
  }))
}

export function generateTaxEffectJournalEntry(
  taxEffect: TaxEffectCalc,
  fiscalYear: number,
  closingMonth: number
): ClosingEntry {
  const netAmount = taxEffect.netDeferredTax

  if (netAmount > 0) {
    return {
      type: 'tax_effect',
      debitAccount: '繰延税金資産',
      creditAccount: '法人税等調整額',
      amount: Math.abs(netAmount),
      description: `税効果会計 ${fiscalYear}年度`,
      fiscalYear,
      month: closingMonth,
    }
  } else {
    return {
      type: 'tax_effect',
      debitAccount: '法人税等調整額',
      creditAccount: '繰延税金負債',
      amount: Math.abs(netAmount),
      description: `税効果会計 ${fiscalYear}年度`,
      fiscalYear,
      month: closingMonth,
    }
  }
}

export interface PrepaidExpenseCheck {
  accountName: string
  amount: number
  suggestedTreatment: string
  amortizationPeriod: number
  monthlyAmortization: number
}

export async function checkPrepaidExpenses(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<PrepaidExpenseCheck[]> {
  const balances = await prisma.monthlyBalance.findMany({
    where: {
      companyId,
      fiscalYear,
      month,
      category: 'current_assets',
    },
  })

  const prepaidKeywords = ['前払', '保険', 'リース', '賃借']
  const checks: PrepaidExpenseCheck[] = []

  for (const balance of balances) {
    const isPrepaid = prepaidKeywords.some((k) => balance.accountName.includes(k))

    if (isPrepaid && balance.amount > 0) {
      const amortizationPeriod = 12
      const monthlyAmortization = balance.amount / amortizationPeriod

      checks.push({
        accountName: balance.accountName,
        amount: balance.amount,
        suggestedTreatment: '月次経理による費用化を検討',
        amortizationPeriod,
        monthlyAmortization: Math.round(monthlyAmortization),
      })
    }
  }

  return checks
}

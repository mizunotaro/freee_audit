import { prisma } from '@/lib/db'
import { freeeClient } from '@/integrations/freee/client'

export interface FixedAsset {
  id: string
  companyId: string
  freeeAssetId: string | null
  name: string
  acquisitionDate: Date
  acquisitionCost: number
  salvageValue: number
  usefulLife: number
  depreciationMethod: 'straight_line' | 'declining_balance' | 'fixed_percentage'
  accumulatedDep: number
  bookValue: number
}

export interface DepreciationResult {
  assetId: string
  assetName: string
  periodStart: Date
  periodEnd: Date
  depreciationAmount: number
  accumulatedDepAfter: number
  bookValueAfter: number
  depreciationMethod: string
}

export interface DepreciationSchedule {
  assetId: string
  assetName: string
  acquisitionCost: number
  salvageValue: number
  usefulLife: number
  annualDepreciation: number
  monthlyDepreciation: number
  remainingLife: number
  schedule: Array<{
    year: number
    beginningBookValue: number
    depreciation: number
    endingBookValue: number
  }>
}

export async function getFixedAssets(companyId: string): Promise<FixedAsset[]> {
  const assets = await prisma.fixedAsset.findMany({
    where: { companyId },
    orderBy: { acquisitionDate: 'desc' },
  })

  return assets.map((a) => ({
    id: a.id,
    companyId: a.companyId,
    freeeAssetId: a.freeeAssetId,
    name: a.name,
    acquisitionDate: a.acquisitionDate,
    acquisitionCost: a.acquisitionCost,
    salvageValue: a.salvageValue,
    usefulLife: a.usefulLife,
    depreciationMethod: a.depreciationMethod as FixedAsset['depreciationMethod'],
    accumulatedDep: a.accumulatedDep,
    bookValue: a.bookValue,
  }))
}

export async function calculateDepreciation(
  asset: FixedAsset,
  periodStart: Date,
  periodEnd: Date
): Promise<DepreciationResult> {
  const monthsInPeriod = getMonthsDifference(periodStart, periodEnd) + 1

  let depreciationAmount: number

  switch (asset.depreciationMethod) {
    case 'straight_line':
      depreciationAmount = calculateStraightLineDepreciation(
        asset.acquisitionCost,
        asset.salvageValue,
        asset.usefulLife,
        monthsInPeriod
      )
      break
    case 'declining_balance':
      depreciationAmount = calculateDecliningBalanceDepreciation(
        asset.acquisitionCost,
        asset.salvageValue,
        asset.usefulLife,
        asset.accumulatedDep,
        monthsInPeriod
      )
      break
    case 'fixed_percentage':
      depreciationAmount = calculateFixedPercentageDepreciation(
        asset.acquisitionCost,
        asset.usefulLife,
        asset.accumulatedDep,
        monthsInPeriod
      )
      break
    default:
      depreciationAmount = 0
  }

  depreciationAmount = Math.min(depreciationAmount, asset.bookValue - asset.salvageValue)

  const accumulatedDepAfter = asset.accumulatedDep + depreciationAmount
  const bookValueAfter = asset.acquisitionCost - accumulatedDepAfter

  return {
    assetId: asset.id,
    assetName: asset.name,
    periodStart,
    periodEnd,
    depreciationAmount: Math.round(depreciationAmount),
    accumulatedDepAfter: Math.round(accumulatedDepAfter),
    bookValueAfter: Math.max(Math.round(bookValueAfter), asset.salvageValue),
    depreciationMethod: asset.depreciationMethod,
  }
}

function calculateStraightLineDepreciation(
  acquisitionCost: number,
  salvageValue: number,
  usefulLifeYears: number,
  monthsInPeriod: number
): number {
  const depreciableAmount = acquisitionCost - salvageValue
  const annualDepreciation = depreciableAmount / usefulLifeYears
  const monthlyDepreciation = annualDepreciation / 12
  return monthlyDepreciation * monthsInPeriod
}

function calculateDecliningBalanceDepreciation(
  acquisitionCost: number,
  salvageValue: number,
  usefulLifeYears: number,
  accumulatedDep: number,
  monthsInPeriod: number
): number {
  const bookValue = acquisitionCost - accumulatedDep
  if (bookValue <= salvageValue) return 0

  const decliningBalanceRate = 1 - Math.pow(salvageValue / acquisitionCost, 1 / usefulLifeYears)
  const annualDepreciation = bookValue * decliningBalanceRate
  const monthlyDepreciation = annualDepreciation / 12

  return monthlyDepreciation * monthsInPeriod
}

function calculateFixedPercentageDepreciation(
  acquisitionCost: number,
  usefulLifeYears: number,
  accumulatedDep: number,
  monthsInPeriod: number
): number {
  const bookValue = acquisitionCost - accumulatedDep
  if (bookValue <= 1) return 0

  const fixedPercentage = getFixedPercentageRate(usefulLifeYears)
  const annualDepreciation = bookValue * fixedPercentage
  const monthlyDepreciation = annualDepreciation / 12

  return monthlyDepreciation * monthsInPeriod
}

function getFixedPercentageRate(usefulLifeYears: number): number {
  if (usefulLifeYears <= 2) return 0.636
  if (usefulLifeYears <= 3) return 0.536
  if (usefulLifeYears <= 4) return 0.438
  if (usefulLifeYears <= 5) return 0.352
  if (usefulLifeYears <= 6) return 0.306
  if (usefulLifeYears <= 7) return 0.28
  if (usefulLifeYears <= 8) return 0.263
  if (usefulLifeYears <= 9) return 0.252
  if (usefulLifeYears <= 10) return 0.244
  if (usefulLifeYears <= 11) return 0.238
  if (usefulLifeYears <= 12) return 0.233
  if (usefulLifeYears <= 13) return 0.229
  if (usefulLifeYears <= 14) return 0.226
  if (usefulLifeYears <= 15) return 0.224
  if (usefulLifeYears <= 20) return 0.214
  if (usefulLifeYears <= 25) return 0.206
  if (usefulLifeYears <= 30) return 0.2
  if (usefulLifeYears <= 40) return 0.192
  return 0.18
}

function getMonthsDifference(start: Date, end: Date): number {
  const yearDiff = end.getFullYear() - start.getFullYear()
  const monthDiff = end.getMonth() - start.getMonth()
  return yearDiff * 12 + monthDiff
}

export async function generateDepreciationSchedule(
  asset: FixedAsset
): Promise<DepreciationSchedule> {
  const depreciableAmount = asset.acquisitionCost - asset.salvageValue
  const annualDepreciation = depreciableAmount / asset.usefulLife
  const monthlyDepreciation = annualDepreciation / 12

  const schedule: DepreciationSchedule['schedule'] = []
  let currentBookValue = asset.acquisitionCost - asset.accumulatedDep
  const elapsedYears = Math.floor(asset.accumulatedDep / annualDepreciation)
  const remainingLife = Math.max(0, asset.usefulLife - elapsedYears)

  for (let year = 1; year <= remainingLife; year++) {
    const beginningBookValue = currentBookValue
    const depreciation = Math.min(annualDepreciation, currentBookValue - asset.salvageValue)
    currentBookValue -= depreciation

    schedule.push({
      year: elapsedYears + year,
      beginningBookValue: Math.round(beginningBookValue),
      depreciation: Math.round(depreciation),
      endingBookValue: Math.round(Math.max(currentBookValue, asset.salvageValue)),
    })
  }

  return {
    assetId: asset.id,
    assetName: asset.name,
    acquisitionCost: asset.acquisitionCost,
    salvageValue: asset.salvageValue,
    usefulLife: asset.usefulLife,
    annualDepreciation: Math.round(annualDepreciation),
    monthlyDepreciation: Math.round(monthlyDepreciation),
    remainingLife,
    schedule,
  }
}

export async function calculateMonthlyDepreciation(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<DepreciationResult[]> {
  const assets = await getFixedAssets(companyId)

  const periodStart = new Date(fiscalYear, month - 1, 1)
  const periodEnd = new Date(fiscalYear, month, 0)

  const results: DepreciationResult[] = []

  for (const asset of assets) {
    if (asset.acquisitionDate > periodEnd) continue
    if (asset.bookValue <= asset.salvageValue) continue

    const result = await calculateDepreciation(asset, periodStart, periodEnd)
    results.push(result)

    await prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        accumulatedDep: result.accumulatedDepAfter,
        bookValue: result.bookValueAfter,
      },
    })
  }

  return results
}

export async function generateDepreciationJournalEntries(
  companyId: string,
  fiscalYear: number,
  month: number,
  depreciationAccountId: string,
  accumulatedDepAccountId: string
): Promise<
  Array<{
    assetName: string
    debitAccount: string
    creditAccount: string
    amount: number
    description: string
  }>
> {
  const results = await calculateMonthlyDepreciation(companyId, fiscalYear, month)

  return results.map((r) => ({
    assetName: r.assetName,
    debitAccount: depreciationAccountId,
    creditAccount: accumulatedDepAccountId,
    amount: r.depreciationAmount,
    description: `${r.assetName} 減価償却費（${fiscalYear}年${month}月）`,
  }))
}

export async function getTotalDepreciationByCategory(
  companyId: string,
  fiscalYear: number,
  month: number
): Promise<Record<string, number>> {
  const results = await calculateMonthlyDepreciation(companyId, fiscalYear, month)

  const categoryTotals: Record<string, number> = {}

  for (const result of results) {
    const category = getCategoryFromAssetName(result.assetName)
    categoryTotals[category] = (categoryTotals[category] || 0) + result.depreciationAmount
  }

  return categoryTotals
}

function getCategoryFromAssetName(name: string): string {
  if (name.includes('建物') || name.includes('ビル')) return '建物'
  if (name.includes('車') || name.includes('自動車')) return '車両運搬具'
  if (name.includes('機械') || name.includes('装置')) return '機械装置'
  if (name.includes('器具') || name.includes('備品')) return '工具器具備品'
  if (name.includes('ソフト') || name.includes('ライセンス')) return 'ソフトウェア'
  if (name.includes('土地')) return '土地'
  return 'その他'
}

export async function importFixedAssetsFromFreee(
  companyId: string,
  freeeCompanyId: number
): Promise<{ imported: number; error?: string }> {
  try {
    const result = await freeeClient.getAccountItems(freeeCompanyId)

    if (result.error) {
      return { imported: 0, error: result.error.message }
    }

    return { imported: 0, error: 'Fixed assets API not yet available in freee' }
  } catch (error) {
    return {
      imported: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function createFixedAsset(
  companyId: string,
  data: {
    name: string
    acquisitionDate: Date
    acquisitionCost: number
    salvageValue: number
    usefulLife: number
    depreciationMethod: 'straight_line' | 'declining_balance' | 'fixed_percentage'
  }
): Promise<FixedAsset> {
  const asset = await prisma.fixedAsset.create({
    data: {
      companyId,
      name: data.name,
      acquisitionDate: data.acquisitionDate,
      acquisitionCost: data.acquisitionCost,
      salvageValue: data.salvageValue,
      usefulLife: data.usefulLife,
      depreciationMethod: data.depreciationMethod,
      accumulatedDep: 0,
      bookValue: data.acquisitionCost,
    },
  })

  return {
    id: asset.id,
    companyId: asset.companyId,
    freeeAssetId: asset.freeeAssetId,
    name: asset.name,
    acquisitionDate: asset.acquisitionDate,
    acquisitionCost: asset.acquisitionCost,
    salvageValue: asset.salvageValue,
    usefulLife: asset.usefulLife,
    depreciationMethod: asset.depreciationMethod as FixedAsset['depreciationMethod'],
    accumulatedDep: asset.accumulatedDep,
    bookValue: asset.bookValue,
  }
}

export async function deleteFixedAsset(id: string): Promise<void> {
  await prisma.fixedAsset.delete({
    where: { id },
  })
}

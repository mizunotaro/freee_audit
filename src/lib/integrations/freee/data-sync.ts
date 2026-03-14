import { prisma } from '@/lib/db'
import { FreeeClient } from './client'
import type { FreeeTrialBalanceItem, FreeeJournal } from './types'

export interface SyncResult {
  success: boolean
  journalsCount?: number
  balancesCount?: number
  error?: string
}

export interface SyncProgress {
  companyId: string
  totalJournals: number
  totalBalances: number
  completedAt: Date
  message: string
}

export async function syncJournalsToDatabase(
  companyId: string,
  accessToken: string,
  freeeCompanyId: number,
  fiscalYear: number,
  startMonth: number,
  endMonth: number
): Promise<SyncResult> {
  try {
    const client = new FreeeClient({ accessToken }, String(freeeCompanyId))

    let syncCount = 0

    for (let month = startMonth; month <= endMonth; month++) {
      const startDate = `${fiscalYear}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(fiscalYear, month, 0).getDate()
      const endDate = `${fiscalYear}-${String(month).padStart(2, '0')}-${lastDay}`

      const journalsResponse = await client.getJournals(freeeCompanyId, startDate, endDate)
      const journals = journalsResponse?.data || []

      if (journals.length > 0) {
        for (const journal of journals) {
          await upsertJournal(companyId, journal)
          syncCount++
        }
      }
    }

    return {
      success: true,
      journalsCount: syncCount,
    }
  } catch (error) {
    console.error('Failed to sync journals:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function upsertJournal(companyId: string, journal: FreeeJournal): Promise<void> {
  const debitDetail = journal.details?.find((d) => d.entry_side === 'debit')
  const creditDetail = journal.details?.find((d) => d.entry_side === 'credit')

  const debitAccount = debitDetail?.account_item_name || journal.account_item_name || ''
  const creditAccount = creditDetail?.account_item_name || journal.account_item_name || ''
  const amount = debitDetail?.amount || journal.amount || 0

  try {
    await prisma.journal.upsert({
      where: {
        freeeJournalId: journal.id.toString(),
      },
      update: {
        companyId,
        entryDate: new Date(journal.issue_date),
        description: journal.description || '',
        debitAccount,
        creditAccount,
        amount,
        taxAmount: debitDetail?.vat || creditDetail?.vat || 0,
        syncedAt: new Date(),
      },
      create: {
        freeeJournalId: journal.id.toString(),
        companyId,
        entryDate: new Date(journal.issue_date),
        description: journal.description || '',
        debitAccount,
        creditAccount,
        amount,
        taxAmount: debitDetail?.vat || creditDetail?.vat || 0,
        auditStatus: 'PENDING',
        syncedAt: new Date(),
      },
    })
  } catch (error) {
    console.error(`Failed to upsert journal ${journal.id}:`, error)
    throw error
  }
}

export async function syncTrialBalanceToDatabase(
  companyId: string,
  accessToken: string,
  freeeCompanyId: number,
  fiscalYear: number,
  month: number
): Promise<SyncResult> {
  try {
    const client = new FreeeClient({ accessToken }, String(freeeCompanyId))

    const trialBalance = await client.getTrialBalance({
      company_id: freeeCompanyId,
      fiscal_year: fiscalYear,
      start_month: month,
      end_month: month,
    })

    if (!trialBalance || !trialBalance.trial_balance) {
      return {
        success: false,
        error: 'No trial balance data received',
      }
    }

    let syncCount = 0

    for (const item of trialBalance.trial_balance.account_items) {
      await upsertMonthlyBalance(companyId, fiscalYear, month, item)
      syncCount++
    }

    return {
      success: true,
      balancesCount: syncCount,
    }
  } catch (error) {
    console.error('Failed to sync trial balance:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function upsertMonthlyBalance(
  companyId: string,
  fiscalYear: number,
  month: number,
  item: FreeeTrialBalanceItem
): Promise<void> {
  const category = getCategoryFromAccountItem(item)

  try {
    await prisma.monthlyBalance.upsert({
      where: {
        companyId_fiscalYear_month_accountCode: {
          companyId,
          fiscalYear,
          month,
          accountCode: item.account_item_id.toString(),
        },
      },
      update: {
        accountName: item.account_item_name,
        category,
        amount: item.closing_balance,
      },
      create: {
        companyId,
        fiscalYear,
        month,
        accountCode: item.account_item_id.toString(),
        accountName: item.account_item_name,
        category,
        amount: item.closing_balance,
      },
    })
  } catch (error) {
    console.error(`Failed to upsert monthly balance for account ${item.account_item_id}:`, error)
    throw error
  }
}

function getCategoryFromAccountItem(item: FreeeTrialBalanceItem): string {
  const closingDr = item.closing_dr_balance || 0
  const closingCr = item.closing_cr_balance || 0

  if (closingDr > 0 && closingCr === 0) {
    if (item.account_item_id >= 100 && item.account_item_id < 200) return 'current_asset'
    if (item.account_item_id >= 200 && item.account_item_id < 300) return 'fixed_asset'
    if (item.account_item_id >= 500 && item.account_item_id < 600) return 'sga_expense'
    if (item.account_item_id >= 600 && item.account_item_id < 700) return 'nonoperating_expense'
  }
  if (closingCr > 0 && closingDr === 0) {
    if (item.account_item_id >= 300 && item.account_item_id < 400) return 'current_liability'
    if (item.account_item_id >= 400 && item.account_item_id < 500) return 'equity'
    if (item.account_item_id >= 400 && item.account_item_id < 500) return 'revenue'
    if (item.account_item_id >= 700 && item.account_item_id < 800) return 'nonoperating_revenue'
  }

  return 'current_asset'
}

export async function syncAllFinancialData(
  companyId: string,
  accessToken: string,
  freeeCompanyId: number,
  fiscalYear: number
): Promise<{
  journals: SyncResult
  balances: SyncResult[]
}> {
  const results = {
    journals: { success: true, journalsCount: 0 } as SyncResult,
    balances: [] as SyncResult[],
  }

  const journalsResult = await syncJournalsToDatabase(
    companyId,
    accessToken,
    freeeCompanyId,
    fiscalYear,
    1,
    12
  )
  results.journals = journalsResult

  for (let month = 1; month <= 12; month++) {
    const balanceResult = await syncTrialBalanceToDatabase(
      companyId,
      accessToken,
      freeeCompanyId,
      fiscalYear,
      month
    )
    results.balances.push(balanceResult)
  }

  return results
}

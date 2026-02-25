import { prisma } from '@/lib/db'
import { FreeeClient, createFreeeClient } from '@/lib/integrations/freee/client'
import type { FreeeJournal } from '@/lib/integrations/freee/types'
import { auditLogger } from '@/lib/audit/audit-logger'
import { createAuditNotifier } from '@/lib/integrations/slack/notifier'

export interface SyncOptions {
  companyId?: string
  startDate?: string
  endDate?: string
  notifyOnComplete?: boolean
}

export interface SyncResult {
  totalSynced: number
  newJournals: number
  updatedJournals: number
  errors: number
}

async function getFreeeClient(companyId: string): Promise<FreeeClient | null> {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      companyId,
      provider: 'FREEE',
    },
  })

  if (!apiKey || !apiKey.encryptedKey) {
    console.warn(`[JournalSync] No Freee API key found for company ${companyId}`)
    return null
  }

  return createFreeeClient(apiKey.encryptedKey)
}

export async function syncJournals(options: SyncOptions = {}): Promise<SyncResult> {
  const result: SyncResult = {
    totalSynced: 0,
    newJournals: 0,
    updatedJournals: 0,
    errors: 0,
  }

  const notifier = createAuditNotifier()

  const today = new Date()
  const defaultStartDate =
    options.startDate ||
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const defaultEndDate = options.endDate || today.toISOString().split('T')[0]

  const companies = options.companyId
    ? [{ id: options.companyId }]
    : await prisma.company.findMany({ select: { id: true } })

  for (const company of companies) {
    try {
      const client = await getFreeeClient(company.id)
      if (!client) {
        console.warn(`[JournalSync] Skipping company ${company.id} - no API client`)
        continue
      }

      const companyRecord = await prisma.company.findUnique({
        where: { id: company.id },
        select: { freeeCompanyId: true },
      })

      if (!companyRecord?.freeeCompanyId) {
        console.warn(`[JournalSync] Skipping company ${company.id} - no freeeCompanyId`)
        continue
      }

      const freeeCompanyId = parseInt(companyRecord.freeeCompanyId, 10)
      let offset = 0
      const limit = 100
      let hasMore = true

      while (hasMore) {
        const startTime = Date.now()
        let statusCode = 200

        try {
          const response = await client.getJournals(
            freeeCompanyId,
            defaultStartDate,
            defaultEndDate,
            limit,
            offset
          )

          const duration = Date.now() - startTime
          auditLogger.logFreeeApiCall('/api/1/journals', 'GET', statusCode, duration, company.id)

          const journals: FreeeJournal[] =
            (response as unknown as { journals: FreeeJournal[] }).journals || []

          for (const freeeJournal of journals) {
            try {
              const debitDetail = freeeJournal.details?.find(
                (d: { entry_side: string }) => d.entry_side === 'debit'
              )
              const creditDetail = freeeJournal.details?.find(
                (d: { entry_side: string }) => d.entry_side === 'credit'
              )

              const journalData = {
                companyId: company.id,
                freeeJournalId: String(freeeJournal.id),
                entryDate: new Date(freeeJournal.issue_date),
                description: freeeJournal.description || '',
                debitAccount: debitDetail?.account_item_name || '',
                creditAccount: creditDetail?.account_item_name || '',
                amount: debitDetail?.amount || 0,
                taxAmount: debitDetail?.vat || creditDetail?.vat || 0,
                taxType: debitDetail?.vat_name || creditDetail?.vat_name || null,
                syncedAt: new Date(),
              }

              const existing = await prisma.journal.findUnique({
                where: { freeeJournalId: String(freeeJournal.id) },
              })

              if (existing) {
                await prisma.journal.update({
                  where: { id: existing.id },
                  data: journalData,
                })
                result.updatedJournals++
              } else {
                await prisma.journal.create({
                  data: journalData,
                })
                result.newJournals++
              }

              result.totalSynced++
            } catch (journalError) {
              console.error(`[JournalSync] Error syncing journal ${freeeJournal.id}:`, journalError)
              result.errors++
            }
          }

          const meta = (response as { meta?: { total_count: number } }).meta
          hasMore = !!(meta && offset + limit < meta.total_count)
          offset += limit
        } catch (apiError) {
          statusCode = 500
          throw apiError
        }
      }

      console.log(`[JournalSync] Company ${company.id}: Synced ${result.totalSynced} journals`)
    } catch (error) {
      console.error(`[JournalSync] Error syncing company ${company.id}:`, error)
      result.errors++
    }
  }

  if (options.notifyOnComplete && result.totalSynced > 0) {
    await notifier.notifySyncComplete(result.totalSynced, {
      start: defaultStartDate,
      end: defaultEndDate,
    })
  }

  console.log(
    `[JournalSync] Complete: ${result.totalSynced} synced, ${result.newJournals} new, ${result.updatedJournals} updated, ${result.errors} errors`
  )

  return result
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const params: Record<string, string> = {}

  for (const arg of args) {
    const cleanArg = arg.replace(/^--/, '')
    const eqIndex = cleanArg.indexOf('=')
    if (eqIndex > 0) {
      const key = cleanArg.substring(0, eqIndex)
      const value = cleanArg.substring(eqIndex + 1)
      params[key] = value
    }
  }

  syncJournals({
    companyId: params.company,
    startDate: params.start,
    endDate: params.end,
    notifyOnComplete: params.notify === 'true',
  })
    .then((result) => {
      console.log('Sync result:', result)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Sync failed:', error)
      process.exit(1)
    })
}

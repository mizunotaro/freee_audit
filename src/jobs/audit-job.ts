import { prisma } from '@/lib/db'
import { createReceiptAnalyzer } from '@/services/audit/receipt-analyzer'
import { createJournalChecker, JournalEntryData } from '@/services/audit/journal-checker'
import { createAuditNotifier } from '@/lib/integrations/slack/notifier'
import { auditLogger } from '@/lib/audit/audit-logger'
import { AuditSummary, DocumentAnalysisResult, AuditResultStatus } from '@/types/audit'
import fs from 'fs/promises'
import path from 'path'

const DEFAULT_CONCURRENCY = 5
const CONCURRENCY_LIMIT = parseInt(process.env.AUDIT_CONCURRENCY || String(DEFAULT_CONCURRENCY), 10)

export interface AuditJobOptions {
  companyId?: string
  startDate?: string
  endDate?: string
  statusFilter?: 'PENDING' | 'FAILED'
  notifyOnComplete?: boolean
  skipDocumentAnalysis?: boolean
  concurrency?: number
}

export interface AuditJobResult {
  totalProcessed: number
  passed: number
  failed: number
  errors: number
  skipped: number
  durationMs: number
}

async function getDocumentBuffer(filePath: string): Promise<Buffer | null> {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
    return await fs.readFile(absolutePath)
  } catch {
    console.warn(`[AuditJob] Could not read document: ${filePath}`)
    return null
  }
}

function logMemoryUsage(prefix: string): void {
  const usage = process.memoryUsage()
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`
  console.log(
    `[Memory] ${prefix}: Heap ${mb(usage.heapUsed)}/${mb(usage.heapTotal)}, RSS ${mb(usage.rss)}`
  )
}

interface JournalWithDocument {
  id: string
  freeeJournalId: string
  entryDate: Date
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number | null
  taxType: string | null
  description: string | null
  documentId: string | null
  document: {
    id: string
    filePath: string
  } | null
}

interface ProcessJournalResult {
  journalId: string
  status: AuditResultStatus
  issues: any[]
  error?: Error
}

async function processJournal(
  journal: JournalWithDocument,
  options: AuditJobOptions,
  receiptAnalyzer: ReturnType<typeof createReceiptAnalyzer>,
  journalChecker: ReturnType<typeof createJournalChecker>
): Promise<ProcessJournalResult> {
  try {
    let documentData: DocumentAnalysisResult | null = null

    if (journal.document && !options.skipDocumentAnalysis) {
      const documentBuffer = await getDocumentBuffer(journal.document.filePath)

      if (documentBuffer) {
        try {
          const extension = path.extname(journal.document.filePath).toLowerCase()
          const documentType =
            extension === '.pdf'
              ? 'pdf'
              : extension === '.xlsx' || extension === '.xls'
                ? 'excel'
                : 'image'

          const mimeTypeMap: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
          }
          const mimeType = mimeTypeMap[extension] || 'application/octet-stream'

          documentData = await receiptAnalyzer.analyzeBuffer(documentBuffer, documentType, mimeType)
        } catch (analysisError) {
          console.error(
            `[AuditJob] Document analysis failed for journal ${journal.id}:`,
            analysisError
          )

          await prisma.auditResult.create({
            data: {
              journalId: journal.id,
              documentId: journal.documentId,
              status: 'ERROR',
              issues: JSON.stringify([
                {
                  field: 'document',
                  severity: 'error',
                  message: '証憑解析エラー',
                  messageEn: 'Document analysis error',
                },
              ]),
              analyzedAt: new Date(),
            },
          })

          await prisma.journal.update({
            where: { id: journal.id },
            data: { auditStatus: 'FAILED' },
          })

          return {
            journalId: journal.id,
            status: 'ERROR',
            issues: [],
            error:
              analysisError instanceof Error ? analysisError : new Error(String(analysisError)),
          }
        }
      }
    }

    const entryData: JournalEntryData = {
      id: journal.id,
      date: journal.entryDate.toISOString().split('T')[0],
      debitAccount: journal.debitAccount,
      creditAccount: journal.creditAccount,
      amount: journal.amount,
      taxAmount: journal.taxAmount ?? 0,
      taxType: journal.taxType || undefined,
      description: journal.description || '',
    }

    const validationResult = await journalChecker.check(entryData, documentData)

    const status: AuditResultStatus = validationResult.isValid ? 'PASSED' : 'FAILED'

    await prisma.auditResult.create({
      data: {
        journalId: journal.id,
        documentId: journal.documentId,
        status,
        issues: JSON.stringify(validationResult.issues),
        confidenceScore: documentData?.confidence ?? null,
        rawAiResponse: documentData?.rawText || null,
        analyzedAt: new Date(),
      },
    })

    await prisma.journal.update({
      where: { id: journal.id },
      data: { auditStatus: status === 'PASSED' ? 'PASSED' : 'FAILED' },
    })

    return {
      journalId: journal.id,
      status,
      issues: validationResult.issues,
    }
  } catch (error) {
    console.error(`[AuditJob] Error processing journal ${journal.id}:`, error)

    await prisma.auditResult.create({
      data: {
        journalId: journal.id,
        status: 'ERROR',
        issues: JSON.stringify([
          {
            field: 'system',
            severity: 'error',
            message: '監査処理エラー',
            messageEn: 'Audit processing error',
          },
        ]),
        analyzedAt: new Date(),
      },
    })

    return {
      journalId: journal.id,
      status: 'ERROR',
      issues: [],
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

export async function runAuditJob(options: AuditJobOptions = {}): Promise<AuditJobResult> {
  const startTime = Date.now()
  const result: AuditJobResult = {
    totalProcessed: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    skipped: 0,
    durationMs: 0,
  }

  const receiptAnalyzer = createReceiptAnalyzer()
  const journalChecker = createJournalChecker()
  const notifier = createAuditNotifier()

  const whereClause: {
    companyId?: string
    auditStatus?: 'PENDING' | 'FAILED'
    entryDate?: { gte?: Date; lte?: Date }
  } = {}

  if (options.companyId) {
    whereClause.companyId = options.companyId
  }

  if (options.statusFilter) {
    whereClause.auditStatus = options.statusFilter
  } else {
    whereClause.auditStatus = 'PENDING'
  }

  if (options.startDate || options.endDate) {
    whereClause.entryDate = {}
    if (options.startDate) {
      whereClause.entryDate.gte = new Date(options.startDate)
    }
    if (options.endDate) {
      whereClause.entryDate.lte = new Date(options.endDate)
    }
  }

  const journals = await prisma.journal.findMany({
    where: whereClause,
    include: {
      document: true,
    },
    orderBy: { entryDate: 'asc' },
  })

  console.log(`[AuditJob] Found ${journals.length} journals to audit`)

  const concurrency = options.concurrency ?? CONCURRENCY_LIMIT
  console.log(`[AuditJob] Using concurrency: ${concurrency}`)

  if (journals.length > 100) {
    logMemoryUsage('Before processing')
  }

  const issues: AuditSummary['issues'] = []
  let processedCount = 0

  for (let i = 0; i < journals.length; i += concurrency) {
    const batch = journals.slice(i, i + concurrency)

    const batchResults = await Promise.allSettled(
      batch.map((journal) => processJournal(journal, options, receiptAnalyzer, journalChecker))
    )

    for (const settledResult of batchResults) {
      processedCount++
      result.totalProcessed++

      if (settledResult.status === 'fulfilled') {
        const { status, issues: validationIssues, error } = settledResult.value

        if (error) {
          result.errors++
        } else if (status === 'PASSED') {
          result.passed++
        } else {
          result.failed++
        }

        if (validationIssues.length > 0 && status === 'FAILED') {
          const journal = batch.find((j) => j.id === settledResult.value.journalId)
          if (journal) {
            issues.push({
              journalId: journal.freeeJournalId,
              description: journal.description,
              issues: validationIssues,
            })
          }
        }
      } else {
        result.errors++
        console.error('[AuditJob] Unexpected rejection:', settledResult.reason)
      }
    }

    if (processedCount % 50 === 0 || processedCount === journals.length) {
      console.log(`[AuditJob] Progress: ${processedCount}/${journals.length}`)
      if (journals.length > 100) {
        logMemoryUsage(`After ${processedCount} journals`)
      }
    }
  }

  result.durationMs = Date.now() - startTime

  const summary: AuditSummary = {
    date: new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    totalCount: result.totalProcessed,
    passedCount: result.passed,
    failedCount: result.failed,
    errorCount: result.errors,
    skippedCount: result.skipped,
    issues,
  }

  await auditLogger.logAuditRun(undefined, result.totalProcessed, result.passed, result.failed)

  if (options.notifyOnComplete) {
    await notifier.notifyAuditComplete(summary)
  }

  console.log(
    `[AuditJob] Complete: ${result.passed} passed, ${result.failed} failed, ${result.errors} errors in ${result.durationMs}ms`
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

  runAuditJob({
    companyId: params.company,
    startDate: params.start,
    endDate: params.end,
    statusFilter: params.status as 'PENDING' | 'FAILED' | undefined,
    notifyOnComplete: params.notify === 'true',
    skipDocumentAnalysis: params.skipDocument === 'true',
  })
    .then((result) => {
      console.log('Audit result:', result)
      process.exit(0)
    })
    .catch((error) => {
      console.error('Audit failed:', error)
      process.exit(1)
    })
}

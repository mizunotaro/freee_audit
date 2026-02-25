import { prisma } from '@/lib/db'
import { createReceiptAnalyzer } from '@/services/audit/receipt-analyzer'
import { createJournalChecker, JournalEntryData } from '@/services/audit/journal-checker'
import { createAuditNotifier } from '@/lib/integrations/slack/notifier'
import { auditLogger } from '@/lib/audit/audit-logger'
import { AuditSummary, DocumentAnalysisResult, AuditResultStatus } from '@/types/audit'
import fs from 'fs/promises'
import path from 'path'

export interface AuditJobOptions {
  companyId?: string
  startDate?: string
  endDate?: string
  statusFilter?: 'PENDING' | 'FAILED'
  notifyOnComplete?: boolean
  skipDocumentAnalysis?: boolean
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

  const issues: AuditSummary['issues'] = []

  for (const journal of journals) {
    result.totalProcessed++

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

            documentData = await receiptAnalyzer.analyzeBuffer(
              documentBuffer,
              documentType,
              mimeType
            )
          } catch (analysisError) {
            console.error(
              `[AuditJob] Document analysis failed for journal ${journal.id}:`,
              analysisError
            )
            result.errors++

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

            continue
          }
        }
      }

      const entryData: JournalEntryData = {
        id: journal.id,
        date: journal.entryDate.toISOString().split('T')[0],
        debitAccount: journal.debitAccount,
        creditAccount: journal.creditAccount,
        amount: journal.amount,
        taxAmount: journal.taxAmount,
        taxType: journal.taxType || undefined,
        description: journal.description,
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

      if (status === 'PASSED') {
        result.passed++
      } else {
        result.failed++
        if (validationResult.issues.length > 0) {
          issues.push({
            journalId: journal.freeeJournalId,
            description: journal.description,
            issues: validationResult.issues,
          })
        }
      }
    } catch (error) {
      console.error(`[AuditJob] Error processing journal ${journal.id}:`, error)
      result.errors++

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

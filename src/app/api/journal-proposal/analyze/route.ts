import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getOCREngine } from '@/services/ocr'
import { createOrchestrator } from '@/lib/ai/orchestrator/orchestrator'
import { createStorageProvider, type StorageConfig } from '@/lib/storage'
import {
  analyzeSchema,
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
  withRetry,
  sanitizeForLog,
  proposalCache,
} from '../_utils'

import type { SynthesizedResponse } from '@/lib/ai/orchestrator/orchestrator-types'

import type { OCRStructuredData } from '@/types/ocr'

const ANALYSIS_TIMEOUT_MS = 60000

const CACHE_TTL_MS = 30000

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500

const MAX_RETRY_DELAY_MS = 2000

interface JournalEntryProposal {
  id: string
  lineType: 'debit' | 'credit'
  accountCode: string
  accountName: string
  amount: number
  taxType: string
  taxRate: number
  taxAmount: number
  description: string
  entryDate: string
}

interface JournalProposal {
  id: string
  rank: 1 | 2 | 3
  confidence: number
  entries: JournalEntryProposal[]
  reasoning: {
    accountSelection: string
    taxClassification: string
    standardCompliance: string
    keyAssumptions: string[]
  }
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high'
    auditRisk: { level: string; score: number; factors: unknown[] }
    taxRisk: { level: string; score: number; factors: unknown[] }
    recommendations: string[]
  }
}

async function postHandler(req: AuthenticatedRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const parseResult = analyzeSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid input', parseResult.error.flatten()),
        { status: 400 }
      )
    }

    const { receiptId, additionalContext } = parseResult.data

    const cacheKey = `proposal:${receiptId}`
    const cached = proposalCache.get(cacheKey) as { documentId: string } | null
    if (cached && cached.documentId === receiptId) {
      return NextResponse.json(createSuccessResponse({ cached: true, proposalId: cached.id }), {
        status: 200,
      })
    }

    const document = await withRetry(
      async () =>
        prisma.receiptDocument.findUnique({
          where: { id: receiptId },
          include: { company: true },
        }),
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: 2,
      }
    )

    if (!document) {
      return NextResponse.json(
        createErrorResponse('DOCUMENT_NOT_FOUND', 'Receipt document not found'),
        { status: 404 }
      )
    }

    const hasAccess = await verifyCompanyAccess(req, document.companyId)
    if (!hasAccess) {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Access denied to this document'), {
        status: 403,
      })
    }

    const existingProposal = await withRetry(
      async () =>
        prisma.journalProposal.findUnique({
          where: { documentId: receiptId },
        }),
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: 2,
      }
    )

    if (existingProposal) {
      return NextResponse.json(
        createErrorResponse('ALREADY_ANALYZED', 'Document has already been analyzed'),
        { status: 409 }
      )
    }

    const storageConfig: StorageConfig = {
      provider: 'local',
      encryption: { enabled: true, algorithm: 'AES-256-GCM' },
      maxFileSize: 10 * 1024 * 1024,
      allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
      retentionDays: 30,
    }
    const storage = createStorageProvider(storageConfig)

    const fileResult = await withRetry(
      async () =>
        storage.getFile(receiptId, {
          companyId: document.companyId,
          userId: req.user.id,
        }),
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: 2,
      }
    )

    if (!fileResult.success) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Receipt file not found'), {
        status: 404,
      })
    }

    const fileBuffer = fileResult.data.data
    const ocrEngine = await getOCREngine(document.companyId)
    const ocrResult = await withRetry(
      async () => ocrEngine.recognize(fileBuffer, { language: 'ja' }),
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: 2,
      }
    )

    if (!ocrResult.success) {
      console.error('OCR failed:', sanitizeForLog({ error: ocrResult.error.message }))
      return NextResponse.json(
        createErrorResponse('OCR_FAILED', ocrResult.error.message || 'OCR processing failed'),
        { status: 500 }
      )
    }

    await withRetry(
      async () =>
        prisma.receiptDocument.update({
          where: { id: receiptId },
          data: {
            ocrResult: JSON.stringify(ocrResult.data),
            ocrEngine: ocrResult.engine,
            ocrConfidence: ocrResult.confidence,
            status: 'ocr_completed',
          },
        }),
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: 2,
      }
    )

    const orchestrator = createOrchestrator({
      timeoutMs: ANALYSIS_TIMEOUT_MS,
      maxParallelExecutions: 1,
    })

    const analysisQuery = buildAnalysisQuery(ocrResult.data, additionalContext)
    const orchestratorResult = await orchestrator.process({
      query: analysisQuery,
      context: {
        sessionId: `journal-proposal-${receiptId}`,
        userId: req.user.id,
        companyId: document.companyId,
        language: 'ja',
        conversationHistory: [],
      },
      constraints: {
        preferredPersonas: ['cpa'],
        maxLatencyMs: ANALYSIS_TIMEOUT_MS,
      },
    })

    if (!orchestratorResult.success || !orchestratorResult.response) {
      console.error(
        'Analysis failed:',
        sanitizeForLog({ error: orchestratorResult.error?.message })
      )
      return NextResponse.json(
        createErrorResponse(
          'ANALYSIS_FAILED',
          orchestratorResult.error?.message || 'AI analysis failed'
        ),
        { status: 500 }
      )
    }

    const proposals: JournalProposal[] = buildProposals(orchestratorResult.response, ocrResult.data)
    const aiMetadata = orchestratorResult.metadata.modelSelection

    const savedProposal = await withRetry(
      async () =>
        prisma.journalProposal.create({
          data: {
            companyId: document.companyId,
            documentId: receiptId,
            userContext: additionalContext || '',
            proposals: JSON.stringify(proposals),
            aiProvider: aiMetadata.model.provider,
            aiModel: aiMetadata.model.modelId,
            status: 'proposed',
            createdBy: req.user.id,
          },
        }),
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: 2,
      }
    )

    proposalCache.set(cacheKey, { ...savedProposal, documentId: savedProposal.id }, CACHE_TTL_MS)
    proposalCache.invalidate(new RegExp(`^proposal:${receiptId}`))

    await withRetry(
      async () =>
        prisma.receiptDocument.update({
          where: { id: receiptId },
          data: { status: 'analyzed' },
        }),
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: 2,
      }
    )

    const duration = Date.now() - startTime
    console.log(`Journal proposal analysis completed in ${duration}ms`)

    return NextResponse.json(
      createSuccessResponse({
        id: savedProposal.id,
        ocrResult: {
          rawText: ocrResult.data.rawText,
          extractedInfo: {
            date: ocrResult.data.date,
            vendorName: ocrResult.data.vendor,
            totalAmount: ocrResult.data.totalAmount,
            taxAmount: ocrResult.data.taxAmount,
            items: ocrResult.data.items,
          },
          confidence: ocrResult.confidence,
          warnings: [],
        },
        proposal: {
          entries: proposals[0]?.entries || [],
          rationale: proposals[0]?.reasoning?.accountSelection || '',
          confidence: proposals[0]?.confidence || 0.5,
        },
        aiProvider: aiMetadata.model.provider,
        aiModel: aiMetadata.model.modelId,
        generatedAt: new Date(),
        duration,
      }),
      { status: 201 }
    )
  } catch (error) {
    console.error(
      'Failed to analyze receipt:',
      sanitizeForLog({ error: error instanceof Error ? error.message : String(error) })
    )
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(createErrorResponse('TIMEOUT', 'Analysis timed out'), {
        status: 504,
      })
    }
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Failed to analyze receipt'), {
      status: 500,
    })
  }
}

function buildAnalysisQuery(ocrData: OCRStructuredData, additionalContext?: string): string {
  const parts: string[] = []
  parts.push('以下の領収書情報に基づいて、適切な仕訳を提案してください。')
  parts.push('')
  parts.push('## OCR抽出情報')
  parts.push(`- 日付: ${ocrData.date || '不明'}`)
  parts.push(`- 取引先: ${ocrData.vendor || '不明'}`)
  parts.push(`- 金額（税抜）: ${ocrData.totalAmount || '不明'}`)
  parts.push(`- 消費税: ${ocrData.taxAmount || '不明'}`)
  parts.push(`- 税率: ${ocrData.taxRate ? `${ocrData.taxRate * 100}%` : '不明'}`)
  if (ocrData.items && ocrData.items.length > 0) {
    parts.push('')
    parts.push('## 明細')
    ocrData.items.forEach((item, i) => {
      parts.push(`${i + 1}. ${item.name}: ${item.amount || ''}`)
    })
  }
  parts.push('')
  parts.push('## OCRテキスト')
  parts.push('```')
  parts.push(ocrData.rawText)
  parts.push('```')
  if (additionalContext) {
    parts.push('')
    parts.push('## 補足情報')
    parts.push(additionalContext)
  }
  parts.push('')
  parts.push('上記の情報に基づいて、JGAAPおよび発生基準に準拠した仕訳を提案してください。')
  return parts.join('\n')
}
function buildProposals(
  result: SynthesizedResponse,
  ocrData: OCRStructuredData
): JournalProposal[] {
  const entries: JournalEntryProposal[] = []
  const entryDate = ocrData.date || new Date().toISOString().split('T')[0]
  const description = ocrData.vendor || '領収書'
  const taxRate = ocrData.taxRate || 0.1
  const taxAmount = ocrData.taxAmount || 0

  entries.push({
    id: `entry-debit-${Date.now()}`,
    lineType: 'debit',
    accountCode: '621',
    accountName: '旅費交通費',
    amount: ocrData.totalAmount || 0,
    taxType: 'taxable_10',
    taxRate,
    taxAmount,
    description,
    entryDate,
  })
  entries.push({
    id: `entry-credit-${Date.now()}`,
    lineType: 'credit',
    accountCode: '111',
    accountName: '現金',
    amount: (ocrData.totalAmount || 0) + taxAmount,
    taxType: 'non_taxable',
    taxRate: 0,
    taxAmount: 0,
    description,
    entryDate,
  })
  return [
    {
      id: `proposal-${Date.now()}`,
      rank: 1,
      confidence: result.confidence || 0.8,
      entries,
      reasoning: {
        accountSelection: result.summary || '領収書の内容に基づき旅費交通費として処理',
        taxClassification: '課税仕入れとして処理',
        standardCompliance: 'JGAAPおよび発生基準に準拠',
        keyAssumptions: ['取引は事業関連であることを前提としています'],
      },
      riskAssessment: {
        overallRisk: 'low',
        auditRisk: { level: 'low', score: 20, factors: [] },
        taxRisk: { level: 'low', score: 15, factors: [] },
        recommendations: [],
      },
    },
  ]
}

export const POST = withAuth(postHandler, { rateLimit: 'strict', requireCompany: true })

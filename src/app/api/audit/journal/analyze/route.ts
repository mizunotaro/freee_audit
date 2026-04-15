import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import { prisma } from '@/lib/db'
import { analyzeJournalEntry } from '@/services/ai/analysis-service'
import { z } from 'zod'

const requestSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  companyId: z.string().optional(),
})

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { fiscalYear, month } = parsed.data
    const companyId = await validateCompanyId(req.user, parsed.data.companyId ?? null)

    const startDate = new Date(fiscalYear, month - 1, 1)
    const endDate = new Date(fiscalYear, month, 0)

    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: { gte: startDate, lte: endDate },
      },
      include: { document: true },
      orderBy: { entryDate: 'asc' },
      take: 50,
    })

    const entries = []

    for (const journal of journals) {
      const result = await analyzeJournalEntry(
        {
          id: journal.id,
          entryDate: journal.entryDate,
          description: journal.description,
          debitAccount: journal.debitAccount,
          creditAccount: journal.creditAccount,
          amount: journal.amount,
          taxType: journal.taxType || undefined,
        },
        journal.document ? `証憑ファイル: ${journal.document.fileName}` : undefined,
        { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
      )

      entries.push({
        id: journal.id,
        entryDate: journal.entryDate.toISOString(),
        description: journal.description,
        debitAccount: journal.debitAccount,
        creditAccount: journal.creditAccount,
        amount: journal.amount,
        taxType: journal.taxType,
        auditStatus: result.isValid ? 'PASSED' : 'ISSUE',
        issues: result.issues,
        suggestion: result.suggestion,
      })
    }

    const stats = {
      total: entries.length,
      passed: entries.filter((e) => e.issues.length === 0).length,
      issues: entries.filter((e) => e.issues.length > 0).length,
    }

    return NextResponse.json({ entries, stats })
  } catch (error) {
    console.error('Journal analyze API error:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: 'Failed to analyze journals' }, { status: 500 })
  }
}

export const POST = withAuth(postHandler, { requireCompany: true })

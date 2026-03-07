import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import { prisma } from '@/lib/db'
import { analyzeJournalEntry } from '@/services/ai/analysis-service'

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())

    const companyId = await validateCompanyId(req.user, searchParams.get('companyId'))

    const startDate = new Date(fiscalYear, month - 1, 1)
    const endDate = new Date(fiscalYear, month, 0)

    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { entryDate: 'asc' },
      take: 100,
    })

    const entries = journals.map((j) => ({
      id: j.id,
      entryDate: j.entryDate.toISOString(),
      description: j.description,
      debitAccount: j.debitAccount,
      creditAccount: j.creditAccount,
      amount: j.amount,
      taxType: j.taxType,
      auditStatus: j.auditStatus,
      issues: generateMockIssues(j),
    }))

    const stats = {
      total: entries.length,
      pending: entries.filter((e) => e.auditStatus === 'PENDING').length,
      passed: entries.filter((e) => e.issues.length === 0).length,
      issues: entries.filter((e) => e.issues.length > 0).length,
    }

    return NextResponse.json({ entries, stats })
  } catch (error) {
    console.error('Journal audit API error:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 })
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json()
    const { fiscalYear, month, companyId: requestedCompanyId } = body

    const companyId = await validateCompanyId(req.user, requestedCompanyId || null)

    const startDate = new Date(fiscalYear, month - 1, 1)
    const endDate = new Date(fiscalYear, month, 0)

    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        document: true,
      },
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
      pending: entries.filter((e) => e.auditStatus === 'PENDING').length,
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

function generateMockIssues(journal: {
  description: string
  amount: number
  taxType: string | null
}): { field: string; issue: string; severity: 'error' | 'warning' }[] {
  const issues: { field: string; issue: string; severity: 'error' | 'warning' }[] = []

  if (!journal.description || journal.description.length < 3) {
    issues.push({
      field: '摘要',
      issue: '摘要が入力されていない、または短すぎます',
      severity: 'warning',
    })
  }

  if (!journal.taxType) {
    issues.push({
      field: '税区分',
      issue: '税区分が設定されていません',
      severity: 'warning',
    })
  }

  if (journal.amount < 0) {
    issues.push({
      field: '金額',
      issue: '金額が負の値です',
      severity: 'error',
    })
  }

  return issues
}

export const GET = withAuth(getHandler, { requireCompany: true })
export const POST = withAuth(postHandler, { requireCompany: true })

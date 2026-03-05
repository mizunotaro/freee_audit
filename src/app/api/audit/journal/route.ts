import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeJournalEntry } from '@/services/ai/analysis-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = parseInt(
      searchParams.get('fiscalYear') || new Date().getFullYear().toString()
    )
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())

    const companyId = await getCompanyId()

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
    return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fiscalYear, month } = body

    const companyId = await getCompanyId()

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
    return NextResponse.json({ error: 'Failed to analyze journals' }, { status: 500 })
  }
}

async function getCompanyId(): Promise<string> {
  const companies = await prisma.company.findMany({ take: 1 })
  if (companies.length > 0) {
    return companies[0].id
  }
  const company = await prisma.company.create({
    data: { name: 'サンプル株式会社', fiscalYearStart: 4 },
  })
  return company.id
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

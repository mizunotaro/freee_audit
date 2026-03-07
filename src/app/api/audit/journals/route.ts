import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import { prisma } from '@/lib/db'

async function handler(req: AuthenticatedRequest) {
  try {
    const searchParams = new URL(req.url).searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const auditStatus = searchParams.get('auditStatus') as
      | 'PENDING'
      | 'PASSED'
      | 'FAILED'
      | 'SKIPPED'
      | null

    const companyId = await validateCompanyId(req.user, searchParams.get('companyId'))

    const where: {
      companyId: string
      entryDate?: { gte?: Date; lte?: Date }
      auditStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
    } = { companyId }

    if (startDate || endDate) {
      where.entryDate = {}
      if (startDate) where.entryDate.gte = new Date(startDate)
      if (endDate) where.entryDate.lte = new Date(endDate)
    }

    if (auditStatus) {
      where.auditStatus = auditStatus
    }

    const [journals, total] = await Promise.all([
      prisma.journal.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
            },
          },
        },
        orderBy: { entryDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journal.count({ where }),
    ])

    return NextResponse.json({
      data: journals.map((j) => ({
        id: j.id,
        freeeJournalId: j.freeeJournalId,
        entryDate: j.entryDate.toISOString().split('T')[0],
        description: j.description,
        debitAccount: j.debitAccount,
        creditAccount: j.creditAccount,
        amount: j.amount,
        taxAmount: j.taxAmount,
        taxType: j.taxType,
        documentId: j.documentId,
        document: j.document,
        auditStatus: j.auditStatus,
        syncedAt: j.syncedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[API] Error fetching journals:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch journals' } },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handler, { requireCompany: true })

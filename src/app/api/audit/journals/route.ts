import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
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

    const where: {
      entryDate?: { gte?: Date; lte?: Date }
      auditStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
    } = {}

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
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch journals' } },
      { status: 500 }
    )
  }
}

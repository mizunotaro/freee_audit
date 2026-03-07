import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import { prisma } from '@/lib/db'

async function getHandler(req: AuthenticatedRequest) {
  try {
    const searchParams = new URL(req.url).searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const status = searchParams.get('status') as 'PASSED' | 'FAILED' | 'ERROR' | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const companyId = await validateCompanyId(req.user, searchParams.get('companyId'))

    const where: {
      journal: { companyId: string }
      status?: 'PASSED' | 'FAILED' | 'ERROR'
      analyzedAt?: { gte?: Date; lte?: Date }
    } = { journal: { companyId } }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.analyzedAt = {}
      if (startDate) where.analyzedAt.gte = new Date(startDate)
      if (endDate) where.analyzedAt.lte = new Date(endDate)
    }

    const [results, total] = await Promise.all([
      prisma.auditResult.findMany({
        where,
        include: {
          journal: {
            select: {
              id: true,
              freeeJournalId: true,
              entryDate: true,
              description: true,
              debitAccount: true,
              creditAccount: true,
              amount: true,
              taxAmount: true,
            },
          },
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
            },
          },
        },
        orderBy: { analyzedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditResult.count({ where }),
    ])

    return NextResponse.json({
      data: results.map((r) => ({
        id: r.id,
        journalId: r.journalId,
        documentId: r.documentId,
        status: r.status,
        issues: JSON.parse(r.issues),
        confidenceScore: r.confidenceScore,
        analyzedAt: r.analyzedAt.toISOString(),
        journal: r.journal
          ? {
              ...r.journal,
              entryDate: r.journal.entryDate.toISOString().split('T')[0],
            }
          : null,
        document: r.document,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[API] Error fetching audit results:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit results' } },
      { status: 500 }
    )
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json()
    const { journalId, documentId, status, issues, confidenceScore, rawAiResponse } = body

    const journal = await prisma.journal.findUnique({
      where: { id: journalId },
      select: { companyId: true },
    })

    if (!journal) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Journal not found' } },
        { status: 404 }
      )
    }

    await validateCompanyId(req.user, journal.companyId)

    const result = await prisma.auditResult.create({
      data: {
        journalId,
        documentId,
        status,
        issues: JSON.stringify(issues),
        confidenceScore,
        rawAiResponse,
        analyzedAt: new Date(),
      },
    })

    await prisma.journal.update({
      where: { id: journalId },
      data: { auditStatus: status === 'PASSED' ? 'PASSED' : 'FAILED' },
    })

    return NextResponse.json({
      data: {
        id: result.id,
        status: result.status,
        analyzedAt: result.analyzedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[API] Error creating audit result:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create audit result' } },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler, { requireCompany: true })
export const POST = withAuth(postHandler, { requireCompany: true })

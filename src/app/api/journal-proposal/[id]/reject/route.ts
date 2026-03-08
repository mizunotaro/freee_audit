import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import {
  rejectSchema,
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
} from '../../_utils'

async function postHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  try {
    const resolvedParams = context?.params
      ? context.params instanceof Promise
        ? await context.params
        : context.params
      : {}
    const id = resolvedParams.id

    if (!id) {
      return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'Proposal ID is required'), {
        status: 400,
      })
    }

    const body = await req.json()

    const parseResult = rejectSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid input', parseResult.error.flatten()),
        { status: 400 }
      )
    }

    const proposal = await prisma.journalProposal.findUnique({
      where: { id },
    })

    if (!proposal) {
      return NextResponse.json(createErrorResponse('NOT_FOUND', 'Journal proposal not found'), {
        status: 404,
      })
    }

    const hasAccess = await verifyCompanyAccess(req, proposal.companyId)
    if (!hasAccess) {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Access denied to this proposal'), {
        status: 403,
      })
    }

    if (proposal.status === 'approved') {
      return NextResponse.json(
        createErrorResponse('ALREADY_APPROVED', 'Cannot reject an approved proposal'),
        { status: 400 }
      )
    }

    if (proposal.status === 'rejected') {
      return NextResponse.json(
        createErrorResponse('ALREADY_REJECTED', 'Proposal is already rejected'),
        { status: 400 }
      )
    }

    const updatedProposal = await prisma.journalProposal.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
    })

    await prisma.receiptDocument.update({
      where: { id: proposal.documentId },
      data: { status: 'rejected' },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'journal_proposal_rejected',
        resource: 'journal_proposal',
        resourceId: id,
        details: JSON.stringify({
          reason: parseResult.data.reason,
          previousStatus: proposal.status,
        }),
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        result: 'SUCCESS',
      },
    })

    return NextResponse.json(
      createSuccessResponse({
        ...updatedProposal,
        rejectionReason: parseResult.data.reason,
      })
    )
  } catch (error) {
    console.error('Failed to reject journal proposal:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to reject journal proposal'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(postHandler, { rateLimit: 'strict', requireCompany: true })

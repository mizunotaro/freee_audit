import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import {
  updateProposalSchema,
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
  withRetry,
  proposalCache,
} from '../_utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: AuthenticatedRequest, context: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'Proposal ID is required'), {
        status: 400,
      })
    }

    const body = await req.json()
    const parseResult = updateProposalSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid request body', parseResult.error.errors),
        { status: 400 }
      )
    }

    const proposal = await withRetry(() =>
      prisma.journalProposal.findUnique({
        where: { id },
        include: { document: true },
      })
    )

    if (!proposal) {
      return NextResponse.json(createErrorResponse('NOT_FOUND', 'Journal proposal not found'), {
        status: 404,
      })
    }

    const hasAccess = await verifyCompanyAccess(req.user.companyId, proposal.companyId)
    if (!hasAccess) {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Access denied'), { status: 403 })
    }

    const proposals = JSON.parse(proposal.proposals)
    const updates = parseResult.data

    if (updates.entries) {
      proposals.entries = updates.entries
    }

    if (updates.entryDate) {
      proposals.entries.forEach((entry: { entryDate?: string }) => {
        entry.entryDate = updates.entryDate!
      })
    }

    if (updates.amount !== undefined) {
      proposals.entries.forEach((entry: { amount?: number }) => {
        entry.amount = updates.amount!
      })
    }

    const updatedProposal = await withRetry(() =>
      prisma.journalProposal.update({
        where: { id },
        data: {
          proposals: JSON.stringify(proposals),
          status: 'approved',
        },
      })
    )

    proposalCache.invalidate(`proposal:${id}`)

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'journal_proposal_approved',
        resource: 'journal_proposal',
        resourceId: id,
        details: JSON.stringify({
          reviewerNotes: updates.reviewerNotes,
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
        reviewerNotes: updates.reviewerNotes,
      })
    )
  } catch (error) {
    console.error('Failed to approve journal proposal:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to approve journal proposal'),
      { status: 500 }
    )
  }
}

export const POST_WITH_AUTH = withAuth(POST, { rateLimit: 'strict', requireCompany: true })

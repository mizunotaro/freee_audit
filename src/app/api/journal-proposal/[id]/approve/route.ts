import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import {
  updateProposalSchema,
  approveSchema,
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
  withRetry,
  proposalCache,
} from '../../_utils'

interface ProposalData {
  entries: Array<{
    entryDate?: string
    description?: string
    amount?: number
    [key: string]: unknown
  }>
  [key: string]: unknown
}

const approveUpdateSchema = updateProposalSchema.merge(approveSchema)

async function postHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
): Promise<NextResponse> {
  try {
    const params =
      context?.params instanceof Promise ? await context.params : (context?.params ?? {})
    const id = params.id

    if (!id) {
      return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'Proposal ID is required'), {
        status: 400,
      })
    }

    const body = await req.json()
    const parseResult = approveUpdateSchema.safeParse(body)

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

    const hasAccess = await verifyCompanyAccess(req, proposal.companyId)
    if (!hasAccess) {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Access denied'), { status: 403 })
    }

    const proposals = JSON.parse(proposal.proposals) as ProposalData
    const updates = parseResult.data

    if (updates.entryDate) {
      for (const entry of proposals.entries) {
        entry.entryDate = updates.entryDate
      }
    }

    if (updates.description) {
      for (const entry of proposals.entries) {
        entry.description = updates.description
      }
    }

    if (updates.amount !== undefined && proposals.entries[0]) {
      proposals.entries[0].amount = updates.amount
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

    proposalCache.invalidate(new RegExp(`^proposal:${id}$`))

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

export const POST = withAuth(postHandler, { rateLimit: 'strict', requireCompany: true })

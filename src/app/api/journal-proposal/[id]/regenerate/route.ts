import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import {
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
  withRetry,
  proposalCache,
} from '../../_utils'
import { z } from 'zod'

const regenerateSchema = z.object({
  additionalContext: z.string().max(2000).optional(),
})

interface ProposalData {
  entries: Array<{
    entryDate?: string
    description?: string
    amount?: number
    [key: string]: unknown
  }>
  regeneratedAt?: string
  regenerationCount?: number
  [key: string]: unknown
}

async function postHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const params =
      context?.params instanceof Promise ? await context.params : (context?.params ?? {})
    const id = params.id

    if (!id) {
      return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'Proposal ID is required'), {
        status: 400,
      })
    }

    const body = await req.json().catch(() => ({}))
    const parseResult = regenerateSchema.safeParse(body)

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

    const currentProposals = JSON.parse(proposal.proposals) as ProposalData
    const regeneratedAt = new Date().toISOString()

    const updatedProposals: ProposalData = {
      ...currentProposals,
      regeneratedAt,
      regenerationCount: (currentProposals.regenerationCount || 0) + 1,
    }

    const updatedProposal = await withRetry(() =>
      prisma.journalProposal.update({
        where: { id },
        data: {
          proposals: JSON.stringify(updatedProposals),
          userContext: parseResult.data.additionalContext || proposal.userContext,
        },
      })
    )

    proposalCache.invalidate(new RegExp(`^proposal:${id}$`))

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'journal_proposal_regenerated',
        resource: 'journal_proposal',
        resourceId: id,
        details: JSON.stringify({
          additionalContext: parseResult.data.additionalContext,
          processingTimeMs: Date.now() - startTime,
        }),
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        result: 'SUCCESS',
      },
    })

    return NextResponse.json(
      createSuccessResponse({
        id: updatedProposal.id,
        documentId: updatedProposal.documentId,
        status: updatedProposal.status,
        regeneratedAt,
        processingTimeMs: Date.now() - startTime,
      })
    )
  } catch (error) {
    console.error('Failed to regenerate journal proposal:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to regenerate journal proposal'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(postHandler, { rateLimit: 'strict', requireCompany: true })

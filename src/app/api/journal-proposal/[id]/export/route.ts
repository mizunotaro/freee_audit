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

const exportSchema = z.object({
  targetPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  description: z.string().max(500).optional(),
})

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
    const parseResult = exportSchema.safeParse(body)

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

    if (proposal.status !== 'approved') {
      return NextResponse.json(
        createErrorResponse('INVALID_STATUS', 'Proposal must be approved before export', {
          currentStatus: proposal.status,
        }),
        { status: 400 }
      )
    }

    const updatedProposal = await withRetry(() =>
      prisma.journalProposal.update({
        where: { id },
        data: {
          status: 'exported',
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      })
    )

    proposalCache.invalidate(new RegExp(`^proposal:${id}$`))

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'journal_proposal_exported',
        resource: 'journal_proposal',
        resourceId: id,
        details: JSON.stringify({
          targetPeriod: parseResult.data.targetPeriod,
          description: parseResult.data.description,
          documentId: proposal.documentId,
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
        exportedAt: updatedProposal.reviewedAt,
        exportedBy: updatedProposal.reviewedBy,
        processingTimeMs: Date.now() - startTime,
      })
    )
  } catch (error) {
    console.error('Failed to export journal proposal:', error)

    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        return NextResponse.json(
          createErrorResponse('TIMEOUT', 'Request timed out during export'),
          { status: 504 }
        )
      }
    }

    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to export journal proposal'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(postHandler, { rateLimit: 'strict', requireCompany: true })

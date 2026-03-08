import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import {
  updateProposalSchema,
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
} from '../_utils'

interface ProposalData {
  entries: Array<{
    entryDate?: string
    description?: string
    amount?: number
    [key: string]: unknown
  }>
  [key: string]: unknown
}

async function getHandler(
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

    const proposal = await prisma.journalProposal.findUnique({
      where: { id },
      include: {
        document: {
          select: {
            id: true,
            originalName: true,
            contentType: true,
            fileSize: true,
            uploadedAt: true,
            status: true,
            ocrResult: true,
            ocrConfidence: true,
          },
        },
      },
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

    return NextResponse.json(createSuccessResponse(proposal))
  } catch (error) {
    console.error('Failed to fetch journal proposal:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to fetch journal proposal'),
      { status: 500 }
    )
  }
}

async function patchHandler(
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

    const parseResult = updateProposalSchema.safeParse(body)
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

    if (proposal.status === 'approved' || proposal.status === 'rejected') {
      return NextResponse.json(
        createErrorResponse('INVALID_STATUS', 'Cannot modify approved or rejected proposal'),
        { status: 400 }
      )
    }

    const proposals = JSON.parse(proposal.proposals) as ProposalData
    const updates = parseResult.data

    if (updates.entryDate) {
      for (const entry of proposals.entries) {
        if ('entryDate' in entry) {
          entry.entryDate = updates.entryDate
        }
      }
    }
    if (updates.description) {
      for (const entry of proposals.entries) {
        if ('description' in entry) {
          entry.description = updates.description
        }
      }
    }
    if (updates.amount !== undefined && proposals.entries[0]) {
      proposals.entries[0].amount = updates.amount
    }

    const updatedProposal = await prisma.journalProposal.update({
      where: { id },
      data: {
        proposals: JSON.stringify(proposals),
        status: 'modified',
      },
    })

    return NextResponse.json(createSuccessResponse(updatedProposal))
  } catch (error) {
    console.error('Failed to update journal proposal:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to update journal proposal'),
      { status: 500 }
    )
  }
}

async function deleteHandler(
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
        createErrorResponse('INVALID_STATUS', 'Cannot delete approved proposal'),
        { status: 400 }
      )
    }

    await prisma.journalProposal.delete({
      where: { id },
    })

    await prisma.receiptDocument.update({
      where: { id: proposal.documentId },
      data: { status: 'deleted' },
    })

    return NextResponse.json(createSuccessResponse({ deleted: true }))
  } catch (error) {
    console.error('Failed to delete journal proposal:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to delete journal proposal'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler, { rateLimit: 'api', requireCompany: true })
export const PATCH = withAuth(patchHandler, { rateLimit: 'strict', requireCompany: true })
export const DELETE = withAuth(deleteHandler, { rateLimit: 'strict', requireCompany: true })

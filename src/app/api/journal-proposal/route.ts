import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import {
  withRetry,
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
} from './_utils'

async function handler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const companyId = queryParams.companyId
    if (!companyId) {
      return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'companyId is required'), {
        status: 400,
      })
    }

    const hasAccess = await verifyCompanyAccess(req, companyId)
    if (!hasAccess) {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Access denied to this company'), {
        status: 403,
      })
    }

    const page = parseInt(queryParams.page || '1', 10)
    const pageSize = Math.min(parseInt(queryParams.pageSize || '20', 10), 100)
    const status = queryParams.status
    const startDate = queryParams.startDate
    const endDate = queryParams.endDate

    const where: Record<string, unknown> = { companyId }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.createdAt = {} as Record<string, Date>
      if (startDate) {
        ;(where.createdAt as Record<string, Date>).gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        ;(where.createdAt as Record<string, Date>).lte = endDateTime
      }
    }

    const skip = (page - 1) * pageSize

    const [proposals, total] = await withRetry(
      async () =>
        Promise.all([
          prisma.journalProposal.findMany({
            where,
            include: {
              document: {
                select: {
                  id: true,
                  originalName: true,
                  contentType: true,
                  fileSize: true,
                  uploadedAt: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
          }),
          prisma.journalProposal.count({ where }),
        ]),
      { maxRetries: 2, initialDelayMs: 500, maxDelayMs: 2000, backoffMultiplier: 2 }
    )

    return NextResponse.json(
      createSuccessResponse({
        proposals,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      })
    )
  } catch (error) {
    console.error('Failed to fetch journal proposals:', error)
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to fetch journal proposals'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handler, { rateLimit: 'strict', requireCompany: true })

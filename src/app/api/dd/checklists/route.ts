import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import { ddChecklistService } from '@/services/dd/checklist-service'
import type { DDChecklistType } from '@/services/dd/types'

async function getHandler(req: AuthenticatedRequest) {
  try {
    const searchParams = new URL(req.url).searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const type = searchParams.get('type') as DDChecklistType | null
    const fiscalYear = searchParams.get('fiscalYear')
      ? parseInt(searchParams.get('fiscalYear')!, 10)
      : null

    const companyId = await validateCompanyId(req.user, searchParams.get('companyId'))

    const where: {
      companyId: string
      type?: DDChecklistType
      fiscalYear?: number
    } = { companyId }

    if (type) {
      where.type = type
    }

    if (fiscalYear) {
      where.fiscalYear = fiscalYear
    }

    const { prisma } = await import('@/lib/db')
    const [checklists, total] = await Promise.all([
      prisma.dDChecklist.findMany({
        where,
        include: {
          items: {
            select: {
              id: true,
              category: true,
              itemCode: true,
              title: true,
              status: true,
              severity: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dDChecklist.count({ where }),
    ])

    return NextResponse.json({
      data: checklists.map((c) => ({
        id: c.id,
        type: c.type,
        fiscalYear: c.fiscalYear,
        status: c.status,
        materiality: c.materiality,
        overallScore: c.overallScore,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        items: c.items,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[API] Error fetching DD checklists:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DD checklists' } },
      { status: 500 }
    )
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json()
    const { type, fiscalYear, materialityThreshold, skipItems, focusCategories } = body

    const companyId = await validateCompanyId(req.user, body.companyId)

    if (!type || !fiscalYear) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'type and fiscalYear are required' } },
        { status: 400 }
      )
    }

    const validTypes: DDChecklistType[] = [
      'IPO_SHORT_REVIEW',
      'MA_FINANCIAL_DD',
      'TAX_DD',
      'COMPREHENSIVE',
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
          },
        },
        { status: 400 }
      )
    }

    const result = await ddChecklistService.createChecklist({
      type,
      fiscalYear,
      companyId,
      materialityThreshold,
      skipItems,
      focusCategories,
      createdBy: req.user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'CREATE_FAILED', message: result.error.message } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        id: result.data.id,
        type: result.data.type,
        fiscalYear: result.data.fiscalYear,
        status: result.data.status,
        materiality: result.data.materiality,
        createdAt: result.data.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[API] Error creating DD checklist:', error)
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create DD checklist' } },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler, { requireCompany: true })
export const POST = withAuth(postHandler, { requireCompany: true })

import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import {
  accountMappingService,
  type MappingFilters,
} from '@/services/conversion/account-mapping-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const querySchema = z.object({
  sourceCoaId: z.string().optional(),
  targetCoaId: z.string().optional(),
  mappingType: z.enum(['1to1', '1toN', 'Nto1', 'complex']).optional(),
  isApproved: z.coerce.boolean().optional(),
  isManualReview: z.coerce.boolean().optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['sourceCode', 'targetCode', 'confidence', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

async function getHandler(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url)
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams))

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    )
  }

  const query = parseResult.data
  const companyId = req.user.companyId

  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  try {
    const filters: MappingFilters = {}
    if (query.sourceCoaId) filters.sourceCoaId = query.sourceCoaId
    if (query.targetCoaId) filters.targetCoaId = query.targetCoaId
    if (query.mappingType) filters.mappingType = query.mappingType
    if (query.isApproved !== undefined) filters.isApproved = query.isApproved
    if (query.isManualReview !== undefined) filters.isManualReview = query.isManualReview
    if (query.minConfidence !== undefined) filters.minConfidence = query.minConfidence

    const result = await accountMappingService.getByCompany(
      companyId,
      filters,
      query.page,
      query.limit
    )

    const sortField =
      query.sortBy === 'sourceCode'
        ? 'sourceAccountCode'
        : query.sortBy === 'targetCode'
          ? 'targetAccountCode'
          : query.sortBy

    const sortedData = [...result.data].sort((a, b) => {
      let comparison = 0
      if (sortField === 'sourceAccountCode') {
        comparison = a.sourceAccountCode.localeCompare(b.sourceAccountCode)
      } else if (sortField === 'targetAccountCode') {
        comparison = a.targetAccountCode.localeCompare(b.targetAccountCode)
      } else if (sortField === 'confidence') {
        comparison = a.confidence - b.confidence
      } else {
        comparison = 0
      }
      return query.sortOrder === 'desc' ? -comparison : comparison
    })

    return NextResponse.json({
      data: sortedData,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('Failed to fetch mappings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mappings', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

const conversionRuleSchema = z.object({
  type: z.enum(['direct', 'percentage', 'formula', 'ai_suggested']),
  percentage: z.number().min(0).max(100).optional(),
  formula: z.string().max(500).optional(),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(['equals', 'contains', 'gt', 'lt', 'between']),
        value: z.union([z.string(), z.number()]),
        targetAccountId: z.string(),
      })
    )
    .optional(),
})

const createSchema = z.object({
  sourceCoaId: z.string(),
  sourceItemId: z.string(),
  targetCoaId: z.string(),
  targetItemId: z.string(),
  mappingType: z.enum(['1to1', '1toN', 'Nto1', 'complex']),
  conversionRule: conversionRuleSchema.optional(),
  percentage: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
})

async function postHandler(req: AuthenticatedRequest) {
  const companyId = req.user.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parseResult = createSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    )
  }

  const validated = parseResult.data

  try {
    const existing = await prisma.accountMapping.findUnique({
      where: {
        companyId_sourceItemId_targetCoaId: {
          companyId,
          sourceItemId: validated.sourceItemId,
          targetCoaId: validated.targetCoaId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        {
          error: 'Mapping already exists',
          code: 'DUPLICATE',
          existingId: existing.id,
        },
        { status: 409 }
      )
    }

    const mapping = await accountMappingService.create({
      companyId,
      sourceCoaId: validated.sourceCoaId,
      sourceItemId: validated.sourceItemId,
      targetCoaId: validated.targetCoaId,
      targetItemId: validated.targetItemId,
      mappingType: validated.mappingType,
      conversionRule: validated.conversionRule,
      percentage: validated.percentage,
      notes: validated.notes,
      createdBy: req.user.id,
    })

    return NextResponse.json({ data: mapping }, { status: 201 })
  } catch (error) {
    console.error('Failed to create mapping:', error)

    if (error instanceof Error && error.message.includes('Duplicate')) {
      return NextResponse.json({ error: error.message, code: 'DUPLICATE' }, { status: 409 })
    }

    return NextResponse.json(
      { error: 'Failed to create mapping', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const POST = withAccountantAuth(postHandler)

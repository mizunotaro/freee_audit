import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'
import { z } from 'zod'

const querySchema = z.object({
  status: z
    .enum(['draft', 'mapping', 'validating', 'converting', 'reviewing', 'completed', 'error'])
    .optional(),
  targetStandard: z.enum(['USGAAP', 'IFRS']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

async function getHandler(req: AuthenticatedRequest) {
  const companyId = req.user.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

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

  try {
    const result = await conversionProjectService.getByCompany(
      companyId,
      {
        status: query.status,
        targetStandard: query.targetStandard,
      },
      query.page,
      query.limit
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

const createSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    targetStandard: z.enum(['USGAAP', 'IFRS']),
    targetCoaId: z.string().min(1),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    settings: z
      .object({
        includeJournals: z.boolean().optional(),
        includeFinancialStatements: z.boolean().optional(),
        generateAdjustingEntries: z.boolean().optional(),
        aiAssistedMapping: z.boolean().optional(),
        currencyConversionRate: z.number().positive().optional(),
        functionalCurrency: z.string().length(3).optional(),
        presentationCurrency: z.string().length(3).optional(),
      })
      .optional(),
  })
  .refine((data) => new Date(data.periodStart) <= new Date(data.periodEnd), {
    message: 'periodStart must be before or equal to periodEnd',
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

  const data = parseResult.data

  try {
    const project = await conversionProjectService.create(
      companyId,
      {
        name: data.name,
        description: data.description,
        targetStandard: data.targetStandard,
        targetCoaId: data.targetCoaId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        settings: data.settings ?? {},
      },
      req.user.id
    )

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (error) {
    console.error('Failed to create project:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message, code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to create project', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const POST = withAccountantAuth(postHandler)

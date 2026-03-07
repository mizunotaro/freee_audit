import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'
import { z } from 'zod'

const querySchema = z.object({
  companyId: z.string().optional(),
  standardId: z.enum(['JGAAP', 'USGAAP', 'IFRS']).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
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
  const companyId = query.companyId || req.user.companyId

  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  try {
    const coas = await chartOfAccountService.getByCompany(companyId)

    let filtered = coas
    if (query.standardId) {
      filtered = filtered.filter((c) => c.standard === query.standardId)
    }
    if (query.isActive !== undefined) {
      filtered = filtered.filter((c) => c.isActive === query.isActive)
    }
    if (query.search) {
      const searchLower = query.search.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          (c.description && c.description.toLowerCase().includes(searchLower))
      )
    }

    const total = filtered.length
    const totalPages = Math.ceil(total / query.limit)
    const offset = (query.page - 1) * query.limit
    const paginated = filtered.slice(offset, offset + query.limit)

    return NextResponse.json({
      data: paginated,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Failed to fetch COAs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch COAs', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

const createItemSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  nameEn: z.string().min(1).max(100),
  category: z.enum([
    'current_asset',
    'fixed_asset',
    'deferred_asset',
    'current_liability',
    'fixed_liability',
    'deferred_liability',
    'equity',
    'revenue',
    'cogs',
    'sga_expense',
    'non_operating_income',
    'non_operating_expense',
    'extraordinary_income',
    'extraordinary_loss',
  ]),
  subcategory: z.string().max(50).optional(),
  normalBalance: z.enum(['debit', 'credit']),
  parentCode: z.string().max(20).optional(),
  isConvertible: z.boolean().default(true),
})

const createSchema = z.object({
  standardId: z.enum(['JGAAP', 'USGAAP', 'IFRS']),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  items: z.array(createItemSchema).min(1).max(10000),
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
    const standardMap: Record<string, string> = {
      JGAAP: 'jgaap',
      USGAAP: 'usgaap',
      IFRS: 'ifrs',
    }

    const coa = await chartOfAccountService.create({
      companyId,
      standardId: standardMap[validated.standardId],
      name: validated.name,
      description: validated.description,
      items: validated.items.map((item) => ({
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        category: item.category,
        subcategory: item.subcategory,
        normalBalance: item.normalBalance,
        parentCode: item.parentCode,
        isConvertible: item.isConvertible,
      })),
    })

    return NextResponse.json({ data: coa }, { status: 201 })
  } catch (error) {
    console.error('Failed to create COA:', error)

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message, code: 'DUPLICATE' }, { status: 409 })
    }

    return NextResponse.json(
      { error: 'Failed to create COA', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const POST = withAccountantAuth(postHandler)

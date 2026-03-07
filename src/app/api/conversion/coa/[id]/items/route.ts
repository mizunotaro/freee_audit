import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'
import { z } from 'zod'
import type { AccountCategory } from '@/types/conversion'

const querySchema = z.object({
  category: z.string().optional(),
})

async function getHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  if (!context?.params) {
    return NextResponse.json(
      { error: 'Missing parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const params = await Promise.resolve(context.params)
  const id = params.id

  const { searchParams } = new URL(req.url)
  const query = querySchema.safeParse(Object.fromEntries(searchParams))

  try {
    const coa = await chartOfAccountService.getById(id)

    if (!coa) {
      return NextResponse.json(
        { error: 'Chart of Accounts not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (
      coa.companyId !== req.user.companyId &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    let items = coa.items
    if (query.success && query.data.category) {
      items = items.filter((item) => item.category === query.data.category)
    }

    return NextResponse.json({ data: items })
  } catch (error) {
    console.error('Failed to fetch COA items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch COA items', code: 'FETCH_ERROR' },
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
  parentId: z.string().optional(),
  isConvertible: z.boolean().default(true),
})

async function postHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  if (!context?.params) {
    return NextResponse.json(
      { error: 'Missing parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const params = await Promise.resolve(context.params)
  const id = params.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parseResult = createItemSchema.safeParse(body)
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
    const coa = await chartOfAccountService.getById(id)

    if (!coa) {
      return NextResponse.json(
        { error: 'Chart of Accounts not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (
      coa.companyId !== req.user.companyId &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    const item = await chartOfAccountService.addItem(id, {
      code: validated.code,
      name: validated.name,
      nameEn: validated.nameEn,
      category: validated.category as AccountCategory,
      subcategory: validated.subcategory,
      normalBalance: validated.normalBalance,
      parentId: validated.parentId,
      isConvertible: validated.isConvertible,
    })

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    console.error('Failed to add COA item:', error)

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message, code: 'DUPLICATE' }, { status: 409 })
    }

    return NextResponse.json(
      { error: 'Failed to add COA item', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const POST = withAccountantAuth(postHandler)

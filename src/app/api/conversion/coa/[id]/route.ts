import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, withAdminAuth, type AuthenticatedRequest } from '@/lib/api'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'
import { z } from 'zod'

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

    return NextResponse.json({ data: coa })
  } catch (error) {
    console.error('Failed to fetch COA:', error)
    return NextResponse.json({ error: 'Failed to fetch COA', code: 'FETCH_ERROR' }, { status: 500 })
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

async function putHandler(
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

  const parseResult = updateSchema.safeParse(body)
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
    const existing = await chartOfAccountService.getById(id)

    if (!existing) {
      return NextResponse.json(
        { error: 'Chart of Accounts not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (
      existing.companyId !== req.user.companyId &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    if (validated.isDefault === true) {
      await chartOfAccountService.setAsDefault(id)
    }

    const updated = await chartOfAccountService.update(id, {
      name: validated.name,
      description: validated.description ?? undefined,
      isActive: validated.isActive,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Failed to update COA:', error)
    return NextResponse.json(
      { error: 'Failed to update COA', code: 'UPDATE_ERROR' },
      { status: 500 }
    )
  }
}

async function deleteHandler(
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

  try {
    const existing = await chartOfAccountService.getById(id)

    if (!existing) {
      return NextResponse.json(
        { error: 'Chart of Accounts not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (existing.companyId !== req.user.companyId && req.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    await chartOfAccountService.delete(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete COA:', error)

    if (error instanceof Error && error.message.includes('in use')) {
      return NextResponse.json(
        {
          error: 'Cannot delete: Chart of Accounts is in use',
          code: 'IN_USE',
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete COA', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const PUT = withAccountantAuth(putHandler)
export const DELETE = withAdminAuth(deleteHandler)

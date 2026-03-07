import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, withAdminAuth, type AuthenticatedRequest } from '@/lib/api'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'
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
    const project = await conversionProjectService.getById(id)

    if (!project) {
      return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (
      project.companyId !== req.user.companyId &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    return NextResponse.json({ data: project })
  } catch (error) {
    console.error('Failed to fetch project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['draft', 'mapping', 'validating', 'reviewing']).optional(),
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

  const data = parseResult.data

  try {
    const existing = await conversionProjectService.getById(id)

    if (!existing) {
      return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (existing.companyId !== req.user.companyId && req.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    const updateData = {
      name: data.name,
      description: data.description ?? undefined,
      status: data.status,
      settings: data.settings,
    }
    const updated = await conversionProjectService.update(id, updateData)
    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Failed to update project:', error)

    if (error instanceof Error && error.message.includes('Cannot update')) {
      return NextResponse.json({ error: error.message, code: 'INVALID_STATUS' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to update project', code: 'UPDATE_ERROR' },
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
    const existing = await conversionProjectService.getById(id)

    if (!existing) {
      return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (existing.companyId !== req.user.companyId && req.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    await conversionProjectService.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project:', error)

    if (error instanceof Error && error.message.includes('in progress')) {
      return NextResponse.json({ error: error.message, code: 'IN_PROGRESS' }, { status: 409 })
    }

    return NextResponse.json(
      { error: 'Failed to delete project', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const PUT = withAccountantAuth(putHandler)
export const DELETE = withAdminAuth(deleteHandler)

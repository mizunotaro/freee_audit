import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { accountMappingService } from '@/services/conversion/account-mapping-service'
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
    const mapping = await accountMappingService.getById(id)

    if (!mapping) {
      return NextResponse.json({ error: 'Mapping not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ data: mapping })
  } catch (error) {
    console.error('Failed to fetch mapping:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mapping', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

const conversionRuleSchema = z.object({
  type: z.enum(['direct', 'percentage', 'formula', 'ai_suggested']),
  percentage: z.number().min(0).max(100).optional(),
  formula: z.string().max(500).optional(),
})

const updateSchema = z.object({
  targetItemId: z.string().optional(),
  mappingType: z.enum(['1to1', '1toN', 'Nto1', 'complex']).optional(),
  conversionRule: conversionRuleSchema.optional(),
  percentage: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
  isApproved: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  isManualReview: z.boolean().optional(),
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
    const existing = await accountMappingService.getById(id)

    if (!existing) {
      return NextResponse.json({ error: 'Mapping not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const updated = await accountMappingService.update(id, validated)

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Failed to update mapping:', error)
    return NextResponse.json(
      { error: 'Failed to update mapping', code: 'UPDATE_ERROR' },
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
    const existing = await accountMappingService.getById(id)

    if (!existing) {
      return NextResponse.json({ error: 'Mapping not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    await accountMappingService.delete(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete mapping:', error)
    return NextResponse.json(
      { error: 'Failed to delete mapping', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const PUT = withAccountantAuth(putHandler)
export const DELETE = withAccountantAuth(deleteHandler)

import { NextResponse } from 'next/server'
import { withAuth, withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { conversionExportService } from '@/services/conversion/conversion-export-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const exportSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv', 'json']),
  includeJournals: z.boolean().default(true),
  includeFinancialStatements: z.boolean().default(true),
  includeAdjustingEntries: z.boolean().default(true),
  includeDisclosures: z.boolean().default(true),
  includeAIAnalysis: z.boolean().default(false),
  language: z.enum(['ja', 'en', 'both']).default('ja'),
  currency: z.enum(['source', 'target', 'both']).default('source'),
})

async function getProject(projectId: string) {
  return prisma.conversionProject.findUnique({
    where: { id: projectId },
    include: {
      company: true,
    },
  })
}

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
  const projectId = params.projectId

  const project = await getProject(projectId)

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

  try {
    const history = await conversionExportService.getExportHistory(projectId)
    return NextResponse.json({ data: history })
  } catch (error) {
    console.error('Failed to get export history:', error)
    return NextResponse.json(
      { error: 'Failed to get export history', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

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
  const projectId = params.projectId

  const project = await getProject(projectId)

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

  if (project.status !== 'completed') {
    return NextResponse.json(
      {
        error: 'Project not completed yet',
        code: 'NOT_COMPLETED',
        status: project.status,
      },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parseResult = exportSchema.safeParse(body)
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

  const config = parseResult.data

  try {
    const result = await conversionExportService.export(projectId, config, req.user.id)

    return NextResponse.json({
      data: result,
      message: 'Export completed successfully',
    })
  } catch (error) {
    console.error('Export failed:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: errorMessage, code: 'NOT_FOUND' }, { status: 404 })
    }

    if (errorMessage.includes('Unsupported')) {
      return NextResponse.json({ error: errorMessage, code: 'UNSUPPORTED_FORMAT' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Export failed', code: 'EXPORT_ERROR', details: errorMessage },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)
export const POST = withAccountantAuth(postHandler)

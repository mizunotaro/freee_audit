import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'
import { z } from 'zod'

const querySchema = z.object({
  includeJournals: z.coerce.boolean().default(false),
  includeFinancialStatements: z.coerce.boolean().default(true),
  includeWarnings: z.coerce.boolean().default(true),
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
  const projectId = params.id

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

  const project = await conversionProjectService.getById(projectId)

  if (!project) {
    return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (project.companyId !== req.user.companyId && req.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
  }

  if (project.status !== 'completed') {
    return NextResponse.json(
      { error: 'Project not completed yet', code: 'NOT_COMPLETED', status: project.status },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.conversionResult.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Conversion result not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const response: Record<string, unknown> = {
      id: result.id,
      projectId: result.projectId,
      conversionDate: result.conversionDate,
      conversionDurationMs: result.conversionDurationMs,
    }

    if (query.includeFinancialStatements) {
      response.balanceSheet = result.balanceSheet ? JSON.parse(result.balanceSheet) : null
      response.profitLoss = result.profitLoss ? JSON.parse(result.profitLoss) : null
      response.cashFlow = result.cashFlow ? JSON.parse(result.cashFlow) : null
    }

    if (query.includeJournals) {
      response.journalConversions = result.journalConversions
        ? JSON.parse(result.journalConversions)
        : []
    }

    if (query.includeWarnings) {
      response.warnings = result.warnings ? JSON.parse(result.warnings) : []
      response.errors = result.errors ? JSON.parse(result.errors) : []
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Failed to fetch results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch results', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)

import { NextResponse } from 'next/server'
import { withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { conversionEngine, type ExecutionOptions } from '@/services/conversion/conversion-engine'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'
import { z } from 'zod'

const executeSchema = z.object({
  dryRun: z.boolean().default(false),
  skipValidation: z.boolean().default(false),
  batchSize: z.number().int().min(100).max(5000).optional(),
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
  const projectId = params.id

  const project = await conversionProjectService.getById(projectId)

  if (!project) {
    return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (project.companyId !== req.user.companyId && req.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
  }

  if (!['draft', 'mapping', 'error'].includes(project.status)) {
    return NextResponse.json(
      { error: `Cannot execute project with status: ${project.status}`, code: 'INVALID_STATUS' },
      { status: 400 }
    )
  }

  let body: unknown = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    // Empty body is acceptable
  }

  const parseResult = executeSchema.safeParse(body)
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

  const options: ExecutionOptions = parseResult.data

  try {
    const result = await conversionEngine.execute(projectId, options)

    return NextResponse.json({
      data: result,
      message: options.dryRun
        ? 'Dry run completed successfully'
        : 'Conversion completed successfully',
    })
  } catch (error) {
    console.error('Conversion execution failed:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('aborted')) {
      return NextResponse.json(
        { error: 'Conversion was aborted', code: 'ABORTED' },
        { status: 409 }
      )
    }

    if (errorMessage.includes('Validation failed')) {
      return NextResponse.json({ error: errorMessage, code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Conversion execution failed', code: 'EXECUTION_ERROR', details: errorMessage },
      { status: 500 }
    )
  }
}

export const POST = withAccountantAuth(postHandler)

import { NextResponse } from 'next/server'
import { withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { conversionEngine } from '@/services/conversion/conversion-engine'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'

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

  if (project.status !== 'converting') {
    return NextResponse.json(
      { error: `Cannot abort project with status: ${project.status}`, code: 'INVALID_STATUS' },
      { status: 400 }
    )
  }

  try {
    await conversionEngine.abort(projectId)
    return NextResponse.json({ success: true, message: 'Conversion aborted' })
  } catch (error) {
    console.error('Failed to abort conversion:', error)
    return NextResponse.json(
      { error: 'Failed to abort conversion', code: 'ABORT_ERROR' },
      { status: 500 }
    )
  }
}

export const POST = withAccountantAuth(postHandler)

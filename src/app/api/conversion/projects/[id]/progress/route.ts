import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { conversionEngine } from '@/services/conversion/conversion-engine'
import { conversionProjectService } from '@/services/conversion/conversion-project-service'

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

  const project = await conversionProjectService.getById(projectId)

  if (!project) {
    return NextResponse.json({ error: 'Project not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (project.companyId !== req.user.companyId && req.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    const progress = await conversionEngine.getProgress(projectId)
    return NextResponse.json({ data: progress })
  } catch (error) {
    console.error('Failed to get progress:', error)
    return NextResponse.json(
      { error: 'Failed to get progress', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getHandler)

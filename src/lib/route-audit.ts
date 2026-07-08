import type { NextRequest } from 'next/server'
import { auditLogger } from '@/lib/audit/audit-logger'
import { success, failure, createAppError, ERROR_CODES, type Result } from '@/types/result'

export interface RouteAuditInput {
  request: NextRequest
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  result?: 'SUCCESS' | 'FAILURE'
}

export async function logRouteAudit(input: RouteAuditInput): Promise<Result<void>> {
  const userId = input.userId ?? input.request.headers.get('x-user-id') ?? undefined
  try {
    await auditLogger.log({
      userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      ipAddress: input.request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: input.request.headers.get('user-agent') ?? undefined,
      details: input.details,
      result: input.result ?? 'SUCCESS',
    })
    return success(undefined)
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error))
    return failure(createAppError(ERROR_CODES.DATABASE_ERROR, cause.message, { cause }))
  }
}

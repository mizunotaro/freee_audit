import { prisma } from '@/lib/db'

export interface AuditLogInput {
  userId?: string
  action: string
  resource: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
  result: 'SUCCESS' | 'FAILURE'
}

export interface ApiCallLogInput {
  provider: string
  endpoint: string
  method: string
  statusCode: number
  durationMs: number
  requestData?: Record<string, unknown>
  responseData?: Record<string, unknown>
  error?: string
  userId?: string
}

class AuditLogger {
  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          details: input.details ? JSON.stringify(input.details) : null,
          result: input.result,
        },
      })
    } catch (error) {
      console.error('[AuditLogger] Failed to write audit log:', error)
    }
  }

  async logApiCall(input: ApiCallLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: `API_CALL:${input.provider}`,
          resource: `${input.method} ${input.endpoint}`,
          resourceId: undefined,
          details: JSON.stringify({
            provider: input.provider,
            endpoint: input.endpoint,
            method: input.method,
            statusCode: input.statusCode,
            durationMs: input.durationMs,
            requestData: input.requestData,
            error: input.error,
          }),
          result: input.statusCode >= 200 && input.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
        },
      })
    } catch (error) {
      console.error('[AuditLogger] Failed to write API call log:', error)
    }
  }

  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      result: 'SUCCESS',
    })
  }

  async logLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      userId,
      action: 'LOGIN',
      resource: 'session',
      ipAddress,
      userAgent,
      result: 'SUCCESS',
    })
  }

  async logLogout(userId: string, ipAddress?: string): Promise<void> {
    await this.log({
      userId,
      action: 'LOGOUT',
      resource: 'session',
      ipAddress,
      result: 'SUCCESS',
    })
  }

  async logFailedLogin(email: string, ipAddress?: string, reason?: string): Promise<void> {
    await this.log({
      action: 'LOGIN_FAILED',
      resource: 'session',
      ipAddress,
      details: { email, reason },
      result: 'FAILURE',
    })
  }

  async logAuditRun(
    userId: string | undefined,
    journalCount: number,
    passedCount: number,
    failedCount: number
  ): Promise<void> {
    await this.log({
      userId,
      action: 'AUDIT_RUN',
      resource: 'audit',
      details: {
        journalCount,
        passedCount,
        failedCount,
      },
      result: 'SUCCESS',
    })
  }

  async logFreeeApiCall(
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number,
    companyId?: string
  ): Promise<void> {
    await this.logApiCall({
      provider: 'freee',
      endpoint,
      method,
      statusCode,
      durationMs,
      userId: companyId,
    })
  }

  async logAiApiCall(
    provider: string,
    operation: string,
    statusCode: number,
    durationMs: number,
    tokensUsed?: number
  ): Promise<void> {
    await this.logApiCall({
      provider,
      endpoint: operation,
      method: 'POST',
      statusCode,
      durationMs,
      requestData: tokensUsed ? { tokensUsed } : undefined,
    })
  }

  async getRecentLogs(
    limit = 100,
    userId?: string,
    action?: string
  ): Promise<
    Array<{
      id: string
      userId: string | null
      action: string
      resource: string
      resourceId: string | null
      createdAt: Date
      result: string
      details: string | null
    }>
  > {
    const where: { userId?: string; action?: string } = {}
    if (userId) where.userId = userId
    if (action) where.action = action

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}

export const auditLogger = new AuditLogger()

export function withApiLogging<T>(
  provider: string,
  endpoint: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  return withApiLoggingAsync(provider, endpoint, method, fn)
}

async function withApiLoggingAsync<T>(
  provider: string,
  endpoint: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  let statusCode = 200

  try {
    const result = await fn()
    return result
  } catch (error) {
    statusCode = 500
    throw error
  } finally {
    const durationMs = Date.now() - startTime
    auditLogger
      .logApiCall({
        provider,
        endpoint,
        method,
        statusCode,
        durationMs,
      })
      .catch(console.error)
  }
}

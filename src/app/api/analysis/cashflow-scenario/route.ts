import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { projectCashflowScenario } from '@/services/analysis/cashflow-scenario'
import { CONFIG_VERSION } from '../config/constants'
import { parseJsonSafely } from '../utils/validation'
import { checkBoundaryLimits, checkInputSize } from '../utils/boundary-check'
import { generateRequestId } from '../utils/request-id'
import { AnalysisLogger } from '../utils/logger'
import type { ApiResponse } from '../types/response'
import type { ErrorCode } from '../types/app-error'
import { createSuccessResponse, createErrorResponse } from '../types/response'
import { createInternalError } from '../types/app-error'
import { withRateLimit } from '../middleware/rate-limit'
import { withTimeout } from '../middleware/timeout'
import { addSecurityHeaders } from '../middleware/security-headers'
import { logRouteAudit } from '@/lib/route-audit'
import type { CashflowScenarioOutput } from '@/services/analysis/cashflow-scenario'

/**
 * キャッシュフロー・シナリオ分析API (FIN-API-01)
 *
 * Projects cash position under optimistic / realistic / pessimistic net-cash-
 * flow assumptions and derives runway (months until cash <= 0) for each.
 * Cited formulas: this service module (cash runaway / months-of-runway,
 * Garrison cash-budget projection). Reuses runway-calculator's getRunwayAlert.
 *
 * FINANCIAL OUTPUT — scenario semantics + horizon are `PENDING HUMAN
 * DETERMINATION`; the carrying PR is labelled human-review-required +
 * do-not-auto-merge.
 */
async function handlePost(
  request: NextRequest
): Promise<NextResponse<ApiResponse<CashflowScenarioOutput>>> {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      createErrorResponse(
        {
          code: 'UNAUTHORIZED' as ErrorCode,
          message: 'Unauthorized',
          timestamp: new Date().toISOString(),
          requestId: 'auth',
        },
        { requestId: 'auth' }
      ),
      { status: 401 }
    )
  }

  const startTime = Date.now()
  const requestId = generateRequestId()
  const logger = new AnalysisLogger({
    requestId,
    module: 'cashflow-scenario',
    version: CONFIG_VERSION,
  })

  try {
    const parseResult = parseJsonSafely(await request.text())
    if (!parseResult.success) {
      logger.error('JSON parse failed', new Error(parseResult.error.message))
      return NextResponse.json(createErrorResponse(parseResult.error, { requestId }), {
        status: 400,
      })
    }

    const sizeCheck = checkInputSize(parseResult.data)
    if (!sizeCheck.success) {
      logger.error('Input size check failed', new Error(sizeCheck.error.message))
      return NextResponse.json(createErrorResponse(sizeCheck.error, { requestId }), {
        status: 400,
      })
    }

    const boundaryCheck = checkBoundaryLimits(parseResult.data)
    if (!boundaryCheck.success) {
      logger.error('Boundary check failed', new Error(boundaryCheck.error.message))
      return NextResponse.json(createErrorResponse(boundaryCheck.error, { requestId }), {
        status: 400,
      })
    }

    const result = projectCashflowScenario(parseResult.data)
    if (!result.success) {
      logger.error('Cash-flow scenario failed', new Error(result.error.message))
      const appError = {
        code: result.error.code as ErrorCode,
        message: result.error.message,
        details: result.error.details,
        timestamp: new Date().toISOString(),
        requestId,
      }
      return NextResponse.json(createErrorResponse(appError, { requestId }), { status: 400 })
    }

    logger.info('Cash-flow scenario completed', {
      durationMs: Date.now() - startTime,
      scenarios: result.data.scenarios.length,
    })

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'ANALYSIS_CASHFLOW_SCENARIO',
      resource: 'analysis',
      details: {
        currentCash: result.data.currentCash,
        baseBurnRate: result.data.baseBurnRate,
      },
    })

    return NextResponse.json(
      createSuccessResponse(result.data, {
        requestId,
        processingTimeMs: Date.now() - startTime,
        cached: false,
      })
    )
  } catch (error) {
    await logRouteAudit({
      request,
      userId: user.id,
      action: 'ANALYSIS_CASHFLOW_SCENARIO',
      resource: 'analysis',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    logger.error('Unexpected error', error instanceof Error ? error : new Error(String(error)))
    const internalError = createInternalError(
      error instanceof Error ? error.message : 'Unknown error',
      requestId
    )
    return NextResponse.json(
      createErrorResponse(internalError, { requestId, processingTimeMs: Date.now() - startTime }),
      { status: 500 }
    )
  }
}

const rateLimitedHandler = withRateLimit()(handlePost)
const timeoutHandler = withTimeout()(rateLimitedHandler)

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<CashflowScenarioOutput>>> {
  const response = await timeoutHandler(request)
  return addSecurityHeaders(response as NextResponse<ApiResponse<CashflowScenarioOutput>>)
}

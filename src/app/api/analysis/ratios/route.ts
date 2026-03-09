import { NextRequest, NextResponse } from 'next/server'
import { analyzeRatios } from '@/services/ai/analyzers/ratio-analyzer'
import { CONFIG_VERSION } from '../config/constants'
import { validateWithSchema, parseJsonSafely } from '../utils/validation'
import { checkBoundaryLimits, checkInputSize } from '../utils/boundary-check'
import { generateRequestId } from '../utils/request-id'
import { AnalysisLogger } from '../utils/logger'
import { getAnalysisCache } from '../cache/analysis-cache'
import { RatioAnalysisRequestSchema } from '../schemas/request-schemas'
import type { RatioAnalysisRequest } from '../types/input'
import type { RatioAnalysisOutput } from '../types/output'
import type { ApiResponse } from '../types/response'
import type { ErrorCode } from '../types/app-error'
import { createSuccessResponse, createErrorResponse } from '../types/response'
import { createInternalError, createMissingFieldsError } from '../types/app-error'
import { withRateLimit } from '../middleware/rate-limit'
import { withTimeout } from '../middleware/timeout'
import { addSecurityHeaders } from '../middleware/security-headers'

/**
 * 財務比率分析APIエンドポイント
 *
 * 貸借対照表・損益計算書から各種財務比率を計算し、分析結果を返します。
 * カテゴリ別にフィルタリング可能です。
 *
 * **機能**:
 * - キャッシング（TTL: 1時間）
 * - タイムアウト（デフォルト: 30秒）
 * - レート制限（100リクエスト/分）
 * - 入力バリデーション（Zodスキーマ）
 * - 境界値チェック
 * - セキュリティヘッダー
 * - 統一ログフォーマット
 *
 * @param request - Next.jsリクエストオブジェクト
 * @returns 比率分析結果またはエラーを含むNext.jsレスポンス
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/analysis/ratios', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     balanceSheet: { fiscalYear: 2024, ... },
 *     profitLoss: { fiscalYear: 2024, ... },
 *     categories: ['liquidity', 'profitability']
 *   })
 * })
 *
 * const result = await response.json()
 * if (result.success) {
 *   console.log('Groups:', result.data.groups.length)
 *   console.log('Total Ratios:', result.data.allRatios.length)
 * }
 * ```
 */

async function handlePost(
  request: NextRequest
): Promise<NextResponse<ApiResponse<RatioAnalysisOutput>>> {
  const startTime = Date.now()
  const requestId = generateRequestId()

  const logger = new AnalysisLogger({
    requestId,
    module: 'ratio-analysis',
    version: CONFIG_VERSION,
  })

  try {
    const bodyText = await request.text()
    const parseResult = parseJsonSafely(bodyText)

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

    const validationResult = validateWithSchema(parseResult.data, RatioAnalysisRequestSchema)
    if (!validationResult.success) {
      logger.error('Validation failed', new Error(validationResult.error.message))
      return NextResponse.json(createErrorResponse(validationResult.error, { requestId }), {
        status: 400,
      })
    }

    const body: RatioAnalysisRequest = validationResult.data

    if (!body.balanceSheet || !body.profitLoss) {
      const error = createMissingFieldsError(['balanceSheet', 'profitLoss'], requestId)
      logger.error('Missing required fields', new Error(error.message))
      return NextResponse.json(createErrorResponse(error, { requestId }), { status: 400 })
    }

    const cacheKey = `ratio:${requestId}:${JSON.stringify({
      bs: body.balanceSheet.fiscalYear,
      pl: body.profitLoss.fiscalYear,
      categories: body.categories,
    })}`

    const cache = getAnalysisCache()
    const cachedResult = cache.get<RatioAnalysisOutput>(cacheKey)

    if (cachedResult) {
      logger.info('Analysis completed from cache', {
        cached: true,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json(
        createSuccessResponse(cachedResult, {
          requestId,
          processingTimeMs: Date.now() - startTime,
          cached: true,
        })
      )
    }

    const result = analyzeRatios({
      bs: body.balanceSheet,
      pl: body.profitLoss,
      prevBS: body.previousBalanceSheet,
      prevPL: body.previousProfitLoss,
    })

    if (!result.success) {
      logger.error('Ratio analysis failed', new Error(result.error?.message ?? 'Unknown error'))
      const appError = {
        code: result.error!.code as ErrorCode,
        message: result.error!.message,
        timestamp: new Date().toISOString(),
        requestId,
      }
      return NextResponse.json(createErrorResponse(appError, { requestId }), { status: 400 })
    }

    let filteredGroups = result.data!.groups
    if (body.categories && body.categories.length > 0) {
      filteredGroups = filteredGroups.filter((g) =>
        body.categories!.includes(
          g.category as 'liquidity' | 'safety' | 'profitability' | 'efficiency' | 'growth'
        )
      )
    }

    const output: RatioAnalysisOutput = {
      groups: filteredGroups,
      allRatios: result.data!.allRatios,
      summary: result.data!.summary,
      calculatedAt: result.data!.calculatedAt.toISOString(),
    }

    cache.set(cacheKey, output)

    logger.info('Analysis completed', { durationMs: Date.now() - startTime, cached: false })

    return NextResponse.json(
      createSuccessResponse(output, {
        requestId,
        processingTimeMs: Date.now() - startTime,
        cached: false,
      })
    )
  } catch (error) {
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
): Promise<NextResponse<ApiResponse<RatioAnalysisOutput>>> {
  const response = await timeoutHandler(request)
  return addSecurityHeaders(response as NextResponse<ApiResponse<RatioAnalysisOutput>>)
}

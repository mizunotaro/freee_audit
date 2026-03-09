import { NextRequest, NextResponse } from 'next/server'
import { compareWithBenchmark, createBenchmarkService } from '@/services/benchmark'
import { CONFIG_VERSION } from '../config/constants'
import { validateWithSchema, parseJsonSafely } from '../utils/validation'
import { checkBoundaryLimits, checkInputSize } from '../utils/boundary-check'
import { generateRequestId } from '../utils/request-id'
import { AnalysisLogger } from '../utils/logger'
import { getAnalysisCache } from '../cache/analysis-cache'
import { BenchmarkRequestSchema } from '../schemas/request-schemas'
import type { BenchmarkRequest } from '../types/input'
import type { BenchmarkOutput } from '../types/output'
import type { ApiResponse } from '../types/response'
import { createSuccessResponse, createErrorResponse } from '../types/response'
import { createInternalError, createMissingFieldsError } from '../types/app-error'
import { withRateLimit } from '../middleware/rate-limit'
import { withTimeout } from '../middleware/timeout'
import { addSecurityHeaders } from '../middleware/security-headers'

/**
 * ベンチマーク比較APIエンドポイント
 *
 * 財務比率を業界平均・企業規模別ベンチマークと比較します。
 *
 * **機能**:
 * - キャッシング（TTL: 24時間）
 * - タイムアウト（デフォルト: 10秒）
 * - レート制限（100リクエスト/分）
 * - 入力バリデーション（Zodスキーマ）
 * - 境界値チェック
 * - セキュリティヘッダー
 * - 統一ログフォーマット
 *
 * @param request - Next.jsリクエストオブジェクト
 * @returns ベンチマーク比較結果またはエラーを含むNext.jsレスポンス
 *
 * @example
 * ```typescript
 * // POST: ベンチマーク比較
 * const response = await fetch('/api/analysis/benchmark', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     ratios: { current_ratio: 150.5, equity_ratio: 45.2 },
 *     sector: 'manufacturing',
 *     companySize: 'medium'
 *   })
 * })
 *
 * // GET: 利用可能なセクター・指標一覧
 * const response = await fetch('/api/analysis/benchmark')
 * const result = await response.json()
 * console.log('Available Sectors:', result.data.availableSectors)
 * ```
 */

async function handlePost(
  request: NextRequest
): Promise<NextResponse<ApiResponse<BenchmarkOutput>>> {
  const startTime = Date.now()
  const requestId = generateRequestId()

  const logger = new AnalysisLogger({
    requestId,
    module: 'benchmark',
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

    const validationResult = validateWithSchema(parseResult.data, BenchmarkRequestSchema)
    if (!validationResult.success) {
      logger.error('Validation failed', new Error(validationResult.error.message))
      return NextResponse.json(createErrorResponse(validationResult.error, { requestId }), {
        status: 400,
      })
    }

    const body: BenchmarkRequest = validationResult.data

    if (!body.ratios || typeof body.ratios !== 'object') {
      const error = createMissingFieldsError(['ratios'], requestId)
      logger.error('Missing required fields', new Error(error.message))
      return NextResponse.json(createErrorResponse(error, { requestId }), { status: 400 })
    }

    const cacheKey = `benchmark:${requestId}:${JSON.stringify({
      ratios: Object.keys(body.ratios).length,
      sector: body.sector,
      companySize: body.companySize,
    })}`

    const cache = getAnalysisCache()
    const cachedResult = cache.get<BenchmarkOutput>(cacheKey)

    if (cachedResult) {
      logger.info('Benchmark completed from cache', {
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

    const result = compareWithBenchmark(body.ratios, {
      sector: body.sector,
      companySize: body.companySize,
      employeeCount: body.employeeCount,
      annualRevenue: body.annualRevenue,
    })

    if (!result.success) {
      logger.error('Benchmark failed', new Error(result.error?.message ?? 'Unknown error'))
      const appError = {
        code: result.error!.code as
          | 'VALIDATION_ERROR'
          | 'MISSING_REQUIRED_FIELDS'
          | 'INVALID_DATA'
          | 'BENCHMARK_UNAVAILABLE'
          | 'INTERNAL_ERROR',
        message: result.error!.message,
        timestamp: new Date().toISOString(),
        requestId,
      }
      return NextResponse.json(createErrorResponse(appError, { requestId }), { status: 400 })
    }

    cache.set(cacheKey, result.data!)

    logger.info('Benchmark completed', { durationMs: Date.now() - startTime, cached: false })

    return NextResponse.json(
      createSuccessResponse(result.data!, {
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

async function handleGet(): Promise<NextResponse> {
  const service = createBenchmarkService()
  const sectors = service.getAvailableSectors()

  const response = NextResponse.json(
    createSuccessResponse(
      {
        availableSectors: sectors,
        availableMetrics: [
          { id: 'current_ratio', name: '流動比率' },
          { id: 'quick_ratio', name: '当座比率' },
          { id: 'equity_ratio', name: '自己資本比率' },
          { id: 'debt_to_equity', name: 'D/Eレシオ' },
          { id: 'gross_margin', name: '売上総利益率' },
          { id: 'operating_margin', name: '営業利益率' },
          { id: 'net_margin', name: '当期純利益率' },
          { id: 'roa', name: 'ROA' },
          { id: 'roe', name: 'ROE' },
          { id: 'asset_turnover', name: '総資産回転率' },
          { id: 'inventory_turnover', name: '棚卸資産回転率' },
        ],
      },
      { requestId: generateRequestId(), processingTimeMs: 0, cached: false }
    )
  )

  return addSecurityHeaders(response)
}

const rateLimitedPostHandler = withRateLimit()(handlePost)
const timeoutPostHandler = withTimeout({ timeoutMs: 10000 })(rateLimitedPostHandler)

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<BenchmarkOutput>>> {
  const response = await timeoutPostHandler(request)
  return addSecurityHeaders(response as NextResponse<ApiResponse<BenchmarkOutput>>)
}

export async function GET(): Promise<NextResponse> {
  return handleGet()
}

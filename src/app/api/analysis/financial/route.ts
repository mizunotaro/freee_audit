import { NextRequest, NextResponse } from 'next/server'
import { analyzeFinancials } from '@/services/ai/analyzers'
import { compareWithBenchmark } from '@/services/benchmark'
import { CONFIG_VERSION } from '../config/constants'
import { DEFAULT_ANALYSIS_OPTIONS, DEFAULT_BENCHMARK_OPTIONS } from '../config/defaults'
import { validateWithSchema, parseJsonSafely } from '../utils/validation'
import { checkBoundaryLimits, checkInputSize } from '../utils/boundary-check'
import { generateRequestId } from '../utils/request-id'
import { AnalysisLogger } from '../utils/logger'
import { getAnalysisCache } from '../cache/analysis-cache'
import { AnalysisRequestSchema } from '../schemas/request-schemas'
import type { AnalysisRequest } from '../types/input'
import type { FinancialAnalysisOutput } from '../types/output'
import type { ApiResponse } from '../types/response'
import type { ErrorCode } from '../types/app-error'
import { createSuccessResponse, createErrorResponse } from '../types/response'
import { createInternalError, createMissingFieldsError } from '../types/app-error'
import { withRateLimit } from '../middleware/rate-limit'
import { withTimeout } from '../middleware/timeout'
import { addSecurityHeaders } from '../middleware/security-headers'

/**
 * 財務分析APIエンドポイント
 *
 * 貸借対照表・損益計算書を分析し、包括的な財務分析結果を返します。
 * オプションでベンチマーク比較を含めることができます。
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
 * @returns 分析結果またはエラーを含むNext.jsレスポンス
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/analysis/financial', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     balanceSheet: { fiscalYear: 2024, ... },
 *     profitLoss: { fiscalYear: 2024, ... },
 *     options: { depth: 'detailed', includeBenchmark: true }
 *   })
 * })
 *
 * const result = await response.json()
 * if (result.success) {
 *   console.log('Overall Score:', result.data.overallScore)
 *   console.log('Processing Time:', result.metadata.processingTimeMs, 'ms')
 * } else {
 *   console.error('Error:', result.error.message)
 * }
 * ```
 */

async function handlePost(
  request: NextRequest
): Promise<NextResponse<ApiResponse<FinancialAnalysisOutput>>> {
  const startTime = Date.now()
  const requestId = generateRequestId()

  const logger = new AnalysisLogger({
    requestId,
    module: 'financial-analysis',
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
      return NextResponse.json(createErrorResponse(sizeCheck.error, { requestId }), { status: 400 })
    }

    const boundaryCheck = checkBoundaryLimits(parseResult.data)
    if (!boundaryCheck.success) {
      logger.error('Boundary check failed', new Error(boundaryCheck.error.message))
      return NextResponse.json(createErrorResponse(boundaryCheck.error, { requestId }), {
        status: 400,
      })
    }

    const validationResult = validateWithSchema(parseResult.data, AnalysisRequestSchema)
    if (!validationResult.success) {
      logger.error('Validation failed', new Error(validationResult.error.message))
      return NextResponse.json(createErrorResponse(validationResult.error, { requestId }), {
        status: 400,
      })
    }

    const body: AnalysisRequest = validationResult.data

    if (!body.balanceSheet || !body.profitLoss) {
      const error = createMissingFieldsError(['balanceSheet', 'profitLoss'], requestId)
      logger.error('Missing required fields', new Error(error.message))
      return NextResponse.json(createErrorResponse(error, { requestId }), { status: 400 })
    }

    const options = { ...DEFAULT_ANALYSIS_OPTIONS, ...body.options }
    const cacheKey = `analysis:${requestId}:${JSON.stringify({ bs: body.balanceSheet.fiscalYear, pl: body.profitLoss.fiscalYear, options })}`

    const cache = getAnalysisCache()
    const cachedResult = cache.get<FinancialAnalysisOutput>(cacheKey)

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

    const analysisResult = analyzeFinancials(
      {
        balanceSheet: body.balanceSheet,
        profitLoss: body.profitLoss,
        cashFlow: body.cashFlow,
        previousBalanceSheet: body.previousBalanceSheet,
        previousProfitLoss: body.previousProfitLoss,
      },
      options
    )

    if (!analysisResult.success) {
      logger.error('Analysis failed', new Error(analysisResult.error?.message ?? 'Unknown error'))
      const appError = {
        code: analysisResult.error!.code as ErrorCode,
        message: analysisResult.error!.message,
        details: analysisResult.error!.details,
        timestamp: new Date().toISOString(),
        requestId,
      }
      return NextResponse.json(
        createErrorResponse(appError, { requestId, processingTimeMs: Date.now() - startTime })
      )
    }

    let output: FinancialAnalysisOutput = {
      ...analysisResult.data!,
      analyzedAt: analysisResult.data!.analyzedAt.toISOString(),
    }

    if (options.includeBenchmark && body.benchmarkOptions) {
      const ratios: Record<string, number> = {}

      const currentAssets = body.balanceSheet.assets.current.reduce(
        (s, a) => s + (a.amount ?? 0),
        0
      )
      const currentLiabilities = body.balanceSheet.liabilities.current.reduce(
        (s, l) => s + (l.amount ?? 0),
        0
      )
      const totalAssets = body.balanceSheet.totalAssets
      const totalEquity = body.balanceSheet.totalEquity
      const revenue = body.profitLoss.revenue.reduce((s, r) => s + (r.amount ?? 0), 0)
      const grossProfit = body.profitLoss.grossProfit ?? 0
      const operatingIncome = body.profitLoss.operatingIncome ?? 0
      const netIncome = body.profitLoss.netIncome ?? 0

      ratios.current_ratio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) * 100 : 0
      ratios.equity_ratio = totalAssets > 0 ? (totalEquity / totalAssets) * 100 : 0
      ratios.debt_to_equity = totalEquity > 0 ? body.balanceSheet.totalLiabilities / totalEquity : 0
      ratios.gross_margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
      ratios.operating_margin = revenue > 0 ? (operatingIncome / revenue) * 100 : 0
      ratios.net_margin = revenue > 0 ? (netIncome / revenue) * 100 : 0
      ratios.roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0
      ratios.roe = totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0

      const benchmarkOptions = { ...DEFAULT_BENCHMARK_OPTIONS, ...body.benchmarkOptions }
      const benchmarkResult = compareWithBenchmark(ratios, benchmarkOptions)

      if (benchmarkResult.success) {
        output = { ...output, benchmark: benchmarkResult.data! }
      }
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
): Promise<NextResponse<ApiResponse<FinancialAnalysisOutput>>> {
  const response = await timeoutHandler(request)
  return addSecurityHeaders(response as NextResponse<ApiResponse<FinancialAnalysisOutput>>)
}

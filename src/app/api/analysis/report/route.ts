import { NextRequest, NextResponse } from 'next/server'
import { analyzeFinancials } from '@/services/ai/analyzers'
import { analyzeRatios } from '@/services/ai/analyzers/ratio-analyzer'
import { compareWithBenchmark } from '@/services/benchmark'
import { CONFIG_VERSION } from '../config/constants'
import { validateWithSchema, parseJsonSafely } from '../utils/validation'
import { checkBoundaryLimits, checkInputSize } from '../utils/boundary-check'
import { generateRequestId } from '../utils/request-id'
import { AnalysisLogger } from '../utils/logger'
import { getAnalysisCache } from '../cache/analysis-cache'
import { ReportRequestSchema } from '../schemas/request-schemas'
import type { ReportRequest, ReportType, ReportFormat } from '../types/input'
import type { FinancialAnalysisOutput, RatioAnalysisOutput, BenchmarkOutput } from '../types/output'
import type { ApiResponse } from '../types/response'
import { createSuccessResponse, createErrorResponse } from '../types/response'
import { createInternalError, createMissingFieldsError } from '../types/app-error'
import { withRateLimit } from '../middleware/rate-limit'
import { withTimeout } from '../middleware/timeout'
import { addSecurityHeaders } from '../middleware/security-headers'

/**
 * レポート生成APIエンドポイント
 *
 * 財務分析・比率分析・ベンチマーク比較を統合したレポートを生成します。
 * JSON、Markdown、HTML形式で出力可能です。
 *
 * **機能**:
 * - キャッシング（TTL: 1時間）
 * - タイムアウト（デフォルト: 60秒）
 * - レート制限（100リクエスト/分）
 * - 入力バリデーション（Zodスキーマ）
 * - 境界値チェック
 * - セキュリティヘッダー
 * - 統一ログフォーマット
 *
 * @param request - Next.jsリクエストオブジェクト
 * @returns レポートまたはエラーを含むNext.jsレスポンス
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/analysis/report', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     balanceSheet: { fiscalYear: 2024, ... },
 *     profitLoss: { fiscalYear: 2024, ... },
 *     reportType: 'summary',
 *     format: 'markdown',
 *     options: { companyName: 'ABC Corp', fiscalYear: 2024 }
 *   })
 * })
 *
 * const result = await response.json()
 * if (result.success) {
 *   console.log('Format:', result.data.format)
 *   console.log('Content:', result.data.content)
 * }
 * ```
 */

interface ReportJsonData {
  reportType: ReportType
  companyName: string
  fiscalYear: number
  generatedAt: string
  financialAnalysis: FinancialAnalysisOutput | null
  ratioAnalysis: RatioAnalysisOutput | null
  benchmark: BenchmarkOutput | null
}

interface ReportMetadata {
  reportType: ReportType
  companyName: string
  fiscalYear: number
  generatedAt: string
  processingTimeMs: number
}

interface ReportOutput {
  format: ReportFormat
  content: string
  reportType: ReportType
  metadata: ReportMetadata
}

interface GenerateReportResult {
  json: ReportJsonData
  markdown: string
  html: string
}

async function handlePost(request: NextRequest): Promise<NextResponse<ApiResponse<ReportOutput>>> {
  const startTime = Date.now()
  const requestId = generateRequestId()

  const logger = new AnalysisLogger({
    requestId,
    module: 'report',
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

    const validationResult = validateWithSchema(parseResult.data, ReportRequestSchema)
    if (!validationResult.success) {
      logger.error('Validation failed', new Error(validationResult.error.message))
      return NextResponse.json(createErrorResponse(validationResult.error, { requestId }), {
        status: 400,
      })
    }

    const body: ReportRequest = validationResult.data

    if (!body.balanceSheet || !body.profitLoss) {
      const error = createMissingFieldsError(['balanceSheet', 'profitLoss'], requestId)
      logger.error('Missing required fields', new Error(error.message))
      return NextResponse.json(createErrorResponse(error, { requestId }), { status: 400 })
    }

    const cacheKey = `report:${requestId}:${JSON.stringify({
      bs: body.balanceSheet.fiscalYear,
      pl: body.profitLoss.fiscalYear,
      reportType: body.reportType,
      format: body.format,
    })}`

    const cache = getAnalysisCache()
    const cachedResult = cache.get<ReportOutput>(cacheKey)

    if (cachedResult) {
      logger.info('Report generated from cache', {
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

    const financialResult = analyzeFinancials(
      {
        balanceSheet: body.balanceSheet,
        profitLoss: body.profitLoss,
        cashFlow: body.cashFlow,
        previousBalanceSheet: body.previousBalanceSheet,
        previousProfitLoss: body.previousProfitLoss,
      },
      { depth: 'detailed' }
    )

    const ratioResult = analyzeRatios({
      bs: body.balanceSheet,
      pl: body.profitLoss,
      prevBS: body.previousBalanceSheet,
      prevPL: body.previousProfitLoss,
    })

    let benchmarkData: BenchmarkOutput | null = null
    if (body.options?.sector) {
      const ratios: Record<string, number> = {}
      if (ratioResult.success && ratioResult.data) {
        for (const ratio of ratioResult.data.allRatios) {
          ratios[ratio.definition.id] = ratio.value
        }
      }

      const benchmarkResult = compareWithBenchmark(ratios, {
        sector: body.options.sector,
      })

      if (benchmarkResult.success && benchmarkResult.data) {
        benchmarkData = benchmarkResult.data
      }
    }

    const reportData = generateReport({
      financialAnalysis:
        financialResult.success && financialResult.data
          ? {
              ...financialResult.data,
              analyzedAt: financialResult.data.analyzedAt.toISOString(),
            }
          : null,
      ratioAnalysis:
        ratioResult.success && ratioResult.data
          ? {
              ...ratioResult.data,
              calculatedAt: ratioResult.data.calculatedAt.toISOString(),
            }
          : null,
      benchmarkData,
      reportType: body.reportType,
      options: body.options,
    })

    const format: ReportFormat = body.format ?? 'json'

    let output: ReportOutput

    if (format === 'markdown') {
      output = {
        format: 'markdown',
        content: reportData.markdown,
        reportType: body.reportType,
        metadata: {
          reportType: body.reportType,
          companyName: body.options?.companyName ?? 'Company',
          fiscalYear: body.options?.fiscalYear ?? body.balanceSheet.fiscalYear,
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
        },
      }
    } else if (format === 'html') {
      output = {
        format: 'html',
        content: reportData.html,
        reportType: body.reportType,
        metadata: {
          reportType: body.reportType,
          companyName: body.options?.companyName ?? 'Company',
          fiscalYear: body.options?.fiscalYear ?? body.balanceSheet.fiscalYear,
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
        },
      }
    } else {
      output = {
        format: 'json',
        content: JSON.stringify(reportData.json),
        reportType: body.reportType,
        metadata: {
          reportType: body.reportType,
          companyName: body.options?.companyName ?? 'Company',
          fiscalYear: body.options?.fiscalYear ?? body.balanceSheet.fiscalYear,
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
        },
      }
    }

    cache.set(cacheKey, output)

    logger.info('Report generated', { durationMs: Date.now() - startTime, cached: false })

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

interface GenerateReportOptions {
  financialAnalysis: FinancialAnalysisOutput | null
  ratioAnalysis: RatioAnalysisOutput | null
  benchmarkData: BenchmarkOutput | null
  reportType: ReportType
  options?: {
    readonly sector?: string
    readonly companyName?: string
    readonly fiscalYear?: number
    readonly includeCharts?: boolean
  }
}

function generateReport(input: GenerateReportOptions): GenerateReportResult {
  const { financialAnalysis, ratioAnalysis, benchmarkData, reportType, options } = input

  const companyName = options?.companyName ?? 'Company'
  const fiscalYear = options?.fiscalYear ?? new Date().getFullYear()

  const jsonData: ReportJsonData = {
    reportType,
    companyName,
    fiscalYear,
    generatedAt: new Date().toISOString(),
    financialAnalysis,
    ratioAnalysis,
    benchmark: benchmarkData,
  }

  const markdown = generateMarkdownReport(jsonData, reportType)
  const html = generateHtmlReport(jsonData, reportType)

  return { json: jsonData, markdown, html }
}

function generateMarkdownReport(data: ReportJsonData, reportType: string): string {
  let markdown = `# ${data.companyName} 財務分析レポート\n\n`
  markdown += `**報告年度:** ${data.fiscalYear}年度\n`
  markdown += `**作成日:** ${new Date(data.generatedAt).toLocaleDateString('ja-JP')}\n`
  markdown += `**レポートタイプ:** ${getReportTypeName(reportType)}\n\n`

  if (data.financialAnalysis) {
    markdown += `## 総合評価\n\n`
    if (data.financialAnalysis.overallScore !== undefined) {
      markdown += `**総合スコア:** ${data.financialAnalysis.overallScore}点\n\n`
    }
    if (data.financialAnalysis.executiveSummary) {
      markdown += `### エグゼクティブサマリー\n\n`
      markdown += `${data.financialAnalysis.executiveSummary}\n\n`
    }
  }

  markdown += `---\n\n`
  markdown += `*このレポートは自動生成されています。*\n`

  return markdown
}

function generateHtmlReport(data: ReportJsonData, reportType: string): string {
  let html = `<!DOCTYPE html>\n`
  html += `<html lang="ja">\n`
  html += `<head>\n`
  html += `  <meta charset="UTF-8">\n`
  html += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`
  html += `  <title>${data.companyName} 財務分析レポート</title>\n`
  html += `  <style>\n`
  html += `    body { font-family: 'Hiragino Sans', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }\n`
  html += `    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }\n`
  html += `    h2 { color: #34495e; margin-top: 30px; }\n`
  html += `    .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }\n`
  html += `    .score { font-size: 2em; font-weight: bold; color: #3498db; }\n`
  html += `  </style>\n`
  html += `</head>\n`
  html += `<body>\n`
  html += `  <h1>${data.companyName} 財務分析レポート</h1>\n`
  html += `  <div class="metadata">\n`
  html += `    <p><strong>報告年度:</strong> ${data.fiscalYear}年度</p>\n`
  html += `    <p><strong>作成日:</strong> ${new Date(data.generatedAt).toLocaleDateString('ja-JP')}</p>\n`
  html += `    <p><strong>レポートタイプ:</strong> ${getReportTypeName(reportType)}</p>\n`
  html += `  </div>\n`

  if (data.financialAnalysis) {
    html += `  <h2>総合評価</h2>\n`
    if (data.financialAnalysis.overallScore !== undefined) {
      html += `  <p class="score">${data.financialAnalysis.overallScore}点</p>\n`
    }
    if (data.financialAnalysis.executiveSummary) {
      html += `  <h3>エグゼクティブサマリー</h3>\n`
      html += `  <p>${data.financialAnalysis.executiveSummary.replace(/\n/g, '<br>')}</p>\n`
    }
  }

  html += `  <hr>\n`
  html += `  <p><em>このレポートは自動生成されています。</em></p>\n`
  html += `</body>\n`
  html += `</html>\n`

  return html
}

function getReportTypeName(reportType: string): string {
  const names: Record<string, string> = {
    summary: 'サマリー',
    detailed: '詳細レポート',
    investor: '投資家向けレポート',
    management: '経営陣向けレポート',
    compliance: 'コンプライアンスレポート',
  }
  return names[reportType] ?? reportType
}

const rateLimitedHandler = withRateLimit()(handlePost)
const timeoutHandler = withTimeout({ timeoutMs: 60000 })(rateLimitedHandler)

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ReportOutput>>> {
  const response = await timeoutHandler(request)
  return addSecurityHeaders(response as NextResponse<ApiResponse<ReportOutput>>)
}

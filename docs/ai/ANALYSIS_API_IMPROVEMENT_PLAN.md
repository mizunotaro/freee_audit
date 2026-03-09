# Analysis API 品質改善計画書

## 概要

Task 2.4: Analysis API の品質を10基準すべてで100点にするための詳細改修計画。

**現状評価:** 部分的に実装済み（型チェック・Lint通過）
**目標:** 10品質基準すべてで100点達成

---

## 品質基準別評価と改修計画

### 1. 安定性 (Stability) - 現状: 30点

#### 現状の問題点
- ❌ タイムアウト設定なし
- ❌ リトライロジックなし
- ❌ Circuit Breakerなし
- ❌ graceful degradationなし

#### 改修内容

##### 1.1 タイムアウト設定
```typescript
// src/app/api/analysis/config/constants.ts
export const API_CONFIG = {
  version: '1.0.0',
  timeout: {
    analysis: 30000,        // 財務分析: 30秒
    benchmark: 10000,       // ベンチマーク: 10秒
    reportGeneration: 60000 // レポート生成: 60秒
  }
} as const
```

##### 1.2 リトライロジック
```typescript
// src/app/api/analysis/utils/retry.ts
export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T>
```

##### 1.3 Circuit Breaker
```typescript
// src/app/api/analysis/utils/circuit-breaker.ts
export class CircuitBreaker {
  private failureCount: number = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private lastFailureTime: number = 0
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T>
}
```

##### 1.4 実装ファイル
- `src/app/api/analysis/config/constants.ts`
- `src/app/api/analysis/utils/retry.ts`
- `src/app/api/analysis/utils/circuit-breaker.ts`
- `src/app/api/analysis/middleware/timeout.ts`

#### 検証方法
```bash
pnpm jest tests/unit/api/analysis/stability/ --coverage
```

#### 目標スコア: 100点

---

### 2. 堅牢性 (Robustness) - 現状: 40点

#### 現状の問題点
- ❌ Zodスキーマバリデーションなし
- ⚠️ null/undefined処理が部分的
- ❌ 境界値チェック不足
- ❌ 不正JSON入力のハンドリング不完全

#### 改修内容

##### 2.1 Zodスキーマ定義
```typescript
// src/app/api/analysis/schemas/request-schemas.ts
import { z } from 'zod'

export const BalanceSheetItemSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  amount: z.number().finite(),
  previousAmount: z.number().finite().optional(),
  children: z.lazy(() => z.array(BalanceSheetItemSchema)).optional()
})

export const BalanceSheetSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  assets: z.object({
    current: z.array(BalanceSheetItemSchema),
    fixed: z.array(BalanceSheetItemSchema),
    total: z.number().finite().nonnegative()
  }),
  liabilities: z.object({
    current: z.array(BalanceSheetItemSchema),
    fixed: z.array(BalanceSheetItemSchema),
    total: z.number().finite().nonnegative()
  }),
  equity: z.object({
    items: z.array(BalanceSheetItemSchema),
    total: z.number().finite()
  }),
  totalAssets: z.number().finite().positive(),
  totalLiabilities: z.number().finite().nonnegative(),
  totalEquity: z.number().finite()
})

export const AnalysisRequestSchema = z.object({
  balanceSheet: BalanceSheetSchema,
  profitLoss: ProfitLossSchema,
  cashFlow: CashFlowStatementSchema.optional(),
  previousBalanceSheet: BalanceSheetSchema.optional(),
  previousProfitLoss: ProfitLossSchema.optional(),
  options: AnalysisOptionsSchema.optional(),
  benchmarkOptions: BenchmarkOptionsSchema.optional()
})
```

##### 2.2 バリデーションユーティリティ
```typescript
// src/app/api/analysis/utils/validation.ts
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: AppError }

export function validateRequest<T>(
  input: unknown,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { errors: result.error.errors }
      }
    }
  }
  return { success: true, data: result.data }
}
```

##### 2.3 境界値チェック
```typescript
// src/app/api/analysis/utils/boundary-check.ts
export const BOUNDARY_LIMITS = {
  maxArrayLength: 1000,
  maxStringLength: 10000,
  maxAmount: Number.MAX_SAFE_INTEGER,
  minAmount: -Number.MAX_SAFE_INTEGER,
  maxNestingDepth: 10
} as const

export function checkBoundaryLimits(
  data: unknown,
  limits: typeof BOUNDARY_LIMITS
): ValidationResult<void>
```

##### 2.4 実装ファイル
- `src/app/api/analysis/schemas/request-schemas.ts`
- `src/app/api/analysis/schemas/response-schemas.ts`
- `src/app/api/analysis/utils/validation.ts`
- `src/app/api/analysis/utils/boundary-check.ts`

#### 検証方法
```bash
pnpm jest tests/unit/api/analysis/robustness/ --coverage
```

#### 目標スコア: 100点

---

### 3. 再現性 (Reproducibility) - 現状: 30点

#### 現状の問題点
- ❌ 設定バージョン管理なし
- ❌ 非決定的要素の注入なし
- ⚠️ ログにコンテキスト情報が不十分
- ❌ テストの決定論的実行が困難

#### 改修内容

##### 3.1 設定バージョン管理
```typescript
// src/app/api/analysis/config/index.ts
export const CONFIG_VERSION = '1.0.0'

export const ANALYSIS_CONFIG = {
  version: CONFIG_VERSION,
  defaults: {
    depth: 'standard' as const,
    language: 'ja' as const,
    includeAlerts: true,
    includeRecommendations: true,
    includeBenchmark: false
  },
  limits: {
    maxProcessingTime: 60000,
    maxInputSize: 10 * 1024 * 1024, // 10MB
    cacheTTL: 3600000 // 1時間
  }
} as const
```

##### 3.2 非決定的要素の注入
```typescript
// src/app/api/analysis/utils/time-provider.ts
export interface TimeProvider {
  now(): Date
  timestamp(): string
}

export class SystemTimeProvider implements TimeProvider {
  now(): Date { return new Date() }
  timestamp(): string { return new Date().toISOString() }
}

export class MockTimeProvider implements TimeProvider {
  constructor(private readonly fixedTime: Date) {}
  now(): Date { return this.fixedTime }
  timestamp(): string { return this.fixedTime.toISOString() }
}
```

##### 3.3 ログコンテキスト強化
```typescript
// src/app/api/analysis/utils/logger.ts
export interface LogContext {
  requestId: string
  module: string
  version: string
  userId?: string
  companyId?: string
  durationMs?: number
  cached?: boolean
}

export class AnalysisLogger {
  constructor(private readonly context: LogContext) {}
  
  info(message: string, data?: Record<string, unknown>): void
  error(message: string, error: Error, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  debug(message: string, data?: Record<string, unknown>): void
}
```

##### 3.4 実装ファイル
- `src/app/api/analysis/config/index.ts`
- `src/app/api/analysis/utils/time-provider.ts`
- `src/app/api/analysis/utils/logger.ts`
- `src/app/api/analysis/utils/request-id.ts`

#### 検証方法
```bash
grep -r "CONFIG_VERSION" src/app/api/analysis/
pnpm jest tests/unit/api/analysis/logging/ --coverage
```

#### 目標スコア: 100点

---

### 4. 拡張性 (Extensibility) - 現状: 40点

#### 現状の問題点
- ❌ インターフェース分離不足
- ❌ Strategy Patternなし
- ❌ 設定の外部化不足
- ❌ 新規プロバイダー追加が困難

#### 改修内容

##### 4.1 分析エンジンインターフェース
```typescript
// src/app/api/analysis/interfaces/analyzer.ts
export interface FinancialAnalyzer {
  readonly name: string
  readonly version: string
  analyze(input: AnalysisInput): Promise<AnalysisOutput>
  validate(input: unknown): ValidationResult<AnalysisInput>
}

export interface RatioCalculator {
  readonly category: RatioCategory
  calculate(bs: BalanceSheet, pl: ProfitLoss): CalculatedRatio[]
}

export interface BenchmarkProvider {
  readonly name: string
  compare(ratios: Record<string, number>, options: BenchmarkOptions): BenchmarkResult
  getAvailableSectors(): IndustrySector[]
}

export interface ReportGenerator {
  readonly format: 'json' | 'markdown' | 'html'
  generate(data: ReportData): string
}
```

##### 4.2 レジストリパターン
```typescript
// src/app/api/analysis/registry/analyzer-registry.ts
export class AnalyzerRegistry {
  private analyzers: Map<string, FinancialAnalyzer> = new Map()
  
  register(analyzer: FinancialAnalyzer): void
  get(name: string): FinancialAnalyzer | undefined
  list(): string[]
}

export class ReportGeneratorRegistry {
  private generators: Map<string, ReportGenerator> = new Map()
  
  register(generator: ReportGenerator): void
  get(format: string): ReportGenerator | undefined
}
```

##### 4.3 Strategy Pattern
```typescript
// src/app/api/analysis/strategies/report-strategy.ts
export interface ReportStrategy {
  generate(data: ReportData): ReportOutput
}

export class SummaryReportStrategy implements ReportStrategy {
  generate(data: ReportData): ReportOutput
}

export class DetailedReportStrategy implements ReportStrategy {
  generate(data: ReportData): ReportOutput
}

export class InvestorReportStrategy implements ReportStrategy {
  generate(data: ReportData): ReportOutput
}

export class ReportStrategyFactory {
  static create(reportType: ReportType): ReportStrategy
}
```

##### 4.4 設定の外部化
```typescript
// src/app/api/analysis/config/features.ts
export interface FeatureFlags {
  enableCaching: boolean
  enableRateLimit: boolean
  enableDetailedLogging: boolean
  enableBenchmarkComparison: boolean
}

export function getFeatureFlags(): FeatureFlags
```

##### 4.5 実装ファイル
- `src/app/api/analysis/interfaces/analyzer.ts`
- `src/app/api/analysis/interfaces/calculator.ts`
- `src/app/api/analysis/interfaces/provider.ts`
- `src/app/api/analysis/registry/analyzer-registry.ts`
- `src/app/api/analysis/registry/report-registry.ts`
- `src/app/api/analysis/strategies/report-strategy.ts`

#### 検証方法
```bash
pnpm jest tests/unit/api/analysis/extensibility/ --coverage
```

#### 目標スコア: 100点

---

### 5. メンテナンス性 (Maintainability) - 現状: 50点

#### 現状の問題点
- ❌ JSDocコメントなし
- ❌ 複雑なロジックにコメントなし
- ⚠️ 関数が長い（report/route.ts: 256行）
- ❌ 循環的複雑度が高い

#### 改修内容

##### 5.1 JSDocコメント追加
```typescript
/**
 * 財務分析APIエンドポイント
 * 
 * 貸借対照表・損益計算書を分析し、包括的な財務分析結果を返します。
 * オプションでベンチマーク比較を含めることができます。
 * 
 * @param request - Next.jsリクエストオブジェクト
 * @returns 分析結果またはエラーを含むNext.jsレスポンス
 * 
 * @example
 * ```typescript
 * // POST /api/analysis/financial
 * const response = await fetch('/api/analysis/financial', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     balanceSheet: { ... },
 *     profitLoss: { ... },
 *     options: { depth: 'detailed' }
 *   })
 * })
 * 
 * const result = await response.json()
 * if (result.success) {
 *   console.log(result.data.overallScore)
 * }
 * ```
 * 
 * @see {@link https://docs.example.com/api/analysis | API Documentation}
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalysisResponse<FinancialAnalysisOutput>>>
```

##### 5.2 関数分割
```typescript
// report/route.ts を分割

// src/app/api/analysis/report/handlers/post.ts
export async function handleReportRequest(
  request: NextRequest
): Promise<NextResponse<AnalysisResponse<ReportOutput>>>

// src/app/api/analysis/report/generators/base.ts
export abstract class BaseReportGenerator {
  protected generateMetadata(options: ReportOptions): ReportMetadata
  protected formatCurrency(amount: number): string
  protected formatDate(date: Date): string
}

// src/app/api/analysis/report/generators/json-generator.ts
export class JsonReportGenerator extends BaseReportGenerator implements ReportGenerator

// src/app/api/analysis/report/generators/markdown-generator.ts
export class MarkdownReportGenerator extends BaseReportGenerator implements ReportGenerator

// src/app/api/analysis/report/generators/html-generator.ts
export class HtmlReportGenerator extends BaseReportGenerator implements ReportGenerator
```

##### 5.3 複雑度低減
```typescript
// Before: 循環的複雑度が高い
function processRequest(body: unknown) {
  if (!body.balanceSheet) { ... }
  if (!body.profitLoss) { ... }
  if (body.options?.includeBenchmark) {
    if (body.benchmarkOptions) { ... }
  }
}

// After: 早期リターンとガード節
function processRequest(body: unknown): Result<ProcessedData, AppError> {
  const validationResult = validateRequest(body, RequestSchema)
  if (!validationResult.success) return validationResult
  
  const normalizedData = normalizeData(validationResult.data)
  return processData(normalizedData)
}
```

##### 5.4 実装ファイル
- 各route.tsにJSDoc追加
- `src/app/api/analysis/report/handlers/post.ts`
- `src/app/api/analysis/report/generators/base.ts`
- `src/app/api/analysis/report/generators/json-generator.ts`
- `src/app/api/analysis/report/generators/markdown-generator.ts`
- `src/app/api/analysis/report/generators/html-generator.ts`

#### 検証方法
```bash
pnpm eslint src/app/api/analysis --rule 'complexity: ["error", 10]'
pnpm eslint src/app/api/analysis --rule 'max-lines: ["error", { "max": 200 }]'
```

#### 目標スコア: 100点

---

### 6. セキュリティ (Security) - 現状: 20点

#### 現状の問題点
- ❌ 入力サニタイゼーションなし
- ❌ レート制限なし
- ❌ 認可チェックなし
- ❌ ログ出力時のフィルタリングなし

#### 改修内容

##### 6.1 入力サニタイゼーション
```typescript
// src/app/api/analysis/utils/sanitizer.ts
export const SENSITIVE_KEYS = ['password', 'apiKey', 'token', 'secret', 'credential']

export function sanitizeInput(input: string, maxLength: number = 10000): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')  // 制御文字除去
    .slice(0, maxLength)               // 長さ制限
    .trim()
}

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

export function maskSensitive(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length)
  }
  return value.slice(0, visibleChars) + '****' + value.slice(-visibleChars)
}
```

##### 6.2 レート制限
```typescript
// src/app/api/analysis/middleware/rate-limit.ts
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (request: NextRequest) => string
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000,  // 1分
  maxRequests: 100  // 100リクエスト/分
}

export function withRateLimit(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
  return function (
    handler: (request: NextRequest) => Promise<NextResponse>
  ): (request: NextRequest) => Promise<NextResponse>
}
```

##### 6.3 認可チェック
```typescript
// src/app/api/analysis/middleware/auth.ts
export interface AuthContext {
  userId: string
  companyId?: string
  role: 'ADMIN' | 'ACCOUNTANT' | 'VIEWER'
}

export async function withAuth(
  handler: (
    request: NextRequest,
    context: AuthContext
  ) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse>
```

##### 6.4 セキュリティヘッダー
```typescript
// src/app/api/analysis/middleware/security-headers.ts
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'"
} as const

export function addSecurityHeaders(response: NextResponse): NextResponse
```

##### 6.5 実装ファイル
- `src/app/api/analysis/utils/sanitizer.ts`
- `src/app/api/analysis/middleware/rate-limit.ts`
- `src/app/api/analysis/middleware/auth.ts`
- `src/app/api/analysis/middleware/security-headers.ts`

#### 検証方法
```bash
pnpm audit
pnpm eslint src/app/api/analysis --plugin security
```

#### 目標スコア: 100点

---

### 7. パフォーマンス (Performance) - 現状: 30点

#### 現状の問題点
- ❌ キャッシングなし
- ❌ 並列処理の最適化なし
- ❌ メモリ効率の考慮なし
- ❌ 大量データ処理の最適化なし

#### 改修内容

##### 7.1 キャッシングシステム
```typescript
// src/app/api/analysis/cache/analysis-cache.ts
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  hash: string
}

export class AnalysisCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  
  get<T>(key: string): T | undefined
  set<T>(key: string, data: T, ttl: number): void
  invalidate(pattern: RegExp): void
  clear(): void
  
  private generateHash(data: unknown): string
}

export const CACHE_CONFIG = {
  analysis: {
    ttl: 3600000,  // 1時間
    maxSize: 100
  },
  benchmark: {
    ttl: 86400000, // 24時間
    maxSize: 50
  }
} as const
```

##### 7.2 並列処理最適化
```typescript
// src/app/api/analysis/utils/parallel.ts
export async function processParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]>

export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]>
```

##### 7.3 メモリ効率化
```typescript
// src/app/api/analysis/utils/memory.ts
export function processLargeDataset<T, R>(
  data: T[],
  processor: (chunk: T[]) => R[],
  chunkSize: number = 100
): R[]

export class ObjectPool<T> {
  acquire(): T
  release(obj: T): void
}
```

##### 7.4 レスポンス最適化
```typescript
// src/app/api/analysis/utils/response.ts
export function createOptimizedResponse<T>(
  data: T,
  options?: {
    compress?: boolean
    cacheControl?: string
  }
): NextResponse

export async function streamResponse<T>(
  data: AsyncIterable<T>,
  transformer: (item: T) => string
): Promise<NextResponse>
```

##### 7.5 実装ファイル
- `src/app/api/analysis/cache/analysis-cache.ts`
- `src/app/api/analysis/utils/parallel.ts`
- `src/app/api/analysis/utils/memory.ts`
- `src/app/api/analysis/utils/response.ts`

#### 検証方法
```bash
pnpm jest tests/performance/api/analysis/ --detectOpenHandles
```

#### 目標スコア: 100点

---

### 8. 文法・構文エラー防止 (Syntax Error Prevention) - 現状: 80点

#### 現状の問題点
- ✅ TypeScript strict mode有効
- ✅ ESLint通過済み
- ⚠️ any型の使用（unknownとしている箇所あり）
- ⚠️ 戻り値型の明示が不十分

#### 改修内容

##### 8.1 any型排除
```typescript
// Before
function generateReport(input: GenerateReportOptions): {
  json: unknown
  markdown: string
  html: string
}

// After
interface ReportOutput {
  json: ReportJsonData
  markdown: string
  html: string
}

function generateReport(input: GenerateReportOptions): Result<ReportOutput, ReportError>
```

##### 8.2 型定義の完全性
```typescript
// src/app/api/analysis/types/output.ts
export interface FinancialAnalysisOutput {
  readonly overallScore: number
  readonly overallStatus: AnalysisStatus
  readonly executiveSummary: string
  readonly categoryAnalyses: readonly CategoryAnalysis[]
  readonly allAlerts: readonly AlertItem[]
  readonly topRecommendations: readonly RecommendationItem[]
  readonly keyMetrics: readonly KeyMetric[]
  readonly benchmark?: BenchmarkComparisonOutput
}

export interface RatioAnalysisOutput {
  readonly groups: readonly RatioGroup[]
  readonly allRatios: readonly CalculatedRatio[]
  readonly summary: RatioSummary
  readonly calculatedAt: string
}

export interface BenchmarkOutput {
  readonly industryComparisons: readonly BenchmarkComparison[]
  readonly sizeComparisons: readonly BenchmarkComparison[]
  readonly overallPercentile: number
  readonly strengths: readonly string[]
  readonly weaknesses: readonly string[]
}

export interface ReportOutput {
  readonly format: 'json' | 'markdown' | 'html'
  readonly content: string
  readonly reportType: ReportType
  readonly metadata: ReportMetadata
}
```

##### 8.3 戻り値型の明示
```typescript
// Before
export async function POST(request: NextRequest)

// After
export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalysisResponse<FinancialAnalysisOutput>>>
```

##### 8.4 実装ファイル
- `src/app/api/analysis/types/output.ts`
- 各route.tsの型定義強化

#### 検証方法
```bash
pnpm tsc --noEmit
pnpm eslint src/app/api/analysis --rule '@typescript-eslint/no-explicit-any: error'
```

#### 目標スコア: 100点

---

### 9. 関数・引数設計 (Function & Parameter Design) - 現状: 60点

#### 現状の問題点
- ⚠️ オブジェクト引数パターンが不十分
- ✅ Result型使用済み
- ⚠️ デフォルト値設定が不十分
- ⚠️ 副作用の分離が不完全

#### 改修内容

##### 9.1 オプションオブジェクトパターン
```typescript
// Before
export async function POST(request: NextRequest)

// After
export interface PostHandlerOptions {
  request: NextRequest
  timeout?: number
  enableCache?: boolean
  logger?: AnalysisLogger
}

export async function POST(options: PostHandlerOptions): Promise<NextResponse>
```

##### 9.2 デフォルト値の統一
```typescript
// src/app/api/analysis/config/defaults.ts
export const DEFAULT_ANALYSIS_OPTIONS = {
  depth: 'standard' as const,
  language: 'ja' as const,
  includeAlerts: true,
  includeRecommendations: true,
  includeBenchmark: false,
  category: 'comprehensive' as const
}

export const DEFAULT_BENCHMARK_OPTIONS = {
  sector: 'other' as const,
  companySize: 'medium' as const
}

export const DEFAULT_REPORT_OPTIONS = {
  format: 'json' as const,
  reportType: 'summary' as const,
  includeCharts: false
}
```

##### 9.3 副作用の分離
```typescript
// Before: 副作用と計算が混在
async function POST(request: NextRequest) {
  const body = await request.json()  // 副作用
  const result = analyze(body)        // 純粋関数
  return NextResponse.json(result)    // 副作用
}

// After: 明確な分離
// 純粋関数
function analyzeFinancialData(input: AnalysisInput): Result<AnalysisOutput, AnalysisError>

// 副作用関数
async function parseRequest(request: NextRequest): Promise<Result<AnalysisRequest, AppError>>
function createResponse<T>(data: T, metadata: ResponseMetadata): NextResponse

// ハンドラー（副作用の調整）
async function POST(request: NextRequest): Promise<NextResponse> {
  const parseResult = await parseRequest(request)
  if (!parseResult.success) {
    return createErrorResponse(parseResult.error)
  }
  
  const analysisResult = analyzeFinancialData(parseResult.data)
  if (!analysisResult.success) {
    return createErrorResponse(analysisResult.error)
  }
  
  return createResponse(analysisResult.data, { cached: false })
}
```

##### 9.4 ビルダーパターン
```typescript
// src/app/api/analysis/utils/request-builder.ts
export class AnalysisRequestBuilder {
  private balanceSheet?: BalanceSheet
  private profitLoss?: ProfitLoss
  private options: Partial<AnalysisOptions> = {}
  
  withBalanceSheet(bs: BalanceSheet): this
  withProfitLoss(pl: ProfitLoss): this
  withOptions(options: Partial<AnalysisOptions>): this
  build(): Result<AnalysisRequest, AppError>
}
```

##### 9.5 実装ファイル
- `src/app/api/analysis/config/defaults.ts`
- `src/app/api/analysis/utils/request-builder.ts`
- 各route.tsのリファクタリング

#### 検証方法
```bash
pnpm jest tests/unit/api/analysis/api-design/ --coverage
```

#### 目標スコア: 100点

---

### 10. 全体整合性 (Overall Consistency) - 現状: 60点

#### 現状の問題点
- ⚠️ ログフォーマットの統一性不足
- ⚠️ エラーフォーマットの統一性不足
- ⚠️ 命名規則の統一性確認不足
- ⚠️ テストパターンの統一性不足

#### 改修内容

##### 10.1 統一ログフォーマット
```typescript
// src/app/api/analysis/types/log.ts
export interface LogEntry {
  timestamp: string        // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: {
    requestId: string
    module: string
    version: string
    userId?: string
    companyId?: string
    [key: string]: unknown
  }
}

// 使用例
logger.info({
  message: 'Analysis completed',
  context: {
    requestId: 'req-123',
    module: 'financial-analyzer',
    version: '1.0.0',
    durationMs: 1500
  }
})
```

##### 10.2 統一エラーフォーマット
```typescript
// src/app/api/analysis/types/error.ts
export interface AppError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
  cause?: Error
  timestamp: string
  requestId?: string
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'MISSING_REQUIRED_FIELDS'
  | 'INVALID_DATA'
  | 'ANALYSIS_FAILED'
  | 'BENCHMARK_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'

export function createError(
  code: ErrorCode,
  message: string,
  options?: Partial<Omit<AppError, 'code' | 'message' | 'timestamp'>>
): AppError
```

##### 10.3 命名規則の統一
```typescript
// ディレクトリ・ファイル: kebab-case
// src/app/api/analysis/financial/route.ts
// src/app/api/analysis/ratio-calculator.ts

// クラス・インターフェース: PascalCase
// class FinancialAnalyzer
// interface AnalysisRequest

// 関数・変数: camelCase
// function analyzeFinancials()
// const processingTime

// 定数: SCREAMING_SNAKE_CASE
// const MAX_TIMEOUT = 30000
// const DEFAULT_CACHE_TTL = 3600000

// 型: PascalCase
// type AnalysisStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
```

##### 10.4 統一レスポンスフォーマット
```typescript
// src/app/api/analysis/types/response.ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: AppError
  metadata: ResponseMetadata
}

export interface ResponseMetadata {
  requestId: string
  processingTimeMs: number
  cached: boolean
  version: string
  timestamp: string
}

export function createSuccessResponse<T>(
  data: T,
  metadata: Partial<ResponseMetadata>
): ApiResponse<T>

export function createErrorResponse(
  error: AppError,
  metadata: Partial<ResponseMetadata>
): ApiResponse<never>
```

##### 10.5 統一テストパターン
```typescript
// tests/unit/api/analysis/financial.test.ts
describe('Financial Analysis API', () => {
  describe('POST /api/analysis/financial', () => {
    describe('成功ケース', () => {
      it('正常な入力で分析結果を返す', async () => {
        // Arrange
        const input = createValidInput()
        
        // Act
        const result = await POST(createMockRequest(input))
        
        // Assert
        expect(result.status).toBe(200)
        expect(result.data.success).toBe(true)
      })
    })
    
    describe('エラーケース', () => {
      it('必須フィールドが欠落している場合400エラー', async () => {
        // Arrange
        const input = createInvalidInput()
        
        // Act
        const result = await POST(createMockRequest(input))
        
        // Assert
        expect(result.status).toBe(400)
        expect(result.data.error.code).toBe('VALIDATION_ERROR')
      })
    })
    
    describe('境界値', () => {
      it('最大データサイズで正常処理', async () => {
        // ...
      })
    })
  })
})
```

##### 10.6 実装ファイル
- `src/app/api/analysis/types/log.ts`
- `src/app/api/analysis/types/error.ts`
- `src/app/api/analysis/types/response.ts`
- `tests/unit/api/analysis/financial.test.ts`
- `tests/unit/api/analysis/ratios.test.ts`
- `tests/unit/api/analysis/benchmark.test.ts`
- `tests/unit/api/analysis/report.test.ts`

#### 検証方法
```bash
pnpm eslint src/app/api/analysis --rule 'naming-convention'
grep -r "interface.*Response" src/app/api/analysis/ | wc -l
pnpm jest tests/unit/api/analysis/ --coverage
```

#### 目標スコア: 100点

---

## 実装スケジュール

### Phase 1: インフラ整備（1-2日）
1. **安定性** - タイムアウト、リトライ、Circuit Breaker
2. **堅牢性** - Zodスキーマ、バリデーション
3. **セキュリティ** - サニタイゼーション、レート制限

### Phase 2: 設計改善（2-3日）
4. **拡張性** - インターフェース分離、Strategy Pattern
5. **関数・引数設計** - オプションオブジェクトパターン、副作用分離
6. **全体整合性** - フォーマット統一

### Phase 3: 品質向上（1-2日）
7. **再現性** - 設定管理、ログ強化
8. **メンテナンス性** - JSDoc、関数分割
9. **パフォーマンス** - キャッシング、並列処理
10. **文法・構文** - any型排除、型完全性

### Phase 4: テストと検証（1日）
- ユニットテスト作成
- 統合テスト作成
- 品質ゲート通過確認

---

## 最終ファイル構成

```
src/app/api/analysis/
├── config/
│   ├── index.ts                    # 設定エクスポート
│   ├── constants.ts                # 定数定義
│   ├── defaults.ts                 # デフォルト値
│   └── features.ts                 # フィーチャーフラグ
├── types/
│   ├── index.ts                    # 型エクスポート
│   ├── input.ts                    # 入力型
│   ├── output.ts                   # 出力型
│   ├── error.ts                    # エラー型
│   ├── response.ts                 # レスポンス型
│   └── log.ts                      # ログ型
├── schemas/
│   ├── index.ts                    # スキーマエクスポート
│   ├── request-schemas.ts          # リクエストスキーマ
│   └── response-schemas.ts         # レスポンススキーマ
├── interfaces/
│   ├── analyzer.ts                 # 分析エンジンインターフェース
│   ├── calculator.ts               # 計算インターフェース
│   └── provider.ts                 # プロバイダーインターフェース
├── registry/
│   ├── analyzer-registry.ts        # 分析エンジンレジストリ
│   └── report-registry.ts          # レポートジェネレーターレジストリ
├── strategies/
│   └── report-strategy.ts          # レポート戦略パターン
├── utils/
│   ├── validation.ts               # バリデーション
│   ├── boundary-check.ts           # 境界値チェック
│   ├── sanitizer.ts                # サニタイゼーション
│   ├── retry.ts                    # リトライロジック
│   ├── circuit-breaker.ts          # サーキットブレーカー
│   ├── time-provider.ts            # 時間プロバイダー
│   ├── logger.ts                   # ロガー
│   ├── request-id.ts               # リクエストID生成
│   ├── parallel.ts                 # 並列処理
│   ├── memory.ts                   # メモリ管理
│   ├── response.ts                 # レスポンス生成
│   └── request-builder.ts          # リクエストビルダー
├── cache/
│   └── analysis-cache.ts           # キャッシング
├── middleware/
│   ├── timeout.ts                  # タイムアウト
│   ├── rate-limit.ts               # レート制限
│   ├── auth.ts                     # 認可
│   └── security-headers.ts         # セキュリティヘッダー
├── financial/
│   ├── route.ts                    # エントリーポイント
│   └── handlers/
│       └── post.ts                 # POSTハンドラー
├── ratios/
│   ├── route.ts                    # エントリーポイント
│   └── handlers/
│       └── post.ts                 # POSTハンドラー
├── benchmark/
│   ├── route.ts                    # エントリーポイント
│   └── handlers/
│       ├── post.ts                 # POSTハンドラー
│       └── get.ts                  # GETハンドラー
├── report/
│   ├── route.ts                    # エントリーポイント
│   ├── handlers/
│   │   └── post.ts                 # POSTハンドラー
│   └── generators/
│       ├── base.ts                 # ベースジェネレーター
│       ├── json-generator.ts       # JSON生成
│       ├── markdown-generator.ts   # Markdown生成
│       └── html-generator.ts       # HTML生成
└── tests/
    ├── unit/
    │   ├── stability/
    │   ├── robustness/
    │   ├── extensibility/
    │   ├── api-design/
    │   └── logging/
    └── integration/
        ├── financial.test.ts
        ├── ratios.test.ts
        ├── benchmark.test.ts
        └── report.test.ts
```

---

## 品質ゲート通過基準

### 自動ゲート
| ゲート | 基準 | コマンド |
|--------|------|---------|
| TypeScript | エラー0件 | `pnpm tsc --noEmit` |
| ESLint | エラー0件、警告0件 | `pnpm eslint src/ --max-warnings=0` |
| ユニットテスト | 全テストPASS | `pnpm jest --passWithNoTests` |
| カバレッジ | 90%以上 | `pnpm jest --coverage` |
| 脆弱性 | 高リスク0件 | `pnpm audit` |
| ビルド | 成功 | `pnpm build` |

### 手動ゲート
- [ ] 全JSDocコメント記載完了
- [ ] 全品質基準チェックリスト確認完了
- [ ] コードレビュー承認済み
- [ ] ドキュメント更新完了

---

## 参照

- [品質基準チェックリスト](./QUALITY_STANDARDS.md)
- [制約定義](./CONSTRAINTS.md)
- [タスク分割](./TASKS.md)

# AI実装品質基準チェックリスト

このドキュメントは、**全ての実装**における必須品質基準を定義します。
AI機能に限らず、プロジェクト全体で適用される汎用的な基準です。

---

## 品質基準一覧

| # | 基準 | 目的 | 主なチェック項目 |
|---|------|------|-----------------|
| 1 | 安定性 | システム継続性 | タイムアウト、リトライ、Circuit Breaker |
| 2 | 堅牢性 | 障害耐性 | 入力検証、例外処理、境界値対応 |
| 3 | 再現性 | トレーサビリティ | 設定管理、ログ、決定論的処理 |
| 4 | 拡張性 | 将来対応 | インターフェース、プラグイン、設定化 |
| 5 | メンテナンス性 | 保守効率 | 単一責任、命名、ドキュメント |
| 6 | セキュリティ | 脅威対策 | サニタイゼーション、認可、秘匿化 |
| 7 | パフォーマンス | 効率性 | キャッシュ、並列化、リーク防止 |
| 8 | 文法・構文エラー防止 | 品質担保 | 型安全性、Lint、コンパイル |
| 9 | 関数・引数設計 | API品質 | オブジェクト引数、Result型、純粋関数 |
| 10 | 全体整合性 | 一貫性 | 命名統一、パターン統一、型統一 |

---

## 1. 安定性 (Stability)

**目的:** 外部要因（API障害、ネットワークエラー等）によるシステム停止を防ぐ。

### チェックリスト
- [ ] 全ての外部API呼び出しにタイムアウト設定（デフォルト30秒、設定可能）
- [ ] リトライロジック実装（最大3回、指数バックオフ）
- [ ] エラー時のgraceful degradation（機能低下でも継続）
- [ ] 部分的な失敗でも処理継続可能な設計
- [ ] プロセス異常時のリソースクリーンアップ
- [ ] Circuit Breakerパターンの採用（連続失敗時の一時停止）

### 実装パターン

```typescript
interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined
  let delay = config.initialDelayMs
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < config.maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs)
      }
    }
  }
  
  throw lastError
}
```

### 検証方法
```bash
# ユニットテストでタイムアウト・リトライをテスト
pnpm jest tests/unit/stability/ --coverage
```

---

## 2. 堅牢性 (Robustness)

**目的:** 不正入力・異常値に対してクラッシュせず、適切にエラーを返す。

### チェックリスト
- [ ] 全ての公開関数の入力バリデーション
- [ ] null/undefined/空文字の適切な処理
- [ ] 境界値テストケースの網羅（0、MAX、負値等）
- [ ] 例外のキャッチとログ出力
- [ ] 型ガードの使用（TypeScript）
- [ ] 不正なJSON入力のハンドリング

### 実装パターン

```typescript
// Result型によるエラーハンドリング
type Result<T, E = AppError> = 
  | { success: true; data: T }
  | { success: false; error: E }

interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// 入力バリデーション関数
function validateInput<T>(
  input: unknown,
  schema: z.ZodSchema<T>
): Result<T, AppError> {
  const result = schema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: { errors: result.error.errors }
      }
    }
  }
  return { success: true, data: result.data }
}

// 使用例
function processData(input: unknown): Result<Output, AppError> {
  const validationResult = validateInput(input, InputSchema)
  if (!validationResult.success) {
    return validationResult
  }
  // 処理続行
}
```

### 検証方法
```bash
# 境界値テストを含むユニットテスト
pnpm jest tests/unit/robustness/ --coverage
```

---

## 3. 再現性 (Reproducibility)

**目的:** 同じ入力に対して同じ結果が得られ、デバッグ・テストを容易にする。

### チェックリスト
- [ ] 設定値はコード内でバージョン管理（環境変数は上書きのみ）
- [ ] 非決定的な要素（ランダム、現在時刻）の分離・注入可能化
- [ ] ログに十分なコンテキスト情報を含める（requestId、userId等）
- [ ] テストの決定論的実行が可能（モック使用時）
- [ ] LLM呼び出しのtemperature設定を固定（分析タスクは0.1-0.3）
- [ ] 出力にメタデータ（バージョン、タイムスタンプ）を含める

### 実装パターン

```typescript
// 設定のバージョン管理
export const CONFIG_VERSION = '1.0.0'

export const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  timeout: 30000,
  retries: 3,
  temperature: 0.1
} as const

// 非決定的要素の注入
interface TimeProvider {
  now(): Date
}

class SystemTimeProvider implements TimeProvider {
  now(): Date { return new Date() }
}

class MockTimeProvider implements TimeProvider {
  constructor(private fixedTime: Date) {}
  now(): Date { return this.fixedTime }
}

// ログコンテキスト
interface LogContext {
  requestId: string
  userId?: string
  companyId?: string
  module: string
  version: string
}
```

### 検証方法
```bash
# 設定バージョンの確認
grep -r "CONFIG_VERSION" src/

# ログフォーマットの確認
pnpm jest tests/unit/logging/ --coverage
```

---

## 4. 拡張性 (Extensibility)

**目的:** 将来の機能追加・変更に対して最小限のコード変更で対応可能にする。

### チェックリスト
- [ ] 新機能追加のための拡張ポイント設計
- [ ] 設定による動作変更が可能（ハードコード回避）
- [ ] プラグイン/ミドルウェアパターンの採用
- [ ] インターフェースベースの設計（具象クラスへの直接依存回避）
- [ ] Strategy Patternによるアルゴリズム切り替え可能
- [ ] 新規プロバイダー/モデルの追加が容易

### 実装パターン

```typescript
// インターフェースベース設計
interface Analyzer {
  readonly name: string
  analyze(input: AnalysisInput): Promise<AnalysisOutput>
}

// レジストリパターン
class AnalyzerRegistry {
  private analyzers: Map<string, Analyzer> = new Map()
  
  register(analyzer: Analyzer): void {
    this.analyzers.set(analyzer.name, analyzer)
  }
  
  get(name: string): Analyzer | undefined {
    return this.analyzers.get(name)
  }
  
  list(): string[] {
    return Array.from(this.analyzers.keys())
  }
}

// Strategy Pattern
interface CalculationStrategy {
  calculate(data: FinancialData): number
}

class StandardCalculation implements CalculationStrategy {
  calculate(data: FinancialData): number {
    // 標準計算ロジック
  }
}

class AlternativeCalculation implements CalculationStrategy {
  calculate(data: FinancialData): number {
    // 代替計算ロジック
  }
}
```

### 検証方法
```bash
# 新規追加時の変更箇所確認
# インターフェース実装のテスト
pnpm jest tests/unit/extensibility/ --coverage
```

---

## 5. メンテナンス性 (Maintainability)

**目的:** コードの理解・修正・拡張を容易にする。

### チェックリスト
- [ ] 関数は単一責任（50行以内推奨、最大100行）
- [ ] JSDocコメントの記載（公開APIは必須）
- [ ] 複雑なロジックにインラインコメント（「なぜ」を説明）
- [ ] 命名規則の統一（既存コードに準拠）
- [ ] ファイルサイズの適正化（500行以内推奨）
- [ ] 循環的複雑度の低減（分岐はネストしない）

### 命名規則

| 種別 | 規則 | 例 |
|------|------|-----|
| 関数 | camelCase + 動詞 | `analyzeFinancial`, `calculateRatio` |
| クラス | PascalCase | `FinancialAnalyzer`, `TaxCalculator` |
| 型/インターフェース | PascalCase | `AnalysisResult`, `Config` |
| 定数 | SCREAMING_SNAKE_CASE | `MAX_TOKENS`, `DEFAULT_TIMEOUT` |
| ファイル | kebab-case | `financial-analyzer.ts` |
| ディレクトリ | kebab-case | `financial-analysis/` |

### JSDoc例

```typescript
/**
 * 財務データを分析し、結果を返す
 * 
 * @param options - 分析オプション
 * @param options.data - 分析対象の財務データ
 * @param options.period - 分析期間
 * @param options.config - 分析設定（オプション）
 * @returns 分析結果またはエラー
 * 
 * @example
 * ```typescript
 * const result = await analyzeFinancial({
 *   data: financialData,
 *   period: { start: '2024-01', end: '2024-12' }
 * })
 * if (result.success) {
 *   console.log(result.data.summary)
 * }
 * ```
 */
async function analyzeFinancial(
  options: AnalyzeOptions
): Promise<Result<AnalysisOutput, AnalysisError>> {
  // 実装
}
```

### 検証方法
```bash
# 複雑度チェック
pnpm eslint src/ --rule 'complexity: ["error", 10]'

# 行数チェック
pnpm eslint src/ --rule 'max-lines: ["error", { "max": 500 }]'
```

---

## 6. セキュリティ (Security)

**目的:** 機密情報の保護と、攻撃への対策を実装する。

### チェックリスト
- [ ] ユーザー入力のサニタイゼーション（制御文字除去等）
- [ ] 機密情報のログ出力禁止（APIキー、個人情報等）
- [ ] SQL/コマンドインジェクション対策（パラメータ化クエリ使用）
- [ ] 認可チェックの実装（リソースアクセス時）
- [ ] 依存パッケージの脆弱性チェック（npm audit等）
- [ ] LLMプロンプトへのユーザー入力直接埋め込み回避
- [ ] レート制限の実装

### センシティブデータの扱い

```typescript
// 機密情報のマスキング
function maskSensitive(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length)
  }
  return value.slice(0, visibleChars) + '****' + value.slice(-visibleChars)
}

// ログ出力時のフィルタリング
const SENSITIVE_KEYS = ['password', 'apiKey', 'token', 'secret', 'credential']

function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
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

// 入力サニタイゼーション
function sanitizeInput(input: string, maxLength: number = 10000): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')  // 制御文字除去
    .slice(0, maxLength)               // 長さ制限
    .trim()
}
```

### 検証方法
```bash
# 依存パッケージの脆弱性チェック
pnpm audit

# セキュリティLint
pnpm eslint src/ --plugin security
```

---

## 7. パフォーマンス (Performance)

**目的:** リソース効率的な実装と、応答時間の最適化。

### チェックリスト
- [ ] N+1クエリの回避（一括取得またはキャッシュ）
- [ ] 適切なキャッシング戦略（TTL設定、無効化ロジック）
- [ ] メモリリークの防止（イベントリスナーの削除等）
- [ ] 非同期処理の最適化（並列化可能な処理はPromise.all）
- [ ] バンドルサイズへの配慮（フロントエンド：動的インポート）
- [ ] 大量データのストリーミング処理

### パフォーマンス基準

| 操作 | 目標時間 | 許容時間 |
|------|---------|---------|
| モデル選択 | < 100ms | < 200ms |
| プロンプトコンパイル | < 50ms | < 100ms |
| キャッシュヒット時の応答 | < 10ms | < 50ms |
| 単純な計算処理 | < 100ms | < 500ms |
| DB単一クエリ | < 50ms | < 200ms |

### 実装パターン

```typescript
// キャッシング
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return undefined
    }
    return entry.data
  }
  
  set(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }
  
  invalidate(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }
}

// 並列処理
async function processParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }
  return results
}
```

### 検証方法
```bash
# パフォーマンステスト
pnpm jest tests/performance/ --detectOpenHandles

# バンドルサイズ確認
pnpm build && ls -la .next/static/chunks/
```

---

## 8. 文法・構文エラー防止 (Syntax Error Prevention)

**目的:** TypeScriptの型システムを活用し、コンパイル時エラーを解消する。

### チェックリスト
- [ ] TypeScript strict mode有効（tsconfig.json）
- [ ] ESLintエラー0件
- [ ] 未使用変数/インポートの削除
- [ ] 型定義の完全性（any型の回避）
- [ ] 戻り値型の明示（公開関数）
- [ ] null/undefinedの明示的処理

### tsconfig.json 設定

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

### 型定義パターン

```typescript
// any型を避ける
// ❌ 悪い例
function process(data: any): any { ... }

// ✅ 良い例
function process<T extends Record<string, unknown>>(
  data: T
): Result<ProcessedData<T>, ProcessingError> { ... }

// null安全性
// ❌ 悪い例
function getItem(key: string): string { ... }

// ✅ 良い例
function getItem(key: string): string | undefined { ... }
// または
function getItem(key: string): Result<string, 'not_found'> { ... }
```

### 検証方法
```bash
# 型チェック
pnpm tsc --noEmit

# ESLint
pnpm eslint src/ --max-warnings=0
```

---

## 9. 関数・引数設計 (Function & Parameter Design)

**目的:** APIの使いやすさと保守性を両立する設計。

### チェックリスト
- [ ] 引数はオブジェクト形式で渡す（3個以上の場合）
- [ ] デフォルト値の適切な設定
- [ ] 戻り値はResult型/Either型パターン推奨
- [ ] 副作用の分離（純粋関数の活用）
- [ ] 非同期関数はPromiseを返す（コールバック回避）
- [ ] エラーはthrowせずResult型で返す（予測可能なエラー）

### 設計パターン

```typescript
// ❌ 悪い例：複数引数、例外投げ、コールバック
function analyze(
  data: string,
  model: string,
  temp: number,
  callback: (result: AnalysisResult) => void
): void {
  if (!data) throw new Error('data required')
  // ...
}

// ✅ 良い例：オブジェクト引数、Result型、Promise
interface AnalyzeOptions {
  data: string
  model?: string
  temperature?: number
}

const DEFAULT_ANALYZE_OPTIONS = {
  model: 'gpt-4.1-mini',
  temperature: 0.1
} as const

async function analyze(
  options: AnalyzeOptions
): Promise<Result<AnalysisResult, AnalysisError>> {
  const { data, model, temperature } = { ...DEFAULT_ANALYZE_OPTIONS, ...options }
  
  if (!data) {
    return {
      success: false,
      error: { code: 'REQUIRED', message: 'data is required' }
    }
  }
  
  try {
    const result = await performAnalysis(data, model, temperature)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: String(error) }
    }
  }
}

// 使用例
const result = await analyze({ data: inputData })
if (result.success) {
  console.log(result.data)
} else {
  console.error(result.error)
}
```

### 検証方法
```bash
# API設計のテスト
pnpm jest tests/unit/api-design/ --coverage
```

---

## 10. 全体整合性 (Overall Consistency)

**目的:** プロジェクト全体での一貫性を保つ。

### チェックリスト
- [ ] 既存コードとの整合性（命名、構造、パターン）
- [ ] 型定義の統一（同じ概念は同じ型を使用）
- [ ] エラーハンドリングパターンの統一
- [ ] ログフォーマットの統一
- [ ] 設定ファイル形式の統一
- [ ] テストパターンの統一

### 統一フォーマット

#### ログフォーマット
```typescript
interface LogEntry {
  timestamp: string        // ISO 8601: "2024-03-08T10:00:00.000Z"
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: {
    requestId?: string
    userId?: string
    companyId?: string
    module: string
    [key: string]: unknown
  }
}

// 使用例
logger.info({
  message: 'Analysis completed',
  context: {
    requestId: 'req-123',
    module: 'financial-analyzer',
    durationMs: 1500
  }
})
```

#### エラーフォーマット
```typescript
interface AppError {
  code: string              // 'VALIDATION_ERROR', 'NOT_FOUND', etc.
  message: string           // ユーザー向けメッセージ
  details?: unknown         // 追加情報（開発者向け）
  cause?: Error             // 元のエラー
  timestamp: string         // ISO 8601
  requestId?: string        // トレーサビリティ用
}
```

#### 設定ファイル形式
```typescript
interface Config {
  version: string           // 設定バージョン
  env: 'development' | 'staging' | 'production'
  features: Record<string, boolean>
  limits: {
    timeout: number
    maxRetries: number
    maxTokens: number
  }
}
```

### 検証方法
```bash
# 命名規則の確認
pnpm eslint src/ --rule 'naming-convention'

# 型の重複確認
grep -r "interface.*Result" src/ | wc -l
```

---

## 品質ゲート

各タスクは以下のゲートを通過しなければならない：

### 自動ゲート

| ゲート | 基準 | コマンド |
|--------|------|---------|
| TypeScript | エラー0件 | `pnpm tsc --noEmit` |
| ESLint | エラー0件、警告0件 | `pnpm eslint src/ --max-warnings=0` |
| ユニットテスト | 全テストPASS | `pnpm jest --passWithNoTests` |
| カバレッジ | 80%以上（重要ロジック90%以上） | `pnpm jest --coverage` |
| 脆弱性 | 高リスク0件 | `pnpm audit` |
| ビルド | 成功 | `pnpm build` |

### 手動ゲート

| ゲート | 基準 | 確認者 |
|--------|------|--------|
| コードレビュー | 承認済み | チームメンバー |
| ドキュメント | 更新済み | 実装者 |
| 品質チェックリスト | 全項目確認済み | 実装者 |

---

## 品質チェックリスト使用フロー

```
実装開始
    │
    ▼
┌─────────────────────────────────┐
│ 設計フェーズ                      │
│ ・README.md でアーキテクチャ確認    │
│ ・本チェックリストで要件確認        │
│ ・CONSTRAINTS.md で制約確認        │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ 実装フェーズ                      │
│ ・各基準の実装パターンを適用        │
│ ・チェックリスト項目を実装          │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ 検証フェーズ                      │
│ ・検証コマンド実行                 │
│ ・品質ゲート通過確認               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ レビューフェーズ                   │
│ ・チェックリストの自己確認          │
│ ・コードレビュー依頼               │
└─────────────────────────────────┘
    │
    ▼
完了
```

---

## 参照

- [制約定義](./CONSTRAINTS.md) - LLM制約・入力バリデーション・出力フォーマット
- [タスク分割](./TASKS.md) - 実装タスクの詳細
- [AI機能概要](./README.md) - アーキテクチャ・コンポーネント
- [セキュリティガイドライン](../SECURITY.md) - 詳細なセキュリティ要件

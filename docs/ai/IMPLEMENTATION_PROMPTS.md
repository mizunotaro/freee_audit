# 実装プロンプト集

このドキュメントは、品質評価に基づく改修タスクとIRモジュール新規開発のための詳細なプロンプト集です。

---

## 実装順序・依存関係

```
┌─────────────────────────────────────────────────────────────────┐
│ Group A: 共通モジュール作成（並列実行可能）                        │
│ ├── A1: src/types/result.ts                                     │
│ ├── A2: src/lib/utils/html-sanitize.ts                          │
│ ├── A3: src/lib/utils/safe-formula-evaluator.ts                 │
│ ├── A4: src/lib/api/auth-helpers.ts                             │
│ └── A5: src/lib/api/fetch-with-timeout.ts                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Group B: P0 Critical修正（Group A完了後、並列実行可能）           │
│ ├── B1: XSS脆弱性修正（A2依存）                                  │
│ ├── B2: コードインジェクション修正（A3依存）                      │
│ └── B3: DBタイムアウト追加                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Group C: P1 High修正（Group A完了後、並列実行可能）               │
│ ├── C1: 認証ヘルパー共通化（A4依存）                             │
│ ├── C2: fetchタイムアウト追加（A5依存）                          │
│ ├── C3: Result型パターン実装（A1依存）                           │
│ ├── C4: AI設定統一                                              │
│ └── C5: N+1問題解消                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Group D: P2/P3 Medium-Low修正                                   │
│ ├── D1: モックレスポンス削除                                     │
│ ├── D2: 長大ファイル分割                                        │
│ └── D3: 型定義集約                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Group E: IRモジュール新規開発                                    │
│ ├── E1: DB Schema & Types                                       │
│ ├── E2: Service Layer                                           │
│ ├── E3: API Routes                                              │
│ ├── E4: AI Prompts                                              │
│ ├── E5: UI Pages                                                │
│ ├── E6: Components                                              │
│ ├── E7: Export (PDF/PPTX)                                       │
│ └── E8: Tests                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 実行コマンド例

各タスク完了後に以下を実行して品質ゲートを確認:

```bash
# 型チェック
pnpm tsc --noEmit

# リント
pnpm eslint src/ --max-warnings=0

# テスト
pnpm jest --passWithNoTests

# ビルド
pnpm build
```

---

## Group A: 共通モジュール作成

### A1: Result型定義

**ファイル:** `src/types/result.ts`

**プロンプト:**
```
AGENTS.mdとdocs/ai/CONSTRAINTS.mdを参照し、Result型パターンを実装してください。

以下の内容を含む src/types/result.ts を作成してください:

1. Result<T, E> 型定義
   - success: true の場合 data: T を含む
   - success: false の場合 error: E を含む
   - E のデフォルトは AppError

2. AppError インターフェース
   - code: string (エラーコード)
   - message: string (ユーザー向けメッセージ)
   - details?: Record<string, unknown> (追加情報)
   - cause?: Error (元のエラー)
   - timestamp: Date

3. エラーコード定数
   - VALIDATION_ERROR
   - NOT_FOUND
   - UNAUTHORIZED
   - TIMEOUT
   - DATABASE_ERROR
   - EXTERNAL_SERVICE_ERROR
   - BUSINESS_LOGIC_ERROR

4. ヘルパー関数
   - success<T>(data: T): Result<T>
   - failure<E>(error: E): Result<never, E>
   - isSuccess<T, E>(result: Result<T, E>): result is SuccessResult<T>
   - isFailure<T, E>(result: Result<T, E>): result is FailureResult<E>

5. tryCatch ヘルパー
   - async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T>>

品質基準:
- strict mode有効
- JSDocコメント追加
- ユニットテスト作成: tests/unit/types/result.test.ts
```

---

### A2: HTMLサニタイザー

**ファイル:** `src/lib/utils/html-sanitize.ts`

**プロンプト:**
```
XSS脆弱性対策としてHTMLサニタイズユーティリティを作成してください。

以下の内容を含む src/lib/utils/html-sanitize.ts を作成してください:

1. 依存関係の確認・インストール
   - dompurify または isomorphic-dompurify
   - pnpm add dompurify @types/dompurify
   - または pnpm add isomorphic-dompurify

2. sanitizeHtml(html: string, options?: SanitizeOptions): string
   - デフォルトでALLOWED_TAGSを制限
   - script, iframe, object, embed等を除去
   - onclick, onerror等のイベントハンドラを除去

3. sanitizePlainText(text: string): string
   - HTML特殊文字をエスケープ (<, >, &, ", ')
   - 制御文字を除去

4. stripHtml(html: string): string
   - 全HTMLタグを除去しテキストのみ抽出

5. 型定義
   interface SanitizeOptions {
     allowedTags?: string[]
     allowedAttributes?: Record<string, string[]>
     allowDataAttributes?: boolean
   }

6. エクスポート
   - デフォルトのALLOWED_TAGS定数
   - ALLOWED_ATTRIBUTES定数

品質基準:
- セキュリティテストを含める
- JSDocで使用例を記載
- tests/unit/lib/utils/html-sanitize.test.ts を作成
```

---

### A3: 安全な数式評価器

**ファイル:** `src/lib/utils/safe-formula-evaluator.ts`

**プロンプト:**
```
new Function()のコードインジェクション脆弱性を解決するため、
安全な数式評価器を作成してください。

以下の内容を含む src/lib/utils/safe-formula-evaluator.ts を作成してください:

1. 依存関係の確認・インストール
   - mathjs または mexpr を使用
   - pnpm add mathjs

2. SafeFormulaEvaluator クラス
   - constructor(variables: string[]) - 使用可能な変数名を定義
   - evaluate(formula: string, context: Record<string, number>): number
   - validate(formula: string): ValidationResult

3. セキュリティ機能
   - 許可された変数名のみ使用可能
   - 許可された関数のみ使用可能（sum, avg, max, min, abs, round等）
   - 危険なパターンの検出（eval, Function, require, import等）
   - 式の複雑さ制限（最大演算子数、最大ネスト深度）

4. 型定義
   interface ValidationResult {
     isValid: boolean
     errors: string[]
     usedVariables: string[]
     usedFunctions: string[]
   }

5. エラー処理
   - ゼロ除算: Infinity または null を返す（設定可能）
   - 未定義変数: エラーをスロー
   - 構文エラー: エラーをスロー

6. ビルトイン関数
   - 数学: abs, ceil, floor, round, sqrt, pow, log, exp
   - 統計: sum, avg, min, max, count
   - 条件: if(条件, 真値, 偽値)

品質基準:
- セキュリティテストでインジェクション攻撃を検証
- tests/unit/lib/utils/safe-formula-evaluator.test.ts を作成
- パフォーマンステスト（1000回評価）
```

---

### A4: 認証ヘルパー

**ファイル:** `src/lib/api/auth-helpers.ts`

**プロンプト:**
```
複数のAPIルートで重複しているgetAuthUserを共通化してください。

以下の内容を含む src/lib/api/auth-helpers.ts を作成してください:

1. 既存コードの確認
   - src/app/api/reports/business/generate/route.ts の getAuthUser を参照
   - src/app/api/reports/periodic/route.ts の withRateLimit パターンを参照

2. getAuthUser(request: NextRequest): Promise<AuthUser | null>
   - セッショントークンをCookieから取得
   - validateSession()で検証
   - ユーザー情報を返却

3. requireAuth(request: NextRequest): Promise<AuthUser>
   - getAuthUserを呼び出し
   - 認証失敗時にNextResponse.json({ error: 'Unauthorized' }, { status: 401 })を返す
   - 認証成功時はユーザー情報を返却

4. getCompanyId(user: AuthUser): string | null
   - ユーザーからcompanyIdを取得
   - ない場合はnullを返す

5. requireCompanyId(user: AuthUser): Result<string>
   - getCompanyIdを呼び出し
   - ない場合はエラーResultを返す

6. 型定義
   interface AuthUser {
     id: string
     email: string
     name: string
     role: string
     companyId?: string
   }

7. withAuth ハンドラーラッパー
   - (handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>) => Handler
   - 認証チェックを自動適用

品質基準:
- 既存のgetAuthUser実装との互換性を維持
- JSDocで使用例を記載
- tests/unit/lib/api/auth-helpers.test.ts を作成
```

---

### A5: タイムアウト付きfetch

**ファイル:** `src/lib/api/fetch-with-timeout.ts`

**プロンプト:**
```
クライアントサイドのfetchにタイムアウト機能を追加するユーティリティを作成してください。

以下の内容を含む src/lib/api/fetch-with-timeout.ts を作成してください:

1. fetchWithTimeout(url: string, options: FetchWithTimeoutOptions): Promise<Response>
   - AbortControllerを使用
   - デフォルトタイムアウト: 30000ms
   - タイムアウト時にFetchTimeoutErrorをスロー

2. 型定義
   interface FetchWithTimeoutOptions extends RequestInit {
     timeout?: number
     onTimeout?: () => void
   }

3. FetchTimeoutError クラス
   - Errorを継承
   - url, timeout プロパティを持つ

4. fetchWithRetry(url: string, options: FetchWithRetryOptions): Promise<Response>
   - リトライ機能付きfetch
   - 指数バックオフ
   - リトライ条件をカスタマイズ可能

5. 型定義
   interface FetchWithRetryOptions extends FetchWithTimeoutOptions {
     retries?: number
     retryDelay?: number
     retryOn?: (response: Response) => boolean
   }

6. ユーティリティ
   - createCancellableFetch(): { fetch, abort }
   - 複数リクエストを一括キャンセル可能

品質基準:
- タイムアウト処理のテスト
- リトライ処理のテスト
- tests/unit/lib/api/fetch-with-timeout.test.ts を作成
```

---

## Group B: P0 Critical修正

### B1: XSS脆弱性修正

**対象ファイル:**
- `src/app/api/reports/business/generate/route.ts`
- `src/app/api/reports/business/export/route.ts`

**前提:** A2完了

**プロンプト:**
```
XSS脆弱性を修正してください。

docs/ai/QUALITY_STANDARDS.mdの品質基準6（セキュリティ）に従い、
以下のファイルを修正してください:

1. src/app/api/reports/business/generate/route.ts
   - src/lib/utils/html-sanitize.ts の sanitizePlainText をインポート
   - テンプレート生成時に companyName, fiscalYear をサニタイズ
   - ユーザー入力がテンプレートに埋め込まれる箇所全てを確認

2. src/app/api/reports/business/export/route.ts
   - src/lib/utils/html-sanitize.ts の sanitizeHtml をインポート
   - HTML生成時に reportData の各フィールドをサニタイズ
   - L113-143のHTMLテンプレートでユーザー入力をエスケープ

修正手順:
1. 各ファイルの先頭にインポート追加
2. テンプレート生成関数内でサニタイズ適用
3. 既存テストが通ることを確認
4. XSSテストケースを追加

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/app/api/reports/business/ --max-warnings=0
pnpm jest tests/api/reports/business/
```

---

### B2: コードインジェクション修正

**対象ファイル:** `src/services/kpi/custom-kpi-service.ts`

**前提:** A3完了

**プロンプト:**
```
new Function()のコードインジェクション脆弱性を修正してください。

src/services/kpi/custom-kpi-service.ts の以下の箇所を修正:

1. L542-549: evaluateCustomFormula関数
   - new Function()を削除
   - src/lib/utils/safe-formula-evaluator.ts の SafeFormulaEvaluator を使用

2. 修正内容:
   - クラスレベルで evaluator インスタンスを作成
   - evaluateCustomFormula内で evaluator.evaluate() を使用
   - 使用可能な変数名をコンテキストから取得

3. L558-623: validateFormula関数
   - SafeFormulaEvaluator.validate() を使用
   - 危険パターン検出を SafeFormulaEvaluator に委譲

4. エラーハンドリング
   - 数式エラーを Result 型で返却
   - ユーザーに分かりやすいエラーメッセージ

修正前:
const fn = new Function('context', \`return ${formula}\`)
return fn(context)

修正後:
const evaluator = new SafeFormulaEvaluator(Object.keys(context))
return evaluator.evaluate(formula, context)

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/services/kpi/ --max-warnings=0
pnpm jest tests/unit/services/kpi/custom-kpi-service.test.ts
```

---

### B3: DBタイムアウト追加

**対象ファイル:**
- `src/services/report/periodic-report.ts`
- `src/services/report/monthly-report.ts`
- `src/services/reports/board-report-service.ts`

**プロンプト:**
```
データベースクエリにタイムアウトを追加してください。

以下のファイルのDBクエリにタイムアウト設定を追加:

1. src/services/report/periodic-report.ts
   - Prismaクエリにタイムアウト設定を追加
   - $queryRawを使用している場合はタイムアウト設定
   - デフォルトタイムアウト: 30秒

2. src/services/report/monthly-report.ts
   - L76-82, L96-102等のDBクエリにタイムアウト追加
   - 一括取得可能なクエリをPromise.allで並列化

3. src/services/reports/board-report-service.ts
   - L137-145, L170-177等のDBクエリにタイムアウト追加

実装パターン:
// Prismaの場合
const result = await prisma.$queryRaw\`
  SELECT * FROM table
\`.catch(err => {
  if (err.code === 'P2024') throw new TimeoutError('Query timeout')
  throw err
})

// または transaction でタイムアウト設定
await prisma.$transaction(async (tx) => {
  // クエリ
}, { maxWait: 5000, timeout: 30000 })

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/services/report/ src/services/reports/ --max-warnings=0
```

---

## Group C: P1 High修正

### C1: 認証ヘルパー共通化

**対象ファイル:** 全APIルート（reports, analysis）

**前提:** A4完了

**プロンプト:**
```
全APIルートの認証処理を共通ヘルパーに置き換えてください。

src/lib/api/auth-helpers.ts を使用し、以下のファイルを修正:

対象ファイル:
- src/app/api/reports/kpi/route.ts
- src/app/api/reports/monthly/route.ts
- src/app/api/reports/cashflow/route.ts
- src/app/api/reports/business/generate/route.ts
- src/app/api/reports/business/export/route.ts
- src/app/api/reports/budget/route.ts
- src/app/api/reports/periodic/route.ts
- src/app/api/analysis/route.ts
- src/app/api/analysis/financial/route.ts

修正内容:
1. 各ファイルの getAuthUser 関数を削除
2. src/lib/api/auth-helpers から getAuthUser または requireAuth をインポート
3. エラーレスポンスの形式を統一

修正前:
async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

修正後:
import { getAuthUser } from '@/lib/api/auth-helpers'

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/app/api/reports/ src/app/api/analysis/ --max-warnings=0
pnpm jest tests/api/
```

---

### C2: fetchタイムアウト追加

**対象ファイル:** 全ページコンポーネント

**前提:** A5完了

**プロンプト:**
```
全ページコンポーネントのfetchにタイムアウトを追加してください。

src/lib/api/fetch-with-timeout.ts を使用し、以下のファイルを修正:

対象ファイル:
- src/app/reports/periodic/page.tsx
- src/app/reports/business/page.tsx
- src/app/reports/kpi/page.tsx
- src/app/reports/cashflow/page.tsx
- src/app/reports/budget/page.tsx
- src/app/reports/monthly/page.tsx

修正内容:
1. fetchWithTimeout をインポート
2. fetch 呼び出しを fetchWithTimeout に置き換え
3. デフォルトタイムアウト: 30000ms
4. タイムアウト時のエラーハンドリング追加

修正前:
const res = await fetch('/api/reports/periodic')

修正後:
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout'

try {
  const res = await fetchWithTimeout('/api/reports/periodic', { timeout: 30000 })
} catch (error) {
  if (error instanceof FetchTimeoutError) {
    toast.error('リクエストがタイムアウトしました')
    return
  }
  throw error
}

追加修正:
- src/app/reports/cashflow/page.tsx L98-110: Promise.allをPromise.allSettledに変更
- src/app/reports/budget/page.tsx L109-121: Promise.allをPromise.allSettledに変更

検証コマンド:
pnpm tsc --noEmit
pnpm eslint "src/app/reports/**/*.tsx" --max-warnings=0
```

---

### C3: Result型パターン実装

**対象ファイル:** コンバージョンサービス全般

**前提:** A1完了

**プロンプト:**
```
コンバージョンサービスにResult型パターンを実装してください。

src/types/result.ts を使用し、以下のファイルを修正:

対象ファイル:
- src/services/conversion/conversion-engine.ts
- src/services/conversion/journal-converter.ts
- src/services/conversion/financial-statement-converter.ts
- src/services/conversion/account-mapping-service.ts
- src/services/conversion/mapping-rule-engine.ts
- src/services/conversion/adjustment-calculator.ts
- src/lib/conversion/coa-validator.ts
- src/lib/conversion/coa-importer.ts

修正内容:
1. throw new Error() を Result型の返却に変更
2. 関数シグネチャを Result<T, AppError> に変更
3. 呼び出し元で isSuccess/isFailure で判定

修正前:
async execute(projectId: string): Promise<ConversionResult> {
  if (!project) {
    throw new Error('Project not found')
  }
  // ...
}

修正後:
async execute(projectId: string): Promise<Result<ConversionResult, AppError>> {
  const project = await this.getProject(projectId)
  if (!project) {
    return failure({ code: 'NOT_FOUND', message: 'Project not found' })
  }
  // ...
  return success(result)
}

呼び出し元:
const result = await engine.execute(projectId)
if (isFailure(result)) {
  return NextResponse.json({ error: result.error.message }, { status: 400 })
}
const data = result.data

注意点:
- 73箇所のthrow文を全て変換
- API RouteでResult型をアンラップ
- テストを更新

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/services/conversion/ src/lib/conversion/ --max-warnings=0
pnpm jest tests/unit/services/conversion/
```

---

### C4: AI設定統一

**対象ファイル:**
- `src/services/conversion/ai-conversion-advisor.ts`
- `src/services/conversion/conversion-engine.ts`

**プロンプト:**
```
AI設定を統一し、再現性を確保してください。

1. src/services/conversion/ai-conversion-advisor.ts
   - AI呼び出しに temperature: 0.1 を明示設定
   - モデル設定を環境変数から取得
   - リトライ処理を追加（3回、指数バックオフ）

修正内容:
const response = await aiProvider.generate({
  model: process.env.AI_MODEL || 'gpt-4.1-mini',
  temperature: 0.1,
  maxTokens: 4096,
  // ...
})

2. src/services/conversion/conversion-engine.ts
   - CONFIG_VERSION 定数を追加
   - 設定をJSON保存時にバージョンを含める

追加内容:
const CONFIG_VERSION = '1.0.0'

interface ConversionConfig {
  version: string
  createdAt: Date
  settings: ConversionSettings
}

3. AI呼び出しにリトライパターンを実装

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)))
    }
  }
  throw new Error('Max retries exceeded')
}

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/services/conversion/ --max-warnings=0
```

---

### C5: N+1問題解消

**対象ファイル:**
- `src/services/budget/actual-vs-budget.ts`
- `src/services/report/periodic-report.ts`

**プロンプト:**
```
N+1クエリ問題を解消してください。

1. src/services/budget/actual-vs-budget.ts (L195-218)
   - 12回の月ごとDB呼び出しを一括取得に変更
   - 期間範囲で一括取得し、メモリでグループ化

修正前:
for (let month = 1; month <= 12; month++) {
  const monthData = await prisma.budget.findMany({
    where: { month }
  })
}

修正後:
const allData = await prisma.budget.findMany({
  where: {
    fiscalYear,
    month: { gte: 1, lte: 12 }
  }
})
const groupedByMonth = groupBy(allData, 'month')

2. src/services/report/periodic-report.ts (L89-94)
   - 直列DBクエリをPromise.allで並列化

修正前:
for (const period of periods) {
  const data = await getPeriodData(companyId, period)
}

修正後:
const periodDataPromises = periods.map(period => 
  getPeriodData(companyId, period)
)
const periodData = await Promise.all(periodDataPromises)

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/services/budget/ src/services/report/ --max-warnings=0
pnpm jest tests/unit/services/budget/
```

---

## Group D: P2/P3 Medium-Low修正

### D1: モックレスポンス削除

**対象ファイル:** `src/lib/ai/orchestrator/orchestrator.ts`

**プロンプト:**
```
モックレスポンスを実際のLLM呼び出しに置き換えてください。

src/lib/ai/orchestrator/orchestrator.ts の L446-471 を修正:

1. モックレスポンスを削除
2. 実際のAIプロバイダー呼び出しを実装
3. src/lib/integrations/ai のプロバイダーを使用

修正内容:
- executeStep内のモックデータ生成を削除
- AIProvider.generate()を呼び出し
- ペルソナに基づくプロンプト生成
- レスポンスのパースと検証

実装例:
const prompt = await persona.buildPrompt(context)
const response = await this.aiProvider.generate({
  messages: [{ role: 'user', content: prompt }],
  model: modelConfig.modelId,
  temperature: persona.temperature,
  timeout: 60000
})
const analysis = this.parseResponse(response.content)

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/lib/ai/orchestrator/ --max-warnings=0
pnpm jest tests/unit/lib/ai/orchestrator/
```

---

### D2: 長大ファイル分割

**対象ファイル:**
- `src/app/reports/kpi/page.tsx` (700行)
- `src/app/reports/budget/page.tsx` (584行)
- `src/app/reports/cashflow/page.tsx` (534行)

**プロンプト:**
```
長大なページコンポーネントを分割してください。

1. src/app/reports/kpi/page.tsx
   以下のコンポーネントに分割:
   - src/components/reports/kpi/kpi-page-header.tsx
   - src/components/reports/kpi/kpi-filters.tsx
   - src/components/reports/kpi/kpi-cards.tsx
   - src/components/reports/kpi/kpi-charts.tsx
   - src/components/reports/kpi/kpi-table.tsx
   - src/hooks/reports/use-kpi-data.ts

2. src/app/reports/budget/page.tsx
   以下のコンポーネントに分割:
   - src/components/reports/budget/budget-page-header.tsx
   - src/components/reports/budget/budget-filters.tsx
   - src/components/reports/budget/budget-variance-table.tsx
   - src/components/reports/budget/budget-charts.tsx
   - src/hooks/reports/use-budget-data.ts

3. src/app/reports/cashflow/page.tsx
   以下のコンポーネントに分割:
   - src/components/reports/cashflow/cashflow-page-header.tsx
   - src/components/reports/cashflow/cashflow-filters.tsx
   - src/components/reports/cashflow/cashflow-table.tsx
   - src/components/reports/cashflow/cashflow-charts.tsx
   - src/hooks/reports/use-cashflow-data.ts

分割ルール:
- 各コンポーネントは150行以下
- カスタムフックでデータ取得ロジックを分離
- 型定義は src/types/reports.ts に集約
- 共通UIコンポーネントを再利用

検証コマンド:
pnpm tsc --noEmit
pnpm eslint "src/app/reports/**/*.tsx" "src/components/reports/**/*.tsx" --max-warnings=0
```

---

### D3: 型定義集約

**ファイル:** `src/types/reports.ts`

**プロンプト:**
```
レポート関連の型定義を集約してください。

src/types/reports.ts を作成し、以下の型を集約:

1. 共通型
   - PeriodRange
   - ComparisonData
   - TrendData
   - ChartDataPoint

2. KPI関連
   - KPIValue
   - KPICategory
   - KPITrend
   - KPIReportData

3. 予算関連
   - BudgetItem
   - VarianceData
   - BudgetReportData

4. キャッシュフロー関連
   - CashFlowItem
   - CashFlowCategory
   - CashFlowReportData

5. 定期レポート関連
   - PeriodData
   - PeriodBS, PeriodPL, PeriodCF
   - PeriodKPIs
   - PeriodicSummary

移行手順:
1. 各ページのインライン型定義を特定
2. src/types/reports.ts に移動
3. 各ファイルからインポートに変更
4. 重複する型を統合

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/types/ --max-warnings=0
```

---

## Group E: IRモジュール新規開発

### E1: DB Schema & Types

**前提:** Group A-D完了

**プロンプト:**
```
IRレポートモジュールのデータベーススキーマと型定義を作成してください。

1. prisma/schema.prisma に以下のモデルを追加:

model IRReport {
  id                String   @id @default(cuid())
  companyId         String   @map("company_id")
  company           Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  reportType        String   @map("report_type")  // annual, quarterly, earnings_call, sustainability
  fiscalYear        Int      @map("fiscal_year")
  quarter           Int?     // 1-4 (quarterlyのみ)
  
  title             String
  titleEn           String?  @map("title_en")
  summary           String?  // トップメッセージ
  summaryEn         String?  @map("summary_en")
  
  sections          IRReportSection[]
  
  status            String   @default("DRAFT")    // DRAFT, REVIEW, PUBLISHED, ARCHIVED
  language          String   @default("ja")       // ja, en, bilingual
  
  publishedAt       DateTime? @map("published_at")
  publishedBy       String?  @map("published_by")
  
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  
  @@unique([companyId, reportType, fiscalYear, quarter])
  @@index([companyId, fiscalYear])
  @@map("ir_reports")
}

model IRReportSection {
  id              String   @id @default(cuid())
  reportId        String   @map("report_id")
  report          IRReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  sectionType     String   @map("section_type")
  title           String
  titleEn         String?  @map("title_en")
  content         String   // Markdown
  contentEn       String?  @map("content_en")
  data            String?  // JSON形式の構造化データ
  
  sortOrder       Int      @map("sort_order")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@index([reportId])
  @@map("ir_report_sections")
}

model ShareholderComposition {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  asOfDate        DateTime @map("as_of_date")
  
  shareholderType String   @map("shareholder_type")
  shareholderName String?  @map("shareholder_name")
  sharesHeld      Float    @map("shares_held")
  percentage      Float
  
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@index([companyId, asOfDate])
  @@map("shareholder_compositions")
}

model IREvent {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  eventType       String   @map("event_type")  // earnings_release, briefing, dividend, agm
  title           String
  titleEn         String?  @map("title_en")
  description     String?
  descriptionEn   String?  @map("description_en")
  scheduledDate   DateTime @map("scheduled_date")
  
  status          String   @default("scheduled")  // scheduled, completed, cancelled
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@index([companyId, scheduledDate])
  @@map("ir_events")
}

2. Companyモデルにリレーションを追加:
  irReports                 IRReport[]
  shareholderCompositions   ShareholderComposition[]
  irEvents                  IREvent[]

3. src/types/ir-report.ts を作成:
   - IRReportType, IRReportStatus, IRSectionType 型
   - IRReport, IRReportSection インターフェース
   - LocalizedText, ShareholderData, IREvent インターフェース
   - Result型パターンを使用

4. マイグレーション実行:
   pnpm prisma migrate dev --name add_ir_reports

検証コマンド:
pnpm prisma validate
pnpm prisma generate
pnpm tsc --noEmit
```

---

### E2: Service Layer

**前提:** E1完了

**プロンプト:**
```
IRレポートモジュールのサービス層を実装してください。

以下のファイルを作成:

1. src/services/reports/ir-report-service.ts

機能:
- getIRReports(companyId, filters): IRReport一覧取得
- getIRReport(id): IRReport詳細取得
- createIRReport(data): IRReport作成
- updateIRReport(id, data): IRReport更新
- deleteIRReport(id): IRReport削除
- publishIRReport(id): IRReport公開
- duplicateIRReport(id): IRReport複製

セクション操作:
- getSections(reportId): セクション一覧
- updateSection(reportId, sectionType, data): セクション更新
- reorderSections(reportId, order): セクション順序変更

2. src/services/reports/ir-shareholder-service.ts

機能:
- getShareholderCompositions(companyId, asOfDate): 株主構成取得
- upsertShareholderComposition(data): 株主構成登録/更新
- deleteShareholderComposition(id): 株主構成削除
- getLatestShareholderComposition(companyId): 最新株主構成

3. src/services/reports/ir-event-service.ts

機能:
- getIREvents(companyId, filters): IRイベント一覧
- createIREvent(data): IRイベント作成
- updateIREvent(id, data): IRイベント更新
- deleteIREvent(id): IRイベント削除
- getUpcomingIREvents(companyId): 今後のIRイベント

4. src/services/reports/ir-faq-service.ts

機能:
- getFAQs(companyId): FAQ一覧取得
- createFAQ(data): FAQ作成
- updateFAQ(id, data): FAQ更新
- deleteFAQ(id): FAQ削除
- reorderFAQs(companyId, order): FAQ順序変更

品質基準:
- Result型パターンを使用
- DBタイムアウト設定
- JSDocコメント
- ユニットテスト作成

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/services/reports/ir-*.ts --max-warnings=0
pnpm jest tests/unit/services/reports/
```

---

### E3: API Routes

**前提:** E2完了

**プロンプト:**
```
IRレポートモジュールのAPI Routesを実装してください。

以下のファイルを作成:

1. src/app/api/reports/ir/route.ts
   - GET: IRReport一覧取得
   - POST: IRReport作成

2. src/app/api/reports/ir/[id]/route.ts
   - GET: IRReport詳細取得
   - PUT: IRReport更新
   - DELETE: IRReport削除

3. src/app/api/reports/ir/[id]/publish/route.ts
   - POST: IRReport公開

4. src/app/api/reports/ir/[id]/sections/route.ts
   - GET: セクション一覧
   - PUT: セクション一括更新

5. src/app/api/reports/ir/[id]/export/route.ts
   - POST: PDF/PPTXエクスポート

6. src/app/api/reports/ir/shareholders/route.ts
   - GET: 株主構成一覧
   - POST: 株主構成登録

7. src/app/api/reports/ir/shareholders/[id]/route.ts
   - PUT: 株主構成更新
   - DELETE: 株主構成削除

8. src/app/api/reports/ir/events/route.ts
   - GET: IRイベント一覧
   - POST: IRイベント作成

9. src/app/api/reports/ir/events/[id]/route.ts
   - PUT: IRイベント更新
   - DELETE: IRイベント削除

10. src/app/api/reports/ir/faq/route.ts
    - GET: FAQ一覧
    - POST: FAQ作成

実装パターン:
- src/lib/api/auth-helpers の requireAuth を使用
- Zodスキーマで入力バリデーション
- Result型をアンラップしてレスポンス
- タイムアウト・レート制限設定
- セキュリティヘッダー設定

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/app/api/reports/ir/ --max-warnings=0
pnpm jest tests/api/reports/ir/
```

---

### E4: AI Prompts

**前提:** E2完了

**プロンプト:**
```
IRレポート生成用のAIプロンプトテンプレートを作成してください。

以下のファイルを作成:

1. src/lib/ai/prompts/templates/ir/index.ts
   - テンプレート登録・取得関数
   - エクスポート

2. src/lib/ai/prompts/templates/ir/top-message.ts
   - トップメッセージ生成プロンプト
   - 変数: companyName, fiscalYear, highlights, challenges
   - CFOペルソナ使用

3. src/lib/ai/prompts/templates/ir/financial-highlights.ts
   - 財務ハイライト生成プロンプト
   - 変数: financialData, previousYearData, kpis
   - Financial Analystペルソナ使用

4. src/lib/ai/prompts/templates/ir/dividend-policy.ts
   - 配当政策生成プロンプト
   - 変数: dividendHistory, payoutRatio, futurePolicy
   - CFOペルソナ使用

5. src/lib/ai/prompts/templates/ir/midterm-plan.ts
   - 中期経営計画生成プロンプト
   - 変数: currentStatus, marketTrend, strategy, targets
   - CFOペルソナ使用

6. src/lib/ai/prompts/templates/ir/esg-info.ts
   - ESG情報生成プロンプト
   - 変数: environmentalData, socialData, governanceData
   - CPAペルソナ使用

7. src/lib/ai/prompts/templates/ir/risk-factors.ts
   - リスク要因生成プロンプト
   - 変数: industryRisks, companyRisks, mitigationStrategies
   - Financial Analystペルソナ使用

テンプレート構造:
interface IRPromptTemplate {
  id: string
  sectionType: IRSectionType
  persona: 'cfo' | 'financial_analyst' | 'cpa'
  systemPrompt: LocalizedText
  userPromptTemplate: LocalizedText
  variables: string[]
  outputFormat: 'markdown' | 'structured'
  temperature: number
}

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/lib/ai/prompts/templates/ir/ --max-warnings=0
```

---

### E5: UI Pages

**前提:** E3完了

**プロンプト:**
```
IRレポートモジュールのUIページを実装してください。

以下のファイルを作成:

1. src/app/reports/ir/page.tsx
   - IRレポート一覧ページ
   - フィルター（レポート種別、年度、ステータス）
   - 新規作成ボタン
   - レポートカード（ステータス、公開日等）

2. src/app/reports/ir/new/page.tsx
   - IRレポート新規作成ページ
   - レポート種別選択
   - 年度・四半期選択
   - 言語選択（日英/バイリンガル）
   - テンプレート選択

3. src/app/reports/ir/[id]/page.tsx
   - IRレポート編集ページ
   - セクションエディタ
   - AI生成ボタン（セクション単位）
   - プレビューボタン
   - 公開ボタン
   - エクスポートボタン

4. src/app/reports/ir/[id]/preview/page.tsx
   - IRレポートプレビューページ
   - 読み取り専用表示
   - PDFプレビュー
   - 印刷対応

5. src/app/reports/ir/shareholders/page.tsx
   - 株主構成管理ページ
   - 基準日選択
   - 円グラフ表示
   - データ入力フォーム

6. src/app/reports/ir/events/page.tsx
   - IRイベントカレンダーページ
   - カレンダー表示
   - イベント作成/編集フォーム

実装パターン:
- fetchWithTimeoutを使用
- Promise.allSettledで並列リクエスト
- ローディング・エラー状態表示
- レスポンシブ対応

検証コマンド:
pnpm tsc --noEmit
pnpm eslint "src/app/reports/ir/**/*.tsx" --max-warnings=0
```

---

### E6: Components

**前提:** E5完了

**プロンプト:**
```
IRレポートモジュールのコンポーネントを実装してください。

以下のファイルを作成:

1. src/components/reports/ir/ir-report-list.tsx
   - レポート一覧表示
   - ステータスバッジ
   - アクションボタン

2. src/components/reports/ir/ir-report-editor.tsx
   - レポート編集メインコンポーネント
   - タブ切り替え（日/英）
   - 自動保存

3. src/components/reports/ir/ir-section-editor.tsx
   - セクション編集コンポーネント
   - Markdownエディタ
   - AI生成ボタン
   - プレビュー

4. src/components/reports/ir/ir-preview.tsx
   - レポートプレビュー
   - PDF風レイアウト
   - 印刷対応

5. src/components/reports/ir/financial-highlights-chart.tsx
   - 財務ハイライトチャート
   - 売上・利益トレンド
   - 前年比較

6. src/components/reports/ir/shareholder-pie-chart.tsx
   - 株主構成円グラフ
   - 凡例付き
   - ツールチップ

7. src/components/reports/ir/ir-calendar-widget.tsx
   - IRイベントカレンダー
   - 月表示
   - イベントマーカー

8. src/components/reports/ir/faq-manager.tsx
   - FAQ管理コンポーネント
   - ドラッグ&ドロップ順序変更
   - Q&A編集

9. src/components/reports/ir/language-toggle.tsx
   - 言語切り替えコンポーネント
   - 日/英/バイリンガル

10. src/hooks/reports/use-ir-report.ts
    - IRレポートデータ取得フック
    - キャッシュ管理
    - 楽観的更新

11. src/hooks/reports/use-ir-generation.ts
    - AI生成フック
    - 生成状態管理
    - エラーハンドリング

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/components/reports/ir/ src/hooks/reports/ --max-warnings=0
pnpm jest tests/components/reports/ir/
```

---

### E7: Export (PDF/PPTX)

**前提:** E5完了

**プロンプト:**
```
IRレポートのエクスポート機能を実装してください。

1. PDF エクスポート

以下のファイルを作成:
- src/services/reports/ir-pdf-exporter.ts
- src/components/reports/ir/pdf/ir-report-pdf.tsx

実装内容:
- React-PDF または Puppeteer を使用
- A4サイズ、縦向き
- ヘッダー/フッター（ページ番号、会社名）
- セクションごとのページ分割
- チャートの埋め込み
- 表紙

依存関係:
pnpm add @react-pdf/renderer
# または
pnpm add puppeteer

2. PowerPoint エクスポート

以下のファイルを作成:
- src/services/reports/ir-pptx-exporter.ts

実装内容:
- PptxGenJS を使用
- タイトルスライド
- セクションごとのスライド
- チャート画像化
- アニメーションなし

依存関係:
pnpm add pptxgenjs

3. エクスポートAPI

src/app/api/reports/ir/[id]/export/route.ts を実装:
- POST: { format: 'pdf' | 'pptx', language: 'ja' | 'en' }
- Content-Type 設定
- Content-Disposition ヘッダー

品質基準:
- タイムアウト設定（60秒）
- メモリ使用量監視
- 大きなレポートの分割処理
- エラーハンドリング

検証コマンド:
pnpm tsc --noEmit
pnpm eslint src/services/reports/ir-*exporter.ts --max-warnings=0
pnpm jest tests/unit/services/reports/ir-export.test.ts
```

---

### E8: Tests

**前提:** E1-E7完了

**プロンプト:**
```
IRレポートモジュールのテストを実装してください。

1. ユニットテスト

作成ファイル:
- tests/unit/services/reports/ir-report-service.test.ts
- tests/unit/services/reports/ir-shareholder-service.test.ts
- tests/unit/services/reports/ir-event-service.test.ts
- tests/unit/services/reports/ir-faq-service.test.ts
- tests/unit/services/reports/ir-pdf-exporter.test.ts
- tests/unit/services/reports/ir-pptx-exporter.test.ts

テスト内容:
- 各サービス関数のテスト
- Result型の成功/失敗ケース
- バリデーションテスト
- エッジケース

2. APIテスト

作成ファイル:
- tests/api/reports/ir/route.test.ts
- tests/api/reports/ir/[id]/route.test.ts
- tests/api/reports/ir/[id]/export/route.test.ts
- tests/api/reports/ir/shareholders/route.test.ts
- tests/api/reports/ir/events/route.test.ts

テスト内容:
- 認証チェック
- 入力バリデーション
- レスポンス形式
- エラーレスポンス

3. コンポーネントテスト

作成ファイル:
- tests/components/reports/ir/ir-report-list.test.tsx
- tests/components/reports/ir/ir-section-editor.test.tsx
- tests/components/reports/ir/financial-highlights-chart.test.tsx

テスト内容:
- レンダリング
- ユーザー操作
- 状態変更

4. E2Eテスト

作成ファイル:
- tests/e2e/ir-report-workflow.test.ts

テスト内容:
- レポート作成フロー
- AI生成フロー
- エクスポートフロー

検証コマンド:
pnpm jest tests/unit/services/reports/ir- --coverage
pnpm jest tests/api/reports/ir/ --coverage
pnpm jest tests/components/reports/ir/ --coverage
pnpm playwright test tests/e2e/ir-report-workflow.test.ts
```

---

## 品質ゲート確認チェックリスト

各フェーズ完了時に以下を確認:

```markdown
## Phase完了チェックリスト

### TypeScript
- [ ] pnpm tsc --noEmit エラー0件

### ESLint
- [ ] pnpm eslint src/ --max-warnings=0 エラー0件、警告0件

### テスト
- [ ] pnpm jest --passWithNoTests 全テストPASS
- [ ] カバレッジ80%以上

### ビルド
- [ ] pnpm build 成功

### 10品質基準
- [ ] 1. 安定性: タイムアウト、リトライ実装
- [ ] 2. 堅牢性: 入力バリデーション、例外処理
- [ ] 3. 再現性: 設定バージョン管理
- [ ] 4. 拡張性: インターフェース分離
- [ ] 5. メンテナンス性: JSDoc、単一責任
- [ ] 6. セキュリティ: サニタイゼーション、認可
- [ ] 7. パフォーマンス: キャッシング、並列処理
- [ ] 8. 文法・構文: strict mode、型完全性
- [ ] 9. 関数設計: Result型、オブジェクト引数
- [ ] 10. 全体整合性: パターン統一
```

---

## 参照ドキュメント

実装時に参照すべきドキュメント:
- AGENTS.md - プロジェクトルール
- docs/ai/QUALITY_STANDARDS.md - 品質基準チェックリスト
- docs/ai/CONSTRAINTS.md - 制約・フォーマット定義
- docs/ai/TASKS.md - タスク分割・依存関係
- docs/ai/README.md - AI機能アーキテクチャ

# 開発ログ (Development Log)

## 2026-03-14 セッション

### 目標
創薬スタートアップ向けサンプル財務データを作成し、月次決算資料ダッシュボードを正常に動作させる。

---

## 問題と解決方法

### 1. Next.js 16 と Turbopack / next-intl の互換性問題

#### 問題
- Next.js 16.1.6 で Turbopack（`next dev` のデフォルト）を使用時、next-intl 3.x が正常に動作しない
- エラー: `Couldn't find next-intl config file`
- favicon.ico やその他の静的ファイルでも同エラーが発生

#### 原因
- Turbopack は webpack とは異なるモジュール解決を行う
- next-intl の設定ファイル（`next-intl.config.ts`）が Turbopack で正しく認識されない

#### 解決方法
```javascript
// package.json
"scripts": {
  "dev": "next dev --webpack"  // Turbopackではなくwebpackを明示的に使用
}
```

**教訓**: 新しいビルドツール（Turbopack）は、サードパーティライブラリとの互換性問題がある可能性がある。安定性を優先する場合は、実績のあるwebpackを使用する。

---

### 2. Next.js 15以降の params Promise 問題

#### 問題
- Next.js 15以降、動的ルートの `params` は Promise として扱う必要がある
- エラー: `Route "/[locale]/login" used params.locale. params is a Promise and must be unwrapped`

#### 原因
- Next.js 15+ で並列ルートとレンダリングの最適化のため、params が非同期になった

#### 解決方法
```typescript
// ❌ 古い書き方
export default function Page({ params: { locale } }: { params: { locale: string } }) {
  // ...
}

// ✅ 新しい書き方 (Server Component)
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  // ...
}

// ✅ Client Component で use() を使用
'use client'
import { use } from 'react'

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params)
  // ...
}
```

---

### 3. Client Component で async 関数を使用できない問題

#### 問題
- `'use client'` 宣言のあるコンポーネントで `async function` を使用するとエラー
- `useRouter()` などのフックが `null` のコンテキストで呼ばれる

#### 原因
- Client Component は非同期関数として定義できない（React 18の仕様）
- Server Component と Client Component の境界を正しく理解していなかった

#### 解決方法
- Client Component では `use()` フックを使用して Promise を解決
- または、親の Server Component で params を解決して props として渡す

---

### 4. サンプルデータが月次決算資料に反映されない問題

#### 問題
- 月次決算資料ページ（`/reports/monthly`）で数字が表示されない
- ローディング状態から進まない

#### 原因
1. データベースに3月分のデータしか入っていなかった
2. サービス層の `generateSampleBalanceSheet()` / `generateSampleProfitLoss()` が古い一般的な企業データを使用していた
3. 創薬スタートアップ向けのデータ構造と一致していなかった

#### 解決方法
1. **シードスクリプトの拡張**: 12ヶ月分の財務データ（BS/PL）を生成するように変更
   ```typescript
   // prisma/seed.ts
   const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
   for (const month of months) {
     const monthlyBS = generateMonthlyBS(month, bs)
     const monthlyPL = generateMonthlyPL(month, pl)
     // データベースに投入
   }
   ```

2. **サンプルデータ生成関数の更新**: `monthly-report.ts` で創薬スタートアップのデータを使用
   ```typescript
   import { sampleTherapeuticsData } from '@/lib/data/sample-therapeutics-data'
   
   function generateSampleBalanceSheet(fiscalYear: number, month: number): BalanceSheet {
     const monthlyBurn = sampleTherapeuticsData.monthlyBurn.find(m => m.month === month)
     const cashBalance = monthlyBurn?.cashBalance ?? bs.assets.currentAssets.cash
     // ...
   }
   ```

---

### 5. TypeScript型エラー: totalLiabilities プロパティ

#### 問題
- `sampleTherapeuticsData.balanceSheet.totalLiabilities` が型に存在しない

#### 原因
- サンプルデータの型定義に `totalLiabilities` が含まれていたが、実際のオブジェクト構造と一致していなかった
- ネストされた `liabilities.totalLiabilities` ではなく、トップレベルの `totalLiabilities` を参照しようとした

#### 解決方法
- 固定値を使用（`358000000`）または計算で導出
- 将来的には型定義とデータ構造の整合性を確保

---

### 6. experimental.turbo 設定の廃止

#### 問題
- `next.config.js` で `experimental.turbo` を使用すると警告が表示される
- Next.js 15+ で `experimental.turbo` は廃止され、トップレベルの `turbo` に移動

#### 解決方法
- Turbopack を使用しない場合は設定を削除
- 使用する場合はトップレベルに移動:
  ```javascript
  // ❌ 古い書き方
  experimental: {
    turbo: { ... }
  }
  
  // ✅ 新しい書き方
  turbo: {
    rules: { ... }
  }
  ```

---

## アーキテクチャの決定事項

### 1. データ層の設計

```
prisma/
├── schema.prisma          # データベーススキーマ
├── seed.ts                # シードスクリプト（12ヶ月対応）
└── seeds/
    └── sample-therapeutics-data.ts  # 創薬スタートアップ向けサンプルデータ

src/lib/data/
└── sample-therapeutics-data.ts      # API用データコピー
```

### 2. 国際化 (i18n) の設計

```
next-intl.config.ts        # ルート設定（プロジェクトルート）
messages/
├── ja.json               # 日本語翻訳
└── en.json               # 英語翻訳

src/app/[locale]/          # ロケールベースのルーティング
```

### 3. 認証フロー

```
1. ユーザーが /ja/login にアクセス
2. middleware.ts が認証状態をチェック
3. 未認証 → ログインページ表示
4. 認証済み → ダッシュボードへリダイレクト
5. セッションは Cookie に保存
```

---

## パフォーマンス最適化

### 1. データベースクエリ
- `Promise.all` で並列実行
- トランザクションタイムアウト設定（30秒）

### 2. API タイムアウト
```typescript
const res = await fetchWithTimeout(
  `/api/reports/monthly?...`,
  { timeout: 30000 }
)
```

### 3. キャッシング戦略
- 静的データ: ビルド時に生成
- 動的データ: クライアントサイドキャッシュ

---

## 今後の改善点

1. **Turbopack 互換性**: next-intl が Turbopack に対応したら移行を検討
2. **テストカバレッジ**: ユニットテスト・E2Eテストの追加
3. **エラーハンドリング**: より詳細なエラーメッセージとリカバリー機能
4. **パフォーマンス**: 大量データ処理時の仮想化スクロール

---

## 参考リンク

- [Next.js 15 Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [next-intl Documentation](https://next-intl.dev/docs/getting-started/app-router)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

---

## 2026-03-15 セッション

### 目標
freee API連携の型定義修正、認証フローの改善、ダッシュボードの正常動作確認

---

## 問題と解決方法

### 7. freee API型定義の不整合

#### 問題
- `FreeeTrialBalanceItem` のプロパティ名が実際のAPIレスポンスと一致しない
- `id`, `name` ではなく `account_item_id`, `account_item_name` が返される
- `FreeeJournalDetail` 型が存在せず、仕訳明細の型エラーが発生

#### 原因
- 型定義がfreee APIの実際のレスポンス構造と異なっていた
- `FreeeJournalEntry` と `FreeeJournalDetail` の使い分けが不明確

#### 解決方法
```typescript
// types.ts - 正しい型定義
export interface FreeeTrialBalanceItem {
  account_item_id: number        // ✅ 正しい
  account_item_name: string      // ✅ 正しい
  hierarchy_level: number
  opening_balance: number
  closing_balance: number
  closing_dr_balance?: number
  closing_cr_balance?: number
}

export interface FreeeJournalDetail {
  id: number
  account_item_id: number
  account_item_name: string
  amount: number
  vat?: number | null
  vat_name?: string | null
  entry_side: 'debit' | 'credit'
  description?: string
  receipt_id?: number | null
  tag_ids?: number[]
}
```

---

### 8. middleware.ts の構文エラー

#### 問題
- `isPublicApiPath` 関数の閉じ括弧が不足
- TypeScript/ESLintで `',' expected` エラーが発生

#### 原因
- コード編集中に誤って括弧を削除してしまった

#### 解決方法
```typescript
// ❌ エラー
function isPublicApiPath(pathname: string): boolean {
  return publicApiPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)
}  // 閉じ括弧が1つ足りない

// ✅ 修正
function isPublicApiPath(pathname: string): boolean {
  return publicApiPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}  // 閉じ括弧を追加
```

---

### 9. 認証フロー: JWTにrole/companyIdが含まれない問題

#### 問題
- `validateSessionEdge` が常に固定値 `role: 'USER'`, `companyId: null` を返していた
- 実際のユーザーロールや会社IDが反映されない
- ダッシュボードでログインなしでアクセスできる状態

#### 原因
- `generateToken` が userId と sessionId しかJWTに含めていなかった
- `validateSessionEdge` がJWTのペイロードからrole/companyIdを抽出していなかった

#### 解決方法
```typescript
// auth.ts - トークン生成時にrole/companyIdを含める
export async function generateToken(
  userId: string,
  sessionId: string,
  role: string,
  companyId: string | null
): Promise<string> {
  return jwt.sign(
    {
      userId,
      sessionId,
      role,           // ✅ 追加
      companyId,      // ✅ 追加
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: `${SESSION_DURATION_HOURS}h`, issuer: 'freee_audit', audience: 'freee_audit_users' }
  )
}

// createSession も更新
export async function createSession(
  userId: string,
  role: string,
  companyId: string | null
): Promise<Session> {
  const sessionId = crypto.randomUUID()
  const token = await generateToken(userId, sessionId, role, companyId)
  // ...
}

// auth-edge.ts - JWTからrole/companyIdを抽出
interface JwtPayload {
  userId: string
  sessionId: string
  role?: string
  companyId?: string | null
  exp?: number
  iss?: string
  aud?: string
}

export async function validateSessionEdge(token: string): Promise<EdgeAuthUser | null> {
  const decoded = await verifyJwtEdge(token)
  if (!decoded) return null

  return {
    id: decoded.userId,
    role: decoded.role || 'USER',
    companyId: decoded.companyId || null,
  }
}
```

---

### 10. 重複する型定義の問題

#### 問題
- `journal-receipt-mapping-service.ts` に同じ型やクラスが複数回定義されていた
- `FreeeReceipt`, `FreeeDealsResponse`, `FreeeDealParams` などが重複

#### 原因
- 編集中に誤ってコードブロックが複製されてしまった

#### 解決方法
- 重複する定義を削除し、types.tsからimportする形に統一
- クラス定義が2回ある場合は1つを削除

---

### 11. ダッシュボードへの未認証アクセス問題

#### 問題
- `/ja/dashboard` に直接アクセスすると、ログインしていない状態でもページが表示される
- 認証チェックが正しく動作していない

#### 原因
- middleware.ts の `isPublicPath` 判定ロジックに問題があった
- 非公開パスの場合の認証チェックが逆になっていた

#### 解決方法
```typescript
// middleware.ts - 修正後
if (localeMatch && !isPublicPath(pathname)) {  // ✅ 非公開パスの場合のみチェック
  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
  }

  const user = await validateSessionEdge(token)
  if (!user) {
    const response = NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    response.cookies.delete('session')
    return response
  }
}
```

---

### 12. ルートページ ([locale]/page.tsx) の削除

#### 問題
- `/ja` にアクセスすると、認証済みでもシンプルなHTMLページが表示される
- サイドバーやチャットウィジェットが表示されない

#### 原因
- `[locale]/page.tsx` が存在し、`(authenticated)/dashboard/page.tsx` より優先されていた
- ルートページは認証レイアウトの外にあった

#### 解決方法
- `[locale]/page.tsx` を削除
- middleware でルートアクセス時は `/ja/login` にリダイレクト
- ログイン後は `/ja/dashboard` に遷移

---

## 起動コマンド（最終版）

```powershell
cd C:\src\freee_audit
pnpm db:push --force-reset
pnpm db:seed
pnpm dev --webpack
```

## アクセス先

| URL | 説明 |
|-----|------|
| http://localhost:3000/ja/login | ログインページ |
| http://localhost:3000/ja/dashboard | ダッシュボード（認証必要） |
| http://localhost:3000/reports/monthly | 月次決算資料 |

## ログイン情報

- Email: admin@example.com
- Password: admin123

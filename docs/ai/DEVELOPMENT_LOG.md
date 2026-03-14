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

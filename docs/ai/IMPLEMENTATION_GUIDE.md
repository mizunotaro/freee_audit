# 実装実行ガイド

## 概要

このドキュメントは、品質評価に基づく改修とIRモジュール新規開発を別セッションで実行するための実行順序ガイドです。

詳細なプロンプトは [IMPLEMENTATION_PROMPTS.md](./IMPLEMENTATION_PROMPTS.md) を参照してください。

---

## 実行順序（依存関係順）

### Step 1: 共通モジュール作成（並列実行可能）

5つのタスクは独立しているため、5つのセッションで並列実行可能:

| タスクID | ファイル | 内容 |
|---------|----------|------|
| A1 | `src/types/result.ts` | Result型・AppError型定義 |
| A2 | `src/lib/utils/html-sanitize.ts` | HTMLサニタイザー |
| A3 | `src/lib/utils/safe-formula-evaluator.ts` | 安全な数式評価器 |
| A4 | `src/lib/api/auth-helpers.ts` | 認証ヘルパー |
| A5 | `src/lib/api/fetch-with-timeout.ts` | タイムアウト付きfetch |

**完了条件:** 全5ファイル作成、テストPASS

---

### Step 2: P0 Critical修正（Step 1完了後、並列実行可能）

| タスクID | 内容 | 依存 |
|---------|------|------|
| B1 | XSS脆弱性修正 | A2 |
| B2 | コードインジェクション修正 | A3 |
| B3 | DBタイムアウト追加 | なし |

**対象ファイル:**
- `src/app/api/reports/business/generate/route.ts`
- `src/app/api/reports/business/export/route.ts`
- `src/services/kpi/custom-kpi-service.ts`
- `src/services/report/periodic-report.ts`
- `src/services/report/monthly-report.ts`
- `src/services/reports/board-report-service.ts`

**完了条件:** 全Critical問題解消、テストPASS

---

### Step 3: P1 High修正（Step 1完了後、並列実行可能）

| タスクID | 内容 | 依存 |
|---------|------|------|
| C1 | 認証ヘルパー共通化 | A4 |
| C2 | fetchタイムアウト追加 | A5 |
| C3 | Result型パターン実装 | A1 |
| C4 | AI設定統一 | なし |
| C5 | N+1問題解消 | なし |

**対象ファイル:**
- 全APIルート（reports, analysis）
- 全ページコンポーネント（reports）
- コンバージョンサービス全般

**完了条件:** 全High問題解消、テストPASS

---

### Step 4: P2/P3 Medium-Low修正

| タスクID | 内容 |
|---------|------|
| D1 | モックレスポンス削除 |
| D2 | 長大ファイル分割 |
| D3 | 型定義集約 |

**完了条件:** コード品質向上、テストPASS

---

### Step 5: IRモジュール新規開発（順次実行）

| タスクID | 内容 | 期間 |
|---------|------|------|
| E1 | DB Schema & Types | 1日 |
| E2 | Service Layer | 1.5日 |
| E3 | API Routes | 1.5日 |
| E4 | AI Prompts | 1日 |
| E5 | UI Pages | 2日 |
| E6 | Components | 1.5日 |
| E7 | Export (PDF/PPTX) | 2日 |
| E8 | Tests | 1.5日 |

**合計:** 12日

---

## セッション別実行プラン

### セッション1-5: 共通モジュール（並列）

```
セッション1: A1 - Result型
セッション2: A2 - HTMLサニタイザー
セッション3: A3 - 安全な数式評価器
セッション4: A4 - 認証ヘルパー
セッション5: A5 - タイムアウト付きfetch
```

### セッション6-8: Critical修正（並列）

```
セッション6: B1 - XSS修正 + B3 - DBタイムアウト（レポート）
セッション7: B2 - コードインジェクション修正
セッション8: B3 - DBタイムアウト（残り）
```

### セッション9-13: High修正（並列）

```
セッション9:  C1 - 認証ヘルパー共通化
セッション10: C2 - fetchタイムアウト追加
セッション11: C3 - Result型パターン（コンバージョン）
セッション12: C4 - AI設定統一
セッション13: C5 - N+1問題解消
```

### セッション14-16: Medium-Low修正

```
セッション14: D1 - モックレスポンス削除
セッション15: D2 - 長大ファイル分割
セッション16: D3 - 型定義集約
```

### セッション17-24: IRモジュール

```
セッション17: E1 - DB Schema & Types
セッション18: E2 - Service Layer
セッション19: E3 - API Routes
セッション20: E4 - AI Prompts
セッション21-22: E5 - UI Pages
セッション23: E6 - Components + E7 - Export
セッション24: E8 - Tests + 統合確認
```

---

## 品質ゲート確認コマンド

各セッション終了時に実行:

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

## プロンプト使用方法

各セッションで以下の形式でプロンプトを使用:

```
docs/ai/IMPLEMENTATION_PROMPTS.md の [タスクID] セクションを参照し、
実装を行ってください。

タスクID: A1
詳細: src/types/result.ts を作成
```

---

## 注意事項

1. **依存関係を守る**: Step 1の共通モジュールが完了してからStep 2以降を実行
2. **品質ゲートを確認**: 各セッション終了時にコマンドを実行
3. **テストを作成**: 新規ファイルには必ずテストを作成
4. **ドキュメントを更新**: 大きな変更はAGENTS.mdやTASKS.mdを更新

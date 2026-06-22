# START HERE - AI Assistant Session Initialization

> **Copy the entire prompt in Section 2 below and paste it as your first message
> when starting a new Claude Code or Codex session in this repository.**

---

## 1. When To Use This File

- Starting a **new Claude Code session** in this repository
- Starting a **new Codex session** in this repository
- Starting a **new Cursor / Windsurf / any AI IDE session** in this repository
- After **migrating to a new PC/environment**
- When you want the AI assistant to have **full project context** before working

---

## 2. Master Initialization Prompt

Copy everything inside the block below:

---

```
このリポジトリで作業を開始します。以下の手順に従って、プロジェクトの全体像を完全に理解した上で、タスクに着手してください。

## ステップ1: 必須ドキュメントの読み込み（順序厳守）

以下のファイルをこの順序で読んでください:

1. **CLAUDE.md**（ルート）- プロジェクト全体のアーキテクチャ、ディレクトリマップ、API一覧、データベーススキーマ、AIアーキテクチャ、コードパターンの完全な概要
2. **AGENTS.md**（ルート）- AIエージェントルール、品質ゲート、コミット規約、実装パターン
3. **docs/ai/QUALITY_STANDARDS.md** - 10品質基準チェックリスト（全61項目）
4. **docs/ai/CONSTRAINTS.md** - LLM制約、出力フォーマット、入力バリデーション、Result型パターン
5. **docs/ai/TASKS.md** - 実装タスクの詳細と依存関係
6. **docs/ai/README.md** - AI機能アーキテクチャとコンポーネント構成
7. **docs/SECURITY.md** - セキュリティガイドライン
8. **docs/TEST_STRATEGY.md** - テスト戦略

## ステップ2: プロジェクト構造の把握

CLAUDE.md の「Directory Map」セクションを読み、以下を理解してください:
- src/app/ のルーティング構造 ([locale] + (authenticated) グループ)
- src/services/ の34のサービスディレクトリ
- src/lib/ のコアライブラリ（ai/, integrations/, security/, audit/ 等）
- src/types/ の型定義（特に result.ts の Result<T,E> パターン）
- prisma/schema.prisma の60以上のデータモデル
- 100以上のAPIエンドポイント（src/app/api/ 以下）

## ステップ3: 開発コマンドの確認

以下のコマンドが利用可能です:
- `pnpm dev` - 開発サーバー起動
- `pnpm typecheck` - TypeScript型チェック
- `pnpm lint` - ESLint
- `pnpm test` - Vitestテスト実行
- `pnpm test:coverage` - カバレッジ付きテスト
- `pnpm build` - 本番ビルド
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed` - データベース操作
- `pnpm db:studio` - Prisma Studio GUI

## ステップ4: 品質ゲートの理解

全ての実装タスクで以下の品質ゲートを必ず通過すること:
1. `pnpm typecheck` - エラー0件
2. `pnpm lint` - エラー0件、警告0件
3. `pnpm test` - 全テストPASS
4. `pnpm build` - ビルド成功

## ステップ5: コード規約の遵守

以下の規約を厳守してください:

### 必須パターン
- **Result型**: 全関数は Result<T, E> を返す（例外を投げない）
  - success(data), failure(error), isSuccess(), isFailure()
  - tryCatch() / tryCatchSync() ラッパーを使用
- **オプションオブジェクト**: 引数3個以上の場合はオブジェクト引数を使用
- **Zodバリデーション**: 全API入力はZodスキーマで検証
- **監査ログ**: 全API呼び出しとユーザー操作は AuditLog に記録

### 命名規則
- ファイル名: kebab-case (例: audit-service.ts)
- コンポーネント: PascalCase (例: BalanceSheet.tsx)
- 関数: camelCase (例: calculateRunway())
- 定数: UPPER_SNAKE_CASE (例: MAX_RETRY_COUNT)
- 型/インターフェース: PascalCase (例: JournalEntry)

### インポート順序
1. 外部ライブラリ (react, next)
2. 内部コンポーネント (@/components)
3. ユーティリティ (@/lib)
4. 型定義 (@/types)

### コメント
- コメントは**追加しない**（明示的に要求された場合のみ）
- コード自体が説明的であるべき

### コミットメッセージ
形式: <type>(<scope>): <description>
type: feat, fix, refactor, docs, test, chore

### セキュリティ
- APIキー・シークレットは環境変数のみで管理（ハードコード禁止）
- 入力値は必ずZodでサニタイズ
- SQLインジェクション対策（Prismaパラメータ化クエリ使用）
- CSRFトークン、レートリミット必須

## ステップ6: AI機能実装の原則

AI機能を実装する場合:
1. **LLM-First**: 全レイヤーにLLM統合、専門家視点で判断
2. **Expert Personas**: 公認会計士(CPA)、税理士、CFO、財務アナリスト、Big4監査人の5ペルソナ
3. **Model Selection**: タスク複雑度に応じた最適モデル選択（gpt-5.4-nano 〜 Claude Opus）
4. **Neutral & Objective**: 中立的・客観的で根拠に基づく分析
5. **CrystalBall Policy**: 無料APIのみ使用、全API呼び出しに監査ログ、不確実項目は隔離

## ステップ7: 現在の環境状態の確認

以下のコマンドを実行して、環境が正常にセットアップされているか確認してください:
- `pnpm typecheck` - 型エラーがないか
- `pnpm lint` - リントエラーがないか

## 理解確認

上記の全ドキュメントを読み終えたら、以下を3行以内で要約してください:
1. このプロジェクトの目的
2. 最も重要なアーキテクチャ上の決定（3つ）
3. あなたが作業を始める前に確認すべきこと

その後、私が指示するタスクに着手してください。
```

---

## 3. Task-Specific Follow-Up Prompts

After the initialization prompt above, use these follow-up prompts
depending on what you want the AI to do:

### 3.1 Feature Implementation

```
[機能名] の実装をお願いします。

要件:
- [要件を具体的に記述]

実装前に以下を確認してください:
1. docs/ai/CONSTRAINTS.md の該当する制約事項
2. 既存の類似機能のコードパターン（src/services/ または src/lib/）
3. 関連するPrismaモデルとAPIルート
4. 関連するテストファイル

実装後、品質ゲートを必ず実行してください:
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

### 3.2 Bug Fix

```
以下のバグを修正してください:

症状:
[バグの内容を記述]

再現手順:
1. [手順1]
2. [手順2]

期待される動作:
[正しい動作]

調査手順:
1. 関連するコードを特定（src/app/api/, src/services/, src/lib/）
2. 根本原因を分析
3. 修正を実装
4. 品質ゲートを実行: pnpm typecheck && pnpm lint && pnpm test && pnpm build
5. 回帰テストを追加
```

### 3.3 Code Review / Audit

```
このリポジトリのコードレビューを実施してください。

以下の観点で確認し、結果を報告してください:
1. セキュリティ: 入力バリデーション、認証・認可、シークレット管理
2. 品質: Result型パターンの遵守、エラーハンドリング、型安全性
3. パフォーマンス: N+1クエリ、不要な再レンダリング、キャッシュ活用
4. テスト: カバレッジ、エッジケース、モックの適切性
5. アーキテクチャ: レイヤー分離、単一責任、依存関係の方向

各項目について、具体的なファイルと行番号を含めて報告してください。
```

### 3.4 Database Schema Change

```
データベーススキーマの変更を行います:

変更内容:
[追加/修正/削除するモデルとフィールドを記述]

手順:
1. prisma/schema.prisma を更新
2. マイグレーション作成: pnpm db:migrate --name [description]
3. Prismaクライアント再生成: pnpm db:generate
4. 関連するサービス・API・型定義を更新
5. テストを更新・追加
6. 品質ゲートを実行
```

### 3.5 Exploratory Research

```
このリポジトリの [領域名] について調査してください。

調査項目:
1. 現在の実装状況（ファイル一覧、主要クラス/関数）
2. アーキテクチャパターン（使用しているデザインパターン）
3. 外部依存関係
4. テストカバレッジ
5. 改善提案（ある場合）

結果は構造化されたレポートとして報告してください。
```

---

## 4. Codex (OpenAI) Specific Instructions

If using OpenAI Codex (codex CLI or Codex in GitHub), add this to the
initialization prompt:

```
## Codex固有の指示

- このプロジェクトは Next.js 16 (App Router) + TypeScript + Prisma 5 を使用
- pnpmをパッケージマネージャーとして使用（npm/yarnではない）
- テストフレームワークは Vitest（Jestではない）
- AGENTS.md のルールに従うこと
- 出力は日本語で行うこと（デフォルト）
```

---

## 5. Environment-Specific Notes

### Windows (PowerShell)

```
## Windows環境での注意事項

- PowerShell 7+ (pwsh) を使用
- ファイルパスの区切りは バックスラッシュ (\)
- pnpm scripts は package.json の scripts セクションを参照
- .env.local に環境変数を設定（.env ではない）
- Next.js キャッシュクリア: Remove-Item -Recurse -Force .next
```

### Linux / macOS / WSL

```
## Linux/macOS環境での注意事項

- bash または zsh を使用
- ファイルパスの区切りは スラッシュ (/)
- pnpm scripts は package.json の scripts セクションを参照
- .env.local に環境変数を設定（.env ではない）
- Next.js キャッシュクリア: rm -rf .next
```

---

## 6. Quick Reference Card

```
┌──────────────────────────────────────────────────────────────┐
│  READ FIRST (in order):                                      │
│    1. CLAUDE.md          (project overview)                  │
│    2. AGENTS.md          (rules & quality gates)             │
│    3. docs/ai/QUALITY_STANDARDS.md  (61 checklist items)     │
│    4. docs/ai/CONSTRAINTS.md         (LLM constraints)       │
│                                                              │
│  QUALITY GATE (must pass):                                   │
│    pnpm typecheck && pnpm lint && pnpm test && pnpm build    │
│                                                              │
│  KEY PATTERNS:                                               │
│    Result<T,E>  | Zod validation | Options object            │
│    kebab-case files | PascalCase components                  │
│                                                              │
│  DB: pnpm db:generate / db:migrate / db:seed / db:studio     │
│  LOGIN: admin@example.com / admin123                         │
└──────────────────────────────────────────────────────────────┘
```

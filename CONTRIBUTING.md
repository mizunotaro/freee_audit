# コントリビュートガイド（CONTRIBUTING.md）

> freee_audit への開発参加に必要な情報（ローカルセットアップ・主要スクリプト・テスト実行・CI・Class-A境界）をまとめたガイドです。
> プロジェクト全体像は [README.md](./README.md)・[CLAUDE.md](./CLAUDE.md) を、AI作業ルールは [AGENTS.md](./AGENTS.md) を参照してください。

## 目次

1. [前提条件](#1-前提条件)
2. [ローカルセットアップ](#2-ローカルセットアップ)
3. [主要スクリプト](#3-主要スクリプト)
4. [テストの実行](#4-テストの実行)
5. [CI の構成](#5-ci-の構成)
6. [ローカル品質ゲート](#6-ローカル品質ゲート)
7. [Class-A 境界（編集禁止パス）](#7-class-a-境界編集禁止パス)
8. [コーディング規約](#8-コーディング規約)
9. [コミットメッセージ](#9-コミットメッセージ)
10. [ドキュメントの運用](#10-ドキュメントの運用)

---

## 1. 前提条件

- **Node.js >= 20**（CI は 20）
- **pnpm >= 8**（CI は 9。未導入なら `corepack enable` → `corepack pnpm` で導入可）
- （本番）PostgreSQL / （開発）SQLite
- （本番）freee API アクセストークン、各 AI プロバイダーの API キー

外部APIに接続せず検証する場合はモックモード（`FREEE_MOCK_MODE=true` / `AI_MOCK_MODE=true`）が利用できます（詳細は [README §6.4](./README.md)）。

---

## 2. ローカルセットアップ

```bash
git clone <repo>
cd freee_audit
pnpm install              # pnpm が無ければ corepack pnpm install
cp .env.example .env.local
pnpm db:generate          # ★ typecheck/test の前に必須（Prisma Client 生成）
pnpm db:push              # 開発用 SQLite にスキーマ反映
pnpm db:seed              # シード投入
pnpm dev                  # http://localhost:3000 を起動
```

- **`pnpm db:generate` を忘れないこと**: Prisma Client が未生成だと `@prisma/client` 由来の大量の phantom 型エラー（TS7006 等）が出て typecheck/test が通らなくなります。
- **シードログイン**: `admin@example.com` / `admin123`
- 環境変数のひな形は `.env.example` を参照。シークレット類は `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` で生成してください（例示値を再利用しない）。

---

## 3. 主要スクリプト

`package.json` の主要スクリプト一覧です。

### 開発・ビルド

| コマンド | 説明 |
|----------|------|
| `pnpm dev` | 開発サーバー起動（`next dev --webpack`） |
| `pnpm build` | 本番ビルド |
| `pnpm start` | 本番サーバー起動 |

### 品質チェック

| コマンド | 説明 |
|----------|------|
| `pnpm lint` / `pnpm lint:fix` | ESLint（`src/`）。`--max-warnings=0` 運用 |
| `pnpm typecheck` | `tsc --noEmit`（要 `db:generate`） |
| `pnpm format` / `pnpm format:check` | Prettier の書き込み / 検証のみ |

### テスト

| コマンド | 説明 |
|----------|------|
| `pnpm test` | 単体テスト（Vitest, `tests/**/*.test.ts(x)`） |
| `pnpm test:unit` | `tests/unit` のみ |
| `pnpm test:watch` | 監視モード |
| `pnpm test:coverage` | カバレッジ付き（v8, 閾値 60/65/55/60） |
| `pnpm test:integration` | 統合テスト（`tests/integration`） |
| `pnpm test:conversion` | 会計基準変換関連を一括実行 |
| `pnpm test:bench` | ベンチマーク（専用 `vitest.bench.config.ts`・逐次） |
| `pnpm e2e` / `e2e:ui` / `e2e:debug` | Playwright（chromium） |

### データベース（Prisma）

| コマンド | 説明 |
|----------|------|
| `pnpm db:generate` | Prisma Client 生成（typecheck/test の前に必須） |
| `pnpm db:migrate` | マイグレーション作成・適用（dev） |
| `pnpm db:push` | スキーマ直接反映（開発用） |
| `pnpm db:seed` | シード投入（`tsx prisma/seed.ts`） |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:reset` | DB フルリセット |

### セキュリティ

| コマンド | 説明 |
|----------|------|
| `pnpm audit:check` | 依存パッケージ脆弱性チェック（critical 以上） |
| `pnpm security:scan` | 脆弱性スキャン（`better-npm-audit`） |

---

## 4. テストの実行

> **原則: 変更したファイルに関連するテストのみを実行する。** フルスイートは1プロセスでは OOM するため（詳細は [§5](#5-ci-の構成)）、ローカルでも分割実行を前提とします。

### 単体テスト（Vitest）

```bash
pnpm test:unit                                    # tests/unit 全体
pnpm exec vitest run path/to/file.test.ts         # 特定ファイルのみ（推奨）
pnpm exec vitest run --shard=1/4 path/            # ディレクトリを分割実行
```

- 設定: `vitest.config.ts`（`environment: jsdom`, `globals: true`, setup `tests/setup.ts`）
- 除外: `node_modules`, `dist`, `.next`（OOM 起因ファイルは追加除外される場合あり）

### 統合テスト（Vitest）

```bash
pnpm test:integration
```

- 対象: `tests/integration/**/*.test.ts`

### E2E（Playwright）

```bash
pnpm e2e            # ヘッドレス
pnpm e2e:ui         # UI モード
pnpm e2e:debug      # デバッグモード
```

- 設定: `playwright.config.ts`（`testDir: ./tests/e2e`, chromium のみ）
- **自己完結**: `globalSetup`（`tests/e2e/global-setup.ts`）がテスト用 DB スキーマ作成＋admin シードを行うため、CI での DB セットアップは不要です。
- **webServer**: `pnpm dev` を起動し mock モードで boot します。ローカルでは `reuseExistingServer: true` なので、既に dev サーバーが立っていればそれに接続します（PATH に `pnpm` が無い環境では、自分で `pnpm dev` を起動しておくと確実です）。
- **認証レートリミット**: ログイン API は 5 回/15 分/IP の制限があるため、複数 E2E スペックを回すときは1回ログインして cookie を使い回してください。

### ベンチマーク（Vitest）

```bash
pnpm test:bench
```

- 設定: `vitest.bench.config.ts`（`fileParallelism: false` で逐次、`testTimeout: 180s`）

### カバレッジ

```bash
pnpm test:coverage
```

- 強制下限閾値（`vitest.config.ts`）: **lines 60 / functions 65 / branches 55 / statements 60**

---

## 5. CI の構成

CI 定義: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)（Node 20 / pnpm 9）。`push`・`pull_request`（ブランチ: `master`, `develop`）で駆動します。

| ジョブ | 内容 |
|--------|------|
| **Lint** | `pnpm lint`（ESLint） |
| **Type Check** | `pnpm db:generate` → `pnpm typecheck` |
| **Unit Tests Shard**（×32） | `pnpm test -- --shard=N/32`（`NODE_OPTIONS=--max-old-space-size=6144`） |
| **Unit Tests**（集約） | 全シャード成功を必須とするステータスゲート（シャード数に依存しない必須チェック） |
| **Integration Tests** | `pnpm test:integration` |
| **E2E Tests** | `pnpm build` → `pnpm e2e`（Playwright / chromium） |
| **Security Audit** | `pnpm audit:check` |
| **Build** | `pnpm build`（**Lint / Type Check / Unit Tests / Security Audit** の成功が前提） |

### シャード分割の理由

単体テスト（6000+ 件）を単一プロセスで実行すると、jsdom・MSW・AI プロバイダーのシングルトンが蓄積し V8 ワーカーのヒープが OOM します。そのため CI では 32 シャードに分割し、`NODE_OPTIONS=--max-old-space-size=6144` で各ワーカーのヒープ上限を引き上げて実行します。`Build` ジョブは Lint/TypeCheck/Unit Tests/Security Audit に依存する最終ゲートです。

---

## 6. ローカル品質ゲート

### 差分スコープの検証（推奨）

```bash
node scripts/autopm_verify.mjs --changed-only
```

`scripts/autopm_verify.mjs` は `origin/master` との差分（＋作業ツリー＋untracked）を対象に、変更ファイルの種別に応じて **diff スコープ**で以下を実行します:

- TypeScript: `tsc --noEmit`（リポジトリ全体を実行し、差分ファイルに関連するエラーのみ抽出）
- ESLint: 変更 TS/TSX ファイル（`--max-warnings=0`）
- Vitest: 変更ファイルから解決される `*.test.ts(x)`
- Vitest Bench: 変更された `tests/benchmark/*.bench.ts`（専用 config）
- pytest: `python-service/` 変更時
- Prisma: `prisma/schema.prisma` 変更時に `prisma validate`

> ドキュメント（`.md`）のみの変更は該当ステップが skip され、exit 0 になります。

### pre-commit フック

`.husky/pre-commit` が `pnpm lint-staged` を実行します（staged ファイルに対する ESLint + Prettier）。`pnpm` が PATH に無い場合は `corepack pnpm` にフォールバックします。

---

## 7. Class-A 境界（編集禁止パス）

以下は**人間が所有する Class-A 領域**であり、自動化・AI 作業では**編集しない**でください（読み取り専用の参照のみ可）。変更が必要な場合は PR 本文で変更を**提案**し、人間の適用を待ってください。

- `prisma/schema.prisma`, `prisma/migrations/**`
- `src/lib/auth*`, `src/lib/crypto.ts`, `src/lib/security/**`, `src/lib/audit/**`
- `src/services/audit/**`, `src/services/conversion/**`, `src/services/valuation/**`, `src/services/tax/**`, `src/services/kpi/**`, `src/services/debt/**`, `src/services/deferred-accrual/**`, `src/services/journal-proposal/**`, `src/services/freee/**`
- `src/lib/conversion/**`, `src/lib/integrations/freee/**`
- `src/app/api/audit/**`, `src/app/api/journals/**`, `src/app/api/journal-proposal/**`, `src/app/api/valuation/**`, `src/app/api/tax/**`, `src/app/api/kpi/**`, `src/app/api/deferred-accrual/**`, `src/app/api/debt/**`, `src/app/api/freee/**`, `src/app/api/conversion/**`, `src/app/api/auth/**`
- `python-service/**`, `r-service/**`

> 品質基準・制約の詳細は [AGENTS.md](./AGENTS.md)・[CLAUDE.md §13](./CLAUDE.md) を参照。

---

## 8. コーディング規約

- **Result 型（必須）**: すべての関数は `@/types/result` の `success` / `failure` を使い `Result<T, E = Error>` を返す。
- **Zod バリデーション**: 入力は `safeParse` で検証する。
- **引数が3個以上**: options object パターンにする。
- **禁止事項**: `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, カバレッジ閾値の引き下げ。**Fake green**（検証をすり抜けるだけの空実装・常に成功するテスト）は禁止。安全に実施できない場合は PR 本文に明示し、変更を保留すること。
- **命名**: ファイル kebab-case / コンポーネント PascalCase / 関数 camelCase。
- **コメント**: 原則書かない（既存パターン・密度に合わせる）。
- **依存関係**: 新規ライブラリを追加しない（外部コードの直接コピーも禁止）。

---

## 9. コミットメッセージ

```
<type>(<scope>): <description>

[optional body]
```

**type**: `feat` / `fix` / `refactor` / `docs` / `test` / `chore`

例:
```
docs(readme): fix Next.js version and document sharded CI
```

> コミットは自動化フレームワークが行います（本リポジトリの AI 作業では `git commit` を手動実行しません）。

---

## 10. ドキュメントの運用

- ドキュメントは**生きた資料**です。機能・構成を変更した際は README・該当 docs を更新してください。
- AI 機能の設計変更時は `docs/ai/` 配下（`QUALITY_STANDARDS.md` / `CONSTRAINTS.md` / `TASKS.md` / `README.md`）を更新してください（[AGENTS.md](./AGENTS.md) のドキュメント更新ルールを参照）。
- 主要ドキュメントの地図は [CLAUDE.md §12](./CLAUDE.md) にあります。

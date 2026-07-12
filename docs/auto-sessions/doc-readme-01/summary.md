# DOC-README-01 — Summary

**Task:** README + CONTRIBUTING の刷新（ローカルセットアップ・主要スクリプト・unit/integration/e2e テスト実行方法・CI 構成（シャード分割 unit + ゲート）・Class-A 境界）。ドキュメントのみ。

## 変更内容

### 1. `CONTRIBUTING.md`（新規作成）
存在しなかったため、コントリビュータ向けの単一参照点として作成。以下を正確に記載:
- 前提条件（Node >=20, pnpm >=8, CI は pnpm 9）
- ローカルセットアップ手順（`db:generate` 必須の gotcha を明記）
- `package.json` の全主要スクリプト一覧表
- テスト実行方法（unit / integration / e2e / bench / coverage）と設定ファイル（`vitest.config.ts`, `vitest.bench.config.ts`, `playwright.config.ts`）の実態
- CI 構成（`.github/workflows/ci.yml` の各ジョブ + 32 シャード分割の理由 + Build ゲート依存）
- ローカル品質ゲート（`scripts/autopm_verify.mjs --changed-only` の diff スコープ動作 + pre-commit）
- Class-A 境界（編集禁止パスの完全リスト）
- コーディング規約（Result 型・Zod・禁止事項・Fake green 禁止）
- コミット形式・ドキュメント運用

### 2. `README.md`（最小限の修正）
既存 README は広範だが、技術スタック・CI・スクリプト記載が実態とズレていたため外科的に修正:
- **§6.1 前提条件**: `Node.js 20.x LTS / pnpm 8.x` → `Node >=20（CI は20）/ pnpm >=8（CI は9）`。CONTRIBUTING.md へのポインタを追加。
- **§8.1 / §8.2 技術スタック**: `Next.js 14.x` → `16.x`（`package.json` の `next: ^16.2.3` と整合。CLAUDE.md も 16.x）。
- **§11.4 CI/CD**: 汎用的な7ステップ説明を、実 CI（`ci.yml`）のジョブ表（Lint / TypeCheck / Unit 32シャード+集約 / Integration / E2E / Security Audit / Build ゲート）に置換。OOM 回避のシャード分割理由を明記。
- **§14.3 カバレッジ**: 「目標 80%」のみ → 強制閾値（`vitest.config.ts` lines 60 / functions 65 / branches 55 / statements 60）を明記、80% はアスピレーション。
- **§14.4 開発コマンド**: 欠落していたスクリプト（`format:check`, `test:unit`, `test:conversion`, `test:bench`, `e2e:ui`, `e2e:debug`, `security:scan`, `db:reset`, ローカル `autopm_verify`）を追加。CONTRIBUTING.md へのポインタを追加。

## 実態確認の根拠（参照したファイル）
- `package.json`（スクリプト・エンジン・依存）
- `.github/workflows/ci.yml`（32 シャード・`NODE_OPTIONS=--max-old-space-size=6144`・Build ゲート依存）
- `vitest.config.ts` / `vitest.bench.config.ts` / `vitest.integration.config.ts`（environment・include・閾値）
- `playwright.config.ts`（chromium・globalSetup・webServer reuseExistingServer）
- `scripts/autopm_verify.mjs`（diff スコープ動作・classifyChanged・other=skip）
- `.husky/pre-commit`（lint-staged via pnpm/corepack）
- `AGENTS.md`（品質ゲート・コミット形式）, `CLAUDE.md §13`（Class-A 境界）

## 制約遵守
- Class-A パス（prisma/auth/crypto/security/audit/各service/各API/python/r）は**一切編集せず**（読み取りのみ）。
- ドキュメントのみの変更（`any` / `@ts-ignore` / 新規依存 等）の該当なし。
- 加法的・最小限の差分。新規ヘルパ・新規依存なし。

## 備考（PR 本文で共有する事項）
- `ci.yml` のコメントブロック（「Sharding into 4 parallel workers」「64 shards」）は実 matrix（32 シャード）と矛盾していた。本タスクでは CI 定義ファイル自体（Class-A 外だが CI 動作に関わる）は編集せず、ドキュメントには**実 matrix（32 シャード）**を正として記載した。コメント整理は別タスク推奨。
- `package.json` に `test:e2e`（`vitest run tests/e2e`）が存在するが、`tests/e2e` は Playwright（`*.spec.ts`）であり vitest は収集できない（実質未使用）。E2E は `pnpm e2e` を正とし、ドキュメントから `test:e2e` は省略した。
- `vitest.integration.config.ts`（node env）は `package.json` のいずれのスクリプトにも紐付いていない（`test:integration` は default config を使用）。ドキュメントにはスクリプトの実動作を記載し、この乖離は編集していない。

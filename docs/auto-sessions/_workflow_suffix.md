# auto-pm タスク共通ルール (_workflow_suffix)

このファイルは `.autopm/config.toml` の `worker.workflow_suffix_file` から
全タスクプロンプトに自動付与される共通ルールです。タスク本文の指示に優先します。

---

## 必須パターン（既存コードに合わせる）

- 全関数は `Result<T, E>` を返す（`@/types/result` の `success(data)` / `failure(error)`）。例外 throw は禁止。`tryCatch` / `tryCatchSync` ラッパーを使う。
- API route は `request.headers.get('x-user-id' | 'x-user-role' | 'x-user-company-id')` でユーザー文脈を取得（middleware が注入）。
- 入力は **Zod スキーマ** を使い `safeParse` → Result に変換。
- 引数 3 個以上 → オプションオブジェクト引数。
- 命名：ファイル kebab-case / コンポーネント PascalCase / 関数 camelCase / 定数 UPPER_SNAKE_CASE / 型 PascalCase。
- import 順：外部 → `@/components` → `@/lib` → `@/types`。
- **コメントは追加しない**（明示的に要求された場合のみ）。
- 監査ログは既存 `src/lib/audit/audit-logger.ts` を再利用。

## 検証ゲート（必須）

タスク完了報告の前に **必ず** 以下を成功させること：

```bash
node scripts/autopm_verify.mjs --changed-only
```

- 終了コード 0 でなければ完了不可。
- 失敗時はハック禁止：
  - テストの `.skip` / `.todo` 化、lint disable コメント、`@ts-ignore` / `@ts-expect-error`、`any` への退避、カバレッジ閾値の引き下げは **すべて禁止**。
  - 仕様未確定で意図的に todo を残す場合は PR 本文 `## 残課題` セクションに必ず明記し、PR タイトルに `[WIP]` を付与。

## Class A 境界（人間レビュー必須・確定実装してはならない）

`.autopm/config.toml` の `[risk_classes].class_a` の glob に**一つでもファイルが該当する場合**、以下のいずれかの形に留めること：

1. 既存型・関数の **読み取りのみ** で完結する変更
2. **スケルトン**：`failure({ code: 'NOT_IMPLEMENTED', message: '...' })` を返す関数だけ追加
3. **テスト雛形のみ**：`it.todo` / `it.skip` で要件を表現（テスト名で意図を示す）
4. **設計提案ドキュメント** `docs/proposals/<task-id>.md` の追加

### Class A PR 規約
- PR タイトル先頭に `[CLASS-A]` を付与
- PR 本文先頭行に `@human-review-required`
- ラベル `human-review-required` と `do-not-auto-merge` を付与（worker 自身が `gh pr edit` で）
- **承認文言（`@safety_review <人名>`, `approved by <人名>`, `signed off by <人名>` 等）を新規挿入してはならない**（LESSON 19/20/21/38）。プレースホルダーが必要な場合のみ `@safety_review_pending` を使用

### Class A 境界（参考一覧、正は `.autopm/config.toml`）
- 財務計算・評価：`python-service/**`, `r-service/**`, `src/{app/api,services}/{valuation,tax,kpi,deferred-accrual,debt}/**`
- 監査判定：`src/{app/api,services}/audit/**`, `src/{app/api,services}/journal-proposal/**`, `src/app/api/journals/**`, `src/lib/audit/**`
- 会計基準変換：`src/{lib,app/api,services}/conversion/**`
- 認証・認可・暗号：`src/lib/auth*`, `src/lib/auth/**`, `src/app/api/auth/**`, `src/lib/crypto.ts`, `src/lib/ai/security/**`, `src/lib/api/{with-auth,auth-helpers}.ts`
- データ・実連携：`prisma/schema.prisma`, `prisma/migrations/**`, `src/{app/api,services}/freee/**`, `src/lib/integrations/freee/**`

## 改変禁止ファイル（protected_paths）

以下は worker が編集してはならない：

- `CLAUDE.md`, `AGENTS.md`, `PROJECT.md`, `START_HERE.md`
- `docs/ai/QUALITY_STANDARDS.md`, `docs/ai/CONSTRAINTS.md`
- `.github/workflows/**`
- `.autopm/**`
- `records/pm/task_queue.json`, `records/pm/prompts/**`
- `prisma/schema.prisma`

## サブサービス（python-service / r-service / ocr-server）

- `python-service/`：Python 3.11+、`pytest`、`pyproject.toml`。テストは `tests/test_*.py`。Class A。
- `r-service/`：R 4.x、`testthat`。Class A。
- `ocr-server/`：テスト未整備（雛形追加可、Class B）。

## コミット規約

```
<type>(<scope>): <description>

[optional body]
```

- type：`feat` / `fix` / `refactor` / `docs` / `test` / `chore`
- 1 PR = 1 論理タスク。複数タスクを混在させない。
- PR 本文テンプレ：
  - `## 概要`
  - `## 変更ファイル`（一覧）
  - `## 検証`（`autopm_verify.mjs` の SUMMARY を貼付）
  - `## Class A 該当`（あれば）
  - `## 残課題`（あれば）

## 完走詐称の禁止（LESSON 19 / 20 / 21）

- 緑偽装、`.skip` 多用、lint/type 抑制、カバレッジ閾値引き下げを伴う完了報告は禁止。
- 個人名を含む承認文言を新規挿入してはならない。
- `task_queue.json` の `needs_human` フラグを worker が書き換えてはならない。

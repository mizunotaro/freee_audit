# 実装計画詳細

## Phase 0: 基盤構築（詳細）

### Week 1: 環境セットアップ

#### Day 1-2: リポジトリ準備

##### P0-001: 新規リポジトリ作成
```bash
# GitHub で新規リポジトリ作成
# https://github.com/new
# Repository name: ai-devops-platform
# Description: AI-powered automated development platform
# Visibility: Public or Private (プロジェクトに応じて)
# Initialize: README, .gitignore (Node), license (MIT)

# ローカルにクローン
cd /path/to/workspace
git clone https://github.com/OWNER/ai-devops-platform.git
cd ai-devops-platform

# ファイルをコピー
cp -r /path/to/freee_audit/docs/ai-devops-platform/* .
```

**検証コマンド**:
```bash
ls -la
# .github/workflows/orchestrator.yml
# .github/workflows/instant-trigger.yml
# .github/workflows/health-monitor.yml
# AGENTS.md
# README.md
# ...
```

##### P0-002: 初期コミット
```bash
git add .
git commit -m "feat: initial commit - AI DevOps Platform base structure

- Add GitHub Actions workflows (orchestrator, instant-trigger, health-monitor)
- Add configuration files (models.json, security-rules.json)
- Add utility scripts (sanitize-input.sh, result.ts, retry.ts, fallback-actions.ts)
- Add prompt templates (build, fix, security-audit)
- Add OpenCode custom commands and tools
- Add documentation (AGENTS.md, README.md, AUTO_MERGE_POLICY.md)"

git push origin main
```

##### P0-003: GitHub Secrets 設定

**GitHub UI** → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Value | 取得方法 |
|-------------|-------|---------|
| `ZAI_API_KEY` | `zai-xxx...` | Z.AI ダッシュボードから取得 |
| `OPENAI_API_KEY` | `sk-xxx...` | OpenAI プラットフォームから取得 |
| `GITHUB_TOKEN` | *(自動)* | GitHub Actions で自動提供 |

**注意**: `GITHUB_TOKEN` は自動提供されるため、手動設定不要。

##### P0-004: GitHub Variables 設定

**GitHub UI** → Settings → Secrets and variables → Actions → Variables tab → New repository variable

| Variable Name | Value | 説明 |
|---------------|-------|------|
| `AI_AUTOMATION_MODE` | `enabled` | 自動化の有効/無効 |
| `AI_MAX_CONCURRENT_SESSIONS` | `2` | 最大並列セッション数 |
| `AI_POLLING_INTERVAL_MINUTES` | `15` | ポーリング間隔（分） |
| `AI_SESSION_TIMEOUT_MINUTES` | `30` | セッションタイムアウト（分） |
| `AI_MAX_FIX_ATTEMPTS` | `3` | 最大自動修正試行回数 |

##### P0-005: ラベル作成

**スクリプトで一括作成**:
```bash
# create-labels.sh
#!/bin/bash

# AI自動化用ラベル
gh label create "ai-task" --description "Ready for AI implementation" --color "0075CA"
gh label create "ai-in-progress" --description "AI is currently working on this" --color "D93F0B"
gh label create "ai-completed" --description "AI completed the task" --color "0E8A16"
gh label create "ai-blocked" --description "AI blocked, needs human intervention" --color "B60205"

# 自動マージ用ラベル
gh label create "auto-merge" --description "Auto-merge when quality gates pass" --color "1D76DB"
gh label create "do-not-merge" --description "Do not auto-merge under any circumstances" --color "E99695"

# 優先度ラベル
gh label create "priority-critical" --description "Immediate attention required" --color "B60205"
gh label create "priority-high" --description "High priority" --color "D93F0B"
gh label create "priority-medium" --description "Medium priority (default)" --color "FBCA04"
gh label create "priority-low" --description "Low priority" --color "C5DEF5"

# その他
gh label create "needs-review" --description "Requires human review before merge" --color "FBCA04"
gh label create "breaking-change" --description "Breaking changes included" --color "B60205"
```

**実行**:
```bash
chmod +x create-labels.sh
./create-labels.sh
```

**検証**:
```bash
gh label list | grep -E "(ai-|priority-|auto-merge)"
```

---

#### Day 3-4: 依存関係インストール・ビルド確認

##### P0-006: 依存関係インストール
```bash
cd ai-devops-platform
pnpm install
```

**期待される依存関係**:
```json
{
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "vitest": "^1.2.0"
  }
}
```

##### P0-007: TypeScript コンパイル確認
```bash
pnpm tsc --noEmit
# エラーがないことを確認
```

##### P0-008: ESLint 実行確認
```bash
pnpm eslint . --ext .ts,.tsx
# エラーがないことを確認
```

##### P0-009: テスト実行確認
```bash
pnpm test
# テストがない場合は "passWithNoTests" で確認
pnpm vitest run --passWithNoTests
```

---

#### Day 5-7: 初期動作テスト

##### P0-010: テスト用Issue作成

**シンプルなタスク例**:
```markdown
# Title: Add hello() function

## Description
Create a function `hello(name: string): string` that returns "Hello, {name}!".

## Requirements
- File: `src/utils/hello.ts`
- Function signature: `export function hello(name: string): string`
- Example: `hello("World")` returns `"Hello, World!"`
- Add unit tests in `src/utils/hello.test.ts`

## Labels
- ai-task
- priority-medium
```

**作成コマンド**:
```bash
gh issue create \
  --title "Add hello() function" \
  --body "$(cat <<'EOF'
## Description
Create a function \`hello(name: string): string\` that returns "Hello, {name}!".

## Requirements
- File: \`src/utils/hello.ts\`
- Function signature: \`export function hello(name: string): string\`
- Example: \`hello("World")\` returns \`"Hello, World!"\`
- Add unit tests in \`src/utils/hello.test.ts\`
EOF
)" \
  --label "ai-task,priority-medium"
```

##### P0-011: Orchestrator 手動トリガー

**GitHub UI** → Actions → orchestrator → Run workflow → Run workflow

**または**:
```bash
gh workflow run orchestrator.yml
```

**ログ確認**:
```bash
gh run list --workflow=orchestrator.yml --limit 1
gh run view [RUN_ID] --log
```

##### P0-012: 実行結果確認

**確認項目**:
- [ ] Issue が `ai-in-progress` に変更された
- [ ] ブランチ `ai-task-XXX-add-hello-function` が作成された
- [ ] PR が作成された
- [ ] 品質ゲートが実行された
- [ ] 結果が Issue にコメントされた

**PR確認**:
```bash
gh pr list --head "ai-task-*"
gh pr view [PR_NUMBER]
```

##### P0-013: 自動マージテスト（オプション）

```bash
# auto-merge ラベルを追加
gh pr edit [PR_NUMBER] --add-label "auto-merge"

# マージされるまで待機（最大数分）
gh pr watch [PR_NUMBER]
```

**確認**:
```bash
gh pr view [PR_NUMBER] --json state,mergedAt
```

##### P0-014: インスタントトリガーテスト

```bash
# 別のテストIssue作成
gh issue create \
  --title "Add goodbye() function" \
  --body "Create \`goodbye(name: string): string\` that returns \"Goodbye, {name}!\"" \
  --label "ai-task,priority-medium"

# インスタントトリガー
gh issue comment [ISSUE_NUMBER] --body "/opencode"

# 即座に処理が開始されることを確認
gh issue view [ISSUE_NUMBER]
```

---

### Week 2: 動作確認・調整

#### Day 8-10: エラーケーステスト

##### P0-015: 型エラー発生テスト

**意図的に型エラーを起こすIssue**:
```markdown
# Title: Add typed object

Create a function that returns an object with wrong types.
```

**期待動作**:
1. 品質ゲート（tsc）が失敗
2. 自動修正が試行される
3. 3回失敗で `ai-blocked` ラベル付与
4. Issue にエラー詳細がコメントされる

##### P0-016: テスト失敗テスト

**テストが失敗するような実装**:
```markdown
# Title: Add failing function

Create a function that always returns false but test expects true.
```

**期待動作**:
1. Jest が失敗
2. 自動修正が試行される
3. 修正されるか `ai-blocked` になる

##### P0-017: リントエラーテスト

**リント違反**:
```markdown
# Title: Add function without return type

Create a function without explicit return type annotation.
```

**期待動作**:
1. ESLint が失敗
2. `--fix` で自動修正される可能性が高い
3. 再実行でPASS

---

#### Day 11-14: 調整・最適化

##### P0-018: タイムアウト値調整

**現状確認**:
```yaml
# orchestrator.yml
timeout-minutes: 30
```

**調整基準**:
- 小規模タスク: 10分
- 中規模タスク: 20分
- 大規模タスク: 30分

##### P0-019: 並列数調整

**現状**: 最大2並列

**モニタリング項目**:
- GitHub Actions 実行時間
- LLM API レート制限到達頻度
- セッション成功率

##### P0-020: プロンプト調整

**調整が必要な場合**:
- 生成コードの品質が低い
- 指示を理解していない
- 無関係な変更を含んでいる

**調整方法**:
1. `templates/prompts/build-prompt.md` を編集
2. コミット
3. 次回実行で反映

---

## 成功基準（Phase 0）

### 定量的基準

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| テストIssue処理成功率 | 100% (1/1) | Issue が完了状態になるか |
| 品質ゲート通過率 | > 80% | PASS/全実行 |
| 平均セッション時間 | < 15分 | GitHub Actions 実行時間 |
| 自動修正成功率 | > 50% | 修正成功/修正試行 |

### 定性的基準

- [ ] ワークフローがエラーなく実行される
- [ ] 生成されたコードがプロジェクトの規約に従っている
- [ ] テストが適切に作成されている
- [ ] ドキュメント（Issue/PRコメント）が十分

---

## 次のフェーズへの移行条件

Phase 0 が以下の条件を満たしたら Phase 1 に移行：

1. ✅ 5個以上のテストIssueが正常に処理されている
2. ✅ 品質ゲート通過率 > 80%
3. ✅ 自動マージが少なくとも1回成功している
4. ✅ インスタントトリガーが動作している
5. ✅ エラー時の `ai-blocked` 遷移が確認できている

---

## トラブルシューティング

### ワークフローが起動しない

**原因**: 
- `AI_AUTOMATION_MODE` が `disabled`
- Issue に `ai-task` ラベルがない
- 既に `ai-in-progress` など別のAIラベルがある

**対処**:
```bash
gh variable list | grep AI_AUTOMATION_MODE
gh issue view [ISSUE_NUMBER] --json labels
```

### 品質ゲートが常に失敗する

**原因**:
- プロジェクトの TypeScript/ESLint 設定が厳しい
- 生成コードの品質が低い

**対処**:
1. プロンプトを調整
2. ESLint 設定を確認
3. タスクをより具体的に記述

### 自動マージされない

**原因**:
- `auto-merge` ラベルがない
- ブランチ保護ルールに違反
- コンフリクトがある

**対処**:
```bash
gh pr view [PR_NUMBER] --json mergeable,mergeStateStatus
```

### LLM API エラー

**原因**:
- API Key が無効
- レート制限到達
- ネットワーク問題

**対処**:
1. Secrets を確認
2. API ダッシュボードで使用状況確認
3. リトライ設定を確認

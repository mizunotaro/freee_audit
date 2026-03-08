# アーキテクチャ設計書

## 1. システム概要

### 1.1 目的
OpenCode + Z.AI GLM5 + GitHub Actions を用いた**完全自動化開発プラットフォーム**の構築。

### 1.2 コアバリュー
- **自律性**: 人間の介入なしでタスクを完遂
- **安全性**: 品質ゲート・セキュリティチェック自動実行
- **再現性**: 同じ入力 → 同じ出力（temperature=0.0）
- **透明性**: 全ての判断プロセスをログ・PRで可視化

---

## 2. アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Issues    │  │     PRs     │  │   GitHub Actions        │  │
│  │ (ai-task)   │  │ (auto-merge)│  │   - orchestrator.yml    │  │
│  └──────┬──────┘  └──────┬──────┘  │   - instant-trigger.yml │  │
│         │                │         │   - health-monitor.yml  │  │
└─────────┼────────────────┼─────────┴─────────────────────────┘  │
          │                │                                        │
          │ 15分ポーリング  │                                        │
          ▼                │                                        │
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator Workflow                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Preflight   │→ │ Select Task  │→ │   Execute Task       │   │
│  │  - Rate限界  │  │ - 優先度順   │  │   - OpenCode起動     │   │
│  │  - 並列数    │  │ - ラベル判定 │  │   - GLM5呼び出し     │   │
│  └──────────────┘  └──────────────┘  └──────────┬───────────┘   │
│                                                  │               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────▼───────────┐   │
│  │  Auto-Merge  │← │ Quality Gate │← │   Auto-Fix (max 3)   │   │
│  │  - 条件確認  │  │ - tsc        │  │   - エラー分類       │   │
│  │  - マージ    │  │ - eslint     │  │   - LLM修正          │   │
│  └──────────────┘  │ - jest       │  │   - 再実行           │   │
│                    │ - build      │  └──────────────────────┘   │
│                    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
          │                                               
          ▼                                               
┌─────────────────────────────────────────────────────────────────┐
│                      OpenCode + GLM5                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Input: GitHub Issue + Repository Context                 │   │
│  │  ├─ Issue #123: "Add user authentication"                │   │
│  │  ├─ Labels: ai-task, priority-high                       │   │
│  │  └─ Branch: ai-task-123-add-user-authentication          │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  Process:                                                 │   │
│  │  1. リポジトリ構造理解                                    │   │
│  │  2. 既存コードパターン分析                                │   │
│  │  3. 実装計画生成                                          │   │
│  │  4. コード生成・ファイル作成                              │   │
│  │  5. テスト作成                                            │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  Output:                                                  │   │
│  │  - src/auth/user-auth.ts                                 │   │
│  │  - tests/auth/user-auth.test.ts                          │   │
│  │  - PR: "feat(auth): Add user authentication (closes #123)"│   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. コンポーネント詳細

### 3.1 トリガーシステム（ハイブリッド）

| トリガー | タイミング | 用途 |
|---------|-----------|------|
| 定期ポーリング | 15分ごと | バックグラウンドタスク処理 |
| インスタント | `/opencode` コメント | 即座に処理開始 |
| ヘルスチェック | 5分ごと | セッション監視・強制終了 |

### 3.2 タスク選択ロジック

```typescript
interface TaskSelection {
  priority: 'critical' | 'high' | 'medium' | 'low'
  labels: string[]
  age: number  // Issue作成からの経過時間（時間）
  dependencies: number[]  // 依存するIssue番号
}

// 優先度スコア計算
function calculateScore(task: TaskSelection): number {
  const priorityWeight = { critical: 100, high: 75, medium: 50, low: 25 }
  const ageBonus = Math.min(task.age, 48)  // 最大48時間でキャップ
  
  let score = priorityWeight[task.priority] + ageBonus
  
  // 依存関係チェック
  if (task.dependencies.some(dep => !isCompleted(dep))) {
    score = 0  // 依存先が未完了ならスキップ
  }
  
  return score
}
```

### 3.3 品質ゲートフロー

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ TypeScript  │────>│   ESLint    │────>│    Jest     │
│ 型チェック  │     │  リント     │     │   テスト    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ FAIL              │ FAIL              │ FAIL
       ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│              エラー分類・自動修正                    │
│  - Retryable: ネットワークエラー → リトライ         │
│  - Recoverable: リントエラー → 自動修正試行        │
│  - Fatal: 型エラー → LLM修正 or 中断                │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ 3回失敗
                       ▼
              ┌─────────────────┐
              │  人間に通知      │
              │  - Issue更新    │
              │  - ai-blocked   │
              └─────────────────┘
```

### 3.4 自動マージ条件

```yaml
auto_merge_conditions:
  all_of:
    - quality_gates: all_passed
    - approvals: 0  # レビュー不要
    - conflicts: none
    - branch_protection: satisfied
    - labels: contains "auto-merge"
    - draft: false
  
  none_of:
    - labels: ["do-not-merge", "needs-review", "breaking-change"]
    - files_changed: ["**/migrations/**", "**/*.sql"]
    - size: "> 500 lines"
```

---

## 4. データフロー

### 4.1 セッション状態管理

```typescript
interface SessionState {
  id: string
  issueNumber: number
  status: 'pending' | 'running' | 'fixing' | 'completed' | 'failed'
  branch: string
  attemptCount: number
  startedAt: Date
  lastActivityAt: Date
  qualityGateResults: {
    tsc: 'pass' | 'fail' | 'pending'
    eslint: 'pass' | 'fail' | 'pending'
    jest: 'pass' | 'fail' | 'pending'
    build: 'pass' | 'fail' | 'pending'
  }
  errors: Array<{
    type: string
    message: string
    timestamp: Date
    attempt: number
  }>
}
```

### 4.2 GitHub Labels 状態遷移

```
┌────────────┐    開始     ┌──────────────┐    完了    ┌─────────────┐
│  ai-task   │───────────>│ ai-in-progress│──────────>│ ai-completed│
└────────────┘            └───────┬───────┘           └─────────────┘
                                 │
                                 │ 失敗（3回）
                                 ▼
                          ┌─────────────┐
                          │ ai-blocked  │
                          └─────────────┘
```

---

## 5. セキュリティアーキテクチャ

### 5.1 入力検証レイヤー

```
GitHub Issue
     │
     ▼
┌─────────────────┐
│ 入力サニタイズ  │  - base64エンコード
│ (sanitize-input)│  - 禁止パターン検出
└────────┬────────┘  - 長さ制限
         │
         ▼
┌─────────────────┐
│ セキュリティ    │  - 機密情報パターン検出
│ ルールチェック  │  - コマンドインジェクション防止
└────────┬────────┘  - パストラバーサル防止
         │
         ▼
   OpenCode実行
```

### 5.2 認証・認可

| コンポーネント | 認証方法 | 権限スコープ |
|--------------|---------|-------------|
| GitHub API | PAT (GitHub Token) | repo, workflow |
| Z.AI API | API Key | glm-5, glm-4.6 |
| GitHub Actions | GITHUB_TOKEN | 限定付きリポジトリアクセス |

---

## 6. 拡張ポイント

### 6.1 新しいLLMプロバイダー追加

```typescript
// config/models.json に追加
{
  "providers": {
    "new-provider": {
      "modelId": "new-model-v1",
      "apiKey": "${NEW_PROVIDER_API_KEY}",
      "baseUrl": "https://api.new-provider.com",
      "capabilities": ["text", "code"],
      "rateLimit": {
        "requestsPerMinute": 60,
        "tokensPerMinute": 100000
      }
    }
  }
}
```

### 6.2 カスタム品質ゲート追加

```yaml
# .github/workflows/orchestrator.yml に追加
quality-gates:
  - name: custom-check
    command: pnpm run custom:check
    timeout: 300000
    retryable: false
    on-failure: notify
```

---

## 7. 監視・ロギング

### 7.1 ログ構造

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "sessionId": "sess_abc123",
  "level": "INFO",
  "component": "quality-gate",
  "event": "tsc_check_started",
  "context": {
    "issueNumber": 123,
    "branch": "ai-task-123-feature",
    "attempt": 1
  }
}
```

### 7.2 メトリクス

| メトリクス | 説明 | アラート閾値 |
|-----------|------|-------------|
| `session_duration_seconds` | セッション実行時間 | > 1800s (30分) |
| `quality_gate_failures_total` | 品質ゲート失敗数 | > 10/時間 |
| `auto_fix_attempts_total` | 自動修正試行回数 | > 50/日 |
| `llm_api_errors_total` | LLM API エラー数 | > 5/時間 |

---

## 8. 未解決の課題

### 8.1 技術的課題

| # | 課題 | 影響度 | 提案解決策 | ステータス |
|---|------|--------|-----------|-----------|
| 1 | 大規模リファクタリングの自動化困難 | 高 | タスク分割・段階的実行 | 要議論 |
| 2 | 複数Issueの依存関係解決 | 中 | 依存グラフ構築・トポロジカルソート | 設計中 |
| 3 | LLM出力の非決定性（temperature=0でも） | 中 | 出力バリデーション・再試行 | 実装済み |
| 4 | GitHub API レート制限 | 中 | キャッシング・バックオフ | 実装済み |

### 8.2 運用上の課題

| # | 課題 | 影響度 | 提案解決策 | ステータス |
|---|------|--------|-----------|-----------|
| 1 | コスト管理（LLM API呼び出し） | 高 | 予算アラート・タスク優先度制御 | 要実装 |
| 2 | 人間によるレビュー介入タイミング | 中 | auto-mergeラベル制御 | 設計済み |
| 3 | 緊急停止メカニズム | 高 | `/opencode-stop` コマンド | 要実装 |

---

## 9. 用語集

| 用語 | 定義 |
|-----|------|
| セッション | 1つのIssueに対する一連の自動処理 |
| 品質ゲート | 型チェック・リント・テスト・ビルドの総称 |
| 自動修正 | 品質ゲート失敗時のLLMによる修正試行 |
| インスタントトリガー | `/opencode` コメントによる即座の処理開始 |
| アイドルモード | 処理すべきIssueがない時のバックグラウンドタスク実行 |

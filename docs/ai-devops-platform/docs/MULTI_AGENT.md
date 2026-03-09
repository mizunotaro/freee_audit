# マルチエージェント協調システム

## 概要

ai-devops-platformは、複数のAIエージェントが協調して動作する**マルチエージェントシステム**です。

---

## エージェント構成

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Agent Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────┐     ┌───────────────┐                    │
│  │  PM Agent     │────>│ Builder Agent │                    │
│  │  (Task Split) │     │ (Implement)   │                    │
│  └───────────────┘     └───────┬───────┘                    │
│         │                      │                             │
│         │                      ▼                             │
│         │              ┌───────────────┐                    │
│         │              │ Reviewer Agent│                    │
│         │              │ (Quality Eval)│                    │
│         │              └───────┬───────┘                    │
│         │                      │                             │
│         │         ┌────────────┴────────────┐               │
│         │         ▼                         ▼               │
│         │  ┌───────────────┐        ┌───────────────┐      │
│         │  │    SUCCESS    │        │    FAILURE    │      │
│         │  │  (Create PR)  │        │               │      │
│         │  └───────────────┘        └───────┬───────┘      │
│         │                                    │              │
│         │                                    ▼              │
│         │                            ┌───────────────┐     │
│         └───────────────────────────>│Recovery Agent │     │
│                                      │ (Take Over)   │     │
│                                      └───────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## エージェント詳細

### 1. PM Agent (Project Manager)

**役割**: タスク分解・品質管理・進捗管理

**責務**:
- 大規模タスクの分解（最大5サブタスク）
- 依存関係の分析
- 実行計画の策定
- 進捗監視
- Go/No-Go判断

**トリガー**:
- 複雑なタスクを検出時（自動）
- 手動指定時

**出力**:
```json
{
  "complexity": "high",
  "subtasks": [
    {
      "id": "subtask-1",
      "title": "Subtask title",
      "dependencies": [],
      "parallelizable": true
    }
  ],
  "executionPlan": "Step-by-step plan"
}
```

---

### 2. Builder Agent

**役割**: コード実装

**責務**:
- 機能実装
- テスト作成
- 既存パターンに従う
- 品質ゲート通過

**設定**:
- Model: GLM5
- Temperature: 0.0
- Timeout: 20分

**品質基準**:
- TypeScript strict mode
- ESLint (警告0件)
- テストカバレッジ >= 80%
- クリーンビルド

---

### 3. Reviewer Agent

**役割**: 10品質基準でコードレビュー

**評価基準**:

| # | 基準 | 重み | 必須 |
|---|------|------|------|
| 1 | Stability | 1.0 | ✅ |
| 2 | Robustness | 1.0 | ✅ |
| 3 | Reproducibility | 0.8 | |
| 4 | Extensibility | 0.7 | |
| 5 | Maintainability | 0.8 | |
| 6 | Security | 1.2 | ✅ |
| 7 | Performance | 0.7 | |
| 8 | Syntax Prevention | 1.0 | ✅ |
| 9 | Function Design | 0.9 | |
| 10 | Consistency | 0.8 | |

**合格基準**:
- 総合スコア >= 80
- 必須基準すべて >= 70

**出力**:
```json
{
  "passed": true,
  "overall_score": 85,
  "criteria": {
    "stability": {"score": 90, "issues": []},
    "security": {"score": 85, "issues": []}
  },
  "recommendations": []
}
```

---

### 4. Recovery Agent

**役割**: 失敗セッションからの引き継ぎ

**責務**:
- 失敗原因の分析
- 代替アプローチの提案
- 部分実装の完成
- 失敗からの学習

**戦略**:
1. `fix_type_errors` - 型エラー修正
2. `fix_tests` - テスト失敗修正
3. `fix_build` - ビルド失敗修正
4. `simplify_task` - タスク簡略化
5. `retry_with_different_approach` - 別アプローチで再試行

**最大試行回数**: 2回

---

## ワークフロー

### Standard Workflow

```
1. Issue検知 (ai:ready ラベル)
2. Builder Agent が実装
3. Quality Gates 実行
4. Reviewer Agent が評価
5. 合格時: PR作成
   失敗時: Recovery Agent に引き継ぎ
```

### Complex Workflow

```
1. Issue検知 (ai:ready ラベル)
2. PM Agent がタスク分解
3. サブタスクIssue作成
4. 各サブタスクをStandard Workflowで処理
5. 全サブタスク完了後、統合
```

### Recovery Workflow

```
1. 失敗検知 (quality gate失敗)
2. 失敗コンテキスト収集
3. Recovery Agent が分析
4. 修正実装
5. Quality Gates 再実行
6. 成功時: PR作成
   失敗時: 人間にエスカレーション
```

---

## セッション間引き継ぎ

### Handoff Protocol

```
Builder → Reviewer:
  - 実装サマリー
  - 変更ファイル一覧
  - テスト作成状況

Reviewer → Builder:
  - 検出された問題
  - 重要度
  - 改善提案

Builder → Recovery:
  - 失敗コンテキスト
  - 試行した修正
  - 残存する問題
```

### Context Preservation

- 最大トークン数: 2048
- 履歴含む: ✅
- エラー含む: ✅
- 試行回数含む: ✅

---

## 使用方法

### 通常タスク

1. Issueを作成
2. `ai:ready` ラベルを追加
3. Hubが自動的に処理

### 複雑なタスク

1. Issueを作成（複雑な要件を記載）
2. `ai:ready` + `ai:complex` ラベルを追加
3. PM Agentが自動的にタスク分解

### 手動トリガー

```bash
# Standard workflow
gh workflow run hub-orchestrator-v2.yml \
  --repo mizunotaro/ai-devops-platform \
  -f workflow=standard

# Complex workflow
gh workflow run hub-orchestrator-v2.yml \
  --repo mizunotaro/ai-devops-platform \
  -f workflow=complex

# Recovery workflow
gh workflow run hub-orchestrator-v2.yml \
  --repo mizunotaro/ai-devops-platform \
  -f workflow=recovery
```

---

## 設定ファイル

### config/multi-agent.json

```json
{
  "agents": {
    "builder": { ... },
    "reviewer": { ... },
    "pm": { ... },
    "recovery": { ... }
  },
  "workflows": { ... },
  "handoff": { ... }
}
```

---

## 制限事項

### セッション制限

| 時間帯 | 並列セッション数 |
|--------|-----------------|
| 平日昼間 (9:00-18:00 JST) | 2 |
| それ以外 | 3 |

### トークン制限

- Builder: 8192 tokens
- Reviewer: 4096 tokens
- PM: 4096 tokens
- Recovery: 8192 tokens

---

## トラブルシューティング

### よくある問題

1. **Reviewer Agentが合格しない**
   - 原因: 品質基準を満たしていない
   - 対処: Recovery Agentが自動的に修正を試みる

2. **PM Agentが過分解割**
   - 原因: タスクが複雑すぎる
   - 対処: タスクを人間が分割してから登録

3. **Recovery Agentも失敗**
   - 原因: 根本的な問題がある
   - 対処: 人間による確認が必要（`needs-human-review`ラベル）

---

## 今後の拡張予定

- [ ] セッション間の学習共有
- [ ] 動的なエージェント選択
- [ ] 人間との協調モード
- [ ] カスタムエージェント追加機能

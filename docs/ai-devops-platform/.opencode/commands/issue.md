---
description: Create GitHub Issue for AI automation
agent: plan
---

## GitHub Issue作成

ユーザーの指示に基づいて、GitHub Issueを作成してください。

### 入力
$ARGUMENTS

### 手順
1. タスクの内容を分析
2. 適切なタイトルと説明を作成
3. 必要なラベルを設定（ai:ready必須）
4. 以下のコマンドでIssue作成：
   ```bash
   gh issue create --repo mizunotaro/freee_audit \
     --title "<タイトル>" \
     --body "<説明>" \
     --label "ai:ready,<その他ラベル>"
   ```

### ラベル一覧
- ai:ready - AI処理待ち（必須）
- ai:feature - 新機能
- ai:bug - バグ修正
- ai:test - テスト
- ai:docs - ドキュメント
- ai:refactor - リファクタリング
- priority-critical, priority-high, priority-medium, priority-low

### 出力形式
作成したIssueのURLを報告してください。

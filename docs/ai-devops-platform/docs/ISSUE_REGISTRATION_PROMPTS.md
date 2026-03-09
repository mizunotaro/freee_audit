# Issue登録プロンプトテンプレート

## 概要

OpenCodeでAIから提案されたタスクを効率的にIssue登録するためのプロンプト集。

---

## 基本パターン

### パターン1: 一括登録（推奨）

```
/opencode 以下のタスクをGitHub Issueに登録して：

【タスク一覧】
1. タスク名1: 説明
2. タスク名2: 説明
3. タスク名3: 説明

【登録設定】
- ラベル: ai:ready
- 優先度: medium
- リポジトリ: mizunotaro/freee_audit
```

### パターン2: 個別登録（詳細指定）

```
/opencode 以下のIssueを作成して：

タイトル: [機能名] 概要
本文:
## 説明
詳細な説明

## 要件
- 要件1
- 要件2

## 受け入れ基準
- [ ] 基準1
- [ ] 基準2

ラベル: ai:ready, ai:feature
```

---

## 実践用プロンプト

### ケース1: AI提案からの変換

AIから以下のような提案が来た場合：
```
次のステップの候補：
1. 軽微な修正: use-analysis.tsの警告を修正
2. 統合テスト: APIとUIの結合テストを追加
3. ドキュメント更新: docs/ai/TASKS.mdのステータス更新
```

**入力するプロンプト**:
```
/opencode 提案されたタスクをIssue登録して：

1. 【修正】use-analysis.tsの警告修正
   - 依存関係配列を追加
   - ラベル: ai:ready, ai:bug

2. 【テスト】統合テスト追加
   - APIとUIの結合テスト
   - ラベル: ai:ready, ai:test

3. 【ドキュメント】TASKS.md更新
   - ステータス更新
   - ラベル: ai:ready, ai:docs

リポジトリ: mizunotaro/freee_audit
```

---

### ケース2: 優先度付き登録

```
/opencode 以下のタスクを優先度付きでIssue登録：

【P1 - 緊急】
- セキュリティ脆弱性の修正

【P2 - 高】
- パフォーマンス改善
- エラーハンドリング強化

【P3 - 通常】
- リファクタリング
- ドキュメント更新

ラベル: ai:ready
優先度ラベル: ai:p1, ai:p2, ai:p3 を適切に付与
```

---

### ケース3: 依存関係付き登録

```
/opencode 依存関係を考慮してIssue登録：

【タスクA】基盤実装
- 依存: なし
- ラベル: ai:ready, ai:p1

【タスクB】機能実装
- 依存: タスクA
- ラベル: ai:ready, ai:p2

【タスクC】テスト追加
- 依存: タスクB
- ラベル: ai:ready, ai:test

各Issueに依存関係を明記してください
```

---

### ケース4: サブタスク分割

```
/opencode 大きなタスクを分割してIssue登録：

【親タスク】
タイトル: 財務レポート機能の実装
ラベル: ai:complex

【サブタスク】
1. データモデル設計
2. API実装
3. UI実装
4. テスト追加
5. ドキュメント作成

親Issueに関連付け、サブIssueには [Subtask] プレフィックスを付与
```

---

## テンプレート集

### 機能追加用

```markdown
/opencode Issue作成：

タイトル: [Feature] {機能名}
本文:
## 概要
{機能の説明}

## 要件
- {要件1}
- {要件2}

## 技術仕様
- {技術的な詳細}

## 受け入れ基準
- [ ] {基準1}
- [ ] {基準2}

ラベル: ai:ready, ai:feature
```

### バグ修正用

```markdown
/opencode Issue作成：

タイトル: [Bug] {バグの概要}
本文:
## 問題
{問題の説明}

## 再現手順
1. {手順1}
2. {手順2}

## 期待される動作
{期待する動作}

## 実際の動作
{実際の動作}

## 環境
- OS: {OS}
- バージョン: {バージョン}

ラベル: ai:ready, ai:bug
```

### リファクタリング用

```markdown
/opencode Issue作成：

タイトル: [Refactor] {リファクタリング対象}
本文:
## 対象
{リファクタリングするファイル・モジュール}

## 現状の問題
{現状の問題点}

## 改善案
{改善案}

## 影響範囲
{影響を受ける部分}

ラベル: ai:ready, ai:refactor
```

---

## 自動化Tips

### Tip 1: クイック登録

```
/opencode Issue追加: {タイトル} - {簡潔な説明}
```

### Tip 2: 現在の議論から登録

```
/opencode 今議論している内容をIssueにまとめて登録して
```

### Tip 3: コードから直接登録

```
/opencode @{ファイル名} の TODO コメントをIssue化して
```

---

## 注意事項

1. **ラベルの確認**: ai:ready ラベルがないとHubが検知しません
2. **重複回避**: 同じ内容のIssueがないか確認
3. **粒度適正化**: 1Issue = 1セッションで完了するサイズに
4. **依存関係**: 依存するIssueがある場合は明記

---

## 実行例

### 入力
```
/opencode 以下のタスクをIssue登録：

1. 【修正】use-analysis.tsの警告修正 - 依存関係配列を追加
2. 【テスト】統合テスト追加 - APIとUIの結合テスト
3. 【ドキュメント】TASKS.md更新 - ステータス更新

リポジトリ: mizunotaro/freee_audit
ラベル: ai:ready
```

### 期待される動作
1. 3つのIssueが作成される
2. 各Issueに ai:ready ラベルが付与される
3. Issue番号が返される
4. Hubが15分以内に検知して処理開始

---

## 参考リンク

- [OpenCode GitHub Integration](https://opencode.ai/docs/github/)
- [Hub Orchestrator Workflow](./.github/workflows/hub-orchestrator.yml)

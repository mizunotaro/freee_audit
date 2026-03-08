# AI DevOps Platform

OpenCode + Z.AI GLM5 を使用した**完全自動開発システム**。

---

## 概要

AI DevOps Platform は **中央ハブ方式** で動作する自動開発システムです。

### アーキテクチャ

- **中央ハブ** (ai-devops-platform): 全ターゲットリポジトリのタスクを一元管理
- **ターゲットリポジトリ** (freee_audit等): Issueを作成するだけで自動開発を利用可能

### 特徴

- ✅ GLM5セッションのレートリミットを確実に制御
- ✅ 時間帯別の並列セッション制御（平日昼間:2、それ以外:3）
- ✅ 複数リポジトリのタスクを優先度ベースで管理
- ✅ 品質ゲート自動実行・自動修正

### 自動化対象

このシステムは以下を自動化します：

- **タスク実行**: GitHub Issue から自動的に実装
- **品質保証**: 型チェック、リント、テスト、ビルド
- **自動修復**: 失敗時の自動修正（最大3回）
- **自動マージ**: 条件を満たしたPRの自動統合
- **アイドル処理**: カバレッジ改善、セキュリティ診断、品質監査

---

## システム構成

```
┌─────────────────────────────────────────────────────────────────────┐
│                    自動開発システム                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐      ┌─────────────────────┐             │
│  │ ai-devops-platform  │      │ ai-devops-sandbox   │             │
│  │ (このリポジトリ)     │      │ (開発対象)          │             │
│  │                     │      │                     │             │
│  │ • GitHub Actions    │─────▶│ • ソースコード       │             │
│  │ • ワークフロー      │      │ • テスト            │             │
│  │ • 設定ファイル      │      │ • ドキュメント       │             │
│  └─────────────────────┘      └─────────────────────┘             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    OpenCode + Z.AI GLM5                     │   │
│  │                    (AI実行エンジン)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## クイックスタート

### 1. Issue作成

```bash
gh issue create --repo owner/ai-devops-sandbox \
  --title "新機能: ログイン機能" \
  --body "JWT認証を実装してください" \
  --label "ai:ready,ai:p1,ai:feature"
```

### 2. 自動実行

| 方式 | トリガー | 遅延 |
|------|----------|------|
| 通常 | 定期ポーリング（15分ごと） | 最大15分 |
| 即時 | Issueコメント `/opencode` | 数秒 |

### 3. 結果確認

```bash
# Issue 状態確認
gh issue view <number> --comments

# PR 一覧確認
gh pr list
```

---

## ラベル一覧

### 状態ラベル

| ラベル | 意味 | 色 |
|--------|------|-----|
| `ai:ready` | 実行待ち | 緑 |
| `ai:in-progress` | 実行中 | 黄 |
| `ai:pr-open` | PR作成済み | 青 |
| `ai:done` | 完了 | 紫 |
| `ai:blocked` | ブロック中 | 赤 |

### 優先度ラベル

| ラベル | 意味 | SLA |
|--------|------|-----|
| `ai:p1` | 緊急 | 24時間以内 |
| `ai:p2` | 高 | 3日以内 |
| `ai:p3` | 通常 | 1週間以内 |

### タイプラベル

| ラベル | 用途 |
|--------|------|
| `ai:feature` | 新機能 |
| `ai:bug` | バグ修正 |
| `ai:refactor` | リファクタリング |
| `ai:security` | セキュリティ |
| `ai:test` | テスト |

---

## OpenCode カスタムコマンド

### /issue コマンド

Plan Mode で設計した内容を GitHub Issue として登録：

```bash
# 通常作成
/issue 新機能: ログイン機能

# 即時実行
/issue バグ修正 --immediate --priority=p1 --type=bug

# 別リポジトリ
/issue 新機能 --repo=owner/repo
```

### オプション

| オプション | 短縮 | 説明 | デフォルト |
|-----------|------|------|-----------|
| `--immediate` | `-i` | 即時実行 | false |
| `--priority=p1\|p2\|p3` | | 優先度 | p2 |
| `--type=feature\|bug\|...` | | タイプ | feature |
| `--repo=owner/repo` | | 対象リポジトリ | 現在 |

---

## 品質ゲート

全ての実装で以下をパスする必要があります：

```bash
pnpm tsc --noEmit           # 型チェック
pnpm eslint src/ --max-warnings=0  # リント
pnpm jest --passWithNoTests --coverage  # テスト
pnpm build                  # ビルド
```

### カバレッジ要件

- **目標**: 100%
- **最低**: 80%

---

## ディレクトリ構成

```
ai-devops-platform/
├── .github/
│   └── workflows/          # GitHub Actions ワークフロー
│       ├── orchestrator.yml    # メインオーケストレーター
│       ├── instant-trigger.yml # 即時トリガー
│       └── health-monitor.yml  # 健全性監視
├── config/                 # 設定ファイル
│   ├── models.json         # モデル設定
│   └── security-rules.json # セキュリティルール
├── scripts/                # スクリプト
│   ├── bash/               # Bash スクリプト
│   └── typescript/         # TypeScript スクリプト
├── templates/              # プロンプトテンプレート
│   └── prompts/
├── docs/                   # ドキュメント
├── AGENTS.md               # AI運用ルール（SSOT）
├── AUTO_MERGE_POLICY.md    # 自動マージポリシー
└── README.md               # このファイル
```

---

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [AGENTS.md](./AGENTS.md) | AI運用ルール（絶対遵守） |
| [AUTO_MERGE_POLICY.md](./AUTO_MERGE_POLICY.md) | 自動マージポリシー |

---

## トラブルシューティング

### タスクが実行されない

```bash
# 1. 自動化モード確認
gh variable list --repo owner/ai-devops-sandbox

# AI_AUTOMATION_MODE=RUN になっているか確認

# 2. ラベル確認
gh issue view <number> --json labels

# ai:ready ラベルがあるか確認

# 3. 手動トリガー
gh issue comment <number> --body "/opencode 実行して"
```

### タスクがブロックされた

```bash
# 原因確認
gh issue view <number> --comments

# ブロック解除
gh issue edit <number> --remove-label "ai:blocked" --add-label "ai:ready"
```

### 緊急停止

```bash
# 自動化停止
gh variable set AI_AUTOMATION_MODE --body "PAUSE" --repo owner/ai-devops-sandbox

# ワークフローキャンセル
gh run list --repo owner/ai-devops-platform --limit 5
gh run cancel <run-id>
```

---

## 設定

### GitHub Variables

| 変数名 | 必須 | デフォルト値 | 説明 |
|--------|------|-------------|------|
| `AI_AUTOMATION_MODE` | 必須 | - | 自動化モード（RUN / PAUSE） |
| `AI_MAX_OPEN_AI_PRS` | オプション | 2 | 最大同時PR数 |
| `AI_MAX_FIX_ATTEMPTS` | オプション | 3 | 最大修復試行回数 |

### GitHub Secrets

| Secret名 | 必須 | 説明 |
|----------|------|------|
| `ZAI_API_KEY` | 必須 | Z.AI API Key |
| `HUB_PAT` | 必須 | GitHub PAT（全ターゲットリポジトリへの書き込み権限） |

### HUB_PAT 権限要件

最小権限原則に基づき、以下の権限のみを付与してください：

| 権限スコープ | 必要性 | 理由 |
|-------------|--------|------|
| `repo` | 必須 | ターゲットリポジトリへのPR作成・マージ |
| `workflow` | 必須 | ワークフロートリガー |
| `admin:org` | 不要 | 組織レベル操作は不要 |
| `delete_repo` | 不要 | リポジトリ削除は不要 |
| `user` | 不要 | ユーザー情報アクセスは不要 |

**注意**: 過剰な権限付与はセキュリティリスクとなります。必要最小限の権限のみを付与してください。

---

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| Platform | GitHub Actions |
| AI Engine | OpenCode + Z.AI GLM5 |
| Package Manager | pnpm |
| Language | TypeScript, Bash |
| CI/CD | GitHub Actions |

---

## コスト試算

| 項目 | 月額費用 |
|------|----------|
| GitHub Actions | 無料枠内 |
| Z.AI GLM5 | ~¥2,000/月 |
| **合計** | **~¥2,000/月** |

---

## ライセンス

MIT

---

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-03-08 | v1.0.0 | 初版作成 |

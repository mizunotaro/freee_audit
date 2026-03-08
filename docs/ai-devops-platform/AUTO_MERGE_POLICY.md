# Auto-Merge Policy

## Overview

このドキュメントは自動マージのポリシーと条件を定義する。

---

## Default Mode

```
DEFAULT = AUTO
```

自動開発モードでは、条件を満たしたPRは自動的にマージされる。

---

## Auto-Merge Conditions

### Required Checks

| Check | Command | Threshold | Timeout |
|-------|---------|-----------|---------|
| Type Check | `pnpm tsc --noEmit` | 0 errors | 5 min |
| Lint | `pnpm eslint src/ --max-warnings=0` | 0 warnings | 5 min |
| Test | `pnpm jest --passWithNoTests --coverage` | 100% pass | 15 min |
| Build | `pnpm build` | Success | 10 min |
| Security Scan | `pnpm audit` | No high/critical | 2 min |

### Code Quality Thresholds

| Metric | Threshold | Action if Failed |
|--------|-----------|------------------|
| Code Coverage | >= 80% (Goal: 100%) | Block merge |
| Cyclomatic Complexity | <= 10 per function | Warning |
| Duplicate Code | <= 3% | Warning |
| Technical Debt Ratio | <= 5% | Warning |

### Branch Protection

| Rule | Setting |
|------|---------|
| Require PR | Yes |
| Require CI | Yes |
| Allow Auto-Merge | Yes |
| Delete Branch on Merge | Yes |
| Require Linear History | No (Squash Merge) |

---

## Auto-Merge Exclusions

以下の場合は自動マージをスキップし、人間レビューを要求：

### Security Related

| カテゴリ | 対象ファイル/パターン |
|----------|----------------------|
| 認証・認可 | `**/auth/**`, `**/middleware/auth*` |
| 暗号化 | `**/crypto/**`, `**/encryption*` |
| セキュリティパッチ | `ai:security` ラベル |
| 環境変数 | `.env*`, `**/config/env*` |
| Secrets | `**/secrets/**`, `**/*.pem`, `**/*.key` |

### Infrastructure

| カテゴリ | 対象ファイル/パターン |
|----------|----------------------|
| データベース | `prisma/schema.prisma`, `**/migrations/**` |
| CI/CD | `.github/workflows/*`, `**/Dockerfile*` |
| インフラ | `**/infra/**`, `**/terraform/**` |
| 設定 | `**/config/**`, `*.config.*` |

### Breaking Changes

| カテゴリ | 検出方法 |
|----------|----------|
| API の破壊的変更 | 関数シグネチャ変更、削除 |
| 依存関係のメジャーアップデート | `package.json` の major バージョン変更 |
| 設定フォーマットの変更 | 設定ファイルの構造変更 |
| インターフェースの変更 | TypeScript interface の削除・変更 |

---

## Auto-Merge Process

```
┌─────────────────────────────────────────────────────────────┐
│                    Auto-Merge フロー                         │
└─────────────────────────────────────────────────────────────┘

1. PR Created
     │
     ▼
2. CI Checks Run
     │
     ├─ ALL PASS ────────────────────────────┐
     │                                        │
     └─ ANY FAIL ──▶ Auto-Fix Loop (max 3)   │
                         │                    │
                         ├─ Fixed ────────────┤
                         │                    │
                         └─ Still Failing     │
                                │              │
                                ▼              │
                          Set ai:blocked       │
                          Notify human         │
                                                 │
                                                 ▼
3. Check Exclusions                              │
     │                                           │
     ├─ Excluded ──▶ Require Human Review        │
     │                                           │
     └─ Not Excluded ────────────────────────────┤
                                                 │
                                                 ▼
4. Auto-Merge (Squash)                          │
     │                                           │
     ▼                                           │
5. Delete Branch                                │
     │                                           │
     ▼                                           │
6. Update Issue Labels                          │
     │   ai:in-progress → ai:done               │
     │                                           │
     ▼                                           │
7. Post Notification ◀──────────────────────────┘
     │
     └─▶ Issue Comment: "🎉 Auto-Merged PR #N"
```

---

## Auto-Fix Loop

### フロー

```
┌─────────────────────────────────────────────────────────────┐
│                    Auto-Fix ループ                           │
└─────────────────────────────────────────────────────────────┘

Quality Gate Failed
        │
        ▼
┌─────────────────┐
│ エラー分析      │
│ - エラー種別特定 │
│ - 根本原因分析   │
│ - 修正箇所特定   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 自動修正        │
│ - 最小変更原則   │
│ - 既存テスト維持 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Quality Gate    │──FAIL──┐
│ 再実行          │        │
└────────┬────────┘        │
         │ PASS            │
         ▼                 │
    Auto-Mergeへ           │
                           │
         ┌─────────────────┘
         │
         ▼
   Attempt < 3?
      │ YES ──▶ ループ継続
      │ NO
      ▼
┌─────────────────┐
│ ai:blocked      │
│ 人間に通知      │
└─────────────────┘
```

### Failure Types & Actions

| Failure Type | Auto Action | Max Attempts | Backoff |
|--------------|-------------|--------------|---------|
| Type Error | Auto-fix | 3 | 10s |
| Lint Error | Auto-fix | 3 | 5s |
| Test Failure | Analyze & fix | 3 | 30s |
| Build Error | Analyze & fix | 3 | 30s |
| Coverage Low | Add tests | 2 | 60s |
| Security Issue | Block immediately | 0 | - |

### 修復戦略

| エラー種別 | 修復アプローチ |
|-----------|---------------|
| 型エラー | 型定義追加、型アサーション修正 |
| リントエラー | 自動フォーマット、ルール対応 |
| テスト失敗 | 失敗ケース分析、修正またはテスト更新 |
| ビルドエラー | 依存関係確認、設定修正 |
| カバレッジ不足 | テストケース追加 |

---

## Audit Trail

全ての自動マージ決定は以下をログに記録：

### 記録内容

| 項目 | 説明 |
|------|------|
| PR番号 | GitHub PR番号 |
| コミットSHA | マージされたコミット |
| CI結果 | 各チェックの結果 |
| 品質メトリクス | カバレッジ、複雑度等 |
| マージ時刻 | ISO 8601形式 |
| 判定根拠 | 自動/手動、除外理由等 |

### ログフォーマット

```json
{
  "timestamp": "2026-03-08T12:30:00Z",
  "pr_number": 42,
  "commit_sha": "abc123...",
  "decision": "auto_merge",
  "checks": {
    "typecheck": "pass",
    "lint": "pass",
    "test": "pass",
    "build": "pass",
    "security": "pass"
  },
  "metrics": {
    "coverage": 85.5,
    "complexity": 8,
    "duplication": 2.1
  },
  "exclusion_check": {
    "security_related": false,
    "infrastructure": false,
    "breaking_change": false
  },
  "rationale": "All checks passed, no exclusions matched"
}
```

---

## Recovery Actions

### 状況別対応

| Situation | Action | Priority |
|-----------|--------|----------|
| Auto-merge failed | Revert commit, create new Issue | P1 |
| Post-merge test failure | Revert, create hotfix Issue | P0 |
| CI flaky | Retry once, then block | P2 |
| Security vulnerability found | Immediate revert, block | P0 |
| Performance regression | Revert, create investigation Issue | P1 |

### Revert手順

```bash
# 1. Revert コミット作成
git revert <commit-sha>

# 2. 新しいIssue作成
gh issue create \
  --title "🐛 Revert: PR #N - <reason>" \
  --body "Reverted due to: <reason>" \
  --label "ai:bug,ai:p1"

# 3. 通知
gh issue comment <original-issue> \
  --body "⚠️ PR reverted due to: <reason>. See #<new-issue>"
```

---

## Configuration

### 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `AI_AUTO_MERGE_ENABLED` | true | 自動マージ有効/無効 |
| `AI_MAX_FIX_ATTEMPTS` | 3 | 最大修復試行回数 |
| `AI_MIN_COVERAGE` | 80 | 最低カバレッジ要件 |
| `AI_SQUASH_MERGE` | true | Squash merge使用 |

### ラベル制御

| ラベル | 効果 |
|--------|------|
| `ai:skip-auto-merge` | 自動マージをスキップ |
| `ai:urgent` | 修復試行回数を5回に増加 |
| `ai:experimental` | テストカバレッジ要件を60%に緩和 |

---

## Safety Mechanisms

### Rate Limiting

| 項目 | 制限 |
|------|------|
| 同時マージ数 | 2 PR |
| 1時間あたりのマージ数 | 10 PR |
| 1日の総マージ数 | 50 PR |

### Cool-down Period

```
マージ失敗後:
- 5分間 待機
- 同一Issueの再実行を防止

連続失敗時:
- 3回連続失敗で15分間停止
- システム健全性チェック実行
```

### Manual Override

```bash
# 自動マージ強制スキップ
gh pr edit <number> --add-label "ai:skip-auto-merge"

# 即時マージ（管理者のみ）
gh pr merge <number> --admin
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-08 | Initial version |

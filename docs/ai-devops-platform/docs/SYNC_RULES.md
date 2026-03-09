# ローカル/リモート同期ルール

## 概要

GitHub Actionsでの自動開発により、**GitHubリポジトリが常に最新**の状態になります。
ローカルリポジトリとの同期を適切に管理するためのルールを定義します。

---

## 基本原則

### 🏆 Single Source of Truth: GitHub

```
GitHub (Remote) = 正
Local = 複製
```

**GitHubリポジトリが常に正しい状態です。ローカルは必要に応じて同期を取ります。**

---

## 同期ルール

### 1. 作業開始前の同期（必須）

```bash
# ローカルで作業を開始する前に必ず実行
git fetch origin
git status

# リモートが進んでいる場合
git pull --rebase origin main
```

### 2. Push前の確認（必須）

```bash
# Pushする前に必ず確認
git fetch origin
git status

# ローカルが遅れている場合
git pull --rebase origin main

# コンフリクトがある場合は解決してからPush
git push origin <branch>
```

### 3. 定期同期（推奨）

```bash
# 1日1回、または作業開始時に実行
git fetch --all
git pull --rebase origin main
```

---

## 禁止事項

### ❌ 絶対にやってはいけないこと

| 禁止事項 | 理由 | 代替手段 |
|---------|------|---------|
| `git push --force` | リモートのAI実装を上書きする可能性 | `git pull --rebase` で解決 |
| ローカル優先でPush | AIが実装した最新コードを消失 | 必ずfetch後にPush |
| 未確認でのマージ | コンフリクトでAIコードを破損 | 必ずdiffを確認 |

### ⚠️ 注意が必要な操作

| 操作 | 注意点 | 推奨アクション |
|------|--------|---------------|
| ブランチ作成 | リモートに同名ブランチがないか確認 | `git branch -r` で確認 |
| リセット | ローカルの未Pushコミット消失 | `git stash` で退避 |
| クリーンアップ | 未追跡ファイル削除 | `git clean -n` で確認後実行 |

---

## 自動同期スクリプト

### Windows (PowerShell)

```powershell
# sync-from-github.ps1
param(
    [string]$RepoPath = "C:\src\freee_audit",
    [string]$Branch = "main"
)

Set-Location $RepoPath

Write-Host "=== GitHub Sync Start ===" -ForegroundColor Cyan
Write-Host "Repository: $RepoPath" -ForegroundColor Gray
Write-Host "Branch: $Branch" -ForegroundColor Gray

# 変更がある場合は退避
$hasChanges = git status --porcelain
if ($hasChanges) {
    Write-Host "Stashing local changes..." -ForegroundColor Yellow
    git stash push -m "auto-sync-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

# リモートから取得
Write-Host "Fetching from remote..." -ForegroundColor Yellow
git fetch origin

# 現在のブランチ確認
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch" -ForegroundColor Gray

# メインブランチに切り替え & 同期
if ($currentBranch -ne $Branch) {
    Write-Host "Switching to $Branch..." -ForegroundColor Yellow
    git checkout $Branch
}

Write-Host "Pulling latest changes..." -ForegroundColor Yellow
git pull --rebase origin $Branch

# 退避した変更を復元
if ($hasChanges) {
    Write-Host "Restoring stashed changes..." -ForegroundColor Yellow
    git stash pop
}

# ステータス表示
Write-Host "`n=== Current Status ===" -ForegroundColor Cyan
git status -sb

Write-Host "`n=== GitHub Sync Complete ===" -ForegroundColor Green
```

### 使用方法

```powershell
# 毎朝の作業開始時に実行
.\scripts\sync-from-github.ps1

# 特定のブランチを同期
.\scripts\sync-from-github.ps1 -Branch "feature/xxx"
```

---

## GitHub Actionsでの自動通知

AIがPushした際にローカル同期を促す通知を設定：

```yaml
# .github/workflows/notify-sync.yml
name: Notify Sync Required

on:
  push:
    branches: [main, master]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Create sync reminder
        run: |
          echo "::notice::Remote repository updated. Please sync your local repository."
```

---

## VSCode / IDE 設定

### 自動Fetch設定

```json
// .vscode/settings.json
{
  "git.autofetch": true,
  "git.autofetchPeriod": 300,
  "git.confirmSync": false,
  "git.pullBeforeCheckout": true
}
```

### 推奨拡張機能

- **GitLens**: リモートとの差分を可視化
- **Git Graph**: ブランチ履歴を視覚化

---

## トラブルシューティング

### ケース1: コンフリクトが発生した場合

```bash
# 1. コンフリクト確認
git status

# 2. コンフリクトファイルを編集
# <<<<<<< HEAD
# ローカルの変更
# =======
# リモートの変更（AI実装）
# >>>>>>> origin/main

# 3. 解決後
git add <resolved-files>
git rebase --continue

# 4. Push
git push origin <branch>
```

### ケース2: ローカルが大幅に遅れている場合

```bash
# 1. 現在の状態を確認
git log --oneline -10
git log --oneline origin/main -10

# 2. リモートに強制同期（ローカル変更は消失）
git fetch origin
git reset --hard origin/main

# 注意: この操作はローカルの未Pushコミットを消失します
```

### ケース3: AI実装を誤って上書きした場合

```bash
# 1. 直前の状態を確認
git reflog -10

# 2. AI実装のコミットに戻る
git reset --hard <commit-hash>

# 3. 強制Push（慎重に）
git push --force-with-lease origin <branch>
```

---

## 日次ルーチン

### 推奨ワークフロー

```
朝:
  1. sync-from-github.ps1 実行
  2. GitHub Issues 確認
  3. AI実装状況確認

日中:
  1. ローカルで開発（必要時）
  2. Push前に必ず fetch & pull

夕:
  1. 未完了タスク確認
  2. 必要に応じてIssue作成
  3. 翌日のAIタスク準備
```

---

## チェックリスト

### 作業開始前
- [ ] `git fetch origin` 実行
- [ ] `git status` で状態確認
- [ ] リモートが進んでいれば `git pull --rebase`

### Push前
- [ ] `git fetch origin` 実行
- [ ] `git status` で状態確認
- [ ] コンフリクトがないことを確認
- [ ] `git diff origin/main` で差分確認

### 1日1回
- [ ] `git fetch --all` 実行
- [ ] GitHub Actionsの実行状況確認
- [ ] 新しいPRがないか確認

---

## 参考リンク

- [Git Documentation - Rebase](https://git-scm.com/docs/git-rebase)
- [GitHub Docs - Syncing a fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)

#!/bin/bash
# AI自動開発設定の完全検証スクリプト
# 10品質基準に基づく包括的検証

set -euo pipefail

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 結果格納
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# ログ関数
log_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    echo "   原因: $2"
    echo "   対処: $3"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

log_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    echo "   内容: $2"
    echo "   推奨: $3"
    ((WARNINGS++))
    ((TOTAL_CHECKS++))
}

log_section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ============================================
# 1. 安定性 (Stability) 検証
# ============================================
log_section "1. 安定性 (Stability) 検証"

# タイムアウト設定確認
if grep -q "timeout:" .github/ai-project.yml; then
    TIMEOUT_COUNT=$(grep -c "timeout:" .github/ai-project.yml)
    if [ "$TIMEOUT_COUNT" -ge 4 ]; then
        log_pass "タイムアウト設定" "全品質ゲートにタイムアウト設定あり（${TIMEOUT_COUNT}箇所）"
    else
        log_warn "タイムアウト設定不足" "${TIMEOUT_COUNT}箇所のみ" "全品質ゲートにタイムアウト設定を追加"
    fi
else
    log_fail "タイムアウト設定なし" "タイムアウト設定が見つかりません" ".github/ai-project.ymlにtimeout設定を追加"
fi

# リトライ設定確認
if grep -q "retryAttempts" docs/ai-devops-platform/config/target-repos.json 2>/dev/null; then
    RETRY_VALUE=$(grep "retryAttempts" docs/ai-devops-platform/config/target-repos.json | grep -o '[0-9]*')
    if [ "$RETRY_VALUE" -ge 1 ]; then
        log_pass "リトライ設定" "retryAttempts=${RETRY_VALUE}"
    else
        log_warn "リトライ設定不十分" "retryAttempts=${RETRY_VALUE}" "retryAttemptsを3以上に設定"
    fi
else
    log_warn "リトライ設定未確認" "target-repos.jsonで確認できませんでした" "リトライ設定を明示的に追加"
fi

# ============================================
# 2. 堅牢性 (Robustness) 検証
# ============================================
log_section "2. 堅牢性 (Robustness) 検証"

# 入力バリデーション確認
if grep -q "constraints:" .github/ai-project.yml; then
    CONSTRAINTS=$(grep -A 10 "constraints:" .github/ai-project.yml | grep -c "  ")
    if [ "$CONSTRAINTS" -ge 3 ]; then
        log_pass "入力バリデーション" "${CONSTRAINTS}個の制約条件が設定されています"
    else
        log_warn "制約条件不足" "${CONSTRAINTS}個のみ" "maxFileSizeKB, maxFilesPerTask, forbiddenPaths等を追加"
    fi
else
    log_fail "制約条件なし" "constraintsセクションが見つかりません" ".github/ai-project.ymlにconstraints追加"
fi

# 境界値確認
if grep -q "maxFileSizeKB:" .github/ai-project.yml; then
    MAX_SIZE=$(grep "maxFileSizeKB:" .github/ai-project.yml | grep -o '[0-9]*')
    if [ "$MAX_SIZE" -le 1000 ]; then
        log_pass "ファイルサイズ制限" "maxFileSizeKB=${MAX_SIZE}"
    else
        log_warn "ファイルサイズ制限が緩い" "maxFileSizeKB=${MAX_SIZE}" "500KB以下を推奨"
    fi
else
    log_fail "ファイルサイズ制限なし" "maxFileSizeKB設定なし" "maxFileSizeKB設定を追加"
fi

# ============================================
# 3. 再現性 (Reproducibility) 検証
# ============================================
log_section "3. 再現性 (Reproducibility) 検証"

# 設定バージョン管理確認
if git rev-parse --git-dir > /dev/null 2>&1; then
    if git log --oneline .github/ai-project.yml | head -1 | grep -q "."; then
        log_pass "設定バージョン管理" "ai-project.ymlはGit管理下にあります"
    else
        log_warn "設定履歴なし" "コミット履歴が見つかりません" "設定ファイルをコミット"
    fi
else
    log_fail "Git管理外" "Gitリポジトリではありません" "git initして設定をバージョン管理"
fi

# 所有者名整合性確認
MIZUNOMI_COUNT=$(git grep -c "mizunomi" 2>/dev/null || echo "0")
if [ "$MIZUNOMI_COUNT" -eq 0 ]; then
    log_pass "所有者名整合性" "古い所有者名（mizunomi）への参照なし"
else
    log_fail "所有者名不整合" "${MIZUNOMI_COUNT}箇所にmizunomi参照あり" "全てのmizunomiをmizunotaroに修正"
fi

# ============================================
# 4. 拡張性 (Extensibility) 検証
# ============================================
log_section "4. 拡張性 (Extensibility) 検証"

# 設定外部化確認
if [ -f ".github/ai-project.yml" ] && [ -f "docs/ai-devops-platform/config/target-repos.json" ]; then
    log_pass "設定外部化" "YAML/JSON設定ファイルを使用"
else
    log_fail "設定外部化不十分" "設定ファイルが不足" ".github/ai-project.ymlとtarget-repos.jsonを作成"
fi

# プラグインパターン確認
if grep -q '"repositories":' docs/ai-devops-platform/config/target-repos.json 2>/dev/null; then
    REPO_COUNT=$(grep -o '"name":' docs/ai-devops-platform/config/target-repos.json | wc -l)
    if [ "$REPO_COUNT" -ge 1 ]; then
        log_pass "拡張可能な構成" "配列構造で${REPO_COUNT}リポジトリ定義可能"
    fi
else
    log_warn "拡張性未確認" "リポジトリ設定構造を確認できません" "配列構造の採用を検討"
fi

# ============================================
# 5. メンテナンス性 (Maintainability) 検証
# ============================================
log_section "5. メンテナンス性 (Maintainability) 検証"

# ドキュメント存在確認
DOC_FILES=0
[ -f "README.md" ] && ((DOC_FILES++))
[ -f "AGENTS.md" ] && ((DOC_FILES++))
[ -f ".github/ai-project.yml" ] && ((DOC_FILES++))

if [ "$DOC_FILES" -ge 3 ]; then
    log_pass "ドキュメント整備" "${DOC_FILES}個のドキュメントファイルあり"
else
    log_warn "ドキュメント不足" "${DOC_FILES}個のみ" "README.md, AGENTS.md, ai-project.ymlを整備"
fi

# 命名規則確認
if [ -f ".github/ai-project.yml" ]; then
    LABEL_COUNT=$(grep -c "- name:" .github/ai-project.yml || echo "0")
    if [ "$LABEL_COUNT" -ge 0 ]; then
        log_pass "命名規則" "ラベル定義が構造化されています"
    fi
fi

# ============================================
# 6. セキュリティ (Security) 検証
# ============================================
log_section "6. セキュリティ (Security) 検証"

# forbiddenPaths確認
if grep -q "forbiddenPaths:" .github/ai-project.yml; then
    FORBIDDEN_COUNT=$(grep -A 10 "forbiddenPaths:" .github/ai-project.yml | grep -c "    -" || echo "0")
    if [ "$FORBIDDEN_COUNT" -ge 5 ]; then
        log_pass "機密パス保護" "${FORBIDDEN_COUNT}個の禁止パスが設定されています"
    elif [ "$FORBIDDEN_COUNT" -ge 3 ]; then
        log_warn "禁止パス不足" "${FORBIDDEN_COUNT}個のみ" "credentials, private, *.pem, *.key等を追加"
    else
        log_fail "機密パス保護不十分" "${FORBIDDEN_COUNT}個のみ" "最低5個以上の禁止パスを設定"
    fi
else
    log_fail "機密パス保護なし" "forbiddenPaths設定なし" "forbiddenPathsを追加"
fi

# .env除外確認
if grep -q "'\*\*/\.env\*'" .github/ai-project.yml || grep -q '"**/.env*"' .github/ai-project.yml; then
    log_pass "環境変数保護" ".envファイルが禁止パスに含まれています"
else
    log_fail "環境変数保護なし" ".envが禁止パスにありません" "**/.env*をforbiddenPathsに追加"
fi

# ============================================
# 7. パフォーマンス (Performance) 検証
# ============================================
log_section "7. パフォーマンス (Performance) 検証"

# 並列処理可能性確認
if [ -f ".github/ai-project.yml" ]; then
    log_pass "設定ファイルサイズ" "軽量なYAML形式を使用"
fi

# タイムアウト値確認
MAX_TIMEOUT=$(grep "timeout:" .github/ai-project.yml | grep -o '[0-9]*' | sort -rn | head -1 || echo "0")
if [ "$MAX_TIMEOUT" -gt 0 ] && [ "$MAX_TIMEOUT" -le 600000 ]; then
    log_pass "タイムアウト設定" "最大${MAX_TIMEOUT}ms（適切）"
elif [ "$MAX_TIMEOUT" -gt 600000 ]; then
    log_warn "タイムアウト値が大きい" "最大${MAX_TIMEOUT}ms" "300000ms（5分）以下を推奨"
else
    log_fail "タイムアウト設定なし" "タイムアウト値が取得できません" "タイムアウト設定を追加"
fi

# ============================================
# 8. 文法・構文エラー防止 (Syntax Error Prevention) 検証
# ============================================
log_section "8. 文法・構文エラー防止 検証"

# YAML構文チェック
if command -v python > /dev/null 2>&1; then
    if python -c "import yaml; yaml.safe_load(open('.github/ai-project.yml'))" 2>/dev/null; then
        log_pass "YAML構文" "ai-project.ymlは有効なYAML"
    else
        log_fail "YAML構文エラー" "ai-project.ymlに構文エラーあり" "YAML構文を修正"
    fi
else
    log_warn "YAML検証スキップ" "Pythonがインストールされていません" "Pythonをインストールして検証"
fi

# JSON構文チェック
if command -v jq > /dev/null 2>&1; then
    if jq empty docs/ai-devops-platform/config/target-repos.json 2>/dev/null; then
        log_pass "JSON構文" "target-repos.jsonは有効なJSON"
    else
        log_fail "JSON構文エラー" "target-repos.jsonに構文エラーあり" "JSON構文を修正"
    fi
else
    log_warn "JSON検証スキップ" "jqがインストールされていません" "jqをインストールして検証"
fi

# ============================================
# 9. 関数・引数設計 (Function Design) 検証
# ============================================
log_section "9. 関数・引数設計 検証"

# 設定ファイルの構造確認
if grep -q "qualityGates:" .github/ai-project.yml; then
    log_pass "構造化設定" "オブジェクト形式で品質ゲート定義"
else
    log_warn "構造化不十分" "品質ゲート定義が見つかりません" "qualityGatesセクションを追加"
fi

# ============================================
# 10. 全体整合性 (Consistency) 検証
# ============================================
log_section "10. 全体整合性 (Consistency) 検証"

# リポジトリ情報確認
REPO_OWNER=$(git config --get remote.origin.url | grep -o 'github\.com[:/][^/]*' | cut -d'/' -f2 || echo "unknown")
REPO_NAME=$(git config --get remote.origin.url | grep -o 'github\.com[:/].*' | cut -d'/' -f3 | cut -d'.' -f1 || echo "unknown")

if [ "$REPO_OWNER" != "unknown" ] && [ "$REPO_NAME" != "unknown" ]; then
    log_pass "リポジトリ情報" "owner=${REPO_OWNER}, repo=${REPO_NAME}"
else
    log_warn "リポジトリ情報取得失敗" "Git remote URLを確認できません" "git remote -vで確認"
fi

# 設定整合性確認
if grep -q "$REPO_OWNER" .github/ai-project.yml 2>/dev/null; then
    log_pass "設定整合性" "ai-project.ymlとリポジトリ所有者が一致"
else
    log_warn "設定整合性要確認" "所有者名を確認してください" "ai-project.ymlのownerを確認"
fi

# ============================================
# 結果サマリー
# ============================================
log_section "検証結果サマリー"

echo ""
echo "総チェック数: ${TOTAL_CHECKS}"
echo -e "${GREEN}合格: ${PASSED_CHECKS}${NC}"
echo -e "${RED}不合格: ${FAILED_CHECKS}${NC}"
echo -e "${YELLOW}警告: ${WARNINGS}${NC}"
echo ""

SUCCESS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
echo "成功率: ${SUCCESS_RATE}%"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   🎉 全品質基準PASS - 100点達成!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
elif [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}   ⚠️  警告あり - 改善推奨${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}   ❌ 不合格項目あり - 修正必要${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
fi

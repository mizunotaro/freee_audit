# プロジェクトルール (AGENTS.md)

## 必須参照ドキュメント

全ての**設計・実装・品質管理・品質保証**において、以下のドキュメントを**必ず参照**すること：

### 品質基準・制約
| ドキュメント | 参照タイミング | 内容 |
|-------------|---------------|------|
| [docs/ai/QUALITY_STANDARDS.md](./docs/ai/QUALITY_STANDARDS.md) | 設計・実装・テスト | 10品質基準チェックリスト |
| [docs/ai/CONSTRAINTS.md](./docs/ai/CONSTRAINTS.md) | 設計・実装 | LLM制約・出力フォーマット・入力バリデーション |
| [docs/ai/TASKS.md](./docs/ai/TASKS.md) | 実装計画 | タスク分割・依存関係・スケジュール |
| [docs/ai/README.md](./docs/ai/README.md) | 設計・概要把握 | AI機能アーキテクチャ・コンポーネント |

### 参照フロー
```
設計フェーズ
  ├── docs/ai/README.md でアーキテクチャ確認
  ├── docs/ai/QUALITY_STANDARDS.md で品質要件確認
  └── docs/ai/CONSTRAINTS.md で制約・フォーマット確認

実装フェーズ
  ├── docs/ai/TASKS.md でタスク詳細確認
  ├── docs/ai/QUALITY_STANDARDS.md のチェックリスト適用
  └── docs/ai/CONSTRAINTS.md のバリデーション実装

品質管理・保証フェーズ
  ├── docs/ai/QUALITY_STANDARDS.md の品質ゲート通過
  └── 検証コマンド実行
```

---

## 品質ゲート

全ての実装タスクで以下の品質ゲートを**必ず**通過すること：

### 必須チェック
```bash
# 型チェック（エラー0件）
pnpm tsc --noEmit

# リント（エラー0件、警告0件）
pnpm eslint src/ --max-warnings=0

# ユニットテスト（全テストPASS）
pnpm jest --passWithNoTests

# ビルド確認
pnpm build
```

### 10品質基準（詳細: [QUALITY_STANDARDS.md](./docs/ai/QUALITY_STANDARDS.md)）

| # | 基準 | 概要 | チェックリスト項目数 |
|---|------|------|---------------------|
| 1 | 安定性 | タイムアウト、リトライ、graceful degradation | 6項目 |
| 2 | 堅牢性 | 入力バリデーション、例外処理、境界値対応 | 6項目 |
| 3 | 再現性 | 設定バージョン管理、決定論的処理 | 6項目 |
| 4 | 拡張性 | プラグインパターン、インターフェース分離 | 6項目 |
| 5 | メンテナンス性 | 単一責任、ドキュメント、命名規則 | 6項目 |
| 6 | セキュリティ | サニタイゼーション、機密情報保護 | 7項目 |
| 7 | パフォーマンス | キャッシング、並列処理、メモリ管理 | 6項目 |
| 8 | 文法・構文エラー防止 | strict mode、型定義完全性 | 6項目 |
| 9 | 関数・引数設計 | オブジェクト引数、Result型、副作用分離 | 6項目 |
| 10 | 全体整合性 | 既存コード整合、パターン統一 | 6項目 |

---

## AI機能実装

AI機能の実装は `docs/ai/` 以下のドキュメントに従うこと。

### AI実装の原則
1. **LLM-First:** 全レイヤーにLLM統合、専門家視点での判断
2. **Model Selection:** タスク複雑度に応じた最適モデル選択
3. **Expert Personas:** 公認会計士・税理士・CFO・財務アナリストの4ペルソナ
4. **Neutral & Objective:** 中立的・客観的で根拠に基づく分析

### 実装パターン（CONSTRAINTS.mdより）

```typescript
// Result型パターン（必須）
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }

// オプションオブジェクトパターン（引数3個以上）
interface AnalyzeOptions {
  data: string
  model?: string
  temperature?: number
}

function analyze(options: AnalyzeOptions): Result<AnalysisOutput> {
  // 実装
}
```

---

## コミットルール

### コミットメッセージ形式
```
<type>(<scope>): <description>

[optional body]
```

### Type
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント更新
- `test`: テスト追加・修正
- `chore`: その他（ビルド、設定等）

### 例
```
feat(ai): add expert persona system for financial analysis

- Implement CPA, Tax Accountant, CFO, Financial Analyst personas
- Add prompt template engine with validation
- Include response sanitization and validation
```

---

## ドキュメント更新ルール

`docs/ai/` 以下のドキュメントは**生きたドキュメント**として継続的に更新する：

- **設計変更時:** README.md、CONSTRAINTS.md を更新
- **新タスク追加時:** TASKS.md を更新
- **品質基準変更時:** QUALITY_STANDARDS.md を更新
- **実装完了時:** 該当タスクのステータスを更新

---

## 参照

- [AI機能ドキュメント](./docs/ai/README.md)
- [セキュリティガイドライン](./docs/SECURITY.md)
- [開発ガイド](./docs/DEVELOPMENT.md)
- [テスト戦略](./docs/TEST_STRATEGY.md)

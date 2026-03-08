# AI実装タスク分割

このドキュメントは、AI機能実装の**タスク分割・依存関係・実装順序**を定義します。
各タスクは [品質基準](./QUALITY_STANDARDS.md) に従って実装すること。

---

## タスク依存関係図

```
Phase 1: AI Orchestrator + チャットボット基盤
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task 1.1 ──┬── Task 1.2 ──┬── Task 1.3 ──┬── Task 1.5 ── Task 1.7
Persona    │  Model       │  Orchestrator│  Chat API    Chat UI
System     │  Selector    │              │
           │              │
           ├── Task 1.4 ──┤
           │  Context     │
           │  Manager     │
           │              │
           └──────────────┴── Task 1.6 ──┘
                              Prompt
                              Engine


Phase 2: Financial Analyzer + ダッシュボード
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task 2.1 ──┬── Task 2.2 ──┬── Task 2.4 ── Task 2.5
Financial │  Ratio       │  Analysis    Dashboard
Analyzer  │  Analyzer    │  API         UI
          │              │
          └── Task 2.3 ──┘
             Benchmark
             Service
```

---

## タスク実行フロー

```
┌─────────────────────────────────────────────────────────────┐
│ 実装開始                                                     │
│   ├── docs/ai/README.md でアーキテクチャ確認                  │
│   ├── docs/ai/QUALITY_STANDARDS.md で品質要件確認             │
│   └── docs/ai/CONSTRAINTS.md で制約・フォーマット確認          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 実装フェーズ                                                 │
│   ├── 本ドキュメントのタスク詳細を確認                        │
│   ├── 品質チェックリストの各項目を実装                        │
│   └── 実装パターンを適用                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 検証フェーズ                                                 │
│   ├── 検証コマンド実行                                       │
│   ├── 品質ゲート通過確認                                     │
│   └── テスト作成・実行                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 完了条件確認                                                 │
│   ├── 全チェックリスト項目 ✓                                 │
│   ├── 検証コマンド全てPASS                                   │
│   └── ドキュメント更新済み                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: AI Orchestrator + チャットボット基盤

### Task 1.1: Expert Persona System

| 項目 | 値 |
|------|-----|
| 優先度 | P0（最高） |
| 依存 | なし（独立） |
| 期間 | 2日 |
| 並行実行 | 可能（Task 1.2と並行可） |

#### 出力ファイル
```
src/lib/ai/personas/
├── index.ts              # 公開API
├── types.ts              # 型定義
├── base-persona.ts       # 基底クラス
├── registry.ts           # ペルソナ登録
├── personas/
│   ├── cpa.ts            # 公認会計士
│   ├── tax-accountant.ts # 税理士
│   ├── cfo.ts            # CFO
│   └── financial-analyst.ts # 財務アナリスト
└── prompts/
    ├── constraints.ts    # 制約定義
    ├── output-formats.ts # 出力フォーマット
    └── templates/        # プロンプトテンプレート
```

#### 機能要件
- [ ] 4種類の専門家ペルソナ定義
- [ ] プロンプト生成機能（buildPrompt）
- [ ] レスポンスバリデーション（validateResponse）
- [ ] 多言語対応（日本語/英語）
- [ ] ペルソナレジストリ

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 1 | 安定性 | null/undefined入力で例外を投げない |
| 2 | 堅牢性 | 全公開関数に入力型ガード |
| 3 | 再現性 | PersonaConfigのversionプロパティ |
| 4 | 拡張性 | BasePersona継承で新ペルソナ追加可能 |
| 5 | メンテナンス性 | 各ペルソナは1ファイルに分離 |
| 6 | セキュリティ | 制御文字の除去（sanitizeString） |
| 7 | パフォーマンス | Object.freezeによる不変化 |
| 8 | 文法・構文 | strict mode有効、any型回避 |
| 9 | 関数設計 | Result型パターン使用 |
| 10 | 整合性 | 既存コードとの命名統一 |

#### 検証コマンド
```bash
# 型チェック
pnpm tsc --noEmit src/lib/ai/personas/**/*.ts

# ユニットテスト
pnpm jest tests/unit/lib/ai/personas/ --coverage

# リント
pnpm eslint src/lib/ai/personas/ --max-warnings=0
```

#### 完了条件
- [ ] 全機能要件実装済み
- [ ] 品質チェックリスト全項目 ✓
- [ ] テストカバレッジ 80%以上
- [ ] ドキュメント更新済み

---

### Task 1.2: Model Selection Strategy

| 項目 | 値 |
|------|-----|
| 優先度 | P0 |
| 依存 | Task 1.1（typesのみ参照） |
| 期間 | 1日 |
| 並行実行 | 可能（Task 1.1と並行可） |

#### 出力ファイル
```
src/lib/ai/orchestrator/
├── model-selector.ts     # モデル選択
├── task-classifier.ts    # タスク分類
├── complexity-analyzer.ts # 複雑度分析
└── types.ts              # 型定義
```

#### 機能要件
- [ ] タスク分類（complex_reasoning, detailed_analysis等）
- [ ] 複雑度スコアリング（0-100）
- [ ] モデル選択ロジック（優先度マトリックス）
- [ ] フォールバックチェーン生成

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 1 | 安定性 | モデル選択失敗時の適切なエラー返却 |
| 2 | 堅牢性 | 入力文字列の境界値テスト |
| 3 | 再現性 | 同一入力に対する決定論的な選択 |
| 4 | 拡張性 | 新規プロバイダーの追加が容易 |
| 5 | メンテナンス性 | モデル情報の一元管理 |
| 6 | セキュリティ | API キーへのアクセスなし |
| 7 | パフォーマンス | モデル選択処理 < 100ms |

#### 検証コマンド
```bash
pnpm tsc --noEmit src/lib/ai/orchestrator/**/*.ts
pnpm jest tests/unit/lib/ai/orchestrator/ --coverage
pnpm eslint src/lib/ai/orchestrator/ --max-warnings=0
```

---

### Task 1.3: AI Orchestrator Core

| 項目 | 値 |
|------|-----|
| 優先度 | P0 |
| 依存 | Task 1.1, Task 1.2 |
| 期間 | 2日 |
| 並行実行 | 不可 |

#### 出力ファイル
```
src/lib/ai/orchestrator/
├── index.ts              # 公開API
├── orchestrator.ts       # オーケストレーター
├── intent-router.ts      # 意図ルーティング
└── response-synthesizer.ts # レスポンス統合
```

#### 機能要件
- [ ] ユーザー入力の意図分類
- [ ] 適切なペルソナ選択
- [ ] 並列分析実行
- [ ] レスポンス統合

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 1 | 安定性 | 部分失敗時のgraceful degradation |
| 2 | 堅牢性 | 入力バリデーション実装 |
| 3 | 再現性 | 選択結果のログ出力 |
| 4 | 拡張性 | カスタムワークフロー追加可能 |
| 5 | メンテナンス性 | クリアな責任分離 |
| 7 | パフォーマンス | 並列実行による高速化 |

#### 検証コマンド
```bash
pnpm tsc --noEmit src/lib/ai/orchestrator/**/*.ts
pnpm jest tests/unit/lib/ai/orchestrator/ --coverage
pnpm eslint src/lib/ai/orchestrator/ --max-warnings=0
```

---

### Task 1.4: Context Manager

| 項目 | 値 |
|------|-----|
| 優先度 | P0 |
| 依存 | Task 1.1（typesのみ） |
| 期間 | 1.5日 |
| 並行実行 | 可能（Task 1.2と並行可） |

#### 出力ファイル
```
src/lib/ai/context/
├── index.ts              # 公開API
├── context-manager.ts    # コンテキスト管理
├── conversation-store.ts # 会話ストレージ
└── token-counter.ts      # トークンカウント
```

#### 機能要件
- [ ] マルチターン会話管理
- [ ] トークン予算管理
- [ ] エンティティ追跡
- [ ] コンテキスト圧縮

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 1 | 安定性 | ストア障害時のインメモリフォールバック |
| 2 | 堅牢性 | 並行アクセスのハンドリング |
| 3 | 再現性 | コンテキストのバージョン管理 |
| 6 | セキュリティ | ユーザー間のコンテキスト分離 |
| 7 | パフォーマンス | トークンカウント精度90%以上 |

#### 検証コマンド
```bash
pnpm tsc --noEmit src/lib/ai/context/**/*.ts
pnpm jest tests/unit/lib/ai/context/ --coverage
pnpm eslint src/lib/ai/context/ --max-warnings=0
```

---

### Task 1.5: Chat API

| 項目 | 値 |
|------|-----|
| 優先度 | P1 |
| 依存 | Task 1.2, Task 1.3, Task 1.4 |
| 期間 | 1.5日 |
| 並行実行 | 不可 |

#### 出力ファイル
```
src/app/api/chat/
├── route.ts              # メインエンドポイント
├── stream.ts             # ストリーミング
└── types.ts              # 型定義
```

#### 機能要件
- [ ] POST /api/chat エンドポイント
- [ ] ストリーミングレスポンス
- [ ] セッション管理
- [ ] レート制限

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 1 | 安定性 | タイムアウト設定、リトライ |
| 6 | セキュリティ | 認証・認可チェック |
| 7 | パフォーマンス | レスポンス時間の監視 |

#### 検証コマンド
```bash
pnpm tsc --noEmit src/app/api/chat/**/*.ts
pnpm jest tests/api/chat/ --coverage
pnpm eslint src/app/api/chat/ --max-warnings=0
```

---

### Task 1.6: Prompt Template Engine

| 項目 | 値 |
|------|-----|
| 優先度 | P1 |
| 依存 | Task 1.3 |
| 期間 | 1日 |
| 並行実行 | 不可 |

#### 出力ファイル
```
src/lib/ai/prompts/
├── index.ts              # 公開API
├── template-engine.ts    # テンプレートエンジン
├── validators.ts         # バリデーター
└── templates/
    ├── analysis/         # 分析用テンプレート
    └── shared/           # 共有テンプレート
```

#### 機能要件
- [ ] テンプレート管理
- [ ] 変数バリデーション
- [ ] プロンプトコンパイル
- [ ] バージョン管理

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 2 | 堅牢性 | 変数バリデーション実装 |
| 3 | 再現性 | テンプレートのバージョン管理 |
| 7 | パフォーマンス | コンパイル処理 < 50ms |

#### 検証コマンド
```bash
pnpm tsc --noEmit src/lib/ai/prompts/**/*.ts
pnpm jest tests/unit/lib/ai/prompts/ --coverage
pnpm eslint src/lib/ai/prompts/ --max-warnings=0
```

---

### Task 1.7: Chat UI

| 項目 | 値 |
|------|-----|
| 優先度 | P1 |
| 依存 | Task 1.5 |
| 期間 | 2日 |
| 並行実行 | 不可 |

#### 出力ファイル
```
src/app/(dashboard)/chat/
├── page.tsx              # ページコンポーネント
├── layout.tsx            # レイアウト
├── components/           # UIコンポーネント
│   ├── chat-container.tsx
│   ├── message-list.tsx
│   ├── message-item.tsx
│   ├── input-area.tsx
│   ├── suggestion-chips.tsx
│   ├── persona-indicator.tsx
│   └── typing-indicator.tsx
└── hooks/                # カスタムフック
    ├── use-chat.ts
    ├── use-streaming.ts
    └── use-session.ts
```

#### 機能要件
- [ ] チャットインターフェース
- [ ] ストリーミング表示
- [ ] ペルソナ表示
- [ ] レスポンシブ対応

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 1 | 安定性 | オフライン時の適切な表示 |
| 5 | メンテナンス性 | コンポーネントの再利用性 |
| 7 | パフォーマンス | 仮想化リスト、遅延読み込み |

#### 検証コマンド
```bash
pnpm tsc --noEmit "src/app/(dashboard)/chat/**/*.ts*"
pnpm jest tests/components/chat/ --coverage
pnpm eslint "src/app/(dashboard)/chat/" --max-warnings=0
```

---

## Phase 2: Financial Analyzer + ダッシュボード

### Task 2.1: Financial Analyzer Core

| 項目 | 値 |
|------|-----|
| 優先度 | P0 |
| 依存 | Task 1.3, Task 1.6 |
| 期間 | 2日 |
| 並行実行 | 不可 |

#### 出力ファイル
```
src/services/ai/analyzers/
├── financial-analyzer.ts # メインアナライザー
├── types.ts              # 型定義
├── utils.ts              # ユーティリティ
└── validators.ts         # バリデーター
```

#### 機能要件
- [ ] 財務諸表分析（BS/PL/CF）
- [ ] LLM解釈生成
- [ ] アラート検出
- [ ] 推奨事項生成

#### 品質チェックリスト

| # | 基準 | チェック項目 |
|---|------|-------------|
| 2 | 堅牢性 | 計算のゼロ除算対策 |
| 7 | パフォーマンス | 分析処理 < 5秒（LLM除く） |

#### 検証コマンド
```bash
pnpm tsc --noEmit src/services/ai/analyzers/**/*.ts
pnpm jest tests/unit/services/ai/analyzers/ --coverage
pnpm eslint src/services/ai/analyzers/ --max-warnings=0
```

---

### Task 2.2: Ratio Analyzer

| 項目 | 値 |
|------|-----|
| 優先度 | P1 |
| 依存 | Task 2.1 |
| 期間 | 1.5日 |
| 並行実行 | 可能（Task 2.3と並行可） |

#### 出力ファイル
```
src/services/ai/analyzers/
├── ratio-analyzer.ts     # 比率分析
└── ratios/
    ├── liquidity.ts      # 流動性比率
    ├── safety.ts         # 安全性比率
    ├── profitability.ts  # 収益性比率
    ├── efficiency.ts     # 効率性比率
    └── growth.ts         # 成長性比率
```

#### 機能要件
- [ ] 20以上の財務比率計算
- [ ] トレンド分析
- [ ] ステータス判定
- [ ] LLM解釈

#### 検証コマンド
```bash
pnpm tsc --noEmit src/services/ai/analyzers/**/*.ts
pnpm jest tests/unit/services/ai/analyzers/ratios/ --coverage
```

---

### Task 2.3: Benchmark Service

| 項目 | 値 |
|------|-----|
| 優先度 | P1 |
| 依存 | Task 2.1 |
| 期間 | 1日 |
| 並行実行 | 可能（Task 2.2と並行可） |

#### 出力ファイル
```
src/services/benchmark/
├── index.ts              # 公開API
├── benchmark-service.ts  # ベンチマークサービス
├── data/                 # ベンチマークデータ
│   ├── industry-ratios.ts
│   └── company-size-benchmarks.ts
└── types.ts              # 型定義
```

#### 機能要件
- [ ] 業界ベンチマーク検索
- [ ] パーセンタイル計算
- [ ] 比較分析

#### 検証コマンド
```bash
pnpm tsc --noEmit src/services/benchmark/**/*.ts
pnpm jest tests/unit/services/benchmark/ --coverage
```

---

### Task 2.4: Analysis API

| 項目 | 値 |
|------|-----|
| 優先度 | P1 |
| 依存 | Task 2.1, Task 2.2, Task 2.3 |
| 期間 | 1.5日 |
| 並行実行 | 不可 |

#### 出力ファイル
```
src/app/api/analysis/
├── financial/
│   └── route.ts          # 財務分析API
├── ratios/
│   └── route.ts          # 比率分析API
├── benchmark/
│   └── route.ts          # ベンチマークAPI
└── report/
    └── route.ts          # レポート生成API
```

#### 機能要件
- [ ] 分析エンドポイント群
- [ ] レポート生成
- [ ] キャッシング

#### 検証コマンド
```bash
pnpm tsc --noEmit src/app/api/analysis/**/*.ts
pnpm jest tests/api/analysis/ --coverage
```

---

### Task 2.5: Analysis Dashboard UI

| 項目 | 値 |
|------|-----|
| 優先度 | P1 |
| 依存 | Task 2.4 |
| 期間 | 2日 |
| 並行実行 | 不可 |

#### 出力ファイル
```
src/app/(dashboard)/analysis/
├── page.tsx              # ページコンポーネント
├── layout.tsx            # レイアウト
├── components/           # UIコンポーネント
│   ├── financial-overview.tsx
│   ├── ratio-cards.tsx
│   ├── trend-charts.tsx
│   ├── ai-insights.tsx
│   ├── recommendations-panel.tsx
│   ├── alerts-list.tsx
│   └── period-selector.tsx
└── hooks/                # カスタムフック
    ├── use-analysis.ts
    └── use-export.ts
```

#### 機能要件
- [ ] 分析ダッシュボード
- [ ] チャート表示
- [ ] エクスポート機能

#### 検証コマンド
```bash
pnpm tsc --noEmit "src/app/(dashboard)/analysis/**/*.ts*"
pnpm jest tests/components/analysis/ --coverage
pnpm eslint "src/app/(dashboard)/analysis/" --max-warnings=0
```

---

## 実装スケジュール

### Week 1
| 日 | タスク | 担当可能数 |
|----|--------|-----------|
| 1-2 | Task 1.1 + Task 1.2 | 2名並行 |
| 3-4 | Task 1.3 | 1名 |
| 3 | Task 1.4 | 1名（並行） |
| 5 | Task 1.6 | 1名 |

### Week 2
| 日 | タスク | 担当可能数 |
|----|--------|-----------|
| 1-2 | Task 1.5 | 1名 |
| 2-3 | Task 1.7 | 1名 |
| 4-5 | Task 2.1 | 1名 |

### Week 3
| 日 | タスク | 担当可能数 |
|----|--------|-----------|
| 1-2 | Task 2.2 + Task 2.3 | 2名並行 |
| 3-4 | Task 2.4 | 1名 |
| 4-5 | Task 2.5 | 1名 |

---

## ステージ別プロンプト提供計画

| ステージ | タスク | 提供タイミング |
|---------|--------|---------------|
| Stage 1 | 1.1, 1.2 | ✅ 提供済み |
| Stage 2 | 1.3, 1.4, 1.6 | Task 1.1-1.2完了後 |
| Stage 3 | 1.5, 1.7 | Task 1.3-1.6完了後 |
| Stage 4 | 2.1, 2.2 | Phase 1完了後 |
| Stage 5 | 2.3, 2.4, 2.5 | Task 2.1-2.2完了後 |

---

## 実装済みタスク

### 会計基準対応財務計算システム

#### Task 1: 会計基準パラメータシステム
- Status: ✅ Completed
- Files: src/types/accounting-standard.ts

#### Task 2: LLM計算検証サービス
- Status: ✅ Completed
- Files: src/services/validation/calculation-validator.ts

#### Task 3: キャッシュフロー計算修正
- Status: ✅ Completed
- Files: src/services/cashflow/calculator.ts

#### Task 4: KPI計算修正
- Status: ✅ Completed
- Files: src/services/analytics/financial-kpi.ts

#### Task 5: Runway計算修正
- Status: ✅ Completed
- Files: src/services/cashflow/runway-calculator.ts

#### Task 6: 統合テスト
- Status: ✅ Completed
- Files: tests/e2e/financial-calculation-pipeline.test.ts

---

## 参照

- [品質基準チェックリスト](./QUALITY_STANDARDS.md) - 10品質基準の詳細
- [制約定義](./CONSTRAINTS.md) - 入力・出力・プロンプト制約
- [AI機能概要](./README.md) - アーキテクチャ・コンポーネント

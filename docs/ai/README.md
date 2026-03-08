# AI機能ドキュメント

このディレクトリは、freee_auditプロジェクトのAI機能に関する**必須参照ドキュメント**を含みます。
全ての設計・実装・品質管理・品質保証において参照すること。

---

## ドキュメント一覧

| ドキュメント | 目的 | 参照タイミング |
|-------------|------|---------------|
| [README.md](./README.md) | 概要・アーキテクチャ | 設計開始時・全体把握時 |
| [QUALITY_STANDARDS.md](./QUALITY_STANDARDS.md) | 品質基準チェックリスト | 設計・実装・テスト時 |
| [CONSTRAINTS.md](./CONSTRAINTS.md) | 制約・フォーマット定義 | 実装・バリデーション時 |
| [TASKS.md](./TASKS.md) | タスク分割・依存関係 | 実装計画時 |

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                                │
│  Chat UI  │  Analysis Dashboard  │  Report Viewer  │  API Endpoints    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────┐
│                     AI Orchestrator Layer                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Intent Router → Model Selector → Persona Manager → Synthesizer │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────┬───────────────────────┬───────────────────────────┐
│   Expert Personas │    Analyzers          │     Support Services      │
├───────────────────┼───────────────────────┼───────────────────────────┤
│ ・CPA (公認会計士)│ ・Financial Analyzer  │ ・Context Manager         │
│ ・Tax Accountant  │ ・Ratio Analyzer      │ ・Prompt Template Engine  │
│ ・CFO             │ ・Benchmark Service   │ ・Token Counter           │
│ ・Fin. Analyst    │                       │ ・Conversation Store      │
└───────────────────┴───────────────────────┴───────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────┐
│                        LLM Provider Layer                                │
│  OpenAI  │  Claude  │  Gemini  │  OpenRouter  │  (Fallback Chain)      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 主要コンポーネント

### 1. Expert Persona System

4種類の専門家ペルソナを定義し、それぞれの視点から分析を提供。

| ペルソナ | 専門分野 | 主な分析観点 | 配置 |
|---------|---------|-------------|------|
| CPA (公認会計士) | 監査、JGAAP/IFRS | 財務諸表の妥当性、開示事項 | `src/lib/ai/personas/personas/cpa.ts` |
| Tax Accountant (税理士) | 法人税、消費税 | 税務リスク、節税機会 | `src/lib/ai/personas/personas/tax-accountant.ts` |
| CFO | 財務戦略、資金調達 | キャッシュフロー、投資判断 | `src/lib/ai/personas/personas/cfo.ts` |
| Financial Analyst | 企業評価、業界分析 | バリュエーション、ベンチマーク | `src/lib/ai/personas/personas/financial-analyst.ts` |

### 2. Model Selection Strategy

タスクの複雑度に応じて最適なLLMモデルを選択。

| タスク種別 | 推奨モデル | 用途 | 複雑度スコア |
|-----------|-----------|------|-------------|
| complex_reasoning | Claude Sonnet 4 / GPT-4.1 | 戦略判断、複雑な分析 | 70-100 |
| detailed_analysis | Claude Sonnet 4 / GPT-4.1 | 財務分析、税務判定 | 50-69 |
| standard_analysis | GPT-4.1-mini / Gemini 2.0 Flash | 通常の分析、説明 | 30-49 |
| fast_response | GPT-5-nano | 分類、抽出 | 0-29 |

**配置:** `src/lib/ai/orchestrator/model-selector.ts`

### 3. AI Orchestrator

複数のペルソナによる分析を統合し、一貫したレスポンスを生成。

- **Intent Router:** ユーザー入力の意図を分類
- **Persona Manager:** 適切なペルソナを選択・実行
- **Response Synthesizer:** 複数の分析結果を統合

**配置:** `src/lib/ai/orchestrator/`

### 4. Financial Analyzer

財務諸表データを分析し、LLMによる解釈を生成。

- 財務比率計算（流動性、安全性、収益性、効率性、成長性）
- トレンド分析
- ベンチマーク比較
- アラート検出
- 推奨事項生成

**配置:** `src/services/ai/analyzers/`

---

## データフロー

```
1. ユーザー入力
   │
   ▼
2. Intent Router による分類
   │  financial_analysis / tax_analysis / strategic_advice 等
   ▼
3. Context Manager による文脈構築
   │  会話履歴、財務データ、ユーザー設定
   ▼
4. Model Selector によるモデル選択
   │  複雑度スコアに基づく最適モデル選択
   ▼
5. Persona System によるプロンプト生成
   │  専門家ペルソナ適用、制約付与
   ▼
6. LLM Provider による推論実行
   │  タイムアウト、リトライ、フォールバック
   ▼
7. Response Synthesizer による統合
   │  複数ペルソナ結果の統合、一貫性確保
   ▼
8. ユーザーへの応答
```

---

## API エンドポイント

### チャットAPI

```
POST /api/chat
├── Request:  { message, sessionId?, context?, options? }
└── Response: { sessionId, response, metadata, suggestedFollowups? }

POST /api/chat/stream
├── Request:  { message, sessionId?, context?, options? }
└── Response: SSE Stream
```

### 分析API

```
POST /api/analysis/financial
├── Request:  { companyId, period, options? }
└── Response: { analysisId, summary, sections, alerts, recommendations }

GET /api/analysis/ratios?companyId=xxx&period=2024-03
└── Response: { period, ratios, previousPeriod? }

POST /api/analysis/benchmark
├── Request:  { companyId, metrics, comparisonContext }
└── Response: { comparisons, overallPosition }

POST /api/analysis/report
├── Request:  { type, companyId, period, format, options? }
└── Response: Report file (PDF/Excel) or JSON
```

---

## 設定

### 環境変数

```bash
# プロバイダー選択
AI_PROVIDER=openai|claude|gemini|openrouter
AI_MOCK_MODE=false

# API キー
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-or-...

# モデル設定（オプション）
OPENAI_MODEL=gpt-4.1-mini
CLAUDE_MODEL=claude-sonnet-4-20250514
GEMINI_MODEL=gemini-2.0-flash

# グローバル設定
AI_TEMPERATURE=0.1
AI_MAX_TOKENS=4096
AI_TIMEOUT=30000

# フォールバックチェーン
AI_PROVIDERS=openai,claude,gemini
AI_RETRIES=3
```

### モックモード

開発時はモックモードを使用してLLM呼び出しをスキップ：

```bash
AI_MOCK_MODE=true
```

---

## 実装原則

### LLM-First
全レイヤーにLLMを統合し、専門家の視点で判断を行う。

### Model Selection
タスク複雑度に応じて最適なモデルを選択し、コストと品質のバランスを最適化。

### Expert Personas
公認会計士・税理士・CFO・財務アナリストの4ペルソナによる多角的な分析。

### Neutral & Objective
中立的・客観的で根拠に基づく分析を提供。推測と事実を明確に区別。

---

## 品質基準

全てのAI機能実装は以下の品質基準を遵守（詳細: [QUALITY_STANDARDS.md](./QUALITY_STANDARDS.md)）：

| # | 基準 | 概要 |
|---|------|------|
| 1 | 安定性 | タイムアウト、リトライ、graceful degradation |
| 2 | 堅牢性 | 入力バリデーション、例外処理 |
| 3 | 再現性 | 設定のバージョン管理、決定論的処理 |
| 4 | 拡張性 | プラグインパターン、インターフェース分離 |
| 5 | メンテナンス性 | 単一責任、ドキュメント |
| 6 | セキュリティ | 入力サニタイゼーション、機密情報保護 |
| 7 | パフォーマンス | キャッシング、並列処理 |
| 8 | 文法・構文エラー防止 | strict mode、型定義完全性 |
| 9 | 関数・引数設計 | オブジェクト引数、Result型 |
| 10 | 全体整合性 | 既存コード整合、パターン統一 |

---

## ディレクトリ構成

```
src/
├── lib/ai/
│   ├── personas/          # Expert Persona System
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── base-persona.ts
│   │   ├── personas/      # 各ペルソナ実装
│   │   └── prompts/       # プロンプトテンプレート
│   ├── orchestrator/      # AI Orchestrator
│   │   ├── index.ts
│   │   ├── model-selector.ts
│   │   ├── task-classifier.ts
│   │   └── complexity-analyzer.ts
│   ├── context/           # Context Management
│   │   ├── context-manager.ts
│   │   └── conversation-store.ts
│   ├── prompts/           # Prompt Templates
│   │   ├── template-engine.ts
│   │   └── templates/
│   └── config/            # Configuration
│       ├── defaults.ts
│       └── model-config.ts
├── services/ai/
│   └── analyzers/         # Analysis Services
│       ├── financial-analyzer.ts
│       ├── ratio-analyzer.ts
│       └── ratios/
└── app/api/
    ├── chat/              # Chat API
    └── analysis/          # Analysis API
```

---

## 関連ドキュメント

### プロジェクト共通
- [AGENTS.md](../../AGENTS.md) - プロジェクトルール
- [セキュリティガイドライン](../SECURITY.md)
- [開発ガイド](../DEVELOPMENT.md)
- [テスト戦略](../TEST_STRATEGY.md)

### 設計関連
- [API設計](../API_DESIGN.md)
- [データベース設計](../DATABASE_DESIGN.md)

---

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-03-08 | 1.1.0 | 品質基準10項目整理、参照フロー追加 |
| 2025-03-08 | 1.0.0 | 初版作成 |

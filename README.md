# freee_audit - 会計freee連携AI監査・分析プラットフォーム

## 目次

1. [概要](#1-概要)
2. [ビジネス価値](#2-ビジネス価値)
3. [AIによる支援機能](#3-aiによる支援機能)
4. [機能一覧](#4-機能一覧)
5. [業務別活用ガイド](#5-業務別活用ガイド)
6. [クイックスタート](#6-クイックスタート)
7. [システム構成](#7-システム構成)
8. [技術スタック](#8-技術スタック)
9. [API・拡張](#9-api拡張)
10. [セキュリティ・コンプライアンス](#10-セキュリティコンプライアンス)
11. [運用ガイド](#11-運用ガイド)
12. [トラブルシューティング](#12-トラブルシューティング)
13. [FAQ](#13-faq)
14. [プロジェクト情報](#14-プロジェクト情報)
15. [ドキュメント](#15-ドキュメント)

---

## 1. 概要

freee_auditは、会計freeeの仕訳データをAIで自動監査し、月次決算資料（BS/PL/CF）の自動作成と経営指標の可視化を行うプラットフォームです。

### ターゲットユーザー

| ユーザー | 主な活用目的 |
|---------|-------------|
| **経営者・CFO** | 資金繰り管理、Runway分析、投資判断支援 |
| **経理・財務担当** | 月次決算効率化、仕訳監査、レポート作成 |
| **IPO準備企業** | DD準備、開示資料作成、内部統制構築 |
| **投資家** | 投資先モニタリング、KPI確認（ポータル経由） |
| **開発者** | システム拡張、カスタマイズ、API連携 |

### 主な特徴

- **仕訳監査**: AI（OpenAI/Gemini/Claude）による証憑整合性検証
- **レポート作成**: 貸借対照表・損益計算書・キャッシュフロー計算書の自動生成
- **経営指標**: ROE/ROA/Runway/Burn Rate等のKPI分析
- **予実管理**: 予算対実績の追跡・可視化
- **企業評価**: DCF法・類似企業比較法・Monte Carloシミュレーション
- **DD支援**: IPO・M&A向けデューデリジェンス自動化
- **会計基準変換**: JGAAP↔IFRS変換・調整仕訳生成
- **多言語対応**: 日本語/英語
- **為替換算**: 月末TTMレートによるデュアルカレンシー表示

---

## 2. ビジネス価値

### 2.1 解決する課題

| 課題 | 従来の対応 | freee_auditによる解決 |
|------|-----------|----------------------|
| 月次決算の時間 | 2週間〜1ヶ月 | 2日〜1週間に短縮 |
| 仕訳監査の人的ミス | 目視確認 | AI自動検証 |
| Runwayの見える化 | Excel管理 | リアルタイムダッシュボード |
| IPO準備の工数 | 200時間/件 | 40時間/件に削減 |
| 税務リスクの見落とし | 事後発見 | 予兆検知・アラート |

### 2.2 業務別ROI

| 業務 | 従来工数 | 導入後工数 | 削減効果 |
|------|---------|-----------|---------|
| 月次決算 | 40時間/月 | 8時間/月 | **80%削減** |
| 仕訳監査 | 20時間/月 | 2時間/月 | **90%削減** |
| DD準備 | 200時間/件 | 40時間/件 | **80%削減** |
| IR資料作成 | 16時間/四半期 | 4時間/四半期 | **75%削減** |
| 取締役会資料 | 8時間/月 | 1時間/月 | **87%削減** |

### 2.3 導入効果の想定

**スタートアップ企業**
- Burn Rateの可視化で資金調達タイミングを最適化
- 投資家への定期報告工数を大幅削減

**IPO準備企業**
- DD準備の自動化で上場準備期間を短縮
- 開示資料の品質向上と作成工数削減

**中堅・大手企業**
- 月次決算の早期化による経営判断の迅速化
- グループ会社の財務状況の一元管理

---

## 3. AIによる支援機能

### 3.1 AIアーキテクチャ

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
│ ・税理士          │ ・Ratio Analyzer      │ ・Prompt Template Engine  │
│ ・CFO             │ ・Benchmark Service   │ ・Token Counter           │
│ ・財務アナリスト  │                       │ ・Conversation Store      │
└───────────────────┴───────────────────────┴───────────────────────────┘
                                     │
┌───────────────────────────────────▼─────────────────────────────────────┐
│                        LLM Provider Layer                                │
│  OpenAI  │  Claude  │  Gemini  │  OpenRouter  │  (Fallback Chain)      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Expert Persona System

4種類の専門家ペルソナが、それぞれの視点から分析を提供します。

#### 公認会計士（CPA）

| 項目 | 内容 |
|------|------|
| **専門分野** | 監査基準、JGAAP/IFRS準拠性、開示事項 |
| **活用場面** | 決算書類の妥当性確認、開示事項の検討、監査対応 |
| **出力例** | `【監査人の視点から】売上計上基準について、進行基準の適用において進捗度の客観的な証拠が不足している可能性があります。推奨: 第三者確認書の取得を検討してください。` |

#### 税理士

| 項目 | 内容 |
|------|------|
| **専門分野** | 法人税法、消費税法、租税特別措置法 |
| **活用場面** | 税務リスク評価、節税機会の特定、税務調査対応 |
| **出力例** | `【税務上の取扱いとして】繰延税金資産の回収可能性について、将来5年の課税所得見込みを踏まえ、評価性引当金の計上を検討する必要があります。` |

#### CFO

| 項目 | 内容 |
|------|------|
| **専門分野** | 財務戦略、資金調達、投資判断、ステークホルダー対応 |
| **活用場面** | キャッシュフロー予測、投資家対応、経営戦略立案 |
| **出力例** | `【経営陣の視点から】現在のBurn Rateに基づくと、Runwayは8.2ヶ月です。6ヶ月以内の資金調達、または月次支出15%削減を検討することを推奨します。` |

#### 財務アナリスト

| 項目 | 内容 |
|------|------|
| **専門分野** | 企業評価、業界ベンチマーク、投資分析 |
| **活用場面** | バリュエーション、競合比較、投資判断材料の提供 |
| **出力例** | `【投資判断の材料として】同業他社平均のEV/EBITDAマルチプルは8.5倍です。御社の現在のEBITDAに基づくと、想定企業価値はXX億円となります。` |

### 3.3 AI分析フロー

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

### 3.4 モデル選択戦略

タスクの複雑度に応じて最適なLLMモデルを自動選択します。

| タスク種別 | 複雑度スコア | 推奨モデル | 用例 |
|-----------|-------------|-----------|------|
| complex_reasoning | 70-100 | Claude Sonnet 4 / GPT-4.1 | 戦略判断、M&A分析 |
| detailed_analysis | 50-69 | Claude Sonnet 4 / GPT-4.1 | 財務分析、税務判定 |
| standard_analysis | 30-49 | GPT-4.1-mini / Gemini 2.0 Flash | 通常の分析、説明 |
| fast_response | 0-29 | GPT-5-nano | 分類、抽出 |

### 3.5 AIでできること・できないこと

#### できること

- 財務データに基づく客観的分析
- 複数の観点からのリスク評価
- 法令・基準に基づく推奨事項の提示
- 大量データの効率的な処理・分析
- トレンド・異常値の自動検出

#### できないこと（人間の判断が必要）

- 最終的な意思決定
- 法的責任を伴う判断
- 将来の確実な予測
- 複雑な交渉・説得
- 倫理的判断の最終決定

---

## 4. 機能一覧

### 4.1 コア機能

| カテゴリ | 機能 | 説明 | AI活用 |
|---------|------|------|--------|
| **仕訳監査** | AI証憑分析 | 証憑と仕訳の整合性を自動検証 | ○ |
| | Slack通知 | 監査結果をリアルタイム通知 | - |
| | 監査ログ | 全操作の追跡可能なログ | - |
| **レポート** | BS/PL/CF | 財務諸表の自動生成 | ○ |
| | 資金繰り表 | 月次キャッシュフロー管理 | ○ |
| | 予実管理表 | 予算対実績の対比分析 | ○ |
| **経営指標** | KPIダッシュボード | 収益性・効率性・安全性指標 | ○ |
| | Runway計算 | 資金繰り維持期間の可視化 | ○ |
| | Burn Rate分析 | 月次資金消費率の追跡 | ○ |
| **出力** | PDF/PowerPoint/Excel | レポートの各形式出力 | - |
| **為替** | USD/JPY換算 | 月末TTMレートによる換算 | - |

### 4.2 高度機能

#### 企業評価（Valuation）

| 機能 | 説明 | AI活用 |
|------|------|--------|
| DCF法 | フリーキャッシュフロー割引法による企業価値算定 | ○ |
| WACC計算 | 加重平均資本コスト算定（CAPM対応） | ○ |
| 類似企業比較法 | マルチプル法による評価（PER/PBR/EV-EBITDA等） | ○ |
| Monte Carloシミュレーション | 確率的シミュレーションによる価値幅算定 | - |
| Black-Scholesモデル | ストックオプション評価 | - |
| シナリオ分析 | 楽観・ベース・悲観シナリオの比較分析 | ○ |
| 感度分析 | パラメータ変動による価値感度分析 | - |

#### デューデリジェンス（DD）

| 機能 | 説明 | AI活用 |
|------|------|--------|
| IPO短期レビュー | 上場準備向け財務チェックリスト（30項目以上） | ○ |
| M&A財務DD | 財務デューデリジェンス自動化 | ○ |
| 税務DD | 税務リスク・繰延税金資産の評価 | ○ |
| 包括的DD | 全領域をカバーした包括的DD | ○ |
| DDレポート生成 | 指摘事項・推奨事項の自動レポート化 | ○ |

#### 会計基準変換

| 機能 | 説明 | AI活用 |
|------|------|--------|
| JGAAP→IFRS変換 | 日本基準から国際基準への変換 | ○ |
| JGAAP→US GAAP変換 | 日本基準から米国基準への変換 | ○ |
| 勘定科目マッピング | 自動的な科目対応付け | ○ |
| 調整仕訳生成 | 基準差異に伴う調整仕訳の自動作成 | ○ |
| 開示文書生成 | 注記・開示資料の自動作成 | ○ |
| 監査証跡管理 | 変換プロセスの追跡・記録 | - |

#### 調整項目（会計基準変換）

| 項目 | 内容 |
|------|------|
| 売上認識 | 進行基準・完成基準の調整 |
| リース分類 | オペレーティング・ファイナンスリースの再分類 |
| のれん減損 | 減損テスト・減損認識 |
| 外貨換算 | 為替レート適用の調整 |
| 金融商品 | 時価評価・ヘッジ会計 |
| 退職給付 | 年金債務・年金資産の再計算 |
| 繰延税金 | 一時差異の分析・認識 |
| 企業結合 | のれん計算・PPA |

### 4.3 その他の機能

| カテゴリ | 機能 | 説明 | AI活用 |
|---------|------|------|--------|
| **取締役会** | 議題管理 | 定型議題の自動生成 | ○ |
| | AI分析 | 議題の法的要件分析 | ○ |
| | 報告書生成 | 取締役会資料の自動作成 | ○ |
| **IR** | レポート作成 | IR資料の自動生成 | ○ |
| | FAQ生成 | 投資家向けFAQ作成 | ○ |
| | 株主構成管理 | 株主データの管理・可視化 | - |
| | PowerPoint出力 | IR資料のPPT出力 | - |
| **社会保険** | スケジュール管理 | 保険料支払いの期日管理 | - |
| | 仕訳マッチング | 保険料仕訳の自動照合 | - |
| | 従業員保険追跡 | 加入状況の追跡 | - |
| **固定資産** | 減価償却計算 | 定額法・定率法・級数法対応 | - |
| | 月次償却仕訳 | 償却仕訳の自動生成 | - |
| **OCR** | 証憑読み取り | 請求書・領収書の自動読取 | - |
| **仕訳提案** | AI入力支援 | 入力時の仕訳候補提示 | ○ |
| **類似企業選定** | AI推奨 | 業界・規模に基づく類似企業推奨 | ○ |
| **ベンチマーク** | 業界比較 | 業種別財務比率との比較 | ○ |

---

## 5. 業務別活用ガイド

### 5.1 月次決算フロー

```
┌──────────────────────────────────────────────────────────────┐
│ 1. freeeデータ同期（自動/日次）                               │
│    └─ 仕訳・試算表・証憑データの自動取得                       │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. 仕訳監査実行（AI証憑分析）                                  │
│    └─ 証憑と仕訳の整合性検証、Slack通知                        │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. 月次調整入力                                               │
│    └─ 棚卸調整・減価償却・未払費用等                          │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. 財務諸表生成（自動）                                        │
│    └─ BS/PL/CFの自動作成                                      │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. AI財務分析レポート生成                                      │
│    └─ 4ペルソナによる多角的な分析・推奨事項                    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. 経営指標ダッシュボード更新                                  │
│    └─ KPI・Runway・予実管理の自動更新                         │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. 取締役会報告書生成                                          │
│    └─ 定型フォーマットでの報告資料自動作成                      │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 IPO準備での活用

| フェーズ | 期間 | 使用機能 | 主な出力物 |
|---------|------|---------|-----------|
| **準備段階** | IPO決定〜1年前 | 企業評価、財務分析、内部統制構築 | 財務状況レポート、改善計画書 |
| **DD準備** | 6ヶ月〜1年前 | IPO短期レビュー、各種検証 | DDチェックリスト、指摘事項一覧 |
| **開示準備** | 3ヶ月〜6ヶ月前 | 会計基準変換、開示文書生成 | 有価証券報告書案、注記資料 |
| **IR準備** | 1ヶ月〜3ヶ月前 | IR資料作成、FAQ生成 | IR資料、投資家向けFAQ |

### 5.3 M&A対応

```
ターゲット選定
    │
    ├─ 類似企業選定（AI推奨）
    │
    ├─ ベンチマーク分析
    │
    ▼
価格算定
    │
    ├─ DCF評価
    │
    ├─ 類似企業比較法
    │
    ├─ Monte Carloシミュレーション
    │
    ▼
DD実行
    │
    ├─ M&A財務DD
    │
    ├─ 税務DD
    │
    ├─ 関連当事者検証
    │
    ▼
統合計画
    │
    └─ 財務統合シミュレーション
```

### 5.4 投資家対応

| 場面 | 使用機能 | 提供内容 |
|------|---------|---------|
| 定期報告 | IRレポート、KPIダッシュボード | 月次・四半期レポート |
| 質問対応 | FAQ生成、AI分析 | 投資家向けFAQ、質問回答 |
| 資金調達 | Runway分析、企業評価 | 資金繰り状況、バリュエーション |
| 投資家ポータル | 専用ポータル | 制限付きレポート閲覧 |

---

## 6. クイックスタート

### 6.1 前提条件

- Node.js 20.x LTS
- pnpm 8.x
- （本番）PostgreSQL データベース
- （本番）freee API アクセストークン

### 6.2 インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-org/freee_audit.git
cd freee_audit

# 依存関係インストール
pnpm install

# 環境変数設定
cp .env.example .env.local

# データベース初期化
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 開発サーバー起動
pnpm dev
```

### 6.3 初期ログイン

シードデータ作成後、以下でログイン可能：

- Email: `admin@example.com`
- Password: `admin123`

### 6.4 モック環境での実行（開発用）

外部API（freee、OpenAI等）に接続せずにシステムを動作させることができます。

#### モックモードの有効化

`.env.local` に以下の設定を追加：

```bash
# Mock Mode Settings
FREEE_MOCK_MODE=true
AI_MOCK_MODE=true

# Database
DATABASE_URL="file:./dev.db"

# Authentication
NEXTAUTH_SECRET="dev-secret-key-for-mock-environment"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="dev-jwt-secret-key-for-mock-environment"

# Encryption (32バイトの16進数)
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

#### モック化される機能

| 機能 | モック内容 |
|------|----------|
| freee API | 仕訳データ、試算表、BS/PL を自動生成 |
| AI証憑分析 | ランダムな分析結果を返却（200-500ms遅延） |
| Slack通知 | 自動無効化（コンソールログのみ） |

### 6.5 本番環境への切り替え

実際のAPIキーを取得したら、環境変数を以下のように変更：

```bash
FREEE_MOCK_MODE=false
AI_MOCK_MODE=false

# freee API
FREEE_CLIENT_ID="your-client-id"
FREEE_CLIENT_SECRET="your-client-secret"
FREEE_REDIRECT_URI="http://localhost:3000/api/auth/freee/callback"

# AI APIs（いずれか一つ以上）
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GEMINI_API_KEY="..."
OPENROUTER_API_KEY="sk-or-..."

# Slack（オプション）
SLACK_BOT_TOKEN="xoxb-..."
SLACK_CHANNEL_ID="C..."

# Database（本番）
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

---

## 7. システム構成

### 7.1 アーキテクチャ図

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│         (Next.js Pages, Components, Charts)             │
├─────────────────────────────────────────────────────────┤
│                   Application Layer                      │
│           (API Routes, Services, Jobs)                  │
├─────────────────────────────────────────────────────────┤
│                      Domain Layer                        │
│       (Business Logic, Validation Rules)                │
├─────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                    │
│       (DB, External APIs, File Storage)                 │
└─────────────────────────────────────────────────────────┘
```

### 7.2 データフロー

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  freee   │───▶│  Data    │───▶│ Analysis │───▶│  Output  │
│   API    │    │  Sync    │    │  Engine  │    │  Layer   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                     │
                                     ▼
                               ┌──────────┐
                               │    AI    │
                               │ Process  │
                               └──────────┘
```

### 7.3 外部連携

| サービス | 用途 | データフロー |
|---------|------|-------------|
| freee API | 会計データ取得（仕訳・試算表・証憑） | 双方向 |
| OpenAI / Gemini / Claude | AI証憑分析・財務分析 | 送信のみ |
| OpenRouter | マルチモデルアクセス | 送信のみ |
| Slack API | 監査結果通知 | 送信のみ |
| Box API | ファイルストレージ（本番環境） | 双方向 |

---

## 8. 技術スタック

### 8.1 フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js | 14.x | フルスタックフレームワーク（App Router） |
| TypeScript | 5.x | 型安全な開発 |
| Tailwind CSS | 3.x | スタイリング |
| Recharts | 2.x | グラフ描画 |
| next-intl | 3.x | 国際化（i18n） |

### 8.2 バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js API Routes | 14.x | RESTful API |
| Prisma | 5.x | ORM |
| Node.js | 20.x LTS | ランタイム |

### 8.3 Pythonマイクロサービス

| サービス | 用途 |
|---------|------|
| OCR Server | 証憑OCR処理（Yomitaku / NDLOCR） |
| Statistical Analysis | 高度統計分析 |
| KPI Calculator | 複雑KPI計算 |
| Cashflow Calculator | キャッシュフロー計算 |

### 8.4 データベース

| 環境 | 技術 | 用途 |
|------|------|------|
| PoC | SQLite | ローカル開発 |
| 本番 | PostgreSQL | クラウド本番 |

### 8.5 LLMプロバイダー

| プロバイダー | デフォルトモデル | Input価格 | Output価格 | ZDR対応 | データ所在地 |
|------------|----------------|----------|-----------|---------|-------------|
| OpenAI | gpt-5.4-nano | $0.20/MTok | $1.25/MTok | No | US |
| Claude | claude-sonnet-4-6-20250514 | $3.00/MTok | $15.00/MTok | Yes | US |
| Gemini | gemini-2.5-flash-preview-05-20 | $0.15/MTok | $0.60/MTok | No | US, EU |
| OpenRouter | openai/gpt-5.4-nano | $0.20/MTok | $1.25/MTok | Yes | US, EU, GLOBAL |

#### モデル選択の推奨

| 用途 | 推奨モデル | 理由 |
|------|-----------|------|
| 高速処理・分類 | GPT-5.4 nano | 最も低コスト、高速 |
| 標準的な分析 | Gemini 2.5 Flash | コストパフォーマンス最高 |
| 高品質な分析 | Claude Sonnet 4.6 | 最高品質の分析 |
| 戦略判断 | Claude Opus 4.6 / GPT-5.4 | 最も知的な判断 |

#### 価格比較（1MTokあたり）

| カテゴリ | 最安値 | 最高品質 |
|---------|--------|---------|
| **OpenAI** | GPT-5.4 nano ($0.20/$1.25) | GPT-5.4 ($2.50/$15.00) |
| **Claude** | Haiku 4.5 ($1.00/$5.00) | Opus 4.6 ($5.00/$25.00) |
| **Gemini** | 2.5 Flash ($0.15/$0.60) | 2.5 Pro ($1.25/$10.00) |

### 8.6 環境変数

```bash
# Database
DATABASE_URL="file:./dev.db"                    # PoC: SQLite
# DATABASE_URL="postgresql://..."               # 本番: PostgreSQL

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# freee API
FREEE_CLIENT_ID="your-client-id"
FREEE_CLIENT_SECRET="your-client-secret"
FREEE_REDIRECT_URI="http://localhost:3000/api/auth/freee/callback"
FREEE_MOCK_MODE="true"                         # 開発時はtrue

# AI APIs（いずれか一つ以上）
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="..."
ANTHROPIC_API_KEY="sk-ant-..."
OPENROUTER_API_KEY="sk-or-..."

# AI設定（オプション）
AI_PROVIDER=openai                              # デフォルトプロバイダー
AI_MOCK_MODE=false                              # モックモード
AI_TEMPERATURE=0.1                              # 生成温度
AI_MAX_TOKENS=4096                              # 最大トークン数
OPENAI_MODEL=gpt-5.4-nano                       # OpenAIモデル指定
CLAUDE_MODEL=claude-sonnet-4-6-20250514         # Claudeモデル指定
GEMINI_MODEL=gemini-2.5-flash-preview-05-20     # Geminiモデル指定

# Slack（オプション）
SLACK_BOT_TOKEN="xoxb-..."
SLACK_CHANNEL_ID="C..."

# Box API（本番のみ）
BOX_CLIENT_ID="..."
BOX_CLIENT_SECRET="..."
BOX_ENTERPRISE_ID="..."

# Encryption
ENCRYPTION_KEY="32-byte-hex-string"            # 32バイトの16進数文字列
```

---

## 9. API・拡張

### 9.1 主要APIエンドポイント

#### チャットAPI

```
POST /api/chat
├── Request:  { message, sessionId?, context?, options? }
└── Response: { sessionId, response, metadata, suggestedFollowups? }

POST /api/chat/stream
├── Request:  { message, sessionId?, context?, options? }
└── Response: SSE Stream
```

#### 分析API

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

#### 企業評価API

```
POST /api/valuation/dcf
├── Request:  { freeCashFlow, growthRate, terminalGrowthRate, discountRate, projectionYears }
└── Response: { enterpriseValue, terminalValue, steps }

POST /api/valuation/wacc
├── Request:  { mode, ...params }
└── Response: { wacc, steps, components }

POST /api/valuation/monte-carlo
├── Request:  { variables, formula, iterations }
└── Response: { statistics, distribution, histogram }
```

### 9.2 拡張方法

#### 新しいAIプロバイダーの追加

1. `src/lib/integrations/ai/` にプロバイダー実装を作成
2. `AIProvider` インターフェースを実装
3. `src/lib/integrations/ai/provider-registry.ts` に登録
4. 環境変数を追加

#### 新しいペルソナの追加

1. `src/lib/ai/personas/personas/` にペルソナ実装を作成
2. `BasePersona` クラスを継承
3. `src/lib/ai/personas/registry.ts` に登録
4. プロンプトテンプレートを追加

### 9.3 カスタマイズ

| 設定項目 | 設定方法 | 用途 |
|---------|---------|------|
| デフォルトモデル | 環境変数 / DB | ユーザー・会社別モデル設定 |
| 温度パラメータ | 環境変数 `AI_TEMPERATURE` | AI出力の多様性調整 |
| タイムアウト | 環境変数 `AI_TIMEOUT` | API応答待機時間 |
| フォールバック順 | 環境変数 `AI_PROVIDERS` | プロバイダー障害時の順序 |

---

## 10. セキュリティ・コンプライアンス

### 10.1 実装済み対策

| 項目 | 実装内容 | 詳細 |
|------|---------|------|
| CSRF保護 | トークンベース | 全フォームで実装 |
| 入力値検証 | Zodスキーマ | APIレベルで実施 |
| レートリミット | API アクセス制限 | エンドポイント別設定 |
| 暗号化 | AES-256-GCM | APIキー・トークン保存時 |
| パスワード | bcrypt (cost=12) | ソルト付きハッシュ |
| セキュリティヘッダー | X-Frame-Options, CSP等 | 全レスポンス |
| 監査ログ | 全操作ログ | 7年保持 |

### 10.2 データ保護

| データ種別 | 保護方法 | 保持期間 |
|-----------|---------|---------|
| 会計データ | 暗号化保存 | 7年（法的要件） |
| API認証情報 | AES-256-GCM暗号化 | 無期限（取り下げ可能） |
| 監査ログ | 改ざん防止 | 7年 |
| AI対話履歴 | 暗号化保存 | 1年 |

### 10.3 ロールベースアクセス制御

| ロール | 権限 |
|--------|------|
| **Admin** | 全機能アクセス、設定変更、ユーザー管理 |
| **Accountant** | 監査実行、レポート作成、予算入力 |
| **Viewer** | レポート閲覧のみ |
| **Investor** | 投資家ポータル閲覧のみ（read-only） |

### 10.4 アクセス制御マトリックス

| リソース | Admin | Accountant | Viewer | Investor |
|---------|-------|------------|--------|----------|
| ダッシュボード | ✅ | ✅ | ✅ | ❌ |
| 仕訳監査 | ✅ | ✅ | 読取 | ❌ |
| レポート | ✅ | ✅ | ✅ | ✅ |
| 予算管理 | ✅ | ✅ | 読取 | ❌ |
| 設定 | ✅ | ❌ | ❌ | ❌ |
| ユーザー管理 | ✅ | ❌ | ❌ | ❌ |

---

## 11. 運用ガイド

### 11.1 デプロイ

#### Docker Compose（本番）

```bash
# 本番環境起動
docker-compose up app

# 環境変数確認
docker-compose config
```

#### 手動デプロイ

```bash
# ビルド
pnpm build

# マイグレーション
pnpm db:migrate

# 起動
pnpm start
```

### 11.2 監視・ロギング

| ログ種別 | 場所 | 保持期間 |
|---------|------|---------|
| アプリケーションログ | `/var/log/app/` | 30日 |
| 監査ログ | DB (AuditLog) | 7年 |
| AI処理ログ | DB (AILog) | 1年 |

### 11.3 バックアップ

| 対象 | 頻度 | 保持期間 |
|------|------|---------|
| データベース | 日次 | 30日 |
| 設定ファイル | 変更時 | 無期限 |
| 監査ログ | 日次 | 7年 |

### 11.4 CI/CDパイプライン

1. **Lint**: ESLintによるコード品質チェック
2. **TypeCheck**: TypeScript型チェック
3. **Unit Tests**: Vitestによる単体テスト
4. **Integration Tests**: 統合テスト
5. **E2E Tests**: PlaywrightによるE2Eテスト
6. **Security Audit**: 依存パッケージ脆弱性チェック
7. **Build**: 本番ビルド

```bash
# CIと同等のチェックをローカルで実行
pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build
```

---

## 12. トラブルシューティング

### 12.1 よくある問題

#### freee API接続エラー

| 項目 | 内容 |
|------|------|
| **症状** | freeeデータが同期されない |
| **原因** | トークン期限切れ、ネットワーク問題 |
| **対処** | 設定画面でfreee連携を再認証、ネットワーク接続確認 |

#### AI分析が返ってこない

| 項目 | 内容 |
|------|------|
| **症状** | AI分析リクエストがタイムアウト |
| **原因** | APIキー無効、レートリミット、ネットワーク |
| **対処** | 1. APIキーの有効性確認 2. `AI_MOCK_MODE=true` で動作確認 3. ネットワーク接続確認 |

#### モックモードで動作しない

| 項目 | 内容 |
|------|------|
| **症状** | モックモードでもエラーが発生 |
| **原因** | データベース未初期化 |
| **対処** | `pnpm db:migrate && pnpm db:seed` |

#### 日本語が文字化けする

| 項目 | 内容 |
|------|------|
| **症状** | AI出力や画面表示で日本語が化ける |
| **原因** | エンコーディング設定 |
| **対処** | システムロケール設定、ブラウザエンコーディング確認 |

### 12.2 ログ確認方法

```bash
# アプリケーションログ
tail -f /var/log/app/application.log

# エラーログのみ
grep ERROR /var/log/app/application.log

# AI処理ログ
grep "AI:" /var/log/app/application.log
```

### 12.3 パフォーマンス問題

| 症状 | 原因 | 対処 |
|------|------|------|
| レスポンスが遅い | 大量データ処理 | データを分割して処理 |
| AI分析が遅い | 複雑なクエリ | データを事前にフィルタリング |
| メモリ使用量増加 | 長時間稼働 | 定期的なプロセス再起動 |

---

## 13. FAQ

### Q1: どのAIプロバイダーを選べばいいですか？

| 優先事項 | 推奨プロバイダー | 理由 |
|---------|-----------------|------|
| コスト重視 | OpenAI (gpt-5-nano) | 最も低コスト |
| 品質重視 | Claude (claude-sonnet-4) | 最高品質の分析 |
| データ所在地 | Gemini (EUリージョン) | EU内データ保持 |
| 可用性重視 | OpenRouter | マルチモデル・フォールバック |

### Q2: AI分析の結果は信頼できますか？

AI分析は「意思決定の支援」であり、最終判断は人間が行うべきです。特に以下の場合は専門家の確認を推奨：

- 法的・税務的な判断
- 重要な投資判断
- 外部への開示資料
- 複雑な会計処理

### Q3: データはどこに保存されますか？

| 環境 | 保存場所 | 暗号化 |
|------|---------|--------|
| PoC | ローカルSQLite | OS標準 |
| 本番 | クラウドPostgreSQL | AES-256-GCM |

### Q4: 既存のfreeeデータをインポートできますか？

はい。freee API経由で過去データも同期可能です。初回同期時に期間を指定してください。

### Q5: 英語対応していますか？

はい。日本語/英語のUI切替、AI分析の多言語出力に対応しています。

### Q6: カスタムKPIを追加できますか？

はい。カスタムKPIサービスで計算式を定義することで、独自のKPIを追加できます。

### Q7: 複数会社の管理に対応していますか？

はい。マルチテナント対応で、複数会社のデータを切り替えて管理できます。

---

## 14. プロジェクト情報

### 14.1 ロードマップ

| 四半期 | 予定機能 |
|--------|---------|
| 2024 Q2 | OCR精度向上、モバイル対応 |
| 2024 Q3 | 連結決算対応、予算管理強化 |
| 2024 Q4 | BI連携、API拡充 |
| 2025 Q1 | AI精度向上、新ペルソナ追加 |

### 14.2 既知の制限

| 項目 | 制限内容 | 回避策 |
|------|---------|--------|
| 同時ユーザー数 | 100ユーザーまで | スケーリング設定で対応 |
| 1回のAI分析 | 最大10,000トークン | データを分割して分析 |
| OCR処理 | PDF最大20ページ | 分割してアップロード |
| 履歴保持 | AI対話1年、監査ログ7年 | 定期的なエクスポート |

### 14.3 テストカバレッジ

目標: **80%以上**

```bash
pnpm test:coverage

# レポート確認
open coverage/index.html
```

### 14.4 開発コマンド

```bash
# 開発
pnpm dev              # 開発サーバー起動
pnpm build            # 本番ビルド
pnpm start            # 本番サーバー起動

# 品質チェック
pnpm lint             # ESLint実行
pnpm lint:fix         # ESLint自動修正
pnpm typecheck        # TypeScript型チェック
pnpm format           # Prettierフォーマット

# テスト
pnpm test             # 単体テスト実行
pnpm test:watch       # テスト監視モード
pnpm test:coverage    # カバレッジ付きテスト
pnpm test:integration # 統合テスト
pnpm e2e              # E2Eテスト（Playwright）

# データベース
pnpm db:generate      # Prismaクライアント生成
pnpm db:migrate       # マイグレーション実行
pnpm db:push          # スキーマ直接反映
pnpm db:studio        # Prisma Studio起動
pnpm db:seed          # シードデータ投入
pnpm db:reset         # データベースリセット

# セキュリティ
pnpm audit:check      # 依存パッケージ脆弱性チェック
```

---

## 15. ドキュメント

### 15.1 ドキュメント一覧

| ドキュメント | 内容 | 対象読者 |
|-------------|------|---------|
| [システム設計書](docs/DESIGN.md) | アーキテクチャ・セキュリティ設計 | 開発者 |
| [API設計書](docs/API_DESIGN.md) | 内部・外部API仕様 | 開発者 |
| [データベース設計書](docs/DATABASE_DESIGN.md) | ER図・スキーマ定義 | 開発者 |
| [機能仕様書](docs/FEATURES.md) | 各モジュールの詳細仕様 | 全員 |
| [開発ガイド](docs/DEVELOPMENT.md) | 開発ワークフロー・テスト戦略 | 開発者 |
| [デプロイガイド](docs/DEPLOYMENT.md) | インフラ構築・運用手順 | 運用者 |
| [テスト戦略](docs/TEST_STRATEGY.md) | テスト方針・カバレッジ目標 | 開発者 |
| [セキュリティガイドライン](docs/SECURITY.md) | セキュリティ要件・対策 | 開発者・運用者 |

### 15.2 AI機能ドキュメント

| ドキュメント | 内容 | 対象読者 |
|-------------|------|---------|
| [AI機能概要](docs/ai/README.md) | アーキテクチャ・コンポーネント | 開発者・経営者 |
| [品質基準](docs/ai/QUALITY_STANDARDS.md) | 10品質基準チェックリスト | 開発者 |
| [制約定義](docs/ai/CONSTRAINTS.md) | LLM制約・入力バリデーション | 開発者 |
| [タスク管理](docs/ai/TASKS.md) | 実装タスクの詳細 | 開発者 |

### 15.3 プロジェクト構成

```
freee_audit/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/           # 国際化ルート
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── dashboard/
│   │   │   ├── reports/
│   │   │   ├── budgets/
│   │   │   └── settings/
│   │   └── api/                # API Routes
│   │       ├── auth/
│   │       ├── chat/
│   │       ├── analysis/
│   │       └── valuation/
│   │
│   ├── components/             # Reactコンポーネント
│   │   ├── ui/                 # 基本UI（Button, Input等）
│   │   ├── charts/             # グラフコンポーネント
│   │   ├── reports/            # レポートコンポーネント
│   │   └── layout/             # レイアウトコンポーネント
│   │
│   ├── lib/                    # ユーティリティ
│   │   ├── db.ts              # Prismaクライアント
│   │   ├── auth.ts            # 認証
│   │   ├── crypto.ts          # 暗号化
│   │   ├── ai/                # AI機能
│   │   │   ├── personas/      # ペルソナシステム
│   │   │   │   ├── personas/  # 各ペルソナ実装
│   │   │   │   └── prompts/   # プロンプトテンプレート
│   │   │   ├── orchestrator/  # AIオーケストレーター
│   │   │   ├── prompts/       # プロンプトエンジン
│   │   │   ├── context/       # コンテキスト管理
│   │   │   ├── tokenizer/     # トークン計算
│   │   │   └── config/        # モデル設定
│   │   ├── integrations/      # 外部API連携
│   │   │   ├── freee/         # freee API
│   │   │   ├── ai/            # LLMプロバイダー
│   │   │   ├── slack/         # Slack API
│   │   │   └── box/           # Box API
│   │   └── security/          # セキュリティモジュール
│   │
│   ├── services/              # ビジネスロジック
│   │   ├── audit/             # 仕訳監査
│   │   ├── reports/           # レポート作成
│   │   │   └── ir/            # IR資料作成
│   │   ├── ai/                # AI分析サービス
│   │   │   └── analyzers/     # 各種分析器
│   │   ├── valuation/         # 企業評価
│   │   ├── dd/                # デューデリジェンス
│   │   ├── conversion/        # 会計基準変換
│   │   │   └── adjustments/   # 調整項目
│   │   ├── cashflow/          # 資金繰り
│   │   ├── budget/            # 予算管理
│   │   ├── benchmark/         # ベンチマーク分析
│   │   ├── peer-companies/    # 類似企業管理
│   │   ├── board/             # 取締役会管理
│   │   ├── social-insurance/  # 社会保険管理
│   │   ├── fixed-assets/      # 固定資産管理
│   │   ├── inventory/         # 棚卸管理
│   │   ├── ocr/               # OCR処理
│   │   ├── import/            # データインポート
│   │   └── export/            # 出力機能
│   │
│   ├── jobs/                  # 定期ジョブ
│   │   ├── scheduler.ts
│   │   ├── journal-sync.ts
│   │   └── audit-job.ts
│   │
│   └── types/                 # TypeScript型定義
│
├── prisma/
│   ├── schema.prisma          # データベーススキーマ
│   ├── migrations/
│   └── seeds/
│
├── tests/
│   ├── unit/                  # 単体テスト
│   ├── integration/           # 統合テスト
│   └── e2e/                   # E2Eテスト
│
├── messages/                  # i18n翻訳ファイル
│   ├── ja.json
│   └── en.json
│
├── docs/                      # ドキュメント
│   ├── ai/                    # AI機能ドキュメント
│   ├── DESIGN.md
│   ├── API_DESIGN.md
│   └── ...
│
├── python-service/            # Pythonマイクロサービス
│   └── app/
│       └── services/
│
├── ocr-server/                # OCRサーバー
│   └── main.py
│
├── infrastructure/            # インフラ設定
│   ├── terraform/
│   └── docker/
│
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

---

## ライセンス

Private - All Rights Reserved

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2024-03-23 | 2.0.0 | README全面改訂（AI機能詳細、業務ガイド、FAQ追加） |
| 2024-01-15 | 1.0.0 | 初版作成 |

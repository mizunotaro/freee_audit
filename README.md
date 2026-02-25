# freee_audit

会計freee仕訳監査・レポートシステム

## 概要

freee_auditは、会計freeeの仕訳データをAIで自動監査し、月次決算資料（BS/PL/CF）の自動作成と経営指標の可視化を行うシステムです。

### 主な特徴

- **仕訳監査**: AI（OpenAI/Gemini/Claude）による証憑整合性検証
- **レポート作成**: 貸借対照表・損益計算書・キャッシュフロー計算書の自動生成
- **経営指標**: ROE/ROA/Runway/Burn Rate等のKPI分析
- **予実管理**: 予算対実績の追跡・可視化
- **多言語対応**: 日本語/英語
- **為替換算**: 月末TTMレートによるデュアルカレンシー表示

---

## 機能一覧

| モジュール | 機能 | 説明 |
|-----------|------|------|
| **仕訳監査** | AI証憑分析 | 証憑と仕訳の整合性を自動検証 |
| | Slack通知 | 監査結果の自動通知 |
| | 監査ログ | 全操作のログ記録 |
| **レポート** | BS/PL/CF | 財務諸表の自動生成 |
| | 資金繰り表 | 月次キャッシュフロー管理 |
| | 予実管理表 | 予算対実績の対比分析 |
| **経営指標** | KPIダッシュボード | 収益性・効率性・安全性指標 |
| | Runway計算 | 資金繰り維持期間の可視化 |
| **出力** | PDF/PowerPoint/Excel | レポートの各形式出力 |
| **為替** | USD/JPY換算 | 月末TTMレートによる換算 |

---

## アーキテクチャ

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

### 外部連携

| サービス | 用途 |
|---------|------|
| freee API | 会計データ取得（仕訳・試算表・証憑） |
| OpenAI / Gemini / Claude | AI証憑分析 |
| Slack API | 監査結果通知 |
| Box API | ファイルストレージ（本番環境） |

---

## 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| **Framework** | Next.js (App Router) | 14.x |
| **Language** | TypeScript | 5.x |
| **Database** | SQLite (PoC) / PostgreSQL (本番) | - |
| **ORM** | Prisma | 5.x |
| **Styling** | Tailwind CSS | 3.x |
| **Charts** | Recharts | 2.x |
| **i18n** | next-intl | 3.x |
| **Testing** | Vitest + Playwright | - |
| **Runtime** | Node.js | 20.x LTS |

---

## クイックスタート

### 前提条件

- Node.js 20.x LTS
- pnpm 8.x

### インストール

```bash
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

### 初期ログイン

シードデータ作成後、以下でログイン可能：

- Email: `admin@example.com`
- Password: `admin123`

---

## プロジェクト構成

```
freee_audit/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/           # 国際化ルート
│   │   └── api/                # API Routes
│   ├── components/             # Reactコンポーネント
│   │   ├── ui/                 # 基本UI（Button, Input等）
│   │   ├── charts/             # グラフコンポーネント
│   │   └── export/             # 出力関連コンポーネント
│   ├── lib/                    # ユーティリティ
│   │   ├── db.ts              # Prismaクライアント
│   │   ├── auth.ts            # 認証
│   │   ├── crypto.ts          # 暗号化
│   │   ├── integrations/      # 外部API連携
│   │   └── security/          # セキュリティモジュール
│   ├── services/              # ビジネスロジック
│   │   ├── audit/             # 仕訳監査
│   │   ├── report/            # レポート作成
│   │   ├── analytics/         # KPI分析
│   │   ├── budget/            # 予算管理
│   │   ├── cashflow/          # 資金繰り
│   │   ├── currency/          # 為替換算
│   │   └── export/            # 出力機能
│   ├── jobs/                  # 定期ジョブ
│   └── types/                 # TypeScript型定義
├── prisma/
│   ├── schema.prisma          # データベーススキーマ
│   └── seed.ts                # シードデータ
├── tests/
│   ├── unit/                  # 単体テスト
│   ├── integration/           # 統合テスト
│   └── e2e/                   # E2Eテスト
├── messages/                  # i18n翻訳ファイル
│   ├── ja.json
│   └── en.json
├── docs/                      # ドキュメント
└── infrastructure/            # インフラ設定
```

---

## 環境変数

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

## 開発コマンド

### 開発

```bash
pnpm dev              # 開発サーバー起動
pnpm build            # 本番ビルド
pnpm start            # 本番サーバー起動
```

### 品質チェック

```bash
pnpm lint             # ESLint実行
pnpm lint:fix         # ESLint自動修正
pnpm typecheck        # TypeScript型チェック
pnpm format           # Prettierフォーマット
```

### テスト

```bash
pnpm test             # 単体テスト実行
pnpm test:watch       # テスト監視モード
pnpm test:coverage    # カバレッジ付きテスト
pnpm test:integration # 統合テスト
pnpm e2e              # E2Eテスト（Playwright）
pnpm e2e:ui           # E2EテストUIモード
```

### データベース

```bash
pnpm db:generate      # Prismaクライアント生成
pnpm db:migrate       # マイグレーション実行
pnpm db:push          # スキーマ直接反映
pnpm db:studio        # Prisma Studio起動
pnpm db:seed          # シードデータ投入
pnpm db:reset         # データベースリセット
```

### セキュリティ

```bash
pnpm audit:check      # 依存パッケージ脆弱性チェック
```

---

## セキュリティ

### 実装済み対策

| 項目 | 実装内容 |
|------|---------|
| CSRF保護 | トークンベースのCSRF対策 |
| 入力値検証 | Zodスキーマによるバリデーション |
| レートリミット | API アクセス制限 |
| 暗号化 | AES-256-GCM（APIキー・トークン） |
| パスワード | bcrypt (cost=12) |
| セキュリティヘッダー | X-Frame-Options, CSP等 |
| 監査ログ | 全操作のログ記録 |

### ロールベースアクセス制御

| ロール | 権限 |
|--------|------|
| Admin | 全機能アクセス、設定変更、ユーザー管理 |
| Accountant | 監査実行、レポート作成、予算入力 |
| Viewer | レポート閲覧のみ |
| Investor | 投資家ポータル閲覧のみ |

---

## CI/CD

### パイプライン

1. **Lint**: ESLintによるコード品質チェック
2. **TypeCheck**: TypeScript型チェック
3. **Unit Tests**: Vitestによる単体テスト
4. **Integration Tests**: 統合テスト
5. **E2E Tests**: PlaywrightによるE2Eテスト
6. **Security Audit**: 依存パッケージ脆弱性チェック
7. **Build**: 本番ビルド

### ローカルCI確認

```bash
# CIと同等のチェックを実行
pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build
```

---

## テストカバレッジ

目標: **80%以上**

```bash
pnpm test:coverage

# レポート確認
open coverage/index.html
```

---

## Docker

### 開発環境

```bash
docker-compose --profile dev up
```

### 本番環境

```bash
docker-compose up app
```

---

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [システム設計書](docs/DESIGN.md) | アーキテクチャ・セキュリティ設計 |
| [API設計書](docs/API_DESIGN.md) | 内部・外部API仕様 |
| [データベース設計書](docs/DATABASE_DESIGN.md) | ER図・スキーマ定義 |
| [機能仕様書](docs/FEATURES.md) | 各モジュールの詳細仕様 |
| [開発ガイド](docs/DEVELOPMENT.md) | 開発ワークフロー・テスト戦略 |
| [デプロイガイド](docs/DEPLOYMENT.md) | インフラ構築・運用手順 |

---

## ライセンス

Private - All Rights Reserved

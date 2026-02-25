# freee_audit

会計freee仕訳監査・レポートシステム

## 概要

freee_auditは、会計freeeの仕訳データをAIで自動監査し、月次決算資料（BS/PL/CF）の自動作成と経営指標の可視化を行うシステムです。

## 機能

- **仕訳監査**: AIによる証憑整合性検証
- **レポート作成**: BS/PL/CF自動生成
- **経営指標**: ROE/ROA/Runway等のKPI分析
- **予実管理**: 予算対実績の追跡
- **多言語対応**: 日本語/英語
- **為替換算**: デュアルカレンシー表示

## 技術スタック

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database**: SQLite (開発) / PostgreSQL (本番)
- **ORM**: Prisma 5
- **Testing**: Vitest + Playwright
- **Styling**: Tailwind CSS

## セットアップ

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

### 環境変数

```bash
# .env.local
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
ENCRYPTION_KEY="32-byte-hex-string"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# freee API
FREEE_CLIENT_ID="your-client-id"
FREEE_CLIENT_SECRET="your-client-secret"
FREEE_MOCK_MODE="true"

# AI APIs (optional)
OPENAI_API_KEY="sk-..."
```

## スクリプト

```bash
# 開発
pnpm dev              # 開発サーバー起動
pnpm build            # 本番ビルド
pnpm start            # 本番サーバー起動

# 品質チェック
pnpm lint             # ESLint実行
pnpm typecheck        # 型チェック

# テスト
pnpm test             # 単体テスト実行
pnpm test:watch       # テスト監視モード
pnpm test:coverage    # カバレッジ付きテスト
pnpm test:integration # 統合テスト
pnpm e2e              # E2Eテスト

# データベース
pnpm db:generate      # Prismaクライアント生成
pnpm db:migrate       # マイグレーション実行
pnpm db:studio        # Prisma Studio起動
pnpm db:seed          # シードデータ投入

# セキュリティ
pnpm audit:check      # 依存パッケージ脆弱性チェック
```

## プロジェクト構成

```
freee_audit/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/             # Reactコンポーネント
│   ├── lib/                    # ユーティリティ
│   │   ├── db.ts              # Prismaクライアント
│   │   ├── auth.ts            # 認証
│   │   ├── crypto.ts          # 暗号化
│   │   └── security/          # セキュリティモジュール
│   ├── services/              # ビジネスロジック
│   │   ├── audit/             # 監査サービス
│   │   ├── report/            # レポート作成
│   │   ├── analytics/         # KPI分析
│   │   └── currency/          # 為替換算
│   └── types/                 # TypeScript型定義
├── tests/
│   ├── unit/                  # 単体テスト
│   ├── integration/           # 統合テスト
│   └── e2e/                   # E2Eテスト
├── prisma/
│   └── schema.prisma          # データベーススキーマ
├── .github/workflows/         # CI/CD
├── infrastructure/docker/     # Docker設定
└── docs/                      # ドキュメント
```

## セキュリティ

### 実装済み対策

- **CSRF保護**: トークンベースのCSRF対策
- **入力値検証**: XSS/SQLインジェクション対策
- **レートリミット**: APIアクセス制限
- **暗号化**: AES-256-GCMによるデータ暗号化
- **セキュリティヘッダー**: X-Frame-Options, CSP等

### セキュリティ監査

```bash
# 脆弱性チェック実行
pnpm audit:check
```

## CI/CD

### パイプライン

1. **Lint**: ESLintによるコード品質チェック
2. **TypeCheck**: TypeScript型チェック
3. **Unit Tests**: Vitestによる単体テスト
4. **Integration Tests**: 統合テスト
5. **E2E Tests**: PlaywrightによるE2Eテスト
6. **Security Audit**: 依存パッケージ脆弱性チェック
7. **Build**: 本番ビルド

### CI/CD動作確認方法

```bash
# 1. ローカルでCIと同等のチェックを実行
pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build

# 2. GitHub Actionsのワークフローを確認
cat .github/workflows/ci.yml

# 3. PR作成時の自動チェック
# GitHubでPRを作成すると自動的にCIが実行されます

# 4. 手動でデプロイワークフローをトリガー
# GitHubのActionsタブから「Deploy」ワークフローを実行
```

## Docker

### 開発環境

```bash
# 開発モードで起動
docker-compose --profile dev up

# ビルド
docker-compose --profile dev build
```

### 本番環境

```bash
# 本番モードで起動
docker-compose up app

# ビルド
docker-compose build app
```

## テストカバレッジ

目標: **80%以上**

```bash
# カバレッジレポート生成
pnpm test:coverage

# レポート確認
open coverage/index.html
```

## ドキュメント

- [システム設計書](docs/DESIGN.md)
- [API設計書](docs/API_DESIGN.md)
- [データベース設計書](docs/DATABASE_DESIGN.md)
- [機能仕様書](docs/FEATURES.md)
- [開発ガイド](docs/DEVELOPMENT.md)
- [デプロイガイド](docs/DEPLOYMENT.md)

## ライセンス

Private - All Rights Reserved

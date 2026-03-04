# PROJECT.md

## Purpose

freee_auditは、会計freeeの仕訳データをAIで自動監査し、月次決算資料（貸借対照表・損益計算書・キャッシュフロー計算書）の自動作成と経営指標の可視化を行うシステムです。

## Scope

### In Scope

- 仕訳監査: AI証憑整合性検証（OpenAI/Gemini/Claude）
- レポート作成: BS/PL/CF自動生成
- 経営指標: ROE/ROA/Runway/Burn Rate等のKPI分析
- 予実管理: 予算対実績の追跡・可視化
- 出力機能: PDF/PowerPoint/Excel形式
- 多言語対応: 日本語/英語
- 為替換算: 月末TTMレートによるデュアルカレンシー表示
- 外部連携: freee API、Slack API、Box API（本番）

### Out of Scope

- 会計freeeの代替システム
- 完全自動決算（人的確認必須）
- OCR証憑読取（将来実装予定）
- 他会計ソフト対応（MF等）

## Architecture

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

## External Dependencies

| サービス | 用途 | 必須 |
|---------|------|------|
| freee API | 会計データ取得（仕訳・試算表・証憑） | Yes |
| OpenAI / Gemini / Claude | AI証憑分析 | Yes（いずれか1つ以上） |
| Slack API | 監査結果通知 | No |
| Box API | ファイルストレージ（本番環境） | 本番のみ |

## Constraints

### Technical Constraints

- Node.js >=20.0.0, pnpm >=8.0.0
- Database: SQLite (PoC) / PostgreSQL (本番)
- ORM: Prisma 5.x
- Framework: Next.js 14.x (App Router)

### CrystalBall Policy（厳守）

- **free_only**: 無料公開APIのみ使用
- **paywall excluded**: 有料機能は実装しない
- **audit required**: 全API呼び出しに監査ログ必須
- **Uncertain isolated**: 不確実な処理は分離し「要確認」へ
- **UA+rate control**: User-Agent明示 + レート制御実装
- **OCR deferred**: OCR処理は将来実装（PoCでは実装しない）

### Security Constraints

- 全APIキー・トークンは暗号化（AES-256-GCM）
- パスワードはbcrypt (cost=12) でハッシュ化
- CSRF保護、入力値検証（Zod）、レートリミット実装
- 監査ログ: 全操作を記録

### Compliance Constraints

- 個人情報・機密情報の適切な取り扱い
- 金融情報の暗号化・アクセス制御
- 監査証跡の保持

## Project Structure

```
freee_audit/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/           # 国際化ルート
│   │   └── api/                # API Routes
│   ├── components/             # Reactコンポーネント
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
├── docs/                      # ドキュメント
└── infrastructure/            # インフラ設定
```

## Roles & Permissions

| ロール | 権限 |
|--------|------|
| Admin | 全機能アクセス、設定変更、ユーザー管理 |
| Accountant | 監査実行、レポート作成、予算入力 |
| Viewer | レポート閲覧のみ |
| Investor | 投資家ポータル閲覧のみ |

## Success Metrics

- 監査精度 >95%
- レポート生成時間 <5分
- テストカバレッジ >=80%
- セキュリティ脆弱性 0（High/Critical）
- API レスポンスタイム <2秒（P95）

## Technology Stack

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

## Key Commands

### Development
```bash
pnpm dev              # 開発サーバー起動
pnpm build            # 本番ビルド
pnpm start            # 本番サーバー起動
```

### Quality Assurance
```bash
pnpm lint             # ESLint実行
pnpm typecheck        # TypeScript型チェック
pnpm format:check     # Prettierフォーマット確認
pnpm test:coverage    # カバレッジ付きテスト
```

### Database
```bash
pnpm db:generate      # Prismaクライアント生成
pnpm db:migrate       # マイグレーション実行
pnpm db:seed          # シードデータ投入
```

## Documentation

- [システム設計書](docs/DESIGN.md) - アーキテクチャ・セキュリティ設計
- [API設計書](docs/API_DESIGN.md) - 内部・外部API仕様
- [データベース設計書](docs/DATABASE_DESIGN.md) - ER図・スキーマ定義
- [機能仕様書](docs/FEATURES.md) - 各モジュールの詳細仕様
- [開発ガイド](docs/DEVELOPMENT.md) - 開発ワークフロー・テスト戦略
- [デプロイガイド](docs/DEPLOYMENT.md) - インフラ構築・運用手順
- [バックログ](BACKLOG.md) - 未実装機能・技術的負債
- [ロードマップ](docs/roadmap.md) - 開発スケジュール・マイルストーン

## Status

- **Phase**: Development (PoC完了、本番移行準備中)
- **Last Updated**: 2026-03-04
- **Next Milestone**: テストカバレッジ向上、PostgreSQL移行

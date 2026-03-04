# BACKLOG.md

## High Priority

### 機能実装
- [ ] **OCR機能実装** - 証憑自動読取（将来実装）
  - 依存: OCR API選定（Tesseract/Cloud Vision等）
  - 影響: `src/services/audit/`, `src/lib/integrations/`
  
- [ ] **バッチ処理最適化** - 大規模データ対応
  - 対象: 仕訳データ一括取得・監査
  - 影響: `src/jobs/`, `src/services/audit/`

### セキュリティ
- [ ] **セキュリティ監査ログ強化**
  - 対象: 全API呼び出しの詳細ログ
  - 要件: CrystalBall policy準拠（audit required）
  - 影響: `src/lib/security/`, `src/middleware/`

- [ ] **API レート制御実装**
  - 対象: 全外部API呼び出し
  - 要件: User-Agent明示 + レート制御
  - 影響: `src/lib/integrations/`

### テスト
- [ ] **テストカバレッジ向上**
  - 現在: 未測定
  - 目標: >=80%
  - 対象: `src/services/`, `src/lib/`

---

## Medium Priority

### テスト・品質
- [ ] **E2Eテスト拡充**
  - 対象: 主要ユーザーフロー（監査→レポート→出力）
  - ツール: Playwright
  - 影響: `tests/e2e/`

- [ ] **パフォーマンス監視導入**
  - 対象: API レスポンスタイム、レポート生成時間
  - ツール: APM導入検討（Datadog/New Relic等）

### データベース
- [ ] **PostgreSQL移行計画**
  - 現在: SQLite (PoC)
  - 目標: PostgreSQL (本番)
  - 影響: `prisma/schema.prisma`, `docker-compose.yml`

- [ ] **データベースインデックス最適化**
  - 対象: クエリパフォーマンス改善
  - 影響: `prisma/schema.prisma`

### 機能改善
- [ ] **レポート生成速度改善**
  - 目標: <5分（現状: 未測定）
  - 対象: `src/services/report/`

- [ ] **監査精度向上**
  - 目標: >95%（現状: 未測定）
  - 対象: `src/services/audit/`

---

## Low Priority

### UI/UX
- [ ] **UI/UX改善**
  - 対象: ダッシュボード、レポート画面
  - ツール: ユーザビリティテスト実施

- [ ] **多言語対応拡充**
  - 現在: 日本語/英語
  - 将来: 他言語追加（中国語・韓国語等）
  - 影響: `messages/`, `src/app/[locale]/`

### ドキュメント
- [ ] **API ドキュメント自動生成**
  - ツール: OpenAPI/Swagger
  - 対象: `src/app/api/`

- [ ] **運用マニュアル作成**
  - 対象: 本番運用手順

### パフォーマンス
- [ ] **フロントエンド最適化**
  - 対象: バンドルサイズ削減、レンダリング高速化
  - ツール: Next.js Image最適化、Code splitting

---

## Technical Debt

### コード品質
- [ ] **TypeScript strict mode有効化**
  - 対象: `tsconfig.json`
  - 影響: 全TypeScriptファイル

- [ ] **ESLintルール強化**
  - 対象: `.eslintrc.json`
  - 追加ルール: `@typescript-eslint/strict`

- [ ] **依存関係更新（定期的）**
  - 対象: `package.json`
  - 頻度: 月次

### アーキテクチャ
- [ ] **エラーハンドリング統一**
  - 対象: 全API Routes、Services
  - 影響: `src/app/api/`, `src/services/`

- [ ] **ロギング戦略統一**
  - 対象: 全モジュール
  - ツール: 構造化ログ（Pino/Winston等）

### テスト
- [ ] **テストデータ管理改善**
  - 対象: `tests/`, `prisma/seed.ts`
  - ツール: Factory導入検討

---

## Future Considerations

### スケーラビリティ
- [ ] **マイクロサービス化検討**
  - 対象: 監査サービス、レポートサービス
  - 条件: ユーザー数 >1000

- [ ] **GraphQL導入検討**
  - 対象: API層
  - メリット: オーバーフェッチング削減

### 機能拡張
- [ ] **他会計ソフト対応**
  - 対象: MFクラウド、弥生等
  - 影響: `src/lib/integrations/`

- [ ] **SaaS化検討**
  - 対象: マルチテナント対応
  - 条件: 市場需要確認後

- [ ] **モバイルアプリ開発**
  - 対象: iOS/Android
  - 技術: React Native/Flutter

### AI/ML
- [ ] **異常検知モデル導入**
  - 対象: 仕訳監査
  - 技術: 機械学習モデル（TensorFlow/PyTorch）

- [ ] **自然言語クエリ対応**
  - 対象: レポート検索
  - 技術: LLM活用

---

## Bugs & Issues

### Known Issues
（現時点で特定されているバグ・問題なし）

### Investigate
- [ ] **freee API レート制限詳細確認**
  - 対象: API呼び出し頻度
  - 要件: rate limit厳守

- [ ] **大規模データパフォーマンス検証**
  - 対象: 10万件以上の仕訳データ
  - 条件: 本番移行前

---

## Dependencies

### External
- freee API仕様変更対応（随時）
- OpenAI/Gemini/Claude API変更対応（随時）

### Internal
- PostgreSQL移行完了 → 本番デプロイ可能
- テストカバレッジ >=80% → リリース品質基準

---

## Notes

- **優先順位**: High → Medium → Low → Future
- **更新頻度**: スプリント毎（2週間）
- **責任者**: 開発チームリード
- **関連ドキュメント**: [PROJECT.md](PROJECT.md), [docs/roadmap.md](docs/roadmap.md)

---

## Changelog

### 2026-03-04
- 初版作成
- README.mdの情報を基に構造化
- CrystalBall policy準拠項目追加（無料API、監査ログ必須等）

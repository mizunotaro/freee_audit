# freee_audit 包括的実装ロードマップ

> **作成日**: 2026-04-15 | **作成者**: Opus 4.6 | **対象**: Sonnet 引き継ぎ用
> **リポジトリ**: https://github.com/mizunotaro/freee_audit

---

## 計画策定の思考プロセス

### 第1段階: 10点の計画（現状の延長線上）

現在実装済みの機能（AI分析、仕訳監査、レポート生成、会計基準変換）を安定させ、
TypeScriptエラー修正・テストカバレッジ向上・ビルド安定化を行う。

### 第2段階: 100点にするために足りないもの

10点計画に足りない観点を網羅的に列挙:

1. **外部システム連携の深度** - freee会計だけでなく、freee人事労務・freee MCP・Google Calendar・バクラク・TOKIUM・SharePoint・Box等との実連携
2. **補助金事務局対応** - AMED/NEDO向け業務日誌自動生成、収支簿作成、証拠書類管理
3. **購買プロセス管理** - 見積→発注→納品→検収→請求→支払の一貫した書類整合性チェック
4. **IR/コーポレート機能** - 株主名簿・新株予約権原簿・資本政策・登記簿追跡
5. **経費精算チェック** - 通勤経路vs交通費精算、社内規程との整合性、日付/経路の異常検出
6. **freee人事労務連携** - 社員情報取得、平均年齢/勤続年数算出、事業報告書自動作成
7. **AIファースト設計** - Claude Code/Cowork連携、MCP統合、エージェント対応API設計
8. **LLMモデル完全対応** - 設定画面でのAPI/モデル選択、DeepSeek V4・Qwen等最新モデル追加
9. **セキュリティ強化** - ペネトレーションテスト視点での脆弱性修正、OWASP Top 10完全対応
10. **Python/Rサービス拡充** - 統計分析・時系列予測・Monte Carlo・回帰分析の高度化
11. **ドキュメント自動生成** - 事業報告書・取締役会議事録・株主総会招集通知のテンプレート出力
12. **リアルタイム監視** - 仕訳異常検知、キャッシュフロー警告、支払期日アラート
13. **マルチテナント対応** - 複数法人管理、グループ連結決算サポート
14. **CI/CD強化** - GitHub Actions、自動テスト、デプロイパイプライン
15. **パフォーマンス最適化** - DB索引、クエリ最適化、フロントエンドバンドル最適化

---

## Phase 0: 基盤安定化（即座対応 - 1週間）

### 0.1 既存TypeScript/ビルドエラーの完全修正
- **状態**: ✅ 完了（本セッションで対応済み）
- TypeScriptエラー0件達成
- ESLintエラー/警告0件達成
- ビルド成功確認

### 0.2 欠落モジュールの実装
- **状態**: ✅ 完了（本セッションで対応済み）
- `src/lib/ai/validation/` - 入力/出力バリデーション
- `src/lib/ai/errors/` - AIエラー定義

### 0.3 テストの安定化
- [ ] Worker OOMで失敗する7テストファイルの調査・修正
- [ ] vitest.config.ts のworkerメモリ設定最適化
- [ ] テストのタイムアウト設定見直し

### 0.4 環境設定の整備
- [ ] `.env.example` の完全化（JWT_SECRET, CSRF_SECRET, ENCRYPTION_KEY等）
- [ ] worktree環境での.env.localコピー自動化
- [ ] Docker Compose設定の検証

---

## Phase 1: コア機能高度化（2-3週間）

### 1.1 freee API連携の完全活用

**参照**: https://developer.freee.co.jp/

| エンドポイント | 用途 | 優先度 |
|---|---|---|
| `/api/1/journals` | 仕訳データ取得・同期 | P0 |
| `/api/1/deals` | 取引データ | P0 |
| `/api/1/trial_balance` | 試算表 | P0 |
| `/api/1/receipts` | レシート/領収書 | P0 |
| `/api/1/invoices` | 請求書 | P1 |
| `/api/1/quotations` | 見積書 | P1 |
| `/api/1/expense_applications` | 経費申請 | P1 |
| `/api/1/approval_requests` | 承認リクエスト | P1 |
| `/api/1/walletables` | 口座 | P1 |
| `/api/1/banks` | 銀行口座 | P2 |
| `/api/1/transfers` | 振替 | P2 |
| `/api/1/manual_journals` | 手動仕訳 | P1 |
| `/api/1/taxes` | 税区分 | P2 |
| `/api/1/items` | 品目 | P2 |
| `/api/1/partners` | 取引先 | P1 |
| `/api/1/sections` | 部門 | P1 |
| `/api/1/tags` | メモタグ | P2 |
| `/api/1/account_items` | 勘定科目 | P0 |

**実装タスク**:
- [ ] freee OAuth 2.0 Authorization Code Grantの完全実装
- [ ] refresh tokenの自動更新・安全な保存
- [ ] 全APIエンドポイントのサービスレイヤー実装
- [ ] レート制限対応（User-Agent設定、429 リトライ）
- [ ] Mock Mode と本番Modeの切り替え安定化

### 1.2 freee MCP統合

**参照**: https://github.com/freee/freee-mcp

- [ ] freee MCPサーバーの設定・接続確認
- [ ] Claude Code/Coworkからのfreee API探索用途
- [ ] MCPはあくまで補助ツール、本番パイプラインはREST API直接
- [ ] `npx freee-mcp configure` によるセットアップ手順ドキュメント化

### 1.3 freee人事労務API連携（新規）

| エンドポイント | 用途 |
|---|---|
| `/users/me` | company_id, employee_id取得 |
| `/employees` | 社員一覧 |
| `/employees/{id}/work_record_summaries/{year}/{month}` | 月次勤怠サマリ |
| `/employees/{id}/time_clocks` | 打刻データ |

**実装タスク**:
- [ ] freee人事労務OAuthアプリ作成（company_admin前提）
- [ ] 社員情報取得サービス（人数、生年月日、入社日）
- [ ] 平均年齢・平均勤続年数の自動算出
- [ ] 事業報告書への社員データ自動反映
- [ ] 勤怠データからAMED業務日誌への変換ロジック

### 1.4 LLMモデル対応の完全化

**現在対応済み**: 30+モデル、13プロバイダー

**追加対応**:
- [ ] DeepSeek V4 API（最新モデルID確認・接続テスト）
- [ ] Qwen最新モデル対応
- [ ] OpenRouter経由の最新モデルルーティング
- [ ] 設定画面でのLLM API/モデル選択UI強化
  - プロバイダー選択 → モデル選択 → パラメータ設定
  - 接続テスト実行ボタン
  - コスト見積もり表示
- [ ] モデルレジストリの自動更新機構（新モデルリリース対応）

---

## Phase 2: 新機能 - 補助金事務局対応（3-4週間）

### 2.1 AMED業務日誌自動生成

**根拠資料**: AMED業務日誌自動化提案.pdf、事務処理説明書（共通版/追補版）

**アーキテクチャ**: 4層構造
1. **Connector Layer**: freee人事労務API + Google Calendar API（取得のみ）
2. **Normalization Layer**: 日付統一、タイムゾーン正規化、AMED/非AMED判定
3. **Journal Engine**: AMED関連イベント抽出、日内ギャップ控除計算、作業内容AI生成
4. **Workbook Layer**: AMEDテンプレートExcel複製、指定セルのみ書込

**実装タスク**:
- [ ] Google Calendar API連携（各ユーザーOAuth → calendar.readonly）
- [ ] AMED業務判定ロジック（include/excludeキーワード、手動override、LLM補助判定）
- [ ] freee勤怠データとCalendar予定の日単位統合
- [ ] 作業時間計算（K列=freee実労働時間、G/H列=AMED開始/終了、I列=除外時間）
- [ ] 作業内容テキスト生成（Calendar summary/description → 具体的日本語1文）
  - 禁止語: 「同上」「〃」「作業」「MTG」「会議」のみ
  - 80-120字目安、具体名詞・対象・成果物を含める
- [ ] AMEDテンプレートExcel出力（実績単価/健保等級単価の2様式対応）
- [ ] 出力後バリデーション（日付欠落、時刻整合性、freee合計との差分）
- [ ] AMED固定ヘッダ情報の設定ファイル化（課題管理番号、研究機関名等）

### 2.2 AMED収支簿・収支決算書作成支援

**根拠資料**: 事務処理説明書（共通版）P14-35、証拠書類一覧.pdf

- [ ] 費目別収支簿テンプレート（物品費・旅費・人件費/謝金・その他）
- [ ] freee仕訳データからAMED費目への自動マッピング
- [ ] 収支決算書（委託/補助）の自動集計
- [ ] 四半期ごとの検査書類提出リマインダー（7/10、10/10、1/10期限）
- [ ] 間接経費率の自動計算（直接経費の10%以内）

### 2.3 AMED証拠書類管理

**根拠資料**: 証拠書類一覧.pdf

- [ ] 証拠書類チェックリスト管理（100万未満/100万以上の区分）
  - 仕様書、定価証明書、選定理由書、見積書、契約書、納品書、請求書
- [ ] 証拠書類のファイリング順序管理（費目毎→案件毎→時系列）
- [ ] 5年保管義務のタイムスタンプ管理
- [ ] 人件費証拠書類（作業日誌、人件費積算書、健保等級証明書、専従証明書）

### 2.4 AMED調達業務手続き対応

**根拠資料**: ★AMED調達業務手続き.pdf

- [ ] 費目判定ロジック（委託費 vs 外注費 vs 物品費 vs 人件費/謝金）
  - 研究開発要素の有無 → 委託費 or 外注費
  - 成果物の性質（製造物 vs 役務）
  - 個人 vs 法人（個人は雇用/外注/謝金の3分岐）
- [ ] 調達プロセス管理
  - Phase 0: 費目判定
  - Phase 1: 起案・購入申請
  - Phase 2: 仕様書/SOW作成
  - Phase 3: 業者選定（100万円以上→競争原理）
  - Phase 4: 契約（基本契約+個別SOW推奨）
  - Phase 5: 発注（PO/発注書）
  - Phase 6: 納品・検収
  - Phase 7: 請求・支払
  - Phase 8: ファイリング（検査に耐える並び）
- [ ] 外注費YES/NOチャート（決定木UIコンポーネント）
- [ ] 選定理由書テンプレート（競争性・価格妥当性の説明）
- [ ] 利益排除チェック（自社調達の場合）

### 2.5 NEDO DTSU対応（拡張）
- [ ] NEDO様式への対応（AMEDとの差分管理）
- [ ] 補助金種類別の設定切り替え

---

## Phase 3: 新機能 - 購買・経費チェック（2-3週間）

### 3.1 購買書類整合性チェック

- [ ] 購買フロー管理（見積書→発注書→納品書→検収書→請求書→支払）
- [ ] 書類間の金額・品目・数量・日付の自動整合性チェック
- [ ] 不整合時のアラート生成（金額差異、日付矛盾、品目不一致）
- [ ] 外部ストレージ連携（SharePoint、Box）からの書類取得
  - Box API連携（既存MCP活用可）
  - SharePoint/OneDrive API連携
- [ ] AIエージェントアクセス用の統一ドキュメントインデックス

### 3.2 経費精算チェック

- [ ] freee経費申請データとの連携
- [ ] バクラク経費精算/TOKIUM連携インターフェース設計
- [ ] チェック項目:
  - 通勤経路と交通費精算経路の重複検出
  - 経路の合理性チェック（最短経路との比較）
  - 日付の整合性（出張日 vs 精算日）
  - 社内規程との照合（出張日当上限、宿泊費上限等）
  - 同一日・同一経路の重複申請検出
- [ ] アラートダッシュボード（リスクスコア付き）

### 3.3 支払期日管理・キャッシュフロー予測
- [ ] 支払期日カレンダー
- [ ] 資金繰り予測（freee口座残高 + 売掛回収 - 買掛支払）
- [ ] 期日超過アラート

---

## Phase 4: 新機能 - IR/コーポレート機能（2-3週間）

### 4.1 株主名簿管理

**参照テンプレート**: 株主名簿.xlsx

- [ ] Prismaモデル: `Shareholder`, `ShareTransaction`
- [ ] 株主名簿CRUD API
- [ ] 株主名簿Excel出力（テンプレート準拠）
- [ ] 株式移転・譲渡の履歴管理
- [ ] 議決権比率の自動計算

### 4.2 新株予約権原簿管理

**参照テンプレート**: 新株予約権原簿.xlsx

- [ ] Prismaモデル: `StockOption`, `StockOptionGrant`, `StockOptionExercise`
- [ ] 新株予約権の発行・行使・失効管理
- [ ] ベスティングスケジュール管理
- [ ] 潜在株式を含む完全希薄化後株式数の自動計算
- [ ] 新株予約権原簿Excel出力

### 4.3 資本政策管理

**参照テンプレート**: 資本政策案.xlsx

- [ ] 資金調達ラウンド管理
- [ ] 株価・バリュエーション推移
- [ ] 持分比率シミュレーション（増資/SO発行時の希薄化計算）
- [ ] 資本政策表の自動生成・Excel出力

### 4.4 登記簿追跡

- [ ] 登記簿謄本データの取込（PDF OCR or 電子データ）
- [ ] 変更事象の経時的追跡（役員変更、本店移転、増資等）
- [ ] 登記事項証明書の差分表示
- [ ] 登記変更リマインダー（役員任期満了等）

### 4.5 事業報告書自動生成
- [ ] freee人事労務から社員数・平均年齢・平均勤続年数の自動取得
- [ ] 事業報告書テンプレート（会社法施行規則準拠）
- [ ] 株主構成の自動反映
- [ ] 役員一覧の自動生成

---

## Phase 5: AIファースト設計・リファクタリング（2-3週間）

### 5.1 AIエージェント対応API設計

- [ ] 全APIエンドポイントのOpenAPI仕様書自動生成
- [ ] Claude Code/Cowork向けのMCPサーバー実装
  - freee_audit独自のMCPツール定義
  - データ取得・分析実行・レポート生成のツール化
- [ ] AIエージェントからアクセスしやすいデータインデックス
  - 仕訳データのセマンティック検索
  - 書類メタデータの構造化

### 5.2 Python/Rサービスの高度化

**python-service (FastAPI, port 8000)**:
- [ ] 財務比率の時系列分析（ARIMA、Prophet）
- [ ] キャッシュフロー予測モデル
- [ ] Monte Carloシミュレーション（バリュエーション用）
- [ ] 異常検知（Isolation Forest、LOF）
- [ ] AMED業務日誌Excel出力（openpyxl）
- [ ] freee APIクライアント（Python版、業務日誌生成用）
- [ ] Google Calendar APIクライアント（Python版）

**r-service (Plumber, port 8001)**:
- [ ] 統計的仮説検定（仕訳異常判定用）
- [ ] 回帰分析（コスト予測）
- [ ] 季節性分析（売上・経費パターン）

### 5.3 セキュリティ強化

**ブラックハッカー視点での脆弱性チェック**:
- [ ] SQLインジェクション: Prismaパラメータ化クエリの完全使用確認
- [ ] XSS: React/Next.jsのデフォルトエスケープ + dangerouslySetInnerHTMLの禁止
- [ ] CSRF: CSRFトークン検証の全POSTエンドポイント適用確認
- [ ] 認証バイパス: middleware.tsのパスマッチング漏れチェック
- [ ] APIキー露出: クライアントサイドへのAPIキー漏洩チェック
- [ ] レート制限: 全公開エンドポイントへのレート制限適用
- [ ] ディレクトリトラバーサル: ファイルアクセスパスのサニタイズ
- [ ] SSRF: 内部ネットワークアクセスの制限
- [ ] 暗号化: AES-256-GCMの適切な使用確認（IV再利用禁止）
- [ ] 依存パッケージ: `pnpm audit` での脆弱性0件確認

**ホワイトハッカー視点での防御強化**:
- [ ] Content Security Policy (CSP) ヘッダー
- [ ] HSTS設定
- [ ] Cookieのセキュリティ属性（HttpOnly, Secure, SameSite）
- [ ] 入力バリデーションの境界値テスト
- [ ] ログの機密情報マスキング確認

### 5.4 パフォーマンス最適化

- [ ] Prismaクエリの `select` / `include` 最適化（N+1回避）
- [ ] APIレスポンスのキャッシング（Redis or インメモリ）
- [ ] フロントエンドの動的インポート（コード分割）
- [ ] 画像/アセットの最適化
- [ ] DB索引の追加（頻繁な検索条件）

---

## Phase 6: ドキュメント・運用基盤（1-2週間）

### 6.1 ドキュメント整備

- [ ] API仕様書の完全化（全118エンドポイント）
- [ ] 設計書の更新（新機能分）
- [ ] 運用マニュアル作成（1人管理部向け）
- [ ] トラブルシューティングガイド
- [ ] CLAUDE.md の最新化

### 6.2 CI/CD

- [ ] GitHub Actions ワークフロー
  - PR時: typecheck + lint + test
  - merge時: build + deploy
- [ ] 自動テスト（Vitest + Playwright）
- [ ] 依存パッケージ自動更新（Renovate）

### 6.3 進捗管理

- [ ] GitHub Issues / Projects でのタスク管理
- [ ] マイルストーン設定
- [ ] 変更履歴（CHANGELOG.md）の自動生成

---

## 横断的品質基準（全Phaseに適用）

全実装は以下の品質ゲートを通過すること:

```bash
pnpm typecheck    # 0 errors
pnpm lint         # 0 errors, 0 warnings
pnpm test         # All tests pass
pnpm build        # Build succeeds
```

10品質基準チェックリスト（docs/ai/QUALITY_STANDARDS.md準拠）:

| # | 基準 | チェック |
|---|------|--------|
| 1 | 安定性 | タイムアウト・リトライ・graceful degradation |
| 2 | 堅牢性 | 入力バリデーション・例外処理・境界値 |
| 3 | 再現性 | 設定バージョン管理・決定論的処理 |
| 4 | 拡張性 | プラグインパターン・インターフェース分離 |
| 5 | メンテナンス性 | 単一責任・命名規則・ドキュメント |
| 6 | セキュリティ | サニタイゼーション・機密情報保護 |
| 7 | パフォーマンス | キャッシング・並列処理・メモリ管理 |
| 8 | 文法構文 | strict mode・型定義完全性 |
| 9 | 関数引数設計 | オブジェクト引数・Result型・副作用分離 |
| 10 | 全体整合性 | 既存コード整合・パターン統一 |

---

## Sonnet 引き継ぎ手順

### 1. 環境確認
```bash
cd C:\src\freee_audit
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

### 2. 優先順位の判断基準
- **P0（今すぐ）**: Phase 0残作業、Phase 1.1（freee API安定化）
- **P1（1-2週間）**: Phase 1.3（freee人事労務）、Phase 2.1（AMED業務日誌）
- **P2（2-4週間）**: Phase 3（購買チェック）、Phase 4（IR機能）
- **P3（1-2ヶ月）**: Phase 5（AIファースト）、Phase 6（ドキュメント）

### 3. 各タスクの進め方
1. このロードマップの該当セクションを確認
2. CLAUDE.md, AGENTS.md のルールに従う
3. docs/ai/QUALITY_STANDARDS.md の品質基準を適用
4. 品質ゲート通過を確認してからコミット

### 4. コミット規約
```
<type>(<scope>): <description>

Types: feat, fix, refactor, docs, test, chore
```

### 5. 参照ドキュメント（AMED関連）
- `C:\Users\mizun\Downloads\AMED業務日誌自動化提案.pdf` - AMED業務日誌の設計提案（72ページ）
- `C:\Users\mizun\Downloads\★AMED調達業務手続き.pdf` - AMED調達業務フロー（37ページ）
- `C:\Users\mizun\Downloads\amed\事務処理説明書（共通版）.pdf` - AMED共通事務処理（60ページ）
- `C:\Users\mizun\Downloads\amed\事務処理説明書（追補版）.pdf` - 創薬VEC事業固有ルール（13ページ）
- `C:\Users\mizun\Downloads\amed\証拠書類一覧.pdf` - AMED証拠書類チェックリスト
- `C:\Users\mizun\Downloads\amed\証拠書類一覧.xlsx` - 同上Excel版

### 6. 参照テンプレート（IR関連）
- `Z:\マイドライブ\Tride\済）株主名簿\株主名簿.xlsx`
- `Z:\マイドライブ\Tride\済）新株予約権原簿\新株予約権原簿.xlsx`
- `Z:\マイドライブ\Tride\四半期報告\資本政策案.xlsx`

---

## 付録: 新規Prismaモデル設計（Phase 2-4で追加）

```prisma
// AMED補助金管理
model SubsidyProject {
  id              String   @id @default(cuid())
  companyId       String
  subsidyType     String   // AMED_VECO, NEDO_DTSU, etc.
  projectCode     String   // 課題管理番号
  projectName     String
  programName     String
  institution     String
  piName          String
  startDate       DateTime
  endDate         DateTime
  totalBudget     Float
  subsidyRate     Float    // 2/3 for AMED v-eco
  status          String   // active, completed, suspended
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  company         Company  @relation(fields: [companyId], references: [id])
  journals        SubsidyJournal[]
  documents       SubsidyDocument[]
}

model SubsidyJournal {
  id              String   @id @default(cuid())
  projectId       String
  date            DateTime
  workerName      String
  startTime       String?
  endTime         String?
  excludedHours   Float    @default(0)
  amedHours       Float
  totalHours      Float
  activityText    String
  confidence      Float    @default(1.0)
  reviewFlags     String[] @default([])
  sourceEventIds  String[] @default([])
  status          String   @default("draft") // draft, reviewed, submitted
  createdAt       DateTime @default(now())
  project         SubsidyProject @relation(fields: [projectId], references: [id])
}

model SubsidyDocument {
  id              String   @id @default(cuid())
  projectId       String
  category        String   // evidence, report, application
  documentType    String   // 収支簿, 収支決算書, 作業日誌, etc.
  fiscalYear      Int
  quarter         Int?
  fileName        String
  filePath        String
  status          String   @default("pending") // pending, submitted, verified
  submittedAt     DateTime?
  createdAt       DateTime @default(now())
  project         SubsidyProject @relation(fields: [projectId], references: [id])
}

// 購買プロセス管理
model ProcurementCase {
  id              String   @id @default(cuid())
  companyId       String
  title           String
  vendor          String?
  category        String   // outsource, consignment, goods, personnel
  totalAmount     Float
  competitionRequired Boolean @default(false) // 100万円以上
  status          String   @default("draft")
  documents       ProcurementDocument[]
  createdAt       DateTime @default(now())
  company         Company  @relation(fields: [companyId], references: [id])
}

model ProcurementDocument {
  id              String   @id @default(cuid())
  caseId          String
  documentType    String   // quotation, purchase_order, delivery_note, invoice, receipt
  amount          Float?
  date            DateTime?
  vendorName      String?
  filePath        String?
  verified        Boolean  @default(false)
  discrepancies   String[] @default([])
  procurementCase ProcurementCase @relation(fields: [caseId], references: [id])
}

// 株主名簿・資本政策
model ShareholderRecord {
  id              String   @id @default(cuid())
  companyId       String
  shareholderName String
  shareholderType String   // individual, corporate, fund
  sharesHeld      Int
  shareClass      String   @default("common")
  acquisitionDate DateTime
  votingRights    Float
  address         String?
  createdAt       DateTime @default(now())
  company         Company  @relation(fields: [companyId], references: [id])
}

model StockOptionPlan {
  id              String   @id @default(cuid())
  companyId       String
  planName        String
  totalShares     Int
  exercisePrice   Float
  vestingSchedule String   // JSON
  grantDate       DateTime
  expirationDate  DateTime
  grants          StockOptionGrant[]
  company         Company  @relation(fields: [companyId], references: [id])
}

model StockOptionGrant {
  id              String   @id @default(cuid())
  planId          String
  granteeName     String
  sharesGranted   Int
  sharesVested    Int      @default(0)
  sharesExercised Int      @default(0)
  status          String   @default("active")
  plan            StockOptionPlan @relation(fields: [planId], references: [id])
}

// 登記簿追跡
model RegistryRecord {
  id              String   @id @default(cuid())
  companyId       String
  recordDate      DateTime
  category        String   // officer_change, address_change, capital_change
  description     String
  previousValue   String?
  newValue        String
  sourceFile      String?  // OCR or 電子データのファイルパス
  createdAt       DateTime @default(now())
  company         Company  @relation(fields: [companyId], references: [id])
}
```

---

## 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-04-15 | 初版作成（Opus 4.6） | Opus 4.6 |

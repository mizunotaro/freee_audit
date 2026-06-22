# デバッグ・品質保証総合ガイド

このドキュメントは、`freee_audit` において**安定性・堅牢性・再現性・拡張性・メンテナンス性・セキュリティ・パフォーマンス・文法/構文エラー防止・関数/引数設計・全体整合性**を確保しながらデバッグを進めるための実務ガイドである。  
設計、実装、テスト、障害調査、品質ゲート復旧、リリース前確認で参照すること。

---

## 1. 目的

本システムは、以下の要素が相互依存する複合システムである。

- Next.js App Router フロントエンド
- Next.js API Routes
- Prisma / SQLite / PostgreSQL
- freee API, OpenAI / Claude / Gemini / OpenRouter 等の外部連携
- AI オーケストレーション、ペルソナ、プロンプト、分析サービス
- OCR / Python / R 周辺サービス
- PDF / Excel / PPTX 等の出力
- 認証、暗号化、監査ログ、投資家ポータル

そのため、単一ファイルだけを見て不具合修正すると、別レイヤーで再発しやすい。  
本ガイドでは、**原因の切り分け方法、必須の観測点、修正時のチェック項目、完了条件**を定義する。

---

## 2. 適用範囲

このガイドは以下の問題に適用する。

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` の失敗
- UI 表示不整合、状態遷移不整合、i18n 文言不整合
- API エラー、認証エラー、権限不整合
- freee / AI / OCR / 外部情報取得の失敗
- Prisma スキーマ、DB マイグレーション、シード不整合
- 非同期処理、タイムアウト、リトライ、Circuit Breaker の不具合
- パフォーマンス劣化、メモリ使用量増大、長時間ジョブ失敗
- 機密情報露出、サニタイゼーション不足、監査ログ不足

---

## 3. 基本原則

### 3.1 まず再現条件を固定する

以下を必ず記録する。

- ブランチ名 / コミット SHA
- 実行コマンド
- 使用環境 (`Node`, `pnpm`, `DATABASE_URL`, `AI_MOCK_MODE`)
- 入力データ、ユーザーロール、会社 ID
- 発生時刻
- 成功条件 / 失敗条件

### 3.2 推測ではなく観測で切り分ける

最低限、以下のどの層で壊れているかを切り分ける。

1. 入力
2. UI 表示
3. API ルート
4. サービス層
5. 外部連携
6. DB / ストレージ
7. ビルド / 設定

### 3.3 「実装」「テスト」「ドキュメント」を同時に揃える

以下のどれかだけを直して終わらせない。

- 実装を修正したらテストを更新する
- 仕様変更ならドキュメントを更新する
- テスト期待値変更だけで逃げず、表示や API 契約が妥当か確認する

### 3.4 品質ゲートは局所確認の後に全体確認する

推奨順序:

1. 対象ファイル/機能の局所再現
2. 関連テスト群の再実行
3. `pnpm typecheck`
4. `pnpm lint`
5. `pnpm test`
6. `pnpm build`

---

## 4. 標準デバッグフロー

### Step 1: 症状の分類

以下のいずれかに分類する。

- UI / 表示
- API / 認証
- AI / 外部 API
- DB / データ整合
- 非同期 / 並行実行
- ビルド / 設定
- 性能
- セキュリティ

### Step 2: 影響範囲の特定

確認対象:

- 1画面のみか、複数画面か
- 1 API のみか、共通ミドルウェア全体か
- 1社データのみか、全会社共通か
- 1ロールのみか、全ロール共通か
- SQLite のみか、PostgreSQL でも発生するか
- mock モードのみか、本物の外部 API でも発生するか

### Step 3: 契約の確認

次のどれが正であるべきかを明確にする。

- ドキュメント
- 型定義
- Prisma schema
- API response shape
- コンポーネント props
- テスト期待値

### Step 4: 最小再現ケースの作成

必要に応じて以下を作る。

- unit test
- integration test
- Playwright scenario
- fixture / factory
- seed data

### Step 5: 修正

修正時の原則:

- 原因に近い層で直す
- 同じ原因が他箇所にもないか検索する
- ハードコードで塞がない
- feature flag や config 化の要否を判断する

### Step 6: 回帰確認

最低限確認する。

- 直接の失敗ケース
- 正常系
- 境界値
- 権限違い
- locale 違い
- mock / real provider 切替

---

## 5. 観測対象と証跡

### 5.1 必須証跡

- エラーメッセージ全文
- stack trace
- request / response payload の要約
- userId / companyId / route / requestId
- 依存サービス名
- 実行時間
- retry 回数

### 5.2 ログに含めるべき項目

| 項目 | 用途 |
|---|---|
| `requestId` | リクエスト追跡 |
| `userId` | 認証済みユーザー追跡 |
| `companyId` | テナント追跡 |
| `route` | API / 画面の特定 |
| `provider` | AI / freee / OCR の切り分け |
| `model` | AI 呼び出しの再現 |
| `durationMs` | 遅延検知 |
| `retryCount` | 安定性確認 |
| `errorCode` | 集計と分類 |
| `configVersion` | 再現性確認 |

### 5.3 機密情報の扱い

ログ出力してよいのは以下まで。

- API キーの有無
- token の末尾マスク済み数文字
- provider 名
- companyId

ログ出力禁止:

- 生の API キー
- access token / refresh token
- セッション cookie
- 証憑ファイルの機微情報全文
- 個人情報の無加工全文

---

## 6. 品質観点別チェック項目

## 6.1 安定性

### 目的

一時的な失敗で全体を止めず、利用可能性を維持する。

### 必須事項

- 外部 I/O に timeout を設定する
- retry は最大回数と backoff を明示する
- 連続失敗時は Circuit Breaker を検討する
- 部分失敗時の graceful degradation を設計する
- 中断可能な処理は abort を扱う
- build / test / batch は競合 lock を避ける

### このシステムで重点的に見る場所

- `src/lib/integrations/ai/*`
- `src/lib/ai/providers/*`
- `src/lib/ai/security/*`
- `src/app/api/freee/*`
- `src/services/external-info/*`
- `src/services/market-data/*`
- `src/services/ocr/*`
- `src/jobs/*`

### デバッグ観点

- timeout か、即時エラーか
- retry が走っているか
- retry 後に状態が壊れていないか
- fallback provider が正しく発火しているか
- abort を Unknown error と誤分類していないか

---

## 6.2 堅牢性

### 目的

不正入力、空データ、境界値、壊れた外部レスポンスでもクラッシュしない。

### 必須事項

- 公開関数と API 入力にバリデーションを置く
- `null` / `undefined` / 空配列 / 空文字を明示的に扱う
- 境界値テストを持つ
- JSON parse failure を握り潰さない
- 外部 API の shape mismatch に備える
- UI では loading / empty / error / success を分ける

### デバッグ観点

- データが「ない」のか「壊れている」のか
- UI テストが文言依存になりすぎていないか
- 複数候補にマッチする `getByText` を使っていないか
- Prisma の relation 欠損が起きていないか

---

## 6.3 再現性

### 目的

同じ入力、同じ設定で同じ挙動を再現できるようにする。

### 必須事項

- config version を持つ
- モデル、temperature、timeout を固定管理する
- seed / fixture / factory を明示的に使う
- テストで現在時刻、乱数、外部応答を固定できるようにする
- `.next`, generated files, cache の影響を意識する
- build / test 実行前提をドキュメント化する

### このシステムで重点的に見る場所

- `src/lib/ai/config/*`
- `prisma/seed.ts`
- `prisma/seeds/*`
- `tests/helpers/*`
- `tests/factories/*`
- `vitest.config.ts`
- `next.config.js`

### デバッグ観点

- mock モードか real provider か
- locale が `ja` / `en` のどちらか
- SQLite と PostgreSQL で挙動差がないか
- `.next` 残骸や lock が影響していないか

---

## 6.4 拡張性

### 目的

新しい provider, report, persona, route, export format を追加しやすくする。

### 必須事項

- provider / analyzer / exporter は interface ベースにする
- 分岐増大時は registry や strategy を使う
- 直書きの if/switch 連鎖を局所化する
- 設定値はコードから分離する
- テスト可能な境界に依存性を置く

### デバッグ観点

- 追加実装が既存分岐を壊していないか
- 一箇所の変更で複数ファイルへ波及しすぎていないか
- 新 provider 追加時に共通テストを流用できるか

---

## 6.5 メンテナンス性

### 目的

不具合修正時の探索コストと誤修正率を下げる。

### 必須事項

- 責務を API / service / lib / component で分ける
- 命名と戻り値パターンを統一する
- 例外の種類を揃える
- 長すぎる関数を分割する
- テスト名は意図が読めるようにする
- 残骸ファイル (`*.new.ts` など) を放置しない

### デバッグ観点

- どこで state が変わるか追えるか
- 名前と実態が一致しているか
- 失敗時の責務境界が曖昧でないか

---

## 6.6 セキュリティ

### 目的

機密情報、認証状態、証憑データ、投資家向け情報を安全に扱う。

### 必須事項

- 認証必須 route に `withAuth` / `requireRole` を適用する
- 会社境界とロール境界を検証する
- 入力を sanitize する
- エラー応答で秘密情報を返さない
- API キーは暗号化保存し、表示しない
- ログと例外に secrets を残さない
- CSP / cookie 属性 / CSRF / rate limit を確認する

### このシステムで重点的に見る場所

- `middleware.ts`
- `src/lib/auth.ts`
- `src/lib/security/*`
- `src/app/api/settings/api-keys/*`
- `src/app/api/investor/*`
- `src/app/api/freee/*`

### デバッグ観点

- 未認証で通る route がないか
- 他社データへアクセスできないか
- エラー時にトークンや API キーが露出しないか
- investor role が通常画面へ入れないか

---

## 6.7 パフォーマンス

### 目的

画面応答、分析、レポート生成、外部連携を実用時間内に収める。

### 必須事項

- N+1 クエリを避ける
- 並列化可能な I/O は `Promise.all` を検討する
- 大きな AI / export / report は計測する
- 不安定な性能テストは環境依存性を分離する
- 大きい payload と不要な serialization を避ける

### 観測項目

- API P50 / P95 / max latency
- DB query count
- AI provider response time
- report generation time
- file export size
- memory peak

### デバッグ観点

- 遅いのが CPU か I/O か
- テスト失敗が性能退化か、閾値設定の問題か
- 同一データを何度も変換していないか

---

## 6.8 文法・構文エラー防止

### 目的

静的検査と build で落ちる問題を事前に防ぐ。

### 必須事項

- `pnpm typecheck` を通す
- `pnpm lint` を通す
- import path と alias を統一する
- Next.js / Prisma / Vitest の設定差分を管理する
- 非推奨設定を放置しない

### このシステムで重点的に見る場所

- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.js`
- `vitest.config.ts`
- `playwright.config.ts`

### デバッグ観点

- Next.js のバージョンと config の整合
- test runner の alias と app 側 alias の整合
- generated types が古くないか

---

## 6.9 関数・引数設計

### 目的

バグを埋め込みにくい API を作り、変更耐性を上げる。

### 必須事項

- 引数が3個以上なら options object を優先する
- 戻り値は `Result<T, E>` または明確な例外ポリシーにする
- 副作用関数と純粋関数を分ける
- `boolean` フラグ乱立を避ける
- 単位、通貨、時刻、locale を明示する

### このシステムで特に重要な引数

- `companyId`
- `userId`
- `locale`
- `provider`
- `model`
- `fiscalYear`
- `month`
- `timeoutMs`
- `retryConfig`

### デバッグ観点

- 引数の順番依存で誤用されないか
- 同じ意味の引数名が別箇所で異なっていないか
- `undefined` で意味が変わりすぎないか

---

## 6.10 全体整合性

### 目的

画面、API、DB、AI、外部連携、出力が同じ前提の上で動くようにする。

### 必須事項

- ドキュメント、型、テスト、実装の契約を揃える
- `Company`, `User`, `Role`, `IRReport` 等の中心概念を統一する
- locale, currency, fiscal period の表現を揃える
- SQLite / PostgreSQL 差異を吸収する
- sample data と実運用データ構造を大きく乖離させない

### デバッグ観点

- 画面表示と API response の意味が一致しているか
- Prisma schema と service layer の前提が一致しているか
- docs の技術スタック情報が古くないか

---

## 7. レイヤー別デバッグ観点

## 7.1 フロントエンド

確認項目:

- loading / empty / error / success の4状態
- locale 切替時の文言崩れ
- role による表示差分
- route param の Promise 対応
- chart / table / filter の state 遷移
- `getByText` 依存テストの脆さ

主な確認ファイル:

- `src/app/[locale]/...`
- `src/components/...`
- `messages/ja.json`
- `messages/en.json`

## 7.2 API Routes

確認項目:

- 認証・認可
- request validation
- service 呼び出しの責務分離
- response shape の安定性
- error code / status code の統一
- cache / revalidation 影響

## 7.3 サービス層

確認項目:

- 計算ロジックの純粋性
- Prisma transaction の境界
- 会社境界の保持
- 例外処理
- provider 差し替え可能性

## 7.4 AI / プロンプト / オーケストレーション

確認項目:

- モデル選択ロジック
- persona 制約
- output validation
- timeout / retry / fallback
- mock mode での再現
- hallucination を UI / API へそのまま流さないこと

## 7.5 DB / Prisma

確認項目:

- schema と code の整合
- migration の順序
- seed の再現性
- relation / cascade / unique 制約
- SQLite と PostgreSQL 差分

## 7.6 外部連携

確認項目:

- provider ごとの timeout / retry / rate limit
- token refresh
- circuit breaker
- provider ごとの response shape 差分
- mock 実装の品質

---

## 8. テスト戦略の補強ポイント

既存の `docs/TEST_STRATEGY.md` を補強する観点として、以下を徹底する。

### unit test

- exported function ごとに正常系 / 異常系 / 境界値
- abort / timeout / retry exhaust
- locale 差分
- `Result` の success / failure 両方

### integration test

- 認証あり/なし
- role 差分
- 会社境界
- Prisma を含む read/write
- 外部 API mock の shape 差分

### e2e test

- ログイン
- ダッシュボード表示
- freee 連携主要導線
- 監査実行
- レポート生成
- investor portal

### regression test

以下のバグを直したら、必ず再発防止テストを追加する。

- unhandled rejection
- `.next` lock / build failure
- 文言変更で壊れる UI テスト
- 認可漏れ
- companyId 漏れ
- provider fallback 不全

---

## 9. 品質ゲート前チェックリスト

PR 前に最低限確認する。

- [ ] 失敗の再現手順を記録した
- [ ] 原因レイヤーを特定した
- [ ] 局所テストを追加/更新した
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS
- [ ] `pnpm test` PASS
- [ ] `pnpm build` PASS
- [ ] セキュリティ影響を確認した
- [ ] ドキュメント更新が必要か確認した

---

## 10. 障害種別ごとの一次切り分け

### `pnpm test` 失敗

見る順序:

1. unhandled rejection の有無
2. 失敗ファイルの分類
3. UI 期待値ズレか、実装不具合か
4. fake timer / async await 漏れ
5. test environment alias / mock の崩れ

### `pnpm build` 失敗

見る順序:

1. `.next` lock / build 競合
2. Next.js config warning
3. server/client boundary
4. dynamic route `params` / `searchParams`
5. build-time only imports

### API 500

見る順序:

1. 認証済みか
2. request validation
3. companyId / role
4. service exception
5. Prisma error
6. 外部 API error

### AI 応答異常

見る順序:

1. model / provider / timeout
2. prompt constraints
3. output validation
4. fallback provider
5. mock mode との差分

---

## 11. ドキュメント更新ルール

以下の変更があった場合、本ドキュメントまたは関連文書を更新する。

- 新しい障害パターンを確認した
- 新しい provider / microservice を追加した
- 品質ゲートの定義を変更した
- build / deploy / test 手順が変わった
- セキュリティ要件を追加した
- 関数設計や Result パターンの標準を更新した

併せて更新候補:

- `docs/ai/README.md`
- `docs/ai/QUALITY_STANDARDS.md`
- `docs/ai/CONSTRAINTS.md`
- `docs/ai/TASKS.md`
- `docs/TEST_STRATEGY.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`

---

## 12. 参照ドキュメント

- [AI機能ドキュメント](./README.md)
- [品質基準](./QUALITY_STANDARDS.md)
- [制約定義](./CONSTRAINTS.md)
- [AI実装タスク分割](./TASKS.md)
- [テスト戦略](../TEST_STRATEGY.md)
- [セキュリティ実装ガイド](../SECURITY.md)
- [デプロイ・運用ガイド](../DEPLOYMENT.md)


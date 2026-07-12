# E2E-FLOW-06 — E2E: cashflow + Runway scenario view (通常/悲観/強気)

## 目的
モックモードで `資金繰り表`（`/ja/reports/cashflow`）の Runway シナリオ UI を E2E で駆動し、
3 つのシナリオバンド（楽観/現実/悲観）が描画されること・Runway 月数が表示されること・
コントロール操作でチャートが再投影されることを検証する。UI 層のみ（既存ビューのテスト）。

## 追加ファイル
| ファイル | 役割 |
|---------|------|
| `tests/e2e/cashflow-scenario-flow.spec.ts` | Playwright E2E（2 テスト、beforeAll ログイン 1 回） |
| `docs/auto-sessions/e2e-flow-06/summary.md` | 本ファイル |

ソース変更なし（既存の cashflow ページ + FIN-UI-01 の `RunwayScenarioChart` をそのまま検証）。

## テスト内容
認証は `tests/e2e/settings-import-flow.spec.ts`（E2E-FLOW-03）と同じく **beforeAll で 1 回
ログイン → 各 test で `context.addCookies`** でセッション注入（認証レートリミッタ 5 回/15 分/IP
は Class-A で変更不可・プロセス全体で共有のため、ログイン POST を最小化）。

1. **3 シナリオバンド + Runway 月数の描画**
   - `Runwayシナリオ分析` 見出しの可視化（= `/api/reports/cashflow` 解決 + `runway` 非 null の信号）
   - `楽観シナリオ` / `現実シナリオ` / `悲観シナリオ` の 3 ラベル表示
   - バナーの `Runway` + `{n}ヶ月`（数値月数の描画）
   - `現金残高推移予測（楽観/現実/悲観バンド）` ラベル（= FIN-UI-01 チャートセクション）
   - ネットワーク: `/api/reports/cashflow?fiscalYear=2026` が 200、`body.runway.runwayMonths` が数値、
     `body.runway.scenarios.{optimistic,realistic,pessimistic}` が各 `{runwayMonths, burnRate}` を持つ
2. **コントロール操作でチャートが再投影される**
   - ページ唯一の `<select>`（年度）を 2024 に変更 → `/api/reports/cashflow?fiscalYear=2024` の
     GET が発火し 200、バンドセクションが再描画後に残存

アサーションは構造 + ARIA + ネットワーク応答に限定し、金額の具体値は問わない（サンプル値依存を避ける）。
sleep なし（Playwright の自動待機と waitForResponse のみ）。

## 「シナリオをトグル」の解釈（重要・ wording ↔ 実装のギャップ）
タスク文の「toggling a scenario updates the chart」は、理想上は 楽観/現実/悲観 を個別に
切り替えるトグル UI を想定している。しかし **FIN-UI-01 が実装した `RunwayScenarioChart`
は 3 バンドを同時に描画し（range Area + 現実 Line）、シナリオ個別のトグル UI は存在しない**
（cashflow ページ 199–253 行・`RunwayScenarioChart.tsx` を確認済み）。fin-impl-02 の新エンジン
（`runScenarioEngine` / `projectScenario`）は `/api/analysis/cashflow-scenario`（FIN-API-01）にのみ
接続され、**UI からは未参照**（grep で `src/` 配下の UI に消費者なし）。

擬陽性（fake-green）禁止のため、存在しないトグルをでっち上げず、実 UI が持つ**唯一の再投影
コントロール＝年度 `<select>`** を「toggling … updates the chart」の実体として検証した。年度変更は
`setFiscalYear` → `fetchData`（useCallback の `fiscalYear` 依存）→ 再 GET → バンド再描画、という
チャートデータパスの再実行を起こす。これが本 UI で到達可能な最も忠実な実相互作用である。

## 既知のデータ品質制約（本タスク対象外・参照のみ）
- `/api/reports/cashflow` は **硬 coded サンプル**（FIN-DESIGN-02 欠陥）。`getBalanceSheet`/
  `getProfitLoss` は `baseMultiplier = 1 + (month-1)*0.02/.03` の純合成生成器で `companyId`/
  `fiscalYear` を受け取るが使わない。よって**年度を変えてもシナリオ数値は同一**。本テストは
  「再 GET パスの発火」で検証し、数値変化は主張しない（主張すれば偽になる）。
- `runway`/`alert` は常に非 null（`calculateRunway`/`getRunwayAlert` は常時値を返す）のため、
  バナー・シナリオカードは常に描画される。
- ページは `/api/debt/forecast`（Class-A・読み取り専用）も `Promise.allSettled` で呼ぶが、
  失敗してもシナリオ UI の描画に影響しない（allSettled + `length > 0` ガード）。

## 守った制約
- **Class-A 非変更**: `prisma/**`・`auth*`・`crypto`・`security`・`audit`・`services/{audit,
  conversion,valuation,tax,kpi,debt,deferred-accrual,journal-proposal,freee}`・対応 API・
  microservices は一切触れていない（読み取り参照のみ）。`/api/reports/cashflow` は
  Class-A の api 一覧（`{audit,journals,…}`）に含まれないため参照のみ（編集なし）。
- **追加のみ**: 新規spec 1件 + 本ドキュメント。既存ソース・既存テストは無変更。
- `any`/`@ts-ignore`/`@ts-expect-error`/`.skip`/lint-disable/coverage lowering なし。
- 新規依存なし。

## 検証
- `node scripts/autopm_verify.mjs --changed-only` が exit 0（`.spec.ts` は typecheck + lint のみ；
  vitest ステップは `*.spec.ts` をスキップ＝CI の `e2e-tests` ジョブが実行）。
- 詳細なローカル実行結果は以下「実行ログ」。

## 実行ログ（ローカル実機検証・擬陽性なし）
Windows worktree で `tests/e2e/lib/env.ts` のフォールバック秘密値 + モックモードで
`corepack pnpm dev` を起動し、Playwright がそれを再利用（`reuseExistingServer: !CI`）。

```
$ DATABASE_URL=file:./test.db … FREEE_MOCK_MODE=true AI_MOCK_MODE=true \
    corepack pnpm exec playwright test tests/e2e/cashflow-scenario-flow.spec.ts --reporter=line
Running 2 tests using 1 worker
[1/2] three scenario bands + Runway months render from /api/reports/cashflow
[2/2] changing the fiscal-year control re-projects the scenario chart
  2 passed (8.2s)
```

初回実行で検出された実障害（実行したからこそ分かった偽陽性でない挙動）:
`RunwayScenarioChart` の recharts `<Legend>` が `現実シナリオ` を凡例項目としても描画するため、
`getByText('現実シナリオ', { exact: true })` がカードラベルと凡例の 2 要素にマッチし strict-mode 違反。
→ 各シナリオラベルを `.first()` でカード（チャートより前方の DOM）に固定して修正。修正後 2/2 pass。

検証後、`:3000` の orphan `next-server`（PID 19112）を `taskkill /PID /F` で終了し health=000 を確認。

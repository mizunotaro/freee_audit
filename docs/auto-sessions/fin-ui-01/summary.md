# FIN-UI-01 — UI: variance waterfall, scenario-Runway chart, managerial dashboards

## 目的
管理会計・資金繰り向けの**表示専用**コンポーネントを追加する。
- 予実差異ブリッジ（ウォーターフォール）チャート
- Runway シナリオチャート（楽観/現実/悲観バンド）
- 管理会計ダッシュボードカード（限界利益・損益分岐点・安全余裕率）

## 守った制約
- **UI 層のみ**：財務計算式（限界利益・損益分岐点・差異符号規約）はコンポーネントに埋め込まず、すべてサービス層に配置。
- **Class-A 非変更**：`prisma/schema.prisma`・`auth*`・`crypto`・`security`・`audit`・`services/{audit,conversion,valuation,tax,kpi,debt,deferred-accrual,journal-proposal,freee}`・対応 API・microservices は一切触れていない（読み取り参照のみ）。
- 新規依存なし・`any`/`@ts-ignore`/`.skip`/lint-disable なし。新規ヘルパーは `Result<T,E>` + Zod `safeParse`。
- 差分は追加中心。既存の budget API ルートは `generateSamplePL` のインライン定義を `src/services/budget/sample-pl.ts` へ機械的移動したのみ（挙動不変）。

## 追加ファイル
| ファイル | 役割 |
|---------|------|
| `src/types/reports/managerial.ts` | `ManagerialMetrics` / `VarianceBridge` / `ManagerialReportResponse` 表示型 |
| `src/services/budget/managerial-accounting.ts` | `computeManagerialMetrics`（CVP指標）・`buildVarianceBridge`（差異符号規約+ブリッジ構築）。純粋関数・Result・Zod |
| `src/services/budget/sample-pl.ts` | `generateSamplePL` を共有化（budget 詳細アクションと managerial ルートで利用） |
| `src/app/api/reports/budget/managerial/route.ts` | GET `/api/reports/budget/managerial`。stageLevel から数値抽出+分類しサービス呼出 → `{metrics, bridge}` 返却 |
| `src/components/charts/VarianceBridgeChart.tsx` | ウォーターフォール（recharts BarChart + 透明base/可視value の積重ね + Cell 色分け） |
| `src/components/charts/RunwayScenarioChart.tsx` | シナリオバンド（recharts ComposedChart + range Area + 現実Line） |
| `src/components/reports/ManagerialAccountingCards.tsx` | KPICard（KPIGauge.tsx）を再利用した指標カード群 |
| `src/hooks/reports/use-managerial-accounting.ts` | managerial API を fetch するフック（loading/error/refetch） |
| `tests/unit/services/budget/managerial-accounting.test.ts` | サービステスト（14件） |
| `tests/components/charts/VarianceBridgeChart.test.tsx` | コンポーネントテスト（6件） |
| `tests/components/charts/RunwayScenarioChart.test.tsx` | コンポーネントテスト（6件） |
| `tests/components/reports/ManagerialAccountingCards.test.tsx` | コンポーネントテスト（6件） |

## 変更ファイル（最小）
- `src/app/api/reports/budget/route.ts`：`generateSamplePL` を sample-pl.ts から import するよう変更（関数定義を削除）。挙動不変。
- `src/app/[locale]/(authenticated)/reports/cashflow/page.tsx`：Runwayシナリオ分析カードに `RunwayScenarioChart` を追加（既存 `runway`/`cashPosition` 状態を使用）。
- `src/app/[locale]/(authenticated)/reports/budget/page.tsx`：新タブ「経営分析」を追加（`useManagerialAccounting` 経由で bridge + cards を表示）。

## 計算式の所在（UI 非埋め込みの根拠）
- 限界利益 = 売上高 − 変動費、損益分岐点 = 固定費 ÷ 限界利益率、安全余裕率 = (売上高 − 損益分岐点) ÷ 売上高 → すべて `computeManagerialMetrics`（サービス層）。
- ブリッジ符号規約（費用差異の符号反転）→ `buildVarianceBridge`（サービス層）。コンポーネントは符号付き drivers を受け取って描画するのみ。
- Runway の月次現金投影 `currentCash − burnRate × 月数` → チャート力学（既存 `CashFlowWaterfallChart` の累積計算や `buildChartData` と同位置づけ）。burnRate/runwayMonths は API 既存値。

## ローディング/エラー/空状態
3 コンポーネントとも `resolveChartStatus` + `ChartState` を再利用し、loading（スケルトン）/error（alert）/empty（「データがありません」）を実装。優先順位は loading > error > empty > ready。

## テスト
追加テスト 32 件すべて成功（`corepack pnpm exec vitest run <files>` で確認）。recharts は既存チャートテストと同じ stub モックを使用。`ManagerialAccountingCards` は KPICard（recharts 非描画）のため recharts モック不要。

## 既知のデータ品質制約（本タスクの対象外・PR本文にも明記）
- 実績 P&L は budget 詳細アクションと同様に `generateSamplePL`（サンプル値）を使用。実 trial balance 連携は fin-design-01 提案で `PENDING HUMAN DETERMINATION`。
- 変動費=売上原価、固定費=販売管理費 という簡易分類を採用（厳密な変動/固定分解には仕訳次元データが必要＝同提案 §7）。
- 損益分岐点は限界利益率 <= 0 の場合 `null`（算出不可）として UI に「算出不可」表示。

## 検証
`node scripts/autopm_verify.mjs --changed-only` が exit 0 することを確認済み。

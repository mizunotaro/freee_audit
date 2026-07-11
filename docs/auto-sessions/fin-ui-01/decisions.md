# FIN-UI-01 — Design Decisions (ADR)

## ADR-1: 財務計算式はサービス層に配置、コンポーネントは表示専用

**Status:** Accepted

**Context:** タスク制約「do NOT embed financial formulas in components (they live in services)」。
限界利益・損益分岐点・安全余裕率・差異符号規約は財務計算式であり、UI コンポーネントに埋め込んではならない。

**Decision:** 新サービス `src/services/budget/managerial-accounting.ts`（純粋関数・`Result<T,E>`・Zod `safeParse`）に計算式を集約。コンポーネントは計算済みの結果（`ManagerialMetrics` / `VarianceBridge`）を props で受け取り描画するのみ。API ルート `/api/reports/budget/managerial` がサービスを呼び、フック経由でコンポーネントにデータを供給する。

**Consequences:**
- 計算式が単一箇所に集約され、テスト容易性が高い（サービス単体テスト 14 件）。
- コンポーネントは純粋に表示に専念（loading/error/empty のみ保持）。
- Class-A パス（`services/kpi`, `services/cashflow` 等）には触れず、`services/budget/**`（非 Class-A）に追加。

---

## ADR-2: Runway 投影はチャート力学としてコンポーネントに許容

**Status:** Accepted

**Context:** RunwayScenarioChart は月次現金残高 `currentCash − burnRate × 月数` を描画する。これを「財務計算式」とみなしてサービスに逃がすか、チャート力学としてコンポーネントに残すか。

**Decision:** コンポーネントに残す。burnRate・runwayMonths は API 既存値で、線形投影は既存コードの `CashFlowWaterfallChart`（累積 start/end 計算）や `buildChartData`（累積現金計算）と同等のチャート描画力学であり、限界利益/損益分岐点のような業務計算式とは位置づけが異なる。

**Consequences:**
- 既存チャートの慣行と一貫。新規 API/サービスを増やさず、既存 `/api/reports/cashflow` の `runway` を再利用。
- 36ヶ月の horizon 上限を設け無限配列を防止。

---

## ADR-3: 変動費=売上原価、固定費=販売管理費 の簡易分類

**Status:** Accepted（暫定・データ制約による）

**Context:** 厳密な CVP 分析には原価の変動/固定分解が必要だが、現データモデルは仕訳次元（数量・単価・partner/segment）を持たない（fin-design-01 提案 §4.3, §7.2）。`stageLevel` には 売上高/売上原価/販売管理費/営業利益 があるのみ。

**Decision:** API ルート層で 売上原価→変動費、販売管理費→固定費 と分類し、サービスに渡す。分類決定（業務判断）も UI ではなくサーバー側。損益分岐点は限界利益率 <= 0 の場合 `null`（算出不可）とし、UI は「算出不可」を表示。

**Consequences:**
- 厳密な変動/固定分解が必要になった場合は API ルートの分類のみ変更で対応可能（コンポーネント・サービス型は不変）。
- 本分類の妥当性は人間判断事項（`PENDING HUMAN DETERMINATION`）。

---

## ADR-4: `generateSamplePL` を sample-pl.ts へ抽出（DRY）

**Status:** Accepted

**Context:** 新 managerial API ルートも budget 詳細アクションと同一のサンプル P&L を必要とする。route.ts 間の直接 import は Next.js で非慣行的。

**Decision:** `generateSamplePL` を `src/services/budget/sample-pl.ts` に抽出し、両ルートが import する。既存 budget ルートは関数定義を削除し import に置換（挙動不変・機械的移動）。

**Consequences:**
- サンプル定義の重複排除。既存ルートのテストは存在しないため、置換のリスクは typecheck/lint のみ（両方クリア）。

---

## ADR-5: ブリッジ符号規約は営業利益ベース・費用差異は反転

**Status:** Accepted

**Context:** 予算→実績ブリッッチで「どの差異が利益を増減させるか」の符号規約が必要。生の `variance = actual − budget` だけでは収益と費用で意味が逆になる（fin-design-01 §3, §6.2）。

**Decision:** 営業利益を橋掛け指標とし、サービス層で符号規約を適用：売上高差異はそのまま、売上原価/販売管理費差異は反転。`start + Σdrivers.amount = end` で検証（`reconciliationGap`）。コンポーネントは符号付き drivers を描画するのみ。

**Consequences:**
- ブリッジが常に整合（reconciliationGap=0、丸め誤差以外）。符号規約がサービスに局在し UI 非汚染。

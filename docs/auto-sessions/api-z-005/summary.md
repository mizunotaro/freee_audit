# API-Z-005 — Zod 入力バリデーション監査（inventory / social-insurance / settings）

## 概要

`src/app/api/inventory/`・`src/app/api/social-insurance/`・`src/app/api/settings/`
配下の全 `route.ts` について、Zod `safeParse` による入力バリデーションを監査し、
未検証ハンドラへスキーマを追加した。あわせて social-insurance 系に残っていた
`as any` を除去し、型安全に Zod enum へ置換した。

方針は api-z-001 と同一（既存コード `settings/route.ts`・`settings/api-keys/[provider]`
と同じ `safeParse → 400 (details: error.flatten())` のインライン形式）。新規ヘルパは
不要のため追加していない（既存の `Result<T,E>` 規約に影響なし）。差分は加法的・最小限。

## 変更ファイル（10 件）

| ファイル | 変更内容 |
|---|---|
| `src/app/api/inventory/route.ts` | GET クエリ（action/fiscalYear/month）+ POST ボディ（skip / create）に Zod を追加 |
| `src/app/api/social-insurance/payments/route.ts` | GET クエリ + POST ボディに Zod 追加、`insuranceType as any` を除去（enum 化） |
| `src/app/api/social-insurance/schedules/route.ts` | GET クエリ + POST ボディに Zod 追加、`insuranceType/status as any` を除去（enum 化） |
| `src/app/api/settings/ai/route.ts` | POST ボディ（provider/apiKey/model）に Zod 追加。`encrypt()` 挙動は温存 |
| `src/app/api/settings/market-data/jquants/route.ts` | POST ボディ（email/password）に Zod 追加。`encrypt()` 挙動は温存 |
| `src/app/api/settings/market-data/providers/route.ts` | POST ボディに Zod 追加 |
| `src/app/api/settings/market-data/providers/[id]/route.ts` | PATCH ボディ（enabled/priority/lastError）に Zod 追加 |
| `src/app/api/settings/peer-companies/route.ts` | GET クエリ + POST ボディに Zod 追加 |
| `src/app/api/settings/peer-companies/suggest/route.ts` | POST ボディに Zod 追加（market/growthStage は enum、minPeers/maxPeers/useAI は default） |
| `src/app/api/settings/peer-companies/[id]/route.ts` | PUT ボディ（部分更新）に Zod 追加 |

## 監査結果：変更不要と判断したルート（3 件）

| ファイル | 理由 |
|---|---|
| `src/app/api/settings/route.ts` | 既に `updateSettingsSchema.safeParse` + `settings-sanitizer` 適用済み。シークレット系サニタイザ挙動を温存するため**非改修**。 |
| `src/app/api/settings/api-keys/[provider]/route.ts` | 既に `providerSchema` / `updateApiKeySchema` の `safeParse` 適用済み。**非改修**。 |
| `src/app/api/settings/market-data/jquants/test/route.ts` | リクエストボディを持たない（`request.json()` なし）。検証対象なし。**非改修**。 |

## 検証

```
$ node scripts/autopm_verify.mjs --changed-only
exitCode: 0
  - typecheck: ok  (totalErrors=0, relevantErrors=0)
  - eslint:    ok  (rawExit=0, 10 files, --max-warnings=0)
  - vitest:    skipped (no related tests resolved — 当該ルートのユニット/統合テストは未整備)
```

## Class A 該当

なし。スコープ内パスはいずれも Class A 境界（`src/{app/api,services}/{valuation,tax,kpi,...}/**` 等）に含まれない。
シークレット暗号化（`encrypt`）を呼ぶ `settings/ai`・`settings/market-data/jquants` は
**入力スキーマ検証のみの加法変更**とし、暗号化・保存ロジックは一字一句変更していない。

## 振る舞いの互換性（既存フロントエンド呼び出しに対する考慮）

- **social-insurance**: フロント（`social-insurance/page.tsx`）は GET を `?companyId=` のみ、POST を
  `{companyId, insuranceType, year, month, expectedAmount, actualAmount, dueDate, notes}` で呼ぶ。
  追加スキーマは `companyId` など未知クエリを strip（既定動作）するため互換。`dueDate` は `z.coerce.date()`。
- **peer-companies `[id]` PUT**: `handleToggleActive` が `{ isActive }` のみ送るため、PUT スキーマは
  **全フィールド省略可能**（部分更新）とし `?? existing.*` で既存値を補完する元挙動を維持。
- **peer-companies `suggest`**: フロントは `{industry, revenue?, employees?, minPeers, maxPeers}` のみ送信。
  `market`/`growthStage` は `PeerSelectionCriteria` の合同型に合わせ enum とし、`minPeers/maxPeers/useAI` は default 付与。
- **inventory**: 現状フロントエンド呼び出しなし。GET `month` は `0..12` を許容し `0 → 当月` の元セマンティクスを維持。

## 残課題

特になし。スコープ外（`settings/route.ts` 等の既存バリデーション）は改修不要と判断した。

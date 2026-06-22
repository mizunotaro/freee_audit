# フロント表示・非同期エラー処理・ビルド運用デバッグ計画

**作成日**: 2026-04-23  
**対象リポジトリ**: `freee_audit`  
**目的**: 現在の品質ゲート未達 (`pnpm test`, `pnpm build`) を、原因別に切り分けて段階的に復旧する。

---

## 1. 背景

2026-04-23 時点で、品質ゲートの実行結果は以下の通り。

| コマンド | 結果 | 状況 |
|---|---|---|
| `pnpm typecheck` | PASS | TypeScript エラーなし |
| `pnpm lint` | PASS | ESLint エラーなし |
| `pnpm test` | FAIL | UI テスト、非同期エラー処理、性能閾値、unhandled rejection で失敗 |
| `pnpm build` | FAIL | `.next` lock の競合、および Next.js 設定警告あり |

今回の計画では、問題を次の3系統に分けて扱う。

1. フロント表示変更に対してテスト期待値が追従していない問題
2. 非同期エラー処理とテストの不整合
3. ビルド運用と `next.config.js` 設定の後片付け

---

## 2. 現在確認できている症状

### 2.1 フロント表示変更起因の失敗

- `tests/unit/app/(dashboard)/analysis/components/score-gauge.test.tsx`
  - loading state で `総合評価スコア` が見つからない
- `tests/unit/app/(dashboard)/analysis/components/benchmark-comparison.test.tsx`
  - company value / deviation の期待値と実表示が不一致
- `tests/unit/app/(dashboard)/analysis/components/trend-charts.test.tsx`
  - `流動性` が複数箇所に表示され `getByText` が失敗
- `tests/unit/app/(dashboard)/analysis/components/recommendations-panel.test.tsx`
  - priority label とフィルタ挙動の期待値が実装とずれている

### 2.2 非同期エラー処理起因の失敗

- `tests/unit/app/(dashboard)/chat/hooks/use-chat.test.ts`
  - `AbortError` を無視できず `Unknown error` になる
  - streaming error chunk を受けた時に error state が立たない
- `tests/unit/lib/api/fetch-with-timeout.test.ts`
  - timeout 時の unhandled rejection が残る
- `tests/unit/services/market-data/base-provider.test.ts`
  - retry exhaust ケースで unhandled rejection が残る

### 2.3 ビルド運用起因の失敗

- `pnpm build` 実行時に `.next\lock` 取得失敗
- `next.config.js` の `experimental.serverActions` に対して Next.js 16 系の警告が出る
- `.next` 配下にビルド残骸が残っており、検証の再現性が低い

---

## 3. デバッグ方針

### 方針 1: 原因別に分離して直す

UI テスト、非同期制御、ビルド運用は性質が異なるため、同時に直さずワークストリームを分ける。

### 方針 2: 先に「仕様の正」を決める

UI 失敗は「コードが正しくてテストが古い」のか、「表示変更が意図せず入った」のかを先に判断する。  
テストだけ先に合わせることは避け、画面仕様・フック仕様・ビルド手順のどれを正とするかを明確にする。

### 方針 3: 品質ゲートは段階的に回復させる

全量 `pnpm test` / `pnpm build` を毎回回す前に、対象範囲を絞った再現コマンドで原因を潰す。

---

## 4. ワークストリーム別計画

## 4.1 ワークストリームA: フロント表示変更の切り分け

### 目的

分析ダッシュボード系 UI の表示仕様とテスト期待値の差分を整理し、意図した UI に対してテストを再整合する。

### 対象

- `score-gauge`
- `benchmark-comparison`
- `trend-charts`
- `recommendations-panel`

### 手順

1. 失敗テストをファイル単位で再実行し、失敗理由を固定する
   - `vitest run <test-file>`
2. 対応コンポーネントを確認し、表示文言・DOM 構造・loading state を比較する
3. 変更が意図的かを判定する
   - 意図的変更: テストを更新
   - 非意図的変更: コンポーネントを修正
4. `getByText` の曖昧一致は役割ベースまたは `getAllByText` に修正する
5. フィルタ UI はクリック前後の状態遷移をテストケースとして明示する

### 成果物

- UI 仕様との差分一覧
- 修正済みコンポーネントまたはテスト
- 再現性のある UI テスト

### 完了条件

- 上記4系統のテストが単体で PASS
- loading / empty / normal / filter interaction を最低1ケースずつ確認

---

## 4.2 ワークストリームB: 非同期エラー処理の整理

### 目的

Abort、timeout、streaming error、retry exhaust の扱いを実装とテストで統一し、unhandled rejection をゼロにする。

### 対象

- `use-chat`
- `fetch-with-timeout`
- `market-data/base-provider`

### 手順

1. 非同期エラーの分類を定義する
   - `AbortError`
   - timeout
   - HTTP error
   - streaming protocol error
   - retry exhausted
2. 各ケースで期待する挙動を明文化する
   - UI に出すか
   - ログだけに留めるか
   - 再 throw するか
3. `AbortError` 判定ロジックを確認する
   - ブラウザ由来とカスタム wrapper の両方を吸収できるか
4. stream 読み取り中の error chunk 受信時の state 更新順序を検証する
5. fake timer を使うテストで promise を確実に await / reject capture できているか見直す
6. Vitest 実行時の unhandled rejection を 0 件にする

### 成果物

- 非同期エラー取り扱いポリシー
- フック / ユーティリティの修正
- 安定化したユニットテスト

### 完了条件

- `use-chat` 系テスト PASS
- `fetch-with-timeout` 系テスト PASS
- `market-data/base-provider` 系テスト PASS
- Vitest の unhandled errors が 0 件

---

## 4.3 ワークストリームC: ビルド運用の後片付け

### 目的

`pnpm build` を再現可能にし、lock 競合や古い Next.js 設定によるノイズを除去する。

### 手順

1. `.next` lock の発生条件を確認する
   - 並列 build 実行
   - 中断 build の残骸
2. ビルド前提手順を固定する
   - build 前に別 `next build` が走っていないことを確認
   - 必要なら `.next` をクリーンアップする
3. `next.config.js` の Next.js 16 非推奨設定を見直す
   - `experimental.serverActions` の妥当性確認
   - 公式仕様に合わせて移行または削除
4. `pnpm build` を単独実行して完走させる
5. build warning を「既知」「要対応」に分類する

### 成果物

- 安定した build 実行手順
- 更新済み `next.config.js`
- build warning / error の整理表

### 完了条件

- 単独 `pnpm build` が PASS
- 不要な `.next` lock 競合が再発しない
- Next.js 設定警告が解消、または理由つきで管理されている

---

## 5. 実行順序

優先順位は以下とする。

1. ワークストリームB: 非同期エラー処理
2. ワークストリームA: フロント表示変更
3. ワークストリームC: ビルド運用
4. 全量品質ゲート再実行

### 理由

- unhandled rejection は他テストへ波及しやすく、失敗解析を汚す
- UI テストは局所修正しやすい
- build はテストが落ちた状態でも独立検証できるが、最終確認は最後でよい

---

## 6. 具体的な検証コマンド

```bash
# 非同期系
pnpm vitest run tests/unit/app/(dashboard)/chat/hooks/use-chat.test.ts
pnpm vitest run tests/unit/lib/api/fetch-with-timeout.test.ts
pnpm vitest run tests/unit/services/market-data/base-provider.test.ts

# UI 系
pnpm vitest run tests/unit/app/(dashboard)/analysis/components/score-gauge.test.tsx
pnpm vitest run tests/unit/app/(dashboard)/analysis/components/benchmark-comparison.test.tsx
pnpm vitest run tests/unit/app/(dashboard)/analysis/components/trend-charts.test.tsx
pnpm vitest run tests/unit/app/(dashboard)/analysis/components/recommendations-panel.test.tsx

# 全体確認
pnpm test
pnpm build
```

---

## 7. 品質基準への対応

今回のデバッグは、特に以下の品質基準に直結する。

| 基準 | 対応内容 |
|---|---|
| 安定性 | timeout / retry / abort の扱い統一 |
| 堅牢性 | 非同期エラー時の例外処理と state 遷移の明確化 |
| 再現性 | `.next` lock 競合を避けるビルド手順の固定化 |
| メンテナンス性 | UI 仕様とテスト期待値の再整合 |
| パフォーマンス | 不安定な性能閾値テストの見直し |
| 文法・構文エラー防止 | `typecheck` / `lint` / `test` / `build` の再通過 |
| 全体整合性 | 実装、テスト、運用手順の一貫化 |

---

## 8. リスクと注意点

- UI テストを安易に実装へ合わせると、意図しない表示退行を見逃す
- fake timer を使うテスト修正では、実装の不具合をテスト側で隠さないこと
- `.next` クリーンアップは build 検証前提の手順として文書化し、恒常運用にしない
- `next.config.js` は Next.js 16 の公式仕様と照合してから変更する

---

## 9. 最終完了条件

以下を満たした時点で、本計画は完了とする。

- `pnpm typecheck` PASS
- `pnpm lint` PASS
- `pnpm test` PASS
- `pnpm build` PASS
- 追加した修正内容がドキュメントに反映済み


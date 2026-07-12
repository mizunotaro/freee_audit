# DOC-ARCH-01 — サマリー

## 成果物
- 新規: `docs/ARCHITECTURE.md`（非 Class-A 視点のアーキテクチャ概要）

## 含内容
1. **トップレベルモジュールマップ** — `src/` 5 層（App / Components / Services / Lib / Types・支援）。
   実ディレクトリを再確認して記載（CLAUDE.md §3 の誤記を訂正: `shared/`・`common/`・`analysis/`・`audit/`・`board/`・`dashboard/` は実在せず、共有レイヤは `components/layout/`）。
2. **リクエスト処理フロー** — Mermaid 図 + 5 ステップ。実装確認に基づき下記を明記:
   - `middleware.ts` の `config.matcher` が `/api` を除外 → API 認証はルートハンドラ内（`getAuthUser` → `validateSession`）で施行。
   - `x-user-id` ヘッダはレスポンス付与でありアクター取得元ではない（Cookie/session 経由が正）。
   - サービス層は `prisma`（`@/lib/db` シングルトン）で DB 読み書き、`Result<T,AppError>` を返す。
3. **Result<T,E> + Zod 規約** — `@/types/result` のヘルパ一覧、Zod `safeParse` 失敗時 `VALIDATION_ERROR`、Result→HTTP マッピング表とコード例。
4. **監査シーム** — `prisma.auditLog.create()` 直接呼出し禁止、`logRouteAudit()` 経由（ハッシュ鎖維持）。
5. **Class-A 境界** — タスク制約のパス一覧を読取専用として明示（DB / セキュリティコア / ドメインエンジン / 変換+freee / 保護 API / マイクロサービス）。

## 検証
- `node scripts/autopm_verify.mjs --changed-only` → exit 0（新規 Markdown のみ。TS/テスト変更なし）。

## 意図的に除外したもの
- Class-A 内部の詳細（監査エンジン・変換エンジン・AI オーケストレータ等）は参照専用のため本書では深掘りせず、各専用ドキュメントへ誘導。

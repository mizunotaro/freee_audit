# バックアップ／リストア運用手順 (OPERATIONS_BACKUP)

> データベースのバックアップ・リストア・検証（DR ドリル）の手順と契約定義。
> このファイルは `docs/DEPLOYMENT.md` の補完資料（protected な同ファイルは編集しない）。

## 1. 概要

本ドリルは現在の SQLite（`file:` プロバイダー）データベースファイルを対象とし、
依存パッケージを新規追加せず Node.js 標準機能のみで動作する。

- **バックアップ**: 対象 `.db` ファイルのバイトコピー + SHA-256 チェックサム + manifest サイドカー
- **リストア**: manifest のチェックサム検証を通過したものを **一時場所** へ復元（ライブ DB は上書きしない）
- **検証**: Prisma クライアントでモデル別の行数を比較

PostgreSQL プロバイダーは構造のみ拡張ポイントとして用意し、現時点では未実装（
`postgresql:` を渡すと明示的に失敗し、偽の成功を返さない）。

## 2. 構成要素

| 種別 | パス | 役割 |
|------|------|------|
| ライブラリ（TS） | `src/lib/backup/sqlite-backup.ts` | `Result<T,E>` + Zod で型付けされた再利用可能ヘルパ群。単体テスト対象。 |
| CLI（バックアップ） | `scripts/db-backup.mjs` | `node` 単体で実行可能。dep-free（Node 標準機能のみ）。 |
| CLI（リストア） | `scripts/db-restore.mjs` | `node` 単体で実行可能。デフォルトは dep-free、`--verify-rows` 時のみ `@prisma/client`（既存依存）を使用。 |
| テスト | `tests/unit/lib/backup/sqlite-backup.test.ts` | 実シード DB に対する backup→restore→verify のエンドツーエンドドリル + CLI 相互運用性。 |

## 3. 使い方

### 3.1 バックアップ

```bash
# prisma/dev.db の隣にバックアップを生成
node scripts/db-backup.mjs prisma/dev.db

# 出力先を指定
node scripts/db-backup.mjs prisma/dev.db --out ./backups
```

生成物:

- `prisma/dev.db.<UTCstamp>.db` — バイトコピー本体
- `prisma/dev.db.<UTCstamp>.db.manifest.json` — チェックサム／メタデータ

UTCstamp は `YYYYMMDDTHHMMSSZ`（ファイル名安全）。

### 3.2 リストア（一時場所へ）

```bash
# チェックサム検証後に一時ディレクトリへ復元
node scripts/db-restore.mjs ./backups/dev.db.20260711T120000Z.db --to ./restore-tmp

# 行数検証付き（ライブ DB と比較）
node scripts/db-restore.mjs ./backups/dev.db.20260711T120000Z.db \
  --to ./restore-tmp --verify-rows prisma/dev.db
```

- `--to` は必須（ライブ DB の上書きを防ぐため、復元先は常に別ディレクトリ）。
- `--overwrite` で復元先の既存ファイルを置き換え。
- `--verify-rows <liveDb>` で Prisma によるモデル別行数突合（全一致で exit 0）。

終了コード: `0` = 成功（`--verify-rows` 指定時は検証も通過）、`1` = チェックサム不一致・入力エラー・行数不一致、`2` = 未サポートプロバイダー。

### 3.3 ライブラリ経由（アプリ／CI から）

```typescript
import { backupDatabase, restoreDatabase, verifyRowCounts } from '@/lib/backup/sqlite-backup'

const backup = await backupDatabase({ sourcePath: 'prisma/dev.db', outDir: './backups' })
if (!backup.success) throw backup.error

const restore = await restoreDatabase({ backupPath: backup.data.backupPath, targetDir: './restore-tmp' })
if (!restore.success) throw restore.error

const report = await verifyRowCounts({
  sourceUrl: 'file:./prisma/dev.db',
  targetUrl: `file:${restore.data.restoredPath}`,
})
if (!report.success || !report.data.allMatch) throw new Error('row count mismatch')
```

## 4. Manifest 契約（バージョン 1）

`scripts/db-backup.mjs` と `src/lib/backup/sqlite-backup.ts` は同一の manifest 形式を共有する。
CLI が生成した manifest をライブラリのリストアパスで消費可能（逆も同様）。テストがこの相互運用性を担保する。

```json
{
  "manifestVersion": 1,
  "provider": "sqlite",
  "source": "/abs/path/dev.db",
  "backupPath": "/abs/path/dev.db.20260711T120000Z.db",
  "checksumAlgorithm": "sha256",
  "checksum": "<64-char hex>",
  "bytes": 12345,
  "createdAt": "2026-07-11T12:00:00.000Z"
}
```

破壊的変更時は `BACKUP_MANIFEST_VERSION`（現状 `1`）を繰り上げること。

## 5. 検証対象モデル（既定）

`verifyRowCounts` / `db-restore.mjs --verify-rows` は以下の既定モデルで行数を比較する
（`verifyRowCounts` の `models` オプションで任意指定可能）:

`user`, `company`, `session`, `auditLog`, `journal`, `monthlyBalance`

行数が 0 のモデルも含めて両 DB で一致することを確認する。

## 6. PostgreSQL 拡張（将来対応）

各関数・スクリプトはプロバイダー判定（`detectProvider`）と provider 分岐を持つ構造になっており、
SQLite 支払列を追加する形で PG を拡張できる:

- バックアップ: `pg_dump -Fc` 等でアーカイブを生成し、manifest は同じスキーマ（`provider: "postgresql"`）を再利用。
- リストア: `pg_restore --clean` 等で一時データベースへ復元後、行数検証は同じ Prisma 比較を再利用。
- 依存: PG 対応には `pg` 等のクライアント追加、または `pg_dump`/`pg_restore` CLI 前提の設計が必要（本タスクでは新規依存を追加しないため未実装）。

PG 未対応の状態で `postgresql:` を渡すと、ライブラリは `BUSINESS_LOGIC_ERROR` の `failure`、
CLI は exit code 2 を返す。

## 7. 制限事項・注意

- **WAL／並行書き込み未考慮**: バイトコピーは SQLite の WAL や書き込み中の状態を考慮しない。
  バックアップ取得時は DB への書き込みを停止するか、本番等級のオンラインバックアップ
  （`sqlite3 .backup` / `VACUUM INTO`／`better-sqlite3` 等）を別途検討すること。
  本ドリルは運用手順の検証とリストア可能性の確認を目的とする。
- **リストアは常に一時場所へ**: ライブ DB を直接上書きしない。昇格はオペレーターが別途行う。
- **`docs/DEPLOYMENT.md` §6.2** が参照する `scripts/migrate-sqlite-to-pg.ts` / `scripts/verify-migration.ts` は現存しない（SQLite→PG データ移行は別タスク `pg-prep-01` で計画中）。

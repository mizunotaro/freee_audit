# backup-01 — DB backup/restore drill script + verification test

## Scope
Added a dependency-free SQLite backup/restore drill with checksum verification and a real
end-to-end test. Structured for future PostgreSQL extension without rewriting (provider
switch + manifest contract). No Class-A paths touched; no new dependencies; no
`any`/`@ts-ignore`/`.skip`/lint-disable.

## Deliverables

| Path | Role |
|------|------|
| `src/lib/backup/sqlite-backup.ts` | Canonical `Result<T,E>` + Zod helpers: `backupDatabase`, `restoreDatabase` (checksum-gated), `verifyRowCounts` (Prisma `.count()` comparison), `detectProvider`. SQLite implemented; `postgresql` returns explicit `failure` (no fake success). |
| `scripts/db-backup.mjs` | Dep-free CLI (Node builtins only). Byte-copy + SHA-256 + manifest sidecar. |
| `scripts/db-restore.mjs` | Dep-free CLI (default path). Checksum verify + restore to a TEMP dir; `--verify-rows` lazily imports `@prisma/client` (already-installed) for row-count comparison. Never overwrites the live DB. |
| `tests/unit/lib/backup/sqlite-backup.test.ts` | 9 tests. Real `prisma db push` into a throwaway temp DB + seeded rows; in-process backup→restore→verify, corruption negative, missing-manifest negative, unsupported-provider negative; CLI subprocess interop (db-backup.mjs output consumed by TS restore; db-restore.mjs end-to-end incl. corruption). |
| `docs/OPERATIONS_BACKUP.md` | Usage, manifest contract (v1), default verify models, PG extension notes, limitations (WAL/concurrent writes). |

## Shared contract
Both the TS library and the `.mjs` CLIs emit/consume the same manifest shape
(`BACKUP_MANIFEST_VERSION = 1`): `{manifestVersion, provider, source, backupPath,
checksumAlgorithm:'sha256', checksum, bytes, createdAt}`. The test pins interop: a backup
produced by `db-backup.mjs` is restored + verified through the TS path, and vice-versa.

## Verification
- `corepack pnpm exec vitest run tests/unit/lib/backup/sqlite-backup.test.ts` → 9/9 pass.
- `eslint --max-warnings=0` on both TS files → clean.
- `tsc --noEmit` → no errors in the new module.
- Worktree was delivered without `node_modules`; recovered via
  `corepack pnpm install --frozen-lockfile` + `corepack pnpm db:generate` before any verify.

## Decisions / honest scope
- **SQLite byte-copy only.** Does not handle WAL / concurrent writes — documented as a
  limitation; production-grade online backup is out of scope (would need `better-sqlite3`
  or `sqlite3 .backup`, i.e. a new dependency).
- **PG not implemented.** Structured via `detectProvider` + provider branches; returns a
  clear `failure`/exit-2 rather than pretending. Adding PG = adding a branch.
- **Restore always targets a temp dir** — the live DB is never overwritten; promotion is an
  explicit operator step.
- **`.mjs` scripts are not lint/type-checked by the autopm gate** (bucketed as `other`);
  interop is instead guarded by the subprocess tests.
- **`docs/DEPLOYMENT.md` not edited** (protected). New `docs/OPERATIONS_BACKUP.md` is the
  adjacent doc; it also notes DEPLOYMENT §6.2's referenced `migrate-sqlite-to-pg.ts` /
  `verify-migration.ts` are still missing (out of scope; tracked under `pg-prep-01`).

## Definition of done
- `node scripts/autopm_verify.mjs --changed-only` exits 0.

# PG-PREP-01 — SQLite → PostgreSQL Migration Plan (PROPOSAL)

> **Status: ANALYSIS ONLY — NOT A DECISION.**
> This document is a read-only audit produced by an automated agent. Every
> conclusion, recommendation, and "proposed change" below is marked
> **PENDING HUMAN DETERMINATION**. Nothing here is approved, signed off, or
> final. No reviewer name is attached. A human maintainer must decide each item.
>
> **Hard scope of the audit task:** schema (`prisma/schema.prisma`), Docker/compose
> files, and DB access patterns were read; the source tree is treated as read-only.
> The **only** file written by this task is this proposal. The `prisma/` schema and
> migrations are Class-A (human-owned) and are referenced, not modified.

---

## 0. How to read this document

- "Finding" = a fact established by reading the repository, with the file/line evidence.
- "Proposed change" = a concrete candidate action a human could take. It is a **proposal**.
- "**PENDING HUMAN DETERMINATION**" = the decision is deferred to a human. It appears on
  every conclusion because this task is explicitly analysis-for-a-human, not a sign-off.
- Code blocks (SQL, YAML, shell, TypeScript) are **illustrative proposals**, not files
  that were created. Copying them in is itself a human decision.

Conventions used below:
- "SQLite" = the current dev/PoC engine (`provider = "sqlite"`).
- "PG" / "Postgres" = the target production engine (`provider = "postgresql"`).
- Target PG version assumed = **15**, to match `docs/DEPLOYMENT.md` (RDS `engine_version = "15.4"`).

---

## 1. Executive summary

The schema is, on the whole, **highly favorable for an SQLite → PostgreSQL migration**.
The riskiest parts of a typical Prisma cross-engine move — hand-written SQL, engine-specific
native types, auto-increment integer PKs, and SQLite date/JSON functions — are **absent** here.
The genuine open questions are a small number of data-modeling and operational decisions, not
a large mechanical rewrite.

**Headline findings (all PENDING HUMAN DETERMINATION):**

1. **Zero raw SQL in `src/`.** No `$queryRaw`, `$executeRaw`, `Prisma.sql`, or SQLite-specific
   functions (`datetime('now')`, `julianday`, `strftime`, `json_extract`, `PRAGMA`, …) were
   found in application code. The migration is not blocked by hand-written SQL that must be
   re-translated. *(Finding F-04)*
2. **Zero engine-specific native types.** There are **0** `@db.*` annotations, **0** `Json`,
   **0** `Decimal`, **0** `Bytes`, **0** `BigInt`, **0** `Unsupported` fields. Every column is
   one of `String / String? / Int / Int? / Float / Float? / Boolean / Boolean? / DateTime / DateTime?`.
   This means there is **no per-column type rewriting required** to move the schema onto PG.
   *(Finding F-02)*
3. **All primary keys are `String @default(cuid())` (77 of them).** There is no `@default(autoincrement())`
   and no `Int @id`. There are therefore **no sequence/SERIAL/identity migration hazards**.
   *(Finding F-05)*
4. **No `enum`s (0).** Roles, statuses, and categories are stored as free-text `String` with
   `@default(...)` (e.g. `role String @default("VIEWER")`, `auditStatus String @default("PENDING")`).
   There is nothing to port to PG `CREATE TYPE ... AS ENUM`. *(Finding F-03)*
5. **~61 `Float` columns, the majority holding JPY monetary amounts.** Both SQLite (`REAL`) and
   PG (`double precision`/`float8`) store these as IEEE-754 doubles, so **the migration does not
   change monetary precision** — but it is the natural moment to decide whether monetary columns
   should become `Decimal`/`numeric`. That decision is out of scope for "engine swap" and is a
   separate, larger change with application-code consequences. *(Finding F-06)*
6. **Production `docker-compose` currently points at SQLite.** `infrastructure/docker/docker-compose.yml`
   sets `DATABASE_URL=file:/app/data/production.db` for both `app` and `app-dev`. A PG service is
   not defined anywhere in the repo. *(Finding F-09)*
7. **CI runs entirely against `file:./test.db`, and unit/integration tests mock `@/lib/db`.**
   No CI job spins up a real database engine today, so the current suite **cannot detect PG-specific
   regressions**. Only the Playwright E2E job exercises a live (SQLite) engine. *(Finding F-10)*
8. **The existing `docs/DEPLOYMENT.md §6.2` already sketches this migration but is a stub.**
   It references `scripts/migrate-sqlite-to-pg.ts` and `scripts/verify-migration.ts`, **neither of
   which exists** in `scripts/`. This proposal turns that stub into a concrete, sequenced plan.
   *(Finding F-11)*
9. **`docs/DATABASE_DESIGN.md` is partly aspirational and out of sync.** Its inline schema shows
   `enum UserRole { ... }`, but the **real** `prisma/schema.prisma` has **zero** enums. Migration
   decisions must be made against the real schema, not the design doc. *(Finding F-12)*

The recommended posture: treat this as a **low-mechanical-risk, high-operational-care** move —
schema translation is trivial; the work is in *data movement, CI parity, and the Float/enum
design decisions*, each of which is a human call.

---

## 2. Current-state assessment (evidence)

### F-01 — Datasource is SQLite, single env-driven URL
`prisma/schema.prisma:5-8`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```
- No `shadowDatabaseUrl`, no `relationMode`, no `previewFeatures`.
- `.env.example:10-12` confirms the intended split:
  ```
  # PoC/Dev: SQLite | Production: PostgreSQL
  DATABASE_URL="file:./dev.db"
  # DATABASE_URL="postgresql://user:password@host:5432/dbname"
  ```
- **Proposed change (PENDING HUMAN DETERMINATION):** flip `provider` to `"postgresql"`
  and require the PG connection string in `DATABASE_URL` for non-PoC environments. Because the
  schema is Class-A/human, the exact moment and branch are a human decision.

### F-02 — Field-type inventory (no engine-specific types)
Counts across `prisma/schema.prisma` (77 models):

| Prisma type   | Count | SQLite storage | PG storage (Prisma default) | Migration action |
|---------------|-------|----------------|-----------------------------|------------------|
| `String`      | 367   | `TEXT`         | `TEXT`                      | none             |
| `String?`     | 212   | `TEXT`         | `TEXT`                      | none             |
| `DateTime`    | 154   | `DATETIME` (TEXT, ISO8601) | `TIMESTAMP(3)`  | Prisma handles    |
| `DateTime?`   | 36    | `DATETIME`     | `TIMESTAMP(3)`              | Prisma handles    |
| `Int`         | 58    | `INTEGER`      | `INTEGER` (int4)            | none             |
| `Float`       | 36    | `REAL` (double)| `DOUBLE PRECISION` (float8) | none (see F-06)  |
| `Float?`      | 25    | `REAL`         | `DOUBLE PRECISION`          | none (see F-06)  |
| `Boolean`     | 36    | `INTEGER` (0/1)| `BOOLEAN`                   | Prisma handles    |
| `Int?`        | 12    | `INTEGER`      | `INTEGER`                   | none             |
| `Boolean?`    | 1     | `INTEGER`      | `BOOLEAN`                   | Prisma handles    |
| `Json`/`Decimal`/`Bytes`/`BigInt` | 0 | — | — | n/a |

- `@db.*` native-type annotations: **0**. `enum`s: **0**. `Unsupported` types: **0**.
- **Conclusion (PENDING HUMAN DETERMINATION):** no per-column type rewriting is required for
  the engine swap. The only type-level decision available is *optional* promotion of monetary
  `Float` to `Decimal` (F-06), which is independent of the engine move.

### F-03 — No enums (status/role/category are free-text `String`)
Examples: `User.role String @default("VIEWER")` (`schema.prisma:15`),
`Journal.auditStatus String @default("PENDING")` (`schema.prisma:122`), plus ~10 more
`@default("DRAFT"|"pending"|"PENDING"|...)` status strings.
- **Conclusion (PENDING HUMAN DETERMINATION):** there is nothing to port to `CREATE TYPE AS ENUM`.
  Whether to *introduce* PG enums to constrain these free-text statuses is a separate hardening
  decision (it would also require application validation changes) and is **not** a prerequisite
  for the engine migration.

### F-04 — Zero raw SQL in `src/`; zero SQLite-specific functions
`grep` across `src/` for `$queryRaw | $executeRaw | Prisma.sql | $queryRawUnsafe | $executeRawUnsafe`
returned **0** matches; `grep` for `datetime('now') | julianday | strftime | group_concat |
json_extract | json_each | PRAGMA | AUTOINCREMENT | IFNULL` returned **0** matches.
The single `$queryRaw` in the repo is the portable health check in `src/lib/db.ts`:
```ts
await prisma.$queryRaw`SELECT 1`
```
- **Conclusion (PENDING HUMAN DETERMINATION):** no application SQL must be re-translated for PG.
  `SELECT 1` and Prisma's query builder are engine-agnostic. The migration's mechanical risk is
  concentrated entirely in **data movement** (§6) and **CI parity** (§5), not in query code.

### F-05 — All PKs are `String @default(cuid())`; no autoincrement
77 `@default(cuid())`, 69 `@default(now())` (mapped to `CURRENT_TIMESTAMP` on SQLite and to PG
`now()` by Prisma). No `@default(autoincrement())`, no `dbgenerated(...)`, no `Int @id`.
- **Conclusion (PENDING HUMAN DETERMINATION):** no SERIAL/identity/sequence migration concerns;
  IDs copy verbatim (`TEXT` → `TEXT`), preserving all FK references and the audit hash chain.

### F-06 — `Float` is used for monetary amounts (precision unchanged by the move)
Representative monetary `Float` columns (full list in §F-06 appendix below): `Journal.amount`,
`Journal.taxAmount`, `MonthlyBalance.openingBalance/closingBalance`, `FixedAsset.acquisitionCost/
salvageValue/bookValue`, `TaxEffectAccounting.deferredTaxAsset/deferredTaxLiability`,
`PrepaidExpense/AccruedExpense.originalAmount/remainingAmount/monthlyAmount`,
`BudgetEntry.expectedAmount/actualAmount`, `ExchangeRate.rate`, etc. Non-monetary floats
(`confidence`, `percentage`, `yoyChange`, thresholds, `progress`) are also present.
- **Key fact:** SQLite `REAL` and PG `DOUBLE PRECISION` are **both IEEE-754 64-bit doubles**.
  Moving the column does **not** alter stored values or arithmetic precision.
- **Proposed change — two options, both PENDING HUMAN DETERMINATION:**
  - **(A) Preserve `Float` as `double precision`** — zero data-model change, zero app-code change,
    zero precision change. Strictly an *engine swap*. Lowest risk; recommended *if the goal is
    only to reach PG*.
  - **(B) Promote monetary `Float` → `Decimal`/`numeric(p,s)** — appropriate for accounting
    correctness, but it is a **separate, larger change**: it touches Class-A schema, requires
    selecting scale/precision per column, and changes the Prisma client field type from JS
    `number` to `Decimal` (decimal.js), which ripples through every reader/writer in `src/services`
    and the Python/R services. This should be tracked as its own work item, **not** bundled into
    the engine swap.
- **Recommendation framing (PENDING HUMAN DETERMINATION):** do (A) now to de-risk the move;
  evaluate (B) as a follow-up. Bundling (B) into the move increases blast radius and review load
  on Class-A paths.

### F-07 — Constraints: 31 compound `@@unique`, 69 FK `onDelete` rules
- `@@unique` compound constraints: **31** (e.g. `@@unique([companyId, fiscalYear, month,
  departmentId, accountCode])` at `schema.prisma:205`, `@@unique([companyId, insuranceType,
  year, month])` at `:795`).
- `onDelete`: **68 `Cascade`**, **1 `SetNull`**. Both are supported identically on PG.
- **NULL-in-UNIQUE behavior:** SQLite treats NULLs as distinct in a `UNIQUE` constraint; PG's
  default is **also** `NULLS DISTINCT` (PG ≥15). The two are consistent by default. *(Caveat
  PENDING HUMAN DETERMINATION: if any row currently relies on multiple-NULL dedup semantics,
  that behavior carries over; verify with the preflight in §6.3.)*
- **FK strictness:** PG enforces foreign keys **by default and unconditionally**. SQLite only
  enforces them when `PRAGMA foreign_keys=ON`. Data that was written through paths with FKs off
  (e.g. a raw `sqlite3` import) could contain **orphaned child rows** that PG will reject on
  insert. The data-copy step must therefore (a) insert parents before children and (b) run a
  preflight orphan scan (§6.3).
- **Known data-level hazard (cross-reference, not re-audited here):** the repo's own backlog notes
  a `P2002` (unique-constraint) violation in tax-withholding scheduling against
  `@@unique([companyId, insuranceType, year, month])`. This is a **data** issue, not a schema
  issue, but it means a blind bulk copy can fail mid-load. The copy tooling must report, not
  silently drop, constraint violations (§6.3).

### F-08 — `Float` columns summary (appendix to F-06)
Full list of `Float`/`Float?` columns (from `schema.prisma`):
```
amount, taxAmount, confidenceScore (AuditResult/Journal/etc.)
rate, confidence (ExchangeRate/Analysis)
originalAmount, exchangedAmount, settlementAmount, exchangeGainLoss,
  revaluationGainLoss (ForeignCurrencyTransaction)
value, amount (FinancialKPI/MonthlyBalance/CashFlow)
targetValue, warningThreshold, criticalThreshold (KPI thresholds)
previousValue, yoyChange (KPIRecord)
acquisitionCost, salvageValue, accumulatedDep, bookValue (FixedAsset)
deferredTaxAsset, deferredTaxLiability, netDeferredTax (TaxEffectAccounting)
openingBalance, closingBalance, adjustment (InventoryAdjustment)
expectedAmount, actualAmount (BudgetEntry / SocialInsurance)
originalAmount, remainingAmount, monthlyAmount (Prepaid/AccruedExpense)
percentage, confidence, progress (Conversion / mapping confidence)
```

### F-09 — Production Docker compose uses SQLite; no PG service exists
`infrastructure/docker/docker-compose.yml`:
- `app` service: `DATABASE_URL=file:/app/data/production.db` (production!)
- `app-dev` service: `DATABASE_URL=file:/app/data/dev.db`
- Services present: `app`, `app-dev`, `python-service`, `r-service`. **No `postgres`/`db` service.**
- `docker/ndlocr/docker-compose.yml` is for the OCR stack (unrelated to the app DB).
- **Conclusion (PENDING HUMAN DETERMINATION):** a PG service must be added to compose, and the
  `DATABASE_URL` for non-PoC profiles must point at it. Concrete proposed compose diff in §4.

### F-10 — CI runs on `file:./test.db`; unit/integration suites mock the DB
`.github/workflows/ci.yml`:
- Every job (`lint`, `typecheck`, `unit-tests-shard` ×64, `integration-tests`, `e2e-tests`,
  `build`) sets `DATABASE_URL: 'file:./test.db'`.
- **No `services:` block and no PG service container anywhere in CI.**
- `tests/setup.ts` does `vi.mock('@/lib/db', ...)` (a hand-written per-model mock object), so the
  64 unit-test shards and the integration suite **never issue a real SQL statement**. They validate
  application logic against an in-process mock, not engine behavior.
- The only job that touches a real engine is `e2e-tests` (Playwright), whose `webServer` runs
  `pnpm dev` against the SQLite dev DB.
- `deploy.yml` already runs `pnpm prisma migrate deploy` against `secrets.DATABASE_URL` — so the
  **deploy pipeline is already PG-ready**; what is missing is (a) a PG engine to deploy into and
  (b) CI coverage that exercises PG.
- **Conclusion (PENDING HUMAN DETERMINATION):** existing CI cannot catch PG regressions. A new,
  dedicated PG job is needed (§5) — and it should be **additive**, not a rewrite of the 64-shard
  unit matrix.

### F-11 — `docs/DEPLOYMENT.md §6.2` is a stub; referenced scripts do not exist
`docs/DEPLOYMENT.md` (~line 408) sketches:
```bash
DATABASE_URL="postgresql://..." pnpm prisma migrate deploy
sqlite3 prisma/dev.db .dump > dump.sql
ts-node scripts/migrate-sqlite-to-pg.ts
ts-node scripts/verify-migration.ts
```
- `scripts/migrate-sqlite-to-pg.ts`: **does not exist**.
- `scripts/verify-migration.ts`: **does not exist**.
- `scripts/` currently contains only: `autopm_verify.mjs`, `benchmark-parallel.ts`,
  `security-checklist.js`, `test-quality-report.mjs`, `verify-ai-setup.sh`.
- The doc's draft `migrateUsers()` loops model-by-model with `targetDb.user.create(...)` —
  conceptually fine but incomplete (no FK ordering, no constraint preflight, no verification,
  no rollback). §6 of this proposal specifies the real design.
- **Note (PENDING HUMAN DETERMINATION):** the `.dump > dump.sql` approach in the doc is **not**
  directly loadable into PG — SQLite `dump` emits SQLite DDL/DML (`INTEGER PRIMARY KEY`,
  `INSERT INTO "users" VALUES(...)`). A raw dump requires substantial transformation. The
  per-model Prisma-to-Prisma copy in §6 is safer because Prisma serializes/deserializes each
  row through the client, normalizing types across engines.

### F-12 — `docs/DATABASE_DESIGN.md` drifts from the real schema
`docs/DATABASE_DESIGN.md` (~line 203) shows `enum UserRole { ... }` in its inline schema excerpt,
and frames multi-DB support as a design goal. The **real** `prisma/schema.prisma` has **0 enums**
and `role String`. The design doc is aspirational.
- **Conclusion (PENDING HUMAN DETERMINATION):** make migration decisions against the real schema,
  not the design doc. Optionally update the doc to match reality as a separate docs task (docs are
  not Class-A, but editing them is still outside this audit's single-file output rule).

---

## 3. SQLite → PostgreSQL type/constraint diff

Engine-level differences that actually matter for **this** schema (given F-02–F-05):

| Aspect | SQLite (current) | PostgreSQL 15 (target) | Impact here | Action |
|--------|------------------|------------------------|-------------|--------|
| Provider | `sqlite` | `postgresql` | schema + lock file | switch (§4.1) |
| String | `TEXT` | `TEXT` | none | — |
| DateTime | `DATETIME` (TEXT ISO8601) | `TIMESTAMP(3)` | Prisma normalizes on read/write | handled by copy (§6) |
| Boolean | `INTEGER` 0/1 | `BOOLEAN` | Prisma normalizes | handled by copy |
| Float | `REAL` (double) | `DOUBLE PRECISION` | **identical precision** | none (F-06) |
| Int | `INTEGER` (8-byte) | `INTEGER` (int4, ±2.1e9) | see `fileSize` note | verify (§3.1) |
| `@default(cuid())` | app-side | app-side | none | — |
| `@default(now())` | `CURRENT_TIMESTAMP` | `CURRENT_TIMESTAMP`/`now()` | none | — |
| FK enforcement | only with `PRAGMA foreign_keys=ON` | **always on** | orphaned rows rejected | preflight (§6.3) |
| NULL in UNIQUE | distinct | distinct (default) | consistent | — |
| `LIKE` | ASCII case-insensitive | **case-sensitive** (use `ILIKE`) | no raw `LIKE` in `src/` | none (F-04) |
| Transactions | interactive `$transaction` | interactive `$transaction` (SAVEPOINT) | none; note timeout | §3.2 |
| Autoincrement PKs | `INTEGER ... AUTOINCREMENT` | `SERIAL`/identity | **none present** | — |
| Enums | n/a | `CREATE TYPE` | **none present** | — |

### 3.1 `Int` overflow note (PENDING HUMAN DETERMINATION)
SQLite `INTEGER` is 8-byte; PG `INTEGER` is 4-byte (max ≈ 2.14e9). The only plausible
near-overflow candidate is `fileSize Int` (4 columns: `schema.prisma:142, 1256, 1418, 1666`),
which represents uploaded-file byte counts. A single file > 2 GB would overflow int4.
- **Proposed change (PENDING HUMAN DETERMINATION):** either cap uploads below 2 GB at the
  application layer (no schema change), or widen `fileSize` to `BigInt` (→ PG `BIGINT`) — the
  latter is a Class-A schema change and a separate decision. Not a blocker for the engine swap.

### 3.2 Interactive transaction timeout note (PENDING HUMAN DETERMINATION)
There are **45** `prisma.$transaction(...)` call sites (interactive and batch-array forms).
On PG, Prisma's interactive transactions honor `maxWait`/`timeout` (defaults are generous).
No code change is required, but very long-running report-generation transactions
(e.g. `src/services/reports/board-report-service.ts` has 9 `$transaction` sites) should be
spot-checked against PG lock behavior under concurrent load. **PENDING HUMAN DETERMINATION**
whether to raise `transactionOptions` for the heaviest report services.

---

## 4. Proposed `docker-compose` for local PG

> Illustrative **proposal** — PENDING HUMAN DETERMINATION. Adding/editing compose files is a
> human action; this block shows the candidate shape so a human can review it. PG version pinned
> to 15 to match `docs/DEPLOYMENT.md`.

### 4.1 Schema switch (the one schema-side change)
```prisma
// prisma/schema.prisma  (Class-A — human edits this)
datasource db {
  provider = "postgresql"      // was "sqlite"
  url      = env("DATABASE_URL")
  // Optional, recommended for `prisma migrate dev` in CI/containers where the
  // connecting role cannot CREATE DATABASE:
  // shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```
```toml
# prisma/migrations/migration_lock.toml
provider = "postgresql"        # was "sqlite"
```
- **PENDING HUMAN DETERMINATION:** whether to keep a *separate* PoC schema on SQLite (dual-engine
  support) or commit to PG everywhere. Dual-engine is fragile (no shared migration history);
  this proposal assumes **PG everywhere except the throwaway PoC `.db` files**, but the call is
  human.

### 4.2 Local dev compose service (additive)
```yaml
# infrastructure/docker/docker-compose.yml — proposed additions (PENDING HUMAN DETERMINATION)
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: freee
      POSTGRES_PASSWORD: freee_dev
      POSTGRES_DB: freee_audit
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U freee -d freee_audit"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - calculation-network

  app:
    # ...existing app config, but change:
    environment:
      - DATABASE_URL=postgresql://freee:freee_dev@db:5432/freee_audit?schema=public
    depends_on:
      db:
        condition: service_healthy
      # ...existing python-service / r-service

  app-dev:
    # ...existing app-dev config, but change DATABASE_URL similarly and add db dependency

volumes:
  app-data:
  pg-data:        # added
```
Local dev connection string:
```
DATABASE_URL="postgresql://freee:freee_dev@127.0.0.1:5432/freee_audit?schema=public"
```
- **PENDING HUMAN DETERMINATION:** connection-pool settings. Prisma + Postgres in serverless
  benefits from a pooled string (e.g. PgBouncer / `?pgbouncer=true&connection_limit=1`);
  `docs/DEPLOYMENT.md` already references serverless PG (Vercel Postgres / Neon). Pooling choice
  is a human/infra decision and affects `relationMode`/prepared-statement behavior — call it out,
  do not default it silently.

### 4.3 Bootstrapping a fresh PG locally (proposed sequence)
```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d db
DATABASE_URL="postgresql://freee:freee_dev@127.0.0.1:5432/freee_audit?schema=public" \
  pnpm prisma migrate deploy    # creates schema from migration history
DATABASE_URL="postgresql://..." pnpm db:seed   # prisma/seed.ts (uses Math.round on floats — see F-06)
```

---

## 5. Migration strategy — `prisma migrate` flow

### 5.1 Migration history is engine-specific (the core decision)
There are **13** SQLite migration folders under `prisma/migrations/` plus `migration_lock.toml`
(`provider = "sqlite"`). **Prisma migration history cannot be replayed across engines** — the
existing SQL is SQLite DDL (e.g. `CREATE TABLE "users" (... "id" TEXT NOT NULL PRIMARY KEY,
... DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ...)`). Two viable strategies:

- **Strategy A — Baseline (recommended framing, PENDING HUMAN DETERMINATION):**
  1. Archive the existing `prisma/migrations/` (e.g. move to `prisma/migrations.sqlite.bak/`).
  2. Set `provider = "postgresql"` in schema + `migration_lock.toml`.
  3. Against a fresh empty PG, run `prisma migrate dev --name pg_baseline` to generate **one**
     baseline migration that recreates the full current schema (all 77 models, 31 uniques,
     indexes, FKs) in PG dialect.
  4. Mark that baseline as applied on production PG with `prisma migrate resolve --applied
     <baseline_name>` **after** the schema has been created by the data-copy tooling (§6), so
     `prisma migrate deploy` in `deploy.yml` does not try to recreate tables.
  - Rationale: a single baseline is auditable and avoids shipping 13 SQLite DDL files that PG
    cannot run. Subsequent schema evolution proceeds normally with `prisma migrate dev`.

- **Strategy B — `prisma db push` (throwaway, PENDING HUMAN DETERMINATION):**
  Use `prisma db push` to sync schema without history. Faster for a one-shot PoC, but discards
  migration history and breaks the existing `deploy.yml` `prisma migrate deploy` step. **Not**
  recommended for anything that will go to production.

**PENDING HUMAN DETERMINATION:** choose A or B. This proposal assumes A.

### 5.2 Shadow database
`prisma migrate dev` needs a *shadow* database it can create/drop. If the connecting PG role lacks
`CREATEDB`, set `shadowDatabaseUrl` (§4.1) to a role/database the CI/developer controls. On
managed PG (RDS/Neon/Vercel) the app role usually cannot `CREATE DATABASE`, so this is likely
required in CI. **PENDING HUMAN DETERMINATION** how shadow DBs are provisioned per environment.

### 5.3 Decision matrix (each row PENDING HUMAN DETERMINATION)

| Decision | Options | This proposal's framing |
|----------|---------|-------------------------|
| Engine scope | PG everywhere vs. dual SQLite+PG | PG everywhere except throwaway PoC |
| `Float` money | (A) keep `double precision` / (B) → `Decimal` | Do (A) now; (B) as separate item |
| Enums | none / introduce for statuses | none (out of scope) |
| `fileSize Int` | cap at app / widen to `BigInt` | cap at app; widen only if needed |
| Migration history | baseline (A) / `db push` (B) | baseline (A) |
| Pooling | direct / PgBouncer | human/infra decision; do not default silently |

---

## 6. Data-copy strategy & verification (fills the F-11 stub)

> This section specifies the design of the two scripts `docs/DEPLOYMENT.md` already names
> (`scripts/migrate-sqlite-to-pg.ts`, `scripts/verify-migration.ts`). **These scripts are not
> created by this audit** (single-file output rule). The design below is a **proposal** for a
> human to implement. PENDING HUMAN DETERMINATION at every step.

### 6.1 Approach: Prisma-to-Prisma per-model copy (not raw `.dump`)
- Read each model from the **SQLite** `PrismaClient` (`DATABASE_URL=file:./dev.db`).
- Write to the **PG** `PrismaClient` (`TARGET_DATABASE_URL=postgresql://...`).
- Order tables by FK topology (parents first: `Company`, `User`, then children). Two clients
  pointed at different `datasourceUrl`s is the cleanest engine-agnostic copy, because Prisma
  normalizes types (DateTime, Boolean, Float) on read and re-serializes them per target engine.
- Batch writes (`createMany`) where the target supports it; fall back to chunked loops.
- Preserve PKs verbatim (they are `cuid` strings) so all FK references and the `AuditLog`
  content-hash chain survive intact.

### 6.2 Why not `sqlite3 .dump | psql`
- SQLite dump emits SQLite DDL (`INTEGER PRIMARY KEY`, `DATETIME DEFAULT CURRENT_TIMESTAMP`) and
  DML shaped for SQLite. Loading it into PG requires non-trivial text transformation and is
  error-prone for the `Float`/`Boolean`/`DateTime` edge cases. The Prisma-to-Prisma copy sidesteps
  all of that. The existing doc's `.dump` line (F-11) should be replaced by this approach.

### 6.3 Preflight checks (run BEFORE the copy, fail fast)
Each is **PENDING HUMAN DETERMINATION** to enable/disable:
1. **Orphan scan:** for every FK, count child rows whose parent is missing. PG will reject these.
   Report counts per FK; decide repair (delete or re-parent) before copy.
2. **Unique-constraint violation scan:** detect duplicate-row sets against each of the 31
   `@@unique` constraints in the SQLite source (SQLite may have tolerated edge cases). Known
   candidate: tax-withholding `@@unique([companyId, insuranceType, year, month])` (F-07).
3. **NOT-NULL scan:** confirm no `NULL` in non-nullable columns that PG will reject (should be
   none given Prisma, but raw imports can violate it).
4. **`fileSize` overflow scan:** flag any `fileSize > 2,147,483,647` (§3.1).
5. **Row-count snapshot:** capture per-table counts on SQLite as the comparison baseline (§6.4).

### 6.4 Verification steps (run AFTER the copy)
1. **Per-table row-count equality:** `COUNT(*)` on SQLite vs PG for all 77 models; fail on mismatch.
2. **Checksum sample:** for monetary-critical tables (`Journal`, `MonthlyBalance`,
   `FixedAsset`, `TaxEffectAccounting`, `BudgetEntry`, `PrepaidExpense`, `AccruedExpense`),
   compare `SUM(amount)` / `SUM(closingBalance)` etc. between engines. Float sums can differ in
   the last ULP due to accumulation order — compare with an epsilon (e.g. `Math.abs(a-b) < 1e-6`),
   not strict equality.
3. **Audit-chain integrity:** re-verify the `AuditLog` `contentHash`/`previousHash` chain on PG
   (the chain is content-addressed and engine-independent, so it must verify identically; if it
   does not, a row was altered in transit).
4. **Spot-check a sample of rows** (e.g. 1% or N=100 per large table) for field-level equality,
   paying attention to `DateTime` round-trip (timezone/precision) and `Boolean`.
5. **`prisma migrate resolve --applied <baseline>`** so future `migrate deploy` is consistent.

### 6.5 Idempotency & resumability (PENDING HUMAN DETERMINATION)
- The copy should be **resumable**: track per-model completion so a failure at model 40/77 does
  not restart from zero. Use `upsert` (keyed by PK) or a `createMany({ skipDuplicates: true })`
  guarded by the preflight uniqueness scan.
- It should be **idempotent** against an empty target only; partial targets require the resumability
  above. **PENDING HUMAN DETERMINATION** whether to require a clean target before copy.

---

## 7. Rollback plan

> All steps PENDING HUMAN DETERMINATION. The safe posture for a one-shot migration is to keep the
> SQLite source read-only until PG is verified and signed off.

1. **Source is never mutated.** The copy reads from `file:./dev.db` (or the production SQLite file)
   only. The original file is the rollback artifact.
2. **Snapshot before cutover:** `cp dev.db dev.pre-pg.db` (PoC) / managed backup (prod). This is
   the "undo" — pointing `DATABASE_URL` back at the SQLite file and the old code rollback returns
   to the pre-migration state instantly.
3. **Cutover is a config flip, not a data change.** The rollback is: revert `provider` to
   `sqlite` (or set `DATABASE_URL` back to the file) and redeploy the previous build. No data
   transformation is needed to undo, because PG was populated by copy, not by in-place mutation.
4. **Dual-run window (recommended framing, PENDING HUMAN DETERMINATION):** run PG in shadow
   (read-only verification) for a window before switching writes. During this window, rollback is
   trivial because no writes have gone to PG.
5. **Post-cutover writes:** once PG accepts writes, rollback requires reconciling delta writes
   made to PG back to SQLite. Avoid this by keeping the cutover window short and the dual-run
   verification thorough (§6.4). If rollback-after-writes is required, **PENDING HUMAN
   DETERMINATION** on a reverse-copy tool — but the recommendation is to treat cutover as
   one-way once verification passes.
6. **Migration history rollback:** if the baseline migration (§5.1) is wrong, `prisma migrate
   resolve --rolled-back <name>` and re-baseline against an empty PG.

---

## 8. CI test-matrix implications (PG service container)

> Current matrix in `.github/workflows/ci.yml` (F-10). All changes PENDING HUMAN DETERMINATION.

### 8.1 What does *not* need a PG container
- **64 unit-test shards:** they mock `@/lib/db` (`tests/setup.ts`) and never touch an engine.
  They only need `pnpm db:generate` (which reads `schema.prisma`, engine-agnostic). **No change.**
- **`lint`, `typecheck`, `build`:** need `DATABASE_URL` set and `prisma generate`, but no live
  connection. **No change** beyond keeping `DATABASE_URL` valid (the SQLite placeholder can stay,
  or switch to a PG placeholder string — `generate` does not connect).

### 8.2 What needs a real PG engine
- **Integration tests** that currently assert real query behavior (per the repo's own notes, most
  integration tests are mock-backed today). To gain real-engine coverage, add a PG-backed variant.
- **E2E (Playwright):** `webServer: pnpm dev` currently boots against SQLite. After cutover it
  must boot against PG, so E2E must run against a PG service container.
- **The migration itself:** `prisma migrate deploy` should run in CI against a throwaway PG to
  prove the baseline applies cleanly.

### 8.3 Proposed new CI job (additive — PENDING HUMAN DETERMINATION)
```yaml
# Illustrative — do NOT copy blindly; review required (PENDING HUMAN DETERMINATION)
pg-migration-smoke:
  name: PG Migration & Smoke
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15-alpine
      env:
        POSTGRES_USER: freee
        POSTGRES_PASSWORD: freee_ci
        POSTGRES_DB: freee_audit_test
      ports: ['5432:5432']
      options: >-
        --health-cmd "pg_isready -U freee"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  env:
    DATABASE_URL: postgresql://freee:freee_ci@localhost:5432/freee_audit_test?schema=public
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
      with: { version: '9' }
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm db:generate
    - name: Apply baseline migration to PG
      run: pnpm prisma migrate deploy          # proves history loads cleanly
    - name: Seed + smoke
      run: pnpm db:seed                         # exercises real writes
    # Optional (PENDING HUMAN DETERMINATION): run a curated subset of
    # integration tests against PG via a TEST_DATABASE_URL gate.
```
- **PENDING HUMAN DETERMINATION:** whether E2E switches to PG in the *same* PR or a later one.
  Switching E2E is the highest-signal change and also the most disruptive; recommend the smoke
  job first, then E2E.
- **Cost note:** the 64-shard unit matrix is unaffected, so adding one PG job is a small marginal
  CI cost. Do **not** fold PG into the 64 shards — the mock-based shards are fast and cheap; PG
  belongs in its own job.

---

## 9. Open decisions checklist (consolidated, all PENDING HUMAN DETERMINATION)

| # | Decision | Default framing in this proposal |
|---|----------|----------------------------------|
| D1 | Engine scope: PG-only vs dual SQLite+PG | PG everywhere except throwaway PoC |
| D2 | Switch `provider`/`migration_lock.toml` to `postgresql` | yes (human edits Class-A schema) |
| D3 | Migration strategy: baseline (A) vs `db push` (B) | A — single PG baseline |
| D4 | `Float` monetary columns: keep (A) vs `Decimal` (B) | A now; B as separate item |
| D5 | Introduce PG enums for statuses | no (out of scope) |
| D6 | `fileSize Int` overflow: app cap vs `BigInt` | app cap |
| D7 | Shadow DB provisioning per env | likely `shadowDatabaseUrl` in CI/managed |
| D8 | Connection pooling (PgBouncer/serverless) | human/infra decision |
| D9 | Data-copy tooling design (§6) | Prisma-to-Prisma, FK-ordered, resumable |
| D10 | Verification thresholds (Float epsilon, sample %) | epsilon 1e-6; ~1% sample |
| D11 | Rollback window: dual-run shadow vs immediate cutover | dual-run shadow |
| D12 | CI: add PG smoke job; when to move E2E to PG | smoke first, E2E later |
| D13 | Reconcile `docs/DATABASE_DESIGN.md` enum drift (F-12) | separate docs task |

---

## 10. Sequencing (proposed order, all PENDING HUMAN DETERMINATION)

1. **Decide** D1–D3, D7, D8 (scope, migration strategy, shadow/pooling).
2. **Local:** add PG service to compose (§4.2), flip provider (§4.1), generate baseline (§5.1).
3. **Tooling:** implement `migrate-sqlite-to-pg.ts` + `verify-migration.ts` per §6 (fills F-11).
4. **Dry-run** the copy on a PoC SQLite → local PG; run §6.3 preflight + §6.4 verification.
5. **CI:** add the §8.3 PG smoke job; prove `migrate deploy` + seed are green.
6. **Shadow dual-run** against a real dataset; verify audit chain + monetary checksums (§6.4.2–6.4.3).
7. **Cutover** (config flip + redeploy); keep SQLite read-only snapshot for rollback (§7).
8. **Post-cutover:** move E2E to PG (D12); optionally open D4 (`Decimal`) and D13 (doc fix) items.

---

## 11. What this audit did NOT do (boundary)

- Did **not** modify `prisma/schema.prisma`, `prisma/migrations/**`, any service/route source, or
  any Docker/compose file. All listed as read-only / Class-A.
- Did **not** create `scripts/migrate-sqlite-to-pg.ts` or `scripts/verify-migration.ts` — only
  specified their design (§6).
- Did **not** pick a PG hosting target (RDS vs Neon vs Vercel Postgres) — `docs/DEPLOYMENT.md`
  mentions all three; that is an infra decision.
- Did **not** re-audit the tax-withholding `P2002` data defect or the conversion/valuation engine
  findings recorded elsewhere; they are cross-referenced only where they affect data-copy ordering
  (F-07, §6.3).

---

## Appendix A — Evidence index (file:line)

- `prisma/schema.prisma:5-8` — datasource `sqlite`.
- `prisma/schema.prisma` — 77 models, 0 enums, 0 `@db.*`, 0 `Json`/`Decimal`/`Bytes`/`BigInt`;
  31 `@@unique`; 68 `onDelete: Cascade` + 1 `SetNull`; 45 `$transaction` sites in `src/` (see below).
- `prisma/migrations/migration_lock.toml` — `provider = "sqlite"`; 13 migration folders.
- `src/lib/db.ts` — only `$queryRaw\`SELECT 1\`` (portable); singleton pattern.
- `src/` — 0 `$queryRaw/$executeRaw/Prisma.sql`; 0 SQLite-specific SQL functions.
- `45 × $transaction` — incl. `src/services/reports/board-report-service.ts` (9), conversion
  services, `kpi/custom-kpi-service.ts`, `peer-company-service.ts`, etc.
- `infrastructure/docker/docker-compose.yml` — `app`/`app-dev` use `file:...db`; no PG service.
- `.github/workflows/ci.yml` — all jobs `DATABASE_URL: 'file:./test.db'`; 64 unit shards; no
  `services:` block.
- `.github/workflows/deploy.yml` — already runs `pnpm prisma migrate deploy` against
  `secrets.DATABASE_URL`.
- `tests/setup.ts` — `vi.mock('@/lib/db', ...)`.
- `docs/DEPLOYMENT.md` (~§6.2) — stub referencing non-existent migration scripts.
- `docs/DATABASE_DESIGN.md` (~line 203) — shows `enum UserRole`, absent in real schema.
- `scripts/` — `migrate-sqlite-to-pg.ts` and `verify-migration.ts` do **not** exist.

---

*End of proposal. This document is analysis for a human reviewer. Every item is
**PENDING HUMAN DETERMINATION**; none is approved or signed off.*

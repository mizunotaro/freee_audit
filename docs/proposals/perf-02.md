# PERF-02 — DB Index Optimization Proposals for Hot Queries

> **Status: AUDIT-ONLY / READ-ONLY PROPOSAL.** This document contains *analysis and
> proposals only*. No source, schema, or migration files were modified to produce it.
> `prisma/schema.prisma` and all Class-A paths were treated as read-only reference.
>
> **Every conclusion, priority, and proposed change below is `PENDING HUMAN
> DETERMINATION`.** No item is approved, and no reviewer sign-off is implied. This is
> analysis for a human to decide on, not a decision record.

---

## 0. TL;DR

This audit read `prisma/schema.prisma` (1846 lines) and traced the **reachable** query
sites (Prisma `findMany` / `findFirst` / `findUnique` / `count` / `aggregate` / `groupBy`)
for the hottest models, then mapped each query's `where` / `orderBy` shape against the
existing indexes.

The headline result is that **most of the "obvious" index candidates are not live**:
several promising query shapes exist in the code but are unreachable at runtime (dead
code) or backed by a mock in-memory service rather than the database. An index that serves
only unreachable code is pure write/storage overhead, so those are reported as
**conditional / dormant** rather than recommended.

Seven concrete proposals emerged, ranked by a *rough* live-impact estimate (all priorities
`PENDING HUMAN DETERMINATION`):

| ID | Model | Proposal | Live impact | Est. priority |
|----|-------|----------|-------------|---------------|
| P-01 | `AuditResult` | add `@@index([companyId, analyzedAt])` **after denormalizing `companyId`**; or a low-value `@@index([analyzedAt])` stopgap | Per-request (`/api/audit/results` list sorts/ranges on unindexed `analyzedAt` via a `journal.companyId` relation filter) | **Medium-High** |
| P-02 | `Session` | **DROP** the redundant `@@index([token])` (`token` is `@unique`, so this is a pure duplicate) | Write-heavy table (login/logout/refresh) — removes redundant write amplification | **Medium** (low risk) |
| P-03 | `Journal` | add `@@index([companyId, auditStatus, entryDate])` for the combined filter+sort in the audit journals list | Per-request (`/api/audit/journals`) when both date range and status are set | **Medium** |
| P-04 | `ExchangeRate` | add `@@index([fromCurrency, toCurrency, rateDate])` | **Dormant** — every beneficiary query is dead code; live path uses a mock | **Conditional** |
| P-05 | `User` | add `@@index([companyId])` | One rare query site (business-report) | **Low / Conditional** |
| P-06 | `Session` | add `@@index([expiresAt])` | **Dormant** — cleanup is test-only, not wired | **Conditional** |
| P-07 | `AuditLog` | add `@@index([userId, createdAt])` / `@@index([action, createdAt])` | **Dormant** — `getRecentLogs` has no callers | **Conditional** |

A large number of suspected gaps turned out to be **well-covered or unused** (§5). Those
negative findings are documented deliberately so a human does not re-investigate them.

---

## 1. Methodology

1. **Schema survey** — read `prisma/schema.prisma` in full and tabulated the existing
   `@@index`, `@@unique`, and `@unique` coverage for every model.
2. **Query-site discovery** — for each candidate model, enumerated every reachable Prisma
   read site in `src/` (services, API routes, jobs) and recorded the exact
   `where` / `orderBy` / `first` / `take` / `skip` clause with `file:line`.
3. **Reachability check** — for each query, traced whether it is actually invoked at
   runtime (route handler, cron job, or a wired caller). Definitions with **zero callers**
   were downgraded to *dormant / conditional*.
4. **Coverage mapping** — compared each live query's leading predicate + sort key against
   the available indexes (leftmost-prefix rule for composites). Flagged only the cases
   where no index serves the predicate or the sort.
5. **Proposal** — for each real gap, proposed the minimal index (or composite), with the
   tradeoffs (write amplification, SQLite-dev vs Postgres-prod behavior) noted.

**Scope limits (important):**
- This is **index-only** analysis. Several real performance issues found during the survey
  are *query-shape* problems (no `take`/`limit`, in-`for`-loop repeated full scans, JS-side
  counting instead of `groupBy`, offset deep-pagination). Those are listed in
  **Appendix A** but are explicitly **out of scope** for an index change — fixing them
  needs source edits, not schema edits.
- Index benefit on a relation filter (e.g. `where: { journal: { companyId } }`) is
  inherently limited; the real fix is often denormalization. Such cases are flagged.

---

## 2. Proposals

### P-01 — `AuditResult`: index the results-list sort key (or denormalize `companyId`)

**Finding.** The only user-facing read path into `AuditResult` is the audit-results list
API:

- `src/app/api/audit/results/route.ts:17-31` builds `where = { journal: { companyId },
  status?, analyzedAt?: { gte, lte } }`
- `src/app/api/audit/results/route.ts:34-60` runs `auditResult.findMany({ where, include:
  { journal, document }, orderBy: { analyzedAt: 'desc' }, skip, take })` with classic
  offset pagination
- `src/app/api/audit/results/route.ts:61` runs `auditResult.count({ where })` (same shape)

**Current index state** (`prisma/schema.prisma:151-167`): `@@index([journalId])`,
`@@index([status])`. `analyzedAt`, `createdAt`, `documentId` are **unindexed**. There is no
`companyId` column on `AuditResult` (company scoping is done via the `journal` relation).

**Why this is a gap.** The query (a) filters by `analyzedAt` range, (b) sorts by
`analyzedAt desc`, and (c) scopes by `journal.companyId` — a **relation filter** that
compiles to a join/`EXISTS` against `journals`. None of the existing indexes serve the
`analyzedAt` predicate or the `analyzedAt` sort. A `status`-only equality is covered by
`[status]`, but as soon as the `analyzedAt` range/sort or the company join dominates, the
planner falls back to scanning + an explicit sort (filesort) over the joined set, and
offset pagination deepens that cost.

**Proposed change (two options — mutually exclusive; `PENDING HUMAN DETERMINATION`):**

- **Option A (index-only stopgap)** — add to `AuditResult`:
  ```prisma
  @@index([analyzedAt])
  ```
  Benefit is **uncertain/limited** because the company scoping is a relation filter: the
  planner is unlikely to produce output pre-sorted by `analyzedAt` when it must join on
  `journalId` first. This helps mainly the `analyzedAt` range predicate and the `count`.
  Low write cost (writes come from the nightly audit batch job, not per-request).

- **Option B (schema denormalization — higher impact, larger change)** — add a
  `companyId String @map("company_id")` column to `AuditResult` (written alongside
  `journalId` at create time in `src/jobs/audit-job.ts` and `src/app/api/audit/results/
  route.ts`), backfill existing rows, and add:
  ```prisma
  @@index([companyId, analyzedAt])
  @@index([companyId, status])
  ```
  This eliminates the relation join for the company-scoped list and lets the sort be
  index-served. It is a real schema migration touching a Class-A model, so it is firmly
  human-only.

**Tradeoffs / risks.** Option A: marginal benefit, near-zero risk. Option B: real benefit
but adds a denormalized column to maintain (must be kept in sync on every `AuditResult`
create). **`PENDING HUMAN DETERMINATION`** — including whether the table is large enough
in practice to justify either change (no row-count evidence was gathered; the dev DB is
SQLite and likely small).

---

### P-02 — `Session`: DROP the redundant `@@index([token])`

**Finding.** `prisma/schema.prisma:27-38`:
```prisma
model Session {
  ...
  token     String   @unique            // line 31 — unique constraint ⇒ auto index
  ...
  @@index([userId])                      // line 35
  @@index([token])                       // line 36 — REDUNDANT
}
```
`token` is `@unique`, which already creates a unique index. `@@index([token])` is a second,
non-unique index over the same column — a pure duplicate.

**Reachable queries that touch `token`** (all served by the unique index):
- `src/lib/auth.ts:114-117` `session.findUnique({ where: { token } })` — per-request auth
  validation (~50 routes)
- `src/lib/auth.ts:208` `session.deleteMany({ where: { token } })` — logout
- `src/lib/auth/token-lifecycle.ts:71,119` `session.findUnique({ where: { token } })` —
  refresh

No query benefits from the redundant index; every token query resolves to the unique index.

**Proposed change (`PENDING HUMAN DETERMINATION`):**
```prisma
model Session {
  ...
  @@index([userId])
  // @@index([token])   ← remove this line
}
```

**Tradeoffs / risks.** `Session` is **write-heavy** (every login creates a row, every
logout/refresh deletes/updates). Removing the duplicate index removes one index write per
session mutation and one index of storage, at zero read cost. Risk is essentially nil on
Postgres (the unique index fully covers it). On SQLite-dev, dropping requires a migration.
**`PENDING HUMAN DETERMINATION`.**

---

### P-03 — `Journal`: composite index for the combined `companyId + auditStatus + entryDate` filter

**Finding.** `src/app/api/audit/journals/route.ts:22-36` builds a `where` that may combine
`companyId` + optional `entryDate: { gte, lte }` + optional `auditStatus`, then
(`:39-53`) `journal.findMany({ where, orderBy: { entryDate: 'desc' }, skip, take })` with
offset pagination (default page size 50), plus (`:54`) a `count`.

**Current index state** (`prisma/schema.prisma:108-131`):
`@@index([companyId, entryDate])` (line 128) and `@@index([companyId, auditStatus])`
(line 129). There is **no standalone** `[companyId]` index, but both composites serve a
bare `where: { companyId }` via the leftmost-prefix rule (so full-company scans in
`accounting-basis-check.ts`, `prepaid-expense-tracker.ts`, etc. are *not* a new-index
need).

**Why this is a (partial) gap.** When **both** the date range and `auditStatus` are set,
neither composite is a perfect fit — only one applies, and the other predicate becomes a
post-filter. The `orderBy entryDate` is covered by `[companyId, entryDate]`, but the
combined selectivity is lost.

**Proposed change (`PENDING HUMAN DETERMINATION`):**
```prisma
@@index([companyId, auditStatus, entryDate])
```
This serves `companyId + auditStatus` equality with an `entryDate` range/sort. It does
**not** make the two existing composites redundant — keep them (they serve
date-only and status-only variants). Whether a third composite is worth its write cost on
the `Journal` table (written on every sync) is a judgment call.

**Tradeoffs / risks.** Benefit is bounded by per-company journal volume and how often users
filter on status+date together. `Journal` is written by the daily sync + manual sync +
import, so an extra index adds some write cost. **`PENDING HUMAN DETERMINATION`.**

---

### P-04 — `ExchangeRate`: composite `[fromCurrency, toCurrency, rateDate]` (DORMANT)

**Finding.** The lookup shape that needs this composite exists in the code:
- `src/services/currency/converter.ts:27` `getExchangeRate` —
  `findFirst({ where: { fromCurrency, toCurrency, rateDate: { lte: date } }, orderBy:
  { rateDate: 'desc' } })`
- `src/services/currency/exchange-rate-aggregator.ts:67` `getRatesInRange` —
  `findMany({ where: { rateDate: { gte, lte }, fromCurrency, toCurrency }, orderBy:
  { rateDate: 'asc' } })`

**Current index state** (`prisma/schema.prisma:243-264`):
`@@unique([rateDate, fromCurrency, toCurrency, source])` (line 260),
`@@index([rateDate])` (261), `@@index([toCurrency])` (262). There is no composite starting
with the currency pair, so a pair-scoped, date-ordered lookup cannot use a leftmost prefix.

**Why this is rated DORMANT, not active.** Both beneficiary queries are **unreachable**:
- `converter.ts` `getExchangeRate`/`saveExchangeRate` have **no callers**.
- `ExchangeRateAggregator` is exported (`src/services/currency/index.ts:25`) but **nothing
  imports it**.

The **live** currency path is `src/services/currency/currency-converter.ts:9`, which wires
`createExchangeRateService` from `./exchange-rate` (`BOJExchangeRateService`), which
**never touches the DB** — it uses an in-memory `exchangeRateCache` + `getMockRate`
(`src/services/currency/exchange-rate.ts:18,24,122`). The only live DB read on
`ExchangeRate` is `src/services/currency/providers/boj-rate-provider.ts:94`, a `findFirst`
on `{ rateDate, fromCurrency, toCurrency, source }` fully covered by the 4-column unique
index (called ~260×/year by the weekday 11:00 cron). `ForeignCurrencyTransaction`, the
model that would drive per-transaction rate lookups, has **zero** Prisma queries in `src/`.

**Proposed change (`PENDING HUMAN DETERMINATION` — only if/when the mock is replaced):**
```prisma
@@index([fromCurrency, toCurrency, rateDate])
```

**Tradeoffs / risks.** Adding it now helps **zero** live queries and adds a write cost to a
table written by the rate-fetch cron. The value is conditional on a human decision to
replace the in-memory mock with the DB-backed aggregator. Recommend **not** adding until
that switch is planned. **`PENDING HUMAN DETERMINATION`.**

---

### P-05 — `User`: add `@@index([companyId])` (LOW / CONDITIONAL)

**Finding.** The only `prisma.user` query that filters on `companyId` is
`src/services/reports/business-report/data-aggregator.ts:133-138` (`getOfficerData`):
`user.findMany({ where: { companyId, role: { in: ['ADMIN', 'MANAGER'] } } })`. It runs only
during business-report generation (rare), not per-request. No user-management listing
endpoint exists.

**Current index state** (`prisma/schema.prisma:10-25`): `email @unique` is the only index.
`companyId` and `role` are unindexed.

**Proposed change (`PENDING HUMAN DETERMINATION`):**
```prisma
@@index([companyId])
```

**Tradeoffs / risks.** Low value today (one rare query). It becomes worthwhile only if a
user-management / company-roster feature is added. `role`-only queries do not exist
(permissions are checked on the session-loaded `user.role` in memory). **`PENDING HUMAN
DETERMINATION`.**

---

### P-06 — `Session`: add `@@index([expiresAt])` (DORMANT)

**Finding.** `src/lib/auth/session-policy.ts:115-120` `cleanupExpiredSessions` runs
`session.deleteMany({ where: { expiresAt: { lt: new Date() } } })`. `expiresAt` is
unindexed ⇒ full scan. Per-request expiry is enforced cheaply in `src/lib/auth.ts:119`
after the indexed token lookup, so this is only about the batch cleanup.

**Why DORMANT.** `cleanupExpiredSessions()` is invoked **only** by its own unit test
(`tests/unit/lib/auth/session-policy.test.ts:80`). No cron, route, or job calls it.

**Proposed change (`PENDING HUMAN DETERMINATION` — only if/when cleanup is wired):**
```prisma
@@index([expiresAt])
```

**Tradeoffs / risks.** No benefit until the cleanup is connected to a scheduled job; then
it prevents a growing full scan as sessions accumulate. **`PENDING HUMAN DETERMINATION`.**

---

### P-07 — `AuditLog`: composites for timeline/pagination (DORMANT)

**Finding.** `src/lib/audit/audit-logger.ts:277-281` `getRecentLogs(limit, userId?,
action?)` runs `auditLog.findMany({ where: { userId?, action? }, orderBy: { createdAt:
'desc' }, take })`. The sort is not index-covered (single-column `[userId]` / `[action]`
exist; no composite with `createdAt`).

**Current index state** (`prisma/schema.prisma:169-189`): `@@index([userId])`,
`@@index([action])`, `@@index([resource])`, `@@index([createdAt])`.

**Why DORMANT.** `getRecentLogs` and `verifyIntegrity` have **zero callers** in `src/`.
The only live `AuditLog` read is `getPreviousHash` (`audit-logger.ts:81-87`): a global
`findFirst({ orderBy: { createdAt: 'desc' } })` with no `where`, run before **every** audit
write (via `logRouteAudit` on ~every authenticated route). That is already served by
`[createdAt]`.

**Proposed change (`PENDING HUMAN DETERMINATION` — only if/when an audit-log viewer is
wired):**
```prisma
@@index([userId, createdAt])
@@index([action, createdAt])
```

**Tradeoffs / risks.** `AuditLog` is the most write-heavy table in the app (one row per
audited request), so any extra index is expensive at write time. Do **not** add these
until a real reader (admin audit-log screen) is built. `resourceId` is write-only (never
read-filtered) — no index is warranted for it. **`PENDING HUMAN DETERMINATION`.**

---

## 3. Write-cost sensitivity (why several proposals are "do not add yet")

Several models (`AuditLog`, `Session`) sit on the write hot path — `AuditLog` is appended
once per audited API request, `Session` is mutated on every login/logout/refresh. Each
additional index is paid back on **every** write. For that reason, proposals P-04, P-06,
and P-07 are explicitly **conditional on the read side being wired up first**; adding the
index before the reader exists is net-negative. `PENDING HUMAN DETERMINATION` for all.

---

## 4. SQLite-dev vs Postgres-prod note

The dev DB is SQLite (`prisma/schema.prisma:6`); prod is PostgreSQL (per CLAUDE.md §2).

- **Composite leftmost-prefix behavior** holds on both, so the coverage analysis transfers.
- **`LIKE` / `contains` / `startsWith`** behave differently: SQLite cannot index
  mid-string `LIKE '%x%'` regardless; Postgres could use a trigram (`pg_trgm`) GIN index,
  but none of the `contains` sites (e.g. `debitAccount: { contains: '旅費' }` in
  `expense-audit.ts`, `description: { contains: '給与' }` in
  `employee-insurance-tracker.ts`) are hot enough to justify that, and a prefix
  `startsWith` (`Budget.accountCode` in `budget-service.ts:113`) is low-volume. No index
  proposal is made for these.
- **`NULL` handling / partial indexes** differ; if a human adopts any proposal, the
  migration should be authored for the **prod** engine. All of that is `PENDING HUMAN
  DETERMINATION`.

---

## 5. "No action" — well-covered or unused (documented to avoid re-investigation)

| Model / column | Why no index is proposed |
|----------------|--------------------------|
| `Journal` `companyId`-only scans (`accounting-basis-check.ts`, `prepaid-expense-tracker.ts`) | Served by the leftmost prefix of `[companyId, entryDate]`. No standalone `[companyId]` needed. |
| `Journal` `freeeJournalId` (sync lookups) | `@unique` covers `findUnique`/`upsert` in `journal-sync.ts:121`, `data-sync.ts:71`. |
| `Journal` `syncedAt` | Write-only; incremental sync is calendar-window based (first-of-month), not a `max(syncedAt)` cursor. No filter demand. |
| `AuditResult` `documentId` | Unindexed FK but **never** used as a read filter. |
| `AuditResult` `[journalId]`, `[status]` | `[journalId]` serves the relation join; `[status]` serves status equality. |
| `AuditLog` `resourceId` | Write-only (written by every `logRouteAudit`; never read-filtered). |
| `AuditLog` `getPreviousHash` (live hot path) | Global `orderBy createdAt desc` — already served by `[createdAt]`. |
| `MonthlyBalance` | Every live read filters `companyId + fiscalYear` (covered by `[companyId, fiscalYear]`) or hits the unique 4-col key. No month-range or `accountCode` read filter exists. |
| `Budget`, `CashFlow` | Same — all reads filter `companyId + fiscalYear` (covered) or a unique key. Budget-vs-actual joins happen in memory, not at the DB. |
| `FinancialKPI` | **Write-only** in app code (only `prisma/seed.ts` upserts). No read index demand. |
| `AccountItem` | Reads covered by `[companyId, categoryType]` / unique `[companyId, freeeId]`. No `name`/`shortcut` search query exists. |
| `Dashboard` API | Returns hardcoded sample data — not a DB hot path. |
| `ExchangeRate` live read | `boj-rate-provider.ts:94` covered by the 4-col unique index. |

---

## Appendix A — Out-of-scope: query-shape performance issues (NOT index fixes)

These were found during the survey and are worth a human's attention, but they are **code
changes**, not schema/index changes, and are therefore outside PERF-02's index-only scope.
Listed for awareness only; `PENDING HUMAN DETERMINATION` on whether to spin up separate
tasks.

1. **`src/jobs/audit-job.ts:250-256`** — `journal.findMany({ where: { auditStatus:
   'PENDING', ... } })` with **no `take`/`limit`**, loading the entire pending set into
   memory (a `journals.length > 100` guard at `:263` logs the risk). With no `companyId`,
   `[companyId, auditStatus]` cannot apply (leftmost-prefix), so the default is a
   cross-company scan. A standalone `[auditStatus]` would help this **batch** path, but the
   real fix is bounding the result set.
2. **`src/services/audit/accounting-basis-check.ts:364-366`** — `journal.findMany({
   where: { companyId } })` **inside a `for month = 1..12` loop** → 12 identical full
   company scans per call. Refactor to one fetch + JS grouping.
3. **`src/services/audit/index.ts:156-165`** (`getAuditStatus`) — pulls rows to count
   `auditStatus` in JS (`.filter`) instead of `groupBy`. An index does not fix this.
4. **`src/services/conversion/journal-converter.ts:78-91`** — offset-based (`skip`/`take`)
   streaming in a `while(true)` loop; deep-offset cost grows. Keyset pagination would help.
5. **`src/services/conversion/journal-converter.ts:544-558`** — `groupBy` on
   `debitAccount` / `creditAccount` with only `companyId` as predicate → full company scan
   grouped by an unindexed column. Only matters if this analytics path is exercised on
   large data.

None of the above is a reason to add an index on `debitAccount` / `creditAccount` today.

---

## Appendix B — How a human would apply any accepted proposal

(For reference only — no action taken here. `PENDING HUMAN DETERMINATION`.)

1. Decide which proposals to accept (this doc makes no decision).
2. Edit `prisma/schema.prisma` (a Class-A file — human-only).
3. Generate a migration: `corepack pnpm db:migrate --name <descriptive-name>`.
   - For **drops** (P-02): ensure the migration explicitly drops the redundant index.
   - For **denormalization** (P-01 Option B): the migration must add the column **and** a
     backfill step copying `journal.companyId` onto existing `AuditResult` rows, plus keep
     the create-sites in sync (`audit-job.ts`, `audit/results/route.ts`).
4. Re-run `corepack pnpm db:generate`.
5. Verify against representative data volume (the dev SQLite DB is likely too small to show
   the benefit; profile on a Postgres instance with realistic row counts).

---

*End of proposal. No files other than this document were created or modified. All findings,
priorities, and proposed changes remain `PENDING HUMAN DETERMINATION`.*

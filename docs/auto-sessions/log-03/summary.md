# LOG-03 — Extend audit-logger to remaining non-Class-A mutating API routes

**Outcome:** 1 source file changed — `src/app/api/settings/api-keys/[provider]/route.ts`.
Its PUT/DELETE handlers were re-routed from a direct `prisma.auditLog.create()` write to the
integrity-protected `logRouteAudit()` helper (the LOG-001 idiom), now recording
actor / action / target / outcome on both success **and** failure. No Class-A path touched, no
new dependencies, no new tests. `node scripts/autopm_verify.mjs --changed-only` exits **0**
(typecheck 0 errors · eslint 0 warnings · vitest n/a — no related test resolves).

## Enumeration

The brief asked for mutating (POST/PUT/PATCH/DELETE) `route.ts` under `src/app/api/` that are
**outside** the Class-A API list (`audit, journals, journal-proposal, valuation, tax, kpi,
deferred-accrual, debt, freee, conversion, auth`) and still lack an `audit-logger` call.

Method: for every non-Class-A `route.ts`, detect an exported mutating handler under **both**
export spellings — `export (async) function POST|PUT|PATCH|DELETE` **and**
`export const POST|PUT|PATCH|DELETE = …` (the `withAuth`/`withAdminAuth`/`withRateLimit` wrapper
form) — then count *actual calls* to `logRouteAudit(`/`auditLogger.log(`/`logUserAction(`.

Result: **51** non-Class-A mutating routes, **50** already route through `logRouteAudit` (the
LOG-001 sweep). Exactly **one** had zero logger calls:

| File | Methods | Before | After |
|------|---------|--------|-------|
| `src/app/api/settings/api-keys/[provider]/route.ts` | PUT, DELETE | direct `prisma.auditLog.create()` (see below) | `logRouteAudit()` ×4 |

A repo-wide grep confirms the only remaining direct `prisma.auditLog` writes from route handlers
live in **Class-A** paths (`auth/login`, `auth/logout`, `journal-proposal/[id]/{approve,export,
regenerate,reject}`) — explicitly out of scope (covered by log-002). GET-only routes
(`export/csv`, `prompts`, `board-reports`, `reports/{monthly,periodic,cashflow,kpi}`, etc.) were
skipped per the brief.

## The defect this fixes (why "lacked an audit-logger call" matters here)

This route was *not* audit-silent — it wrote directly to the `AuditLog` table, **bypassing
`auditLogger.log()`** (`src/lib/audit/audit-logger.ts`, unchanged). That bypass corrupts the
blockchain-style integrity chain the logger maintains:

- No `contentHash` is computed → the entry's stored hash is null, so `verifyIntegrity()` flags it.
- No `previousHash` is set → the chain forks: the next legitimate `auditLogger.log()` call reads
  this entry's (null) hash via `getPreviousHash()` and links to nothing.
- No `ipAddress` / `userAgent` / `details`.
- Only `SUCCESS` was recorded, and only on the happy path — failures were not audited at all.

Routing through `logRouteAudit()` repairs all of this: it delegates to `auditLogger.log()`, which
chains the entry correctly, and the call sites now pass the session-resolved actor
(`req.user.id`), `action`, `resource`, `resourceId`, and an explicit `result`.

## Change detail

`putHandler` / `deleteHandler` — the direct write was replaced 1:1 with the helper, preserving
the existing `action`/`resource`/`resourceId` semantics (`API_KEY_UPDATE`/`API_KEY_DELETE`,
resource `settings`, resourceId = provider), and a FAILURE log was added to each `catch` block:

```ts
await logRouteAudit({
  request: req,
  userId: req.user.id,
  action: 'API_KEY_UPDATE',   // 'API_KEY_DELETE' in deleteHandler
  resource: 'settings',
  resourceId: providerKey,    // success path only
})
// …catch:
await logRouteAudit({
  request: req,
  userId: req.user.id,
  action: 'API_KEY_UPDATE',
  resource: 'settings',
  result: 'FAILURE',
  details: { error: error instanceof Error ? error.message : 'Unknown error' },
})
```

### Notes / decisions

- **`resourceId` is omitted on the FAILURE path.** `providerKey` is declared inside `try` (after
  provider validation), so it is out of scope in `catch` — and a failure may occur *before* the
  provider is even validated (e.g. missing/invalid path param). This matches the sibling idiom
  exactly (`settings/route.ts`, `settings/ai/route.ts` both omit `resourceId` in their FAILURE
  logs). The verify gate's typecheck step caught the original `providerKey`-in-catch scoping
  error before it shipped.
- **Actor resolution.** `userId: req.user.id` is the session-resolved user from `withAdminAuth`,
  not the `x-user-id` header (which middleware does not forward to handlers — see project memory).
- **Idiom match.** Identical to `settings/route.ts` (the closest sibling): same helper, same
  field ordering, same FAILURE `details` shape.
- **No test added.** No test exists for this route and none resolves to it under the verify
  gate's diff-scoping; the brief is "additive, minimal". Adding a route-level integration test
  would require standing up prisma + crypto + `withAdminAuth` mocks and is out of scope for a
  logging-wiring change that follows an already-tested helper.

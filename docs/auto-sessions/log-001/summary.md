# LOG-001 — Wire audit-logger into non-Class-A mutating API routes

## Outcome
Added audit logging to **50 `route.ts` files** (≈95 mutating handlers) outside the
Class-A banned list, plus one new shared helper. Every in-scope mutating handler
(POST/PUT/DELETE/PATCH) now records actor, action, target, and outcome through the
existing `auditLogger` (blockchain-style integrity chain). Read-only GET handlers were
left untouched.

`node scripts/autopm_verify.mjs --changed-only` → **exit 0** (typecheck 0 errors,
eslint 0 warnings, vitest green on the 3 resolved route tests).

## Approach
- **New helper `src/lib/route-audit.ts`** (additive, outside every banned path). It
  wraps `auditLogger.log` (read-only use — the logger itself was **not modified**) and
  returns `Result<void, AppError>` per the worker rules; it never throws. It extracts
  `ipAddress`/`userAgent` from the request and accepts an explicit `userId`.
- **Per handler**: a `SUCCESS` log immediately before the success response, and a
  `FAILURE` log at the top of the primary `catch`. Validation/401/403/rate-limit
  early-returns (pre-action) are intentionally not logged. Handlers with multiple
  distinct success returns (e.g. cached vs computed) log each.
- **Actor**: see the key finding below. Where the route resolves an authenticated user
  (the vast majority), its `id` is passed as `userId`. In shared `catch` blocks where
  the user variable is out of scope, `userId` is omitted (action/target/outcome are still
  recorded). No route relies on the `x-user-id` request header.

## Key finding: `x-user-id` is not actually forwarded to route handlers
`middleware.ts` sets `x-user-id`/`x-user-role`/`x-user-company-id` on the
`NextResponse.next()` **response** object, not on the request forwarded to the route
handler. A repo-wide grep confirms **0** routes read `x-user-id` from the request, while
**66** resolve the actor via `validateSession`/`getAuthUser`/`getAuthenticatedUser`.
So the authoritative actor is the session-resolved user id (the same value the
middleware computed). Using the header would have recorded `userId = null` everywhere.
This is noted here rather than "fixed" — fixing it means editing `middleware.ts`
(auth-adjacent), which is out of scope for LOG-001 and would be a separate task.

## Files changed (50 routes + 1 helper)
- `src/lib/route-audit.ts` (new)
- `src/app/api/analysis/{route,benchmark,financial,ratios,report}/route.ts`
- `src/app/api/board/{meetings/route, meetings/[id]/route, meetings/[id]/items,
  meetings/[id]/generate, items/[id]/route, items/[id]/analyze}/route.ts`
- `src/app/api/chat/{route,stream/route}.ts`
- `src/app/api/dd/checklists/{route,[id]/route}.ts`
- `src/app/api/export/{pdf,excel,pptx}/route.ts`
- `src/app/api/import/{journals,account-items,monthly-balances}/route.ts`
- `src/app/api/inventory/route.ts`
- `src/app/api/investor/{invite,accept}/route.ts`
- `src/app/api/prompts/[type]/{route,reset/route}.ts`
- `src/app/api/reports/{budget/route, business/generate/route, business/export/route,
  ir/route, ir/[id]/route, ir/[id]/publish, ir/[id]/sections, ir/[id]/export,
  ir/events/route, ir/events/[id]/route, ir/faq/route, ir/shareholders/route,
  ir/shareholders/[id]/route}.ts`
- `src/app/api/settings/{route,ai/route, peer-companies/route, peer-companies/[id]/route,
  peer-companies/suggest/route, market-data/providers/route,
  market-data/providers/[id]/route, market-data/jquants/route,
  market-data/jquants/test/route}.ts`
- `src/app/api/social-insurance/{schedules,payments}/route.ts`

## Intentionally NOT changed (within scope rules)
- **`src/app/api/settings/api-keys/[provider]/route.ts`** — already records audit entries
  via direct `prisma.auditLog.create` on PUT and DELETE. The task targets handlers
  *without* an audit-log call, so this was left alone. (Caveat: those writes bypass the
  `auditLogger` content-hash chain — a pre-existing integrity gap, not introduced or
  fixed here, and fixing it would mean refactoring the audit mechanism, out of scope.)
- **`src/app/api/investor/access-log/route.ts`** — already calls `auditLogger.log`.
- GET-only in-scope routes (`export/csv`, `prompts/route.ts`, `board-reports`,
  `dashboard`, `health`) — read-only, skipped per scope.

## Environment note (for the verify gate)
This fresh worktree had **no `node_modules`** and an **un-generated Prisma client**.
Without `corepack pnpm install` + `corepack pnpm db:generate`, `tsc` reported ~298
phantom `TS7006` errors (all Prisma model types resolved to `any`). After generating the
client, `tsc --noEmit` is **0 errors repo-wide**. The Prisma client lives under
gitignored `node_modules`, so it is not committed; CI / fresh checkouts must run
`pnpm install && pnpm db:generate` before the typecheck gate is meaningful.

## Test behavior
The 3 route unit tests resolved by the gate (`chat`, `reports/business/generate`,
`reports/business/export`) all pass. They mock auth but **not** Prisma, so each audit
write hits `auditLogger.log` → `prisma.auditLog.findFirst` on an un-mocked client and
throws — which `auditLogger.log` catches and `console.error`s (existing, by-design
behavior). This produces noisy stderr but **no test failures** and no change to HTTP
responses. Not silenced (no lint-disable / no test edits) per the worker rules.

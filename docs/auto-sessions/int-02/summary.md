# INT-02 — Integration tests: board / dd / inventory / social-insurance / settings routes

## Scope
Added real-handler (request → handler → response) integration tests for the
non-Class-A route groups, mirroring the INT-01 pattern
(`tests/integration/api/{dashboard,analysis,reports-monthly}.test.ts`).

## What was done

| File | Routes covered | Tests |
|------|----------------|------|
| `tests/integration/api/settings.test.ts` *(replaced)* | `GET/PUT /api/settings` | 9 |
| `tests/integration/api/settings-ai.test.ts` *(new)* | `GET/POST /api/settings/ai` | 7 |
| `tests/integration/api/board-meetings.test.ts` *(new)* | `GET/POST /api/board/meetings`, `GET/PUT/DELETE /api/board/meetings/[id]` | 12 |
| `tests/integration/api/dd-checklists.test.ts` *(new)* | `GET/POST /api/dd/checklists`, `GET/PUT/DELETE /api/dd/checklists/[id]` | 15 |
| `tests/integration/api/inventory.test.ts` *(new)* | `GET/POST /api/inventory` | 12 |
| `tests/integration/api/social-insurance.test.ts` *(new)* | `GET/POST` schedules + payments | 9 |

**Total: 64 tests.**

## Method
Each test drives the **real exported route handler** (including its real auth
wrapper) with a real `NextRequest`, and asserts the actual HTTP contract:
status codes, response-body shape, and that the collaborator (service / prisma
model) is called with the right arguments. Collaborators are mocked only to
avoid DB / external I/O — never to re-implement the handler's logic.

### Mock strategy (per route auth style)
- **`withAuth`-wrapped** (settings, settings/ai, dd-checklists list): cookie
  `session=…` → mocked `validateSession` returns the user; `withAuth` runs for
  real. `requireCompany: true` routes return 403 when `companyId` is null.
- **Direct cookie auth** (board, social-insurance, dd-checklists `[id]`): same
  cookie → `validateSession` mock.
- **Bearer auth** (inventory): `Authorization: Bearer …` header; `withRateLimit`
  from `@/lib/security` mocked as a passthrough.
- `logRouteAudit` (`@/lib/route-audit`) is mocked to a no-op across the board —
  it is an audited side effect (verified elsewhere) and would otherwise pull the
  full audit hash-chain into the test.
- DB-touching routes get a **per-file** `@/lib/db` mock with only the model they
  use (`settings` / `apiKey` / `dDChecklist`) — the global `tests/setup.ts` mock
  omits these models.
- Pure collaborators (`@/lib/api/settings-sanitizer`) are kept **real**.

### Coverage exercised
- 401 for missing / invalid session (every route) and 401 for users with no
  company on direct-cookie routes.
- Role gating (admin-only API-key updates → 403), company gating (403).
- Zod input validation (400) for query and body schemas.
- Ownership checks (403 / 404) for `[id]` resources.
- `Result<T,E>` service-failure propagation (→ 400) for dd checklists.
- Date → ISO serialization in response bodies.
- Encryption-before-persist + sanitization-strips-key for settings PUT.
- Correct argument forwarding to services (e.g. `createInventoryAdjustment`,
  `createSchedule`, `createChecklist`, `createBoardMeeting`).

## Constraints honoured
- No Class-A paths modified (only `tests/**` and this doc). Class-A sources are
  referenced read-only / mocked.
- No `any`, `@ts-ignore`, `.skip`, lint-disable, or coverage lowering. No new
  dependencies.
- Only the added/modified tests were executed (single-shard vitest), never the
  full suite.

## Definition of done
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 relevant errors · eslint clean · vitest 64/64).

## Notes / gotchas
- **`RequestInit` is not exported by `next/server`** in Next 16, and the DOM
  global `RequestInit` is *not* assignable to Next's extended
  `RequestInit` (`next/dist/server/web/spec-extension/request`). Fix: type the
  request-init object structurally
  (`{ method: string; headers: Record<string,string>; body?: string }`)
  instead of naming `RequestInit`.
- `tests/integration/api/settings.test.ts` previously existed as **fake-green**
  (it asserted against mocked `sanitizeSettings`/`encrypt` directly and never
  invoked the route handler). It was replaced with real-handler tests.
- dd-checklists mixes auth styles: the list route is `withAuth`-wrapped while
  the `[id]` route uses direct cookie auth; `[id]` `params` is a `Promise` that
  must be awaited.

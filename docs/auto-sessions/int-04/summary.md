# INT-04 — Integration tests: benchmark / peer-companies routes

## Scope

Add real-handler integration tests (auth guard → 400 on bad input → happy-path shape;
DB/AI mocked at the boundary) for the non-Class-A routes named in the task.

## Routes found under `src/app/api`

| Route file | Methods | Test file |
|---|---|---|
| `analysis/benchmark/route.ts` | GET, POST | `tests/integration/api/analysis-benchmark.test.ts` |
| `settings/peer-companies/route.ts` | GET (list), POST (create) | `tests/integration/api/settings-peer-companies.test.ts` |
| `settings/peer-companies/[id]/route.ts` | GET, PUT, DELETE | `tests/integration/api/settings-peer-companies-id.test.ts` |
| `settings/peer-companies/suggest/route.ts` | POST | `tests/integration/api/settings-peer-companies-suggest.test.ts` |

### `external-info` — no API route (no action)

`src/services/external-info/**` exists (service layer: sources, cache, NTA/web-search/mock),
but there is **no** `src/app/api/**/external-info/**` route. The service is only consumed
internally (e.g. by tax/audit flows), never exposed over HTTP, so there is no route handler
to integration-test. This is noted rather than faked.

## Test approach (real-handler, boundary-mocked)

Each test imports the real route handler and drives it with a constructed `NextRequest`,
following the established INT-01 pattern (`dashboard`/`analysis`/`settings`):

- **Auth** mocked at `@/lib/auth.validateSession`; the routes' own cookie-extraction
  (`getAuthUser` / the local `validateSession` wrapper) runs for real, so the 401 paths
  exercise the real "no cookie → null → 401" and "invalid session → null → 401" branches.
- **Audit** mocked at `@/lib/route-audit.logRouteAudit` → `success(undefined)`; tests
  assert it is/isn't called with the expected `action`/`resource`/`resourceId`.
- **DB** (peer-companies routes) mocked at `@/lib/db` via `vi.hoisted` exposing only
  `prisma.peerCompany` — the global `tests/setup.ts` mock does not include that model.
- **AI** (suggest route) `@/lib/integrations/ai.getAIService` overridden per-file
  (`setup.ts` mocks that module without `getAIService`, which would otherwise be `undefined`
  and crash the handler); `@/services/peer-companies.createPeerSelectorAI` mocked at the
  boundary so the route's profile/criteria wiring is asserted without an LLM call.
- **benchmark service left real** — `compareWithBenchmark`/`createBenchmarkService` are pure,
  deterministic, no DB/AI, so the POST happy-path runs the real comparison and asserts the
  output shape (`industryComparisons`, `sizeComparisons`, `overallPercentile`, …).

### benchmark middleware — mocked as passthrough

`analysis/benchmark/route.ts` wraps POST in the analysis-suite middleware
(`withRateLimit` → `withTimeout`) and applies `addSecurityHeaders`. These are mocked as
passthroughs (`() => (handler: unknown) => handler`, `(response: unknown) => response`),
mirroring `inventory.test.ts`'s `withRateLimit` passthrough. This also sidesteps the
module-load `setInterval` in `middleware/rate-limit.ts`, which would otherwise leave an
open handle. The benchmark *handler* logic (Zod `BenchmarkRequestSchema`, boundary/size
checks, caching, service call, audit) all runs for real beneath the passthrough.

## Coverage per file

- **analysis-benchmark** (7): GET 401 / GET happy (sectors+metrics shape); POST 401 /
  400 invalid JSON / 400 invalid sector enum / 200 happy (real comparison shape + audit).
- **peer-companies** (7): GET 401 / 401 no-company / happy (asserts `where` filter +
  `orderBy`); POST 401 / 400 missing `name` / 409 dup ticker / 200 create + audit
  (`dataSource: 'manual'` default, `resourceId`).
- **peer-companies/[id]** (10): GET 401 / 404 / 200; PUT 401 / 400 (`employees` non-int) /
  404 / 200 + audit; DELETE 401 / 404 / 200 + audit. Uses `Promise<{id}>` params.
- **peer-companies/suggest** (4): POST 401 / 400 missing `industry` / 400 selector-failure
  (`error.message` surfaced, no audit) / 200 happy (asserts `getProvider` called with
  `{userId,companyId}`, profile derived from input, audit `PEER_COMPANY_SUGGEST`).

27 tests total, all green.

## Notable route behaviors captured

- 401 body shapes differ: benchmark returns `{ error: 'Unauthorized' }`; peer-companies
  routes return `{ success: false, error: 'Unauthorized' }`. Each is asserted verbatim.
- peer-companies GET-list query schema (`activeOnly`/`industry` both `z.string().optional()`)
  cannot be made to fail with normal string query params, so no fake 400 is fabricated for it.
- peer-companies create defaults `dataSource` to `'manual'`; suggest route swallows a `null`
  provider via `createPeerSelectorAI(aiProvider ?? undefined)`.

## Quality gate

`node scripts/autopm_verify.mjs --changed-only` → **exitCode 0**
(typecheck 0 errors, eslint `--max-warnings=0` clean, vitest 27/27).

No Class-A path touched; additive only (4 new test files + this summary). No `any`,
`@ts-ignore`, `.skip`, lint-disable, or new dependencies.

# INT-05 — Integration tests: market-data route group

## Task (as given)
> Same as int-04 for these non-Class-A routes: market-data / fixed-assets / account-items.

No `int-04` session exists in `docs/auto-sessions/`, so this work follows the
established real-handler pattern from INT-01/02/03
(`tests/integration/api/{dashboard,reports-monthly,analysis,board-meetings,
dd-checklists,inventory,settings,import,export,investor-*}.test.ts`).

## Scope reconciliation (two of the three targets need no work)

| Target | Status | Action |
|--------|--------|--------|
| **account-items** (`/api/import/account-items`) | Already covered — **real-handler** tests in `tests/integration/api/import.test.ts` (added by INT-03; imports `POST as accountPOST`, `GET as accountGET`, drives the real route, 21 tests across the import group). Verified not fake-green. | **No-op** — duplicating it would create a second harness for the same route. |
| **fixed-assets** | **No API route exists.** `src/services/fixed-assets/` is a service-only subsystem (unit-tested at `tests/unit/services/fixed-assets/depreciation.test.ts`); there is no `src/app/api/.../fixed-assets/**`. The task brief is stale here. | **No-op** — nothing to integration-test at the route layer. |
| **market-data** (`/api/settings/market-data/**`) | **Genuine gap** — 4 real route handlers, no integration test (only unit tests + a page test existed). | **Done** — new test file below. |

## What was added (additive, no source changes)

`tests/integration/api/market-data.test.ts` — **21 tests, all real-handler.**

| Route | Handler | Concerns covered |
|------|---------|------------------|
| `GET  /api/settings/market-data/providers` | `getProviders` | 401 no-cookie; 200 list company-scoped, strips `encrypted*` secrets, serializes `Date→ISO`, `findMany` filter |
| `POST /api/settings/market-data/providers` | `postProvider` | 401; 400 missing `provider`; 409 duplicate (`findUnique` hit) + audit **not** called; 200 create with defaulted `enabled:true`/`priority:10`/`null` secrets + `MARKET_DATA_PROVIDER_CREATE` audit |
| `PATCH /api/settings/market-data/providers/[id]` | `patchProvider` | 401; 400 bad `priority` type; 404 ownership (`findFirst` null); 200 merge-over-existing + `MARKET_DATA_PROVIDER_UPDATE` audit; `params` awaited as `Promise` |
| `DELETE /api/settings/market-data/providers/[id]` | `deleteProvider` | 401; 404 ownership; 200 delete + `MARKET_DATA_PROVIDER_DELETE` audit |
| `POST /api/settings/market-data/jquants` | `saveJquants` | 401; 400 missing `password`; 200 create-branch (`encrypt` both fields, `create` with `enc:` ciphertexts); 200 update-branch (upsert in place, `lastError:null`) |
| `POST /api/settings/market-data/jquants/test` | `testJquants` | 401; 400 not-configured; auth-failure branch (`decrypt`, `update lastError`, `FAILURE` audit, `testConnection` not reached); success branch (`authenticate` args, `lastSyncAt:Date`+`lastError:null` update, `connected:true`, audit has no explicit `result`) |

## Mocking strategy (real handler, mocked seams only)

Same boundary-only approach as INT-02/03:

- `@/lib/auth` → `validateSession` — controls the auth guard without touching
  Class-A `src/lib/auth*`. The route's own `getAuthUser` still reads the
  `session` cookie for real, so the no-cookie path exercises real code.
- `@/lib/route-audit` → `logRouteAudit` no-op — keeps the Class-A audit
  hash-chain out of the test; asserted via `expect.objectContaining` on
  action / resource / resourceId / userId / result where relevant, and
  asserted **not called** on 401 / 400 / 409.
- `@/lib/db` → **per-file** `prisma.marketDataProvider` mock
  (`findMany`/`findUnique`/`findFirst`/`create`/`update`/`delete`). The global
  `tests/setup.ts` mock omits this model, mirroring INT-02's per-file
  `dDChecklist` mock.
- `@/lib/crypto` → `encrypt`/`decrypt` as deterministic inverses
  (`enc:<plain>` ↔ `<plain>`) for the jquants routes only. **Mocked, not
  modified** — the same treatment INT-02 gave Class-A crypto, and it keeps the
  test free of random-IV coupling (see memory `real-handler-integration-test-
  gotchas`). The providers routes never touch crypto.
- `@/services/market-data` → `createJQuantsProvider` factory returning a stub
  with `authenticate`/`testConnection`, for the connection-test route only.

## Constraints honored
- No Class-A path modified (read-only reference / mocked only): `prisma/**`,
  `src/lib/auth*`, `src/lib/crypto.ts`, `src/lib/audit/**`, `src/services/**`,
  microservices. The only changed file is the new test file + this doc.
- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or
  coverage-threshold change. Request-init object is typed structurally
  (`{ method; headers; body? }`) per the INT-02 `RequestInit` gotcha.
- Additive only — 1 new test file, zero source edits.
- Only the added file was executed (`vitest run` + `autopm_verify --changed-only`),
  never the full suite (known OOM).
- No new dependencies.

## Verification
```
node scripts/autopm_verify.mjs --changed-only   → exitCode 0
  typecheck: total errors=0, relevant to diff=0
  eslint:    1 file, ok (--max-warnings=0)
  vitest:    1 file, 21 passed
```

## Notes
- `account-items` and `fixed-assets` were intentionally **not** touched:
  account-items is already real-handler-tested by INT-03, and fixed-assets has
  no API route to test. Both are documented above rather than silently skipped.
- The `providers/[id]` `params` is a `Promise` (Next 16) and is awaited inside
  the handler; tests pass `{ params: Promise.resolve({ id }) }`, matching the
  dd-checklists `[id]` idiom.

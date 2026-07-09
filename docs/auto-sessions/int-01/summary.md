# INT-01 — Integration tests: dashboard/analysis/reports API routes

## Task
Add request→handler→response integration tests (DB/AI mocked via stubs) for the
non-Class-A routes: auth guard, input validation (400 on bad input), happy-path
shape. Reuse `tests/helpers` + `tests/factories`. No fake green, no `any`.

## What was added (additive, no source changes)

Three new test files. Each imports the **real exported route handler** and drives
it with a real `NextRequest` (cookies + body), mocking only the DB/AI-adjacent
seams. The handler pipeline (auth resolution, body parsing, branching, response
shaping) runs unmodified.

| File | Handler | Concerns covered |
|------|---------|------------------|
| `tests/integration/api/dashboard.test.ts` | `GET /api/dashboard` | 401 no-cookie; 401 invalid session; 200 happy-path shape (`company`/`kpis`/`milestones`) |
| `tests/integration/api/analysis.test.ts` | `POST /api/analysis` | 401 no-cookie; **400 missing financial data**; 200 happy path (returns analysis result, audits `ANALYSIS_RUN`); server-side KPI computation branch |
| `tests/integration/api/reports-monthly.test.ts` | `GET /api/reports/monthly` | 401 no-cookie; 401 user-without-company; 200 single mode; 200 table mode (default); 404 on service failure |

12 tests total, all passing.

## Mocking strategy (real handler, mocked seams only)

- `@/lib/auth` → `validateSession` — controls the auth guard without touching
  Class-A `src/lib/auth*`. Auth resolution still flows through the real
  `getAuthUser` in `@/lib/api/auth-helpers` (reads the `session` cookie), so the
  no-cookie path exercises real code, not a stub.
- `@/lib/route-audit` → `logRouteAudit` — prevents the analysis route from
  reaching the Class-A audit-logger/prisma chain.
- `@/services/ai/analysis-service`, `@/services/analytics/financial-kpi`,
  `@/services/report/monthly-report` — replace AI/DB-backed services. Heavy
  return types (`FinancialKPIs`, `MonthlyReport`) are stubbed through
  `vi.hoisted` (untyped `vi.fn()`) to avoid constructing 30+ field objects while
  keeping the handler logic real.
- Reused `tests/factories/financial.ts` (`createBalanceSheet/ProfitLoss/CashFlowStatement`)
  for the analysis POST bodies.

`vi.mock` factories replace whole modules, so the real (heavy) module bodies —
including real AI-provider imports — never execute. No new dependencies, no
`any`/`@ts-ignore`/casts-to-`any`.

## Constraints honored
- No Class-A path modified (read-only reference only): `prisma/**`,
  `src/lib/auth*`, `src/lib/audit/**`, `src/services/{audit,conversion,...}`,
  `src/app/api/{audit,journals,...}/**`, microservices.
- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or coverage
  threshold change. `success()` from `@/types/result` used for typed mock returns.
- Additive only — 3 new test files, zero source edits. Existing fake-green
  `reports.test.ts` left untouched (out of scope; would be a separate rewrite).
- Only the 3 added files were run (`pnpm exec vitest run <files>`), never the
  full suite.

## Verification
```
node scripts/autopm_verify.mjs --changed-only   → exit 0
  typecheck: 0 errors (0 relevant)
  eslint:    0 warnings (3 files, --max-warnings=0)
  vitest:    12 passed (3 files)
```

## Notes / non-issues
- `analysis/financial` and `analysis/ratios` routes live in a large self-contained
  analysis subsystem (own middleware/cache/schemas). They were not targeted to
  keep the tests robust and avoid coupling to that pipeline; the top-level
  `/api/analysis` POST already exercises the analysis group's auth + validation
  + happy path.
- `reports/periodic` (`withRateLimit` from `@/lib/security`) and `reports/cashflow`
  (multi-service pure-function chain) were left out as lower-value; the monthly
  route covers the reports group's three required concerns.

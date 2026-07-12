# CONTRACT-01 — Response-schema contract tests for analysis API routes

## Outcome
Added one cohesive contract suite that locks the **HTTP response shape** of every
non-Class-A analysis route, so an accidental rename / drop / type change of a
response field is caught at test time.

- **File added:** `tests/integration/api/analysis-response-contract.test.ts`
- **Tests:** 32 (all passing) across 7 routes + the benchmark GET catalog.
- **Production code touched:** none (read-only reference only).
- **DoD:** `node scripts/autopm_verify.mjs --changed-only` → `exitCode: 0`
  (typecheck 0 errors, eslint 0 warnings, vitest 32/32).

## Routes covered
| Route | Success envelope + payload | Validation 400 | 401 shape |
|-------|----------------------------|----------------|-----------|
| `POST /api/analysis/financial`        | FinancialAnalysisOutput | ✓ | error envelope (UNAUTHORIZED) |
| `POST /api/analysis/ratios`           | RatioAnalysisOutput     | ✓ | legacy raw `{error:'Unauthorized'}` |
| `POST /api/analysis/benchmark`        | BenchmarkOutput         | ✓ | legacy raw `{error:'Unauthorized'}` |
| `GET  /api/analysis/benchmark`        | sector/metric catalog   | — | legacy raw `{error:'Unauthorized'}` |
| `POST /api/analysis/report`           | route-local ReportOutput| ✓ | legacy raw `{error:'Unauthorized'}` |
| `POST /api/analysis/variance`         | VarianceAttributionOutput | ✓ | error envelope (UNAUTHORIZED) |
| `POST /api/analysis/cashflow-scenario`| CashflowScenarioOutput  | ✓ | error envelope (UNAUTHORIZED) |
| `POST /api/analysis/managerial`       | ManagerialCvpOutput     | ✓ | error envelope (UNAUTHORIZED) |

## Contract approach
- **Reusable envelope schema.** `ResponseMetadataSchema` (strict, exactly the 5
  keys `cached/processingTimeMs/requestId/timestamp/version`) + `AppErrorSchema`
  (code enum + message + timestamp + optional details/requestId) mirror
  `src/app/api/analysis/types/{response,app-error}.ts`. `successEnvelope(payload)`
  and `errorEnvelope` are `.strict()` at the top level so an added/removed
  envelope key fails the parse.
- **Per-route payload schemas** require every documented key with the correct
  type/enum/nullability; unknown engine-extra keys are tolerated (Zod default
  strip) so the suite locks the documented contract without being brittle to
  internal additions.
- **Real engines are driven end-to-end.** Only `@/lib/auth` (`validateSession`)
  and `@/lib/route-audit` (`logRouteAudit`) are mocked. The analysis engines
  (`analyzeFinancials`, `analyzeRatios`, `compareWithBenchmark`,
  `attributeVariance`, `projectCashflowScenario`, `analyzeCostVolumeProfit`) run
  for real, so the assertions lock the *actual serialized* response a consumer
  sees. Valid BS/PL inputs come from the existing `tests/factories/financial.ts`.
- **Assert mechanism:** `schema.parse(body)` (Zod throws a readable path-tagged
  error on drift) plus targeted scalar assertions and an exact-`metadata`-keys
  check. Not fake green — see discoveries below.

## Real-shape discoveries while writing (proves the suite bites)
1. **`GET /api/analysis/benchmark` `availableSectors`** is
   `{ sector, name }[]`, **not** `string[]` (the route JSDoc example is wrong).
   The first run failed on this; the schema now locks the real shape.
2. **`POST /api/analysis/report`** returns the **route-local** `ReportOutput`
   whose `metadata` = `{ reportType, companyName, fiscalYear, generatedAt,
   processingTimeMs }` — *not* the `ReportMetadata` in `types/output.ts`
   (which has `version` and no `reportType`/`processingTimeMs`). The contract
   locks the route-local shape that consumers actually receive.
3. **`POST /api/analysis/financial`** serializes the **raw analyzer**
   `FinancialAnalysisResult.data` (spread), so each `categoryAnalyses[]`
   element carries a `metrics` array — the field present at runtime, which the
   `CategoryAnalysisOutput` type declaration omits.

## Scope decision: legacy `POST /api/analysis` (not covered here)
The root `analysis/route.ts` is a legacy passthrough: it returns
`NextResponse.json(result)` with **no envelope** (200 → raw service object,
401 → `{error:'Unauthorized'}`, 400 → `{error:'Missing financial data'}`). Its
shapes are **already contract-locked** by `tests/integration/api/analysis.test.ts`
via `expect(body).toEqual(analysisResult)` / `toEqual({error:'...'})`. Adding a
duplicate contract test would be redundant (and a passthrough route has no
route-level shape transformation worth re-locking), so it is intentionally
omitted. No defect — just no incremental contract value.

## Quality-gate notes
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable.
- No new dependencies; Zod is already a project dependency.
- No Class-A path modified; analysis routes are outside the exclusion set.
- The rate-limiter/timeout middleware wraps each handler; total requests in the
  file (~20) are well under the 100/min limiter, and unique `requestId`s prevent
  cache cross-contamination.

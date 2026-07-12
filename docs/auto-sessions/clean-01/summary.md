# CLEAN-01 — Remove provably-unused non-Class-A exports / dead code

**Outcome:** 29 files touched (5 deleted, 24 modified), **−1821 net lines** (2 insertions / 1823 deletions).
All Class-A paths untouched (read-only reference only).

## Method

1. `npx ts-prune` → 2378 raw candidates.
2. Filtered out: Class-A paths, route handlers, config/root `default` exports, `index.ts`/`types/`
   barrels, and `used in module` entries.
3. **In-process sound verify** (Node `readdirSync` corpus, word-boundary regex; spawned `rg` is
   not on PATH here and silently returns 0 hits — would have made every candidate look verified).
   Kept only symbols whose bareword appears in **no** other repo file.
4. **Path-import verify** (Grep for the module path string) for every whole-file / singleton /
   component candidate — catches dynamic `import('@/…')` and lazy references the symbol grep
   cannot see. This reclassified several apparent whole-file candidates as partial removals.
5. Per-file declaration reads to confirm each dead export is not used in-file, and to prune
   cascading orphaned imports the autopm `--max-warnings=0` gate would otherwise fail on.

## Removed

### Whole files deleted (5) — sole exports unused AND zero path-importers
| File | Dead exports |
|------|--------------|
| `src/components/conversion/disclosure-editor.tsx` | `DisclosureEditor`, `DisclosureList` |
| `src/components/reports/kpi/kpi-page-header.tsx` | `KPIPageHeader` |
| `src/components/reports/ir/pdf/ir-report-pdf.tsx` | `IRReportDocument`, `FinancialHighlightsSection`, `TableSection` |
| `prisma/seed-currencies.ts` | `seedCurrencies` (not called by `prisma/seed.ts`, no script ref) |
| `prisma/seeds/sample-financial-data.ts` | `lifeScienceCompanyData`, `LifeScienceData` |

> `ir-report-pdf.tsx` looked live at first glance because `IRReportDocument` had "1 external hit" —
> that hit is a **same-named local function** in the live `src/services/reports/ir-pdf-exporter.tsx`,
> not an importer. Path-grep (`ir-report-pdf`) confirmed zero real importers → whole file dead.

### Partial removals — named export deleted, file otherwise live (24 files)
**`z.infer` type aliases** (schemas still `.safeParse`-used at runtime):
`VarianceAttributionInput`, `ManagerialMetricsInput`, `VarianceBridgeInput`, `OneOff`,
`ResolveChartStatusInput`, `ResolveDisplayStateInput`, `BackupOptions`, `RestoreOptions`,
`VerifyOptions`, `SensitiveFieldName`, `StorageFactoryConfig`, `JournalProposalConfig`,
`ParsedFileResult`, `InsuranceEnrollmentInput`, `KeyVersion`.

**Runtime symbols:** `ConsoleLogger` (class), `calculationClient` / `calculationValidator`
(singletons; live class siblings kept), `DEFAULT_CASHFLOW_HORIZON_MONTHS`, `getJobStatus`,
`runJobManually`, `startExchangeRateFetchJob`, `clearPromptGuardCache`, `getPageTypeLabel`,
`getPathname` (dropped from the `createNavigation` destructure).

### Dead test helpers removed (no importer, including no test importer)
- `tests/factories/financial.ts`: `createEmptyBalanceSheet`, `createEmptyProfitLoss`
- `tests/helpers/db.ts`: `resetMockPrisma`, `setupTestDatabase`, `cleanupTestDatabase`
- `tests/helpers/factories.ts`: `createTestAdminUser`, `createTestSuperAdminUser`,
  `createTestViewerUser`, `createTestAccountantUser`, `createMockPrismaUser`, `createMockSession`

### Cascading import pruning (required by `--max-warnings=0`)
- `src/services/ai/analyzers/utils.ts`: dropped `LogEntry` from the `./types` import (was used only
  inside the removed `ConsoleLogger`). `TrendDirection`/`LogContext` retained — still used.
- `tests/helpers/factories.ts`: dropped pre-existing-dead `vi` + `User` imports (the file never used
  them; surfaced once the file was touched).

## Flagged for human review (security/crypto-adjacent, but NOT Class-A by the literal path rules)
The task forbids `src/lib/crypto.ts` (file) and `src/lib/security/**` (dir). These two are different
paths and were removed as provably-dead, but sit near that boundary — calling them out explicitly:
- `src/lib/crypto/encryption-v2.ts` → `KeyVersion` interface (unused key-versioning type; "crypto-v2
  half-wired" per prior security review). Pure type, zero runtime effect.
- `src/lib/ai/security/prompt-guard.ts` → `clearPromptGuardCache()` (cache-clear never called).

## Left in place (deliberately)
- **All "1 external hit" candidates** (11 symbols incl. `ir-*-service` CRUD functions,
  `createFAQ`, `reorderFAQs`, etc.) — each has a real importer; not dead. Several are the
  ir-service functions covered by [[ir-service-tests-are-fake-green]].
- All `used in module` entries (symbol alive internally; only the `export` keyword is "dead" —
  dropping keywords is a riskier, separate refactor, out of scope).
- Stale doc references to deleted files in `docs/ai/IMPLEMENTATION_PROMPTS.md` (historical planning
  prompts; docs are not linted/typechecked and are out of scope).

## Verification (Definition of Done)
- `corepack pnpm db:generate` then baseline `corepack pnpm typecheck` → **0 errors** (before edits,
  so post-edit errors are unambiguously attributable).
- Post-edit `corepack pnpm typecheck` → **0 errors** (whole-repo; catches namespace-import breakage).
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**:
  - typecheck: 0 relevant errors
  - eslint `--max-warnings=0` on 21 changed `src/` files: clean
  - vitest: **15 test files / 297 tests passed** (all related tests for changed src files)
- Explicit `eslint --max-warnings=0` on the 3 changed test-helper files
  (`tests/factories/financial.ts`, `tests/helpers/db.ts`, `tests/helpers/factories.ts`) → **0
  warnings**. Required because the gate classifies non-`*.test.ts` files under `tests/` as `other`
  and silently skips their lint step ([[autopm-verify-bench-bucket]]).

No `any`, `@ts-ignore`, `.skip`, lint-disable, or coverage-threshold change. No new dependencies.
TASK COMPLETE

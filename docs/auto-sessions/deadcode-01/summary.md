# deadcode-01 — Summary

**Task:** Repo-wide dead-code / unused-export sweep across **non-Class-A** modules.
**Constraint:** Remove only provably-unreferenced exports/functions/files; leave anything
ambiguous listed in `decisions.md`. Never touch Class-A or anything it imports.

**Result:** 18 files changed, **−1896 lines, 0 additions**. 13 files deleted, 5 files edited
(partial export removal). No tests added — this is a pure deletion pass; all affected
existing tests still pass (46/46 via the gate).

## Definition of done
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint clean on 3 src files, vitest 46/46 passed).
Full-repo `tsc --noEmit` also clean (0 errors) — baseline was clean, post-edit still clean,
so no namespace/dynamic-import breakage was introduced.

## Method (per `dead-export-hunting-method` memory)
1. `npx ts-prune` → 2313 raw lines.
2. Filtered out: Class-A paths, Next.js route-handler verbs, root-config `default` exports,
   barrels (`index.ts`, `types/`), `(used in module)`, `middleware.ts`.
3. **In-process grep** (Node `readdirSync` corpus, word-boundary regex) — NOT spawned `rg`
   (which is absent on PATH here and silently returns 0 hits).
4. **Path-import verify** (`@/` alias + relative specifier) for every whole-file candidate —
   required before any whole-file deletion; catches dynamic `import('@/…')`.
5. Whole-file dead-module scan: every non-Class-A `src/**.ts(x)` (excluding route/page/layout/
   loading/error/not-found/template/default/middleware/instrumentation/globals/index) whose path
   is imported nowhere.
6. Manual Grep-tool verification (content mode) of every low-ref candidate to rule out
   same-name-local-symbol false positives and name collisions (e.g. `Calendar` the lucide icon
   vs `ui/calendar.tsx`; `Toaster` from `ui/sonner` vs the dead `ui/toaster.tsx`).

## Removed

### Whole files deleted (13)

**Unused shadcn/ui components (12)** — `src/components/ui/`:
`aspect-ratio.tsx`, `breadcrumb.tsx`, `calendar.tsx`, `context-menu.tsx`, `drawer.tsx`,
`hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `radio-group.tsx`,
`toaster.tsx`, `toggle-group.tsx`.

Each verified: zero `@/components/ui/<name>` importers repo-wide, zero bareword-name collisions
(`Calendar`/`Toaster` refs are the `lucide-react` icon and `ui/sonner` respectively), no test
files, no stories, no dynamic/registry refs (`components.json` carries no component registry).
Re-addable via `npx shadcn@latest add <name>`.

**Superseded seed data (1):** `prisma/seeds/sample-financial-data.ts` (677 lines).
Pure data export (`lifeScienceCompanyData`); zero path importers; superseded by
`prisma/seeds/sample-therapeutics-data.ts`, the only seed `prisma/seed.ts` imports.

### Partial export removals (5 files)

| File | Removed export | Why dead |
|------|----------------|----------|
| `src/lib/external/calculation-client.ts` | `calculationClient` singleton | 0 importers; class `CalculationServiceClient` (still exported) is the live surface used by 2 tests |
| `src/services/validation/calculation-validator.ts` | `calculationValidator` singleton | 0 importers; class `CalculationValidator` (still exported) used by 2 tests |
| `src/lib/ai/security/prompt-guard.ts` | `clearPromptGuardCache()` | 0 importers; `injectionCache` still used by `getGuardStats`/guard path |
| `tests/helpers/db.ts` | `resetMockPrisma`, `setupTestDatabase`, `cleanupTestDatabase` | 0 importers; not wired into any vitest `setupFiles`/`globalSetup`. `vi` + `MockPrismaClient` still used by `createMockPrisma` |
| `tests/factories/financial.ts` | `createEmptyBalanceSheet`, `createEmptyProfitLoss` | 0 importers; sibling `createBalanceSheet`/`createProfitLoss`/`createCashFlowStatement` still used by integration tests; `BalanceSheet`/`ProfitLoss`/`CashFlowStatement` type imports still used |

No cascading orphan imports/vars were introduced (verified by manual eslint on the two test
helpers — which the gate skips as `other`-bucket non-`*.test.ts` files — and full `tsc`).

## Not removed (see `decisions.md`)
- 3 functional seed-runners (`seed-currencies.ts`, `ifrs-coa.ts`, `usgaap-coa.ts`) — verified
  zero-importers but encode domain reference data with standalone-runnable intent; left for
  human decision.
- Generic-named exported types (`*Input`, `*Options`, `*Config`, `*Result`) — bareword grep is
  unreliable (collisions with same-named locals / barrel re-exports); not provably dead.
- `src/types/*.d.ts` ambient declaration files — false positives; ambient `.d.ts` are
  compiler-merged, never path-imported.
- `src/services/reports/ir-{event,faq}-service.ts` functions flagged by ts-prune — false
  positives; the flag cascades from ts-prune marking route-handler exports as unused, but the
  routes are live API endpoints that import these functions.

# deadcode-01 — Decisions (ADR)

## ADR-1: Remove unused shadcn/ui components (12 files)

**Status:** Accepted (removed).
**Context:** Whole-file scan found 12 `src/components/ui/*.tsx` with zero path importers:
`aspect-ratio`, `breadcrumb`, `calendar`, `context-menu`, `drawer`, `hover-card`, `input-otp`,
`menubar`, `navigation-menu`, `radio-group`, `toaster`, `toggle-group`.
**Decision:** Remove all 12. They meet the task's literal criterion (provably zero importers,
verified via `@/components/ui/<name>` alias grep + bareword name check + no tests/stories/registry).
**Consequences:** Trivially reversible — `npx shadcn@latest add <name>`. CLAUDE.md's "44 shadcn/ui
components" count drops to 32. No runtime/build impact (leaf presentational modules importing only
Radix primitives + `@/lib/utils`, neither of which is affected).

## ADR-2: Remove `sample-financial-data.ts`; LEAVE 3 functional seed-runners

**Status:** Accepted (sample-financial-data removed; other 3 left).
**Context:** `prisma/seed.ts` imports only `sampleTherapeuticsData`. Four other seed files have
zero path importers repo-wide: `sample-financial-data.ts` (pure data, superseded),
`seed-currencies.ts`, `ifrs-coa.ts`, `usgaap-coa.ts` (each a standalone-runnable seeder with a
`main()`).
**Decision:** Remove only `sample-financial-data.ts` (unambiguous: pure data, superseded by
`sample-therapeutics-data.ts`, no runnable entrypoint). LEAVE the 3 functional seed-runners.
**Rationale:** All four are provably unreferenced, so the task rule permits removing them.
However the 3 functional seeders encode *domain reference data* (currency table; IFRS/USGAAP
charts of accounts) and follow the standalone-runnable `main()` convention, signalling manual-ops
intent. They sit in domains with known active issues (conversion subsystem per
`conversion-subsystem-dead-and-broken`; currency per `rate-limiters-are-inbound-only`). Recreating
them is non-trivial vs. re-adding a shadcn component. Conservative reading of "if unsure, list in
the PR body and leave" wins for these three.
**Consequences:** Reviewer can delete them in a 1-line follow-up if confirmed unwanted.

## ADR-3: Do NOT remove generic-named exported types

**Status:** Accepted (left).
**Context:** ~30 ts-prune candidates are exported types named `*Input`, `*Options`, `*Config`,
`*Result`, `*Data` in non-Class-A impl files (e.g. `ResolveChartStatusInput`, `BackupOptions`,
`VarianceAttributionInput`, `src/services/{currency,import}/types.ts` members).
**Decision:** Leave all. The bareword-grep verification that works for unique-named values is
unreliable for these: a 1-ref hit is frequently a same-named local symbol or a barrel re-export,
not a real importer (the documented same-name-local-symbol false-positive). Distinguishing
"exported type used only inside its own module's signatures" from "genuinely dead exported type"
would require per-type import-statement analysis with high effort and false-removal risk.
**Consequences:** Modest dead-export surface remains; not worth the risk under the conservative
mandate.

## ADR-4: Do NOT remove `src/types/*.d.ts` ambient files

**Status:** Accepted (left).
**Context:** Whole-file path-import scan flagged `src/types/cloud-providers.d.ts` and
`src/types/global.d.ts` as "no importers."
**Decision:** Leave. These are **ambient declaration files** — TypeScript merges them globally
via `tsconfig` `include`; they are never path-imported, so "zero path importers" is the expected
state, not evidence of death. Removing them could drop global type declarations (env types, JSX
namespaces, module augmentations).
**Consequences:** Recorded as a whole-file-scan **false-positive category** for future sweeps.

## ADR-5: Treat ts-prune flags on live-service functions as false positives

**Status:** Accepted (left).
**Context:** ts-prune flagged many functions in `src/services/reports/ir-event-service.ts` and
`ir-faq-service.ts` (`getIREvent`, `createFAQ`, …) despite their having many bareword refs.
**Decision:** Leave. The flag cascades from ts-prune marking the consuming Next.js route-handler
HTTP-method exports (GET/POST/…) as unused — but those routes ARE live API endpoints (the HTTP
verbs are framework entry points, not dead code). The services are therefore live.
**Consequences:** None; no action.

## ADR-6: Verification = full `tsc` + gate (not gate alone)

**Status:** Accepted.
**Context:** The autopm gate's typecheck filters errors to changed-file paths. A deletion that
broke a *non-changed* importer would be hidden from the gate.
**Decision:** Run full-repo `tsc --noEmit` before AND after edits (baseline 0 errors → post-edit
0 errors), so any breakage is unambiguously attributable. Additionally lint the two changed
non-`*.test.ts` test helpers (`db.ts`, `financial.ts`) manually, since the gate routes them to the
`other` bucket and skips them.
**Consequences:** Confirmed zero breakage from all 13 deletions + 5 edits.

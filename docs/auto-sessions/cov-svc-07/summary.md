# COV-SVC-07 — Unit-test coverage: storage + validation + dd

## Outcome

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 relevant errors · eslint 0 warnings · vitest 137/137).

Only test files were modified (10 files under `tests/unit/services/dd/`). No source
files, no Class-A paths touched, no new dependencies.

## Scope finding

`src/services/storage/file-service.ts` and `src/services/validation/calculation-validator.ts`
were already covered by real-assertion tests (verified: real exports imported and
exercised). The genuine coverage gaps — weak/fake-green assertions and untested
branches — were concentrated in the `src/services/dd/**` subtree. Work focused there.

## Changes per module (10 modules)

| Module | Change |
|---|---|
| `dd/validators/validation-engine` | +8 tests: validator-failure propagation, skip-failed-items, N_A overall status, IN_PROGRESS/mixed weighted scores (50/75), multi-category & multi-year `validateAll`. |
| `dd/validators/ar-validator` | TREND "detects DSO deterioration" asserted only `success`; rewrote with data that actually triggers the MEDIUM finding and asserted it. |
| `dd/validators/revenue-validator` | TREND "detects revenue decrease" asserted only `success`; rewrote to trigger the HIGH finding; removed a verbatim-duplicate "stable" test. |
| `dd/validators/inventory-validator` | TREND "detects increasing inventory trend" asserted only `success`; rewrote to trigger the MEDIUM finding. |
| `dd/validators/related-party-validator` | DISCLOSURE finding was produced by existing data but never asserted; added finding assertion. |
| `dd/validators/internal-controls-validator` | +DOCUMENTATION HIGH/MEDIUM severity tiers (only CRITICAL was covered); +TESTING default-min (1,000,000) and no-high-value paths. |
| `dd/validators/tax-validator` | +PROVISION upper-bound (>120%) branch (only <80% covered); +audit-risk `Math.min` cap coverage (7 yrs → capped 1.00). |
| `dd/reports/report-generator` | +error/catch path (REPORT_GENERATION_FAILED); +executive-summary CRITICAL/HIGH/none text; +referenced-standards collection; +`generatedBy`/`accountingStandard` default fallbacks. |
| `dd/checklist-service` | +getChecklist/updateItem/runChecklist error catches; +severity×status counting matrix + weighted `overallScore` (exact 46); +TAX_DD / COMPREHENSIVE definition branches; +no-status `checkedAt` path. |
| `dd/checklists/ma-financial-dd` | Replaced a literal no-op assertion (`Object.isFrozen(x) || Array.isArray(x)` — always true) with a real `titleEn`-present assertion. |

## Collateral cleanup

Pre-existing unused-import / unused-param lint warnings in the touched files would
have failed the gate's `--max-warnings=0` (it lints changed files). Removed genuinely
dead imports (`DDAnalyticsContext`, `vi`) and prefixed unused MockValidator params
(`_rules`/`_context`). No new `any`/`@ts-ignore`/`.skip`/lint-disable introduced.

## Observations deferred (see decisions.md)

- DD TREND validators collect trend values newest-year-first, so the
  `increasing`/`decreasing` direction labels are calendar-inverted relative to the
  finding text. Not fixed (source-logic change, out of test scope); tests assert
  actual behavior with documenting comments.
- `MA_FINANCIAL_DD_CHECKLIST` is `readonly` at the type level only (no runtime
  `Object.freeze`). Not frozen at runtime; the prior assertion was a no-op.
  `getChecklistDefinitions` spreads copies, so there is no live mutation risk.

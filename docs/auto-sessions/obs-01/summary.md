# OBS-01 — Structured logging for non-Class-A services

## Goal recap
Make non-Class-A services use the project's existing logger
(`src/lib/utils/secure-logger.ts` → `secureLogger`) consistently — structured
fields + levels — instead of `console.*`. No new deps; no audit-log changes.

## Logger contract used
`secureLogger` exposes levels `debug | info | warn | error | fatal` plus
`security()` / `audit()` / `child()`. Each call takes `(message, context?)`
where `context` is a `LogContext` (plain object) that is recursively sanitized
(secrets masked, long strings truncated, circular refs guarded, `Error` →
`{name, message, stack}`). Output is one formatted line via the underlying
`console.*`.

### Level convention applied in this PR
| Level | When |
|-------|------|
| `error` | unexpected exception in a `catch` block (system/operational failure) |
| `warn`  | expected-but-noteworthy: input validation that returns a `Result`, unknown/unimplemented config, fallback taken |
| `info`  | normal lifecycle (analysis started / completed) |

Every call carries `component: '<ServiceName>'` plus operation/relevant fields;
error calls pass the raw `error` (sanitized by the logger) instead of a
pre-stringified message.

## Files changed (source — 7)
| File | console calls | Conversion |
|------|---------------|------------|
| `src/services/ai/analyzers/ratio-analyzer.ts` | 6 (3 validation `console.error`, 2 `console.log` lifecycle, 1 `console.error` catch) | warn / info / error + `component:'RatioAnalyzer'` |
| `src/services/cashflow/runway-calculator.ts` | 2 `console.warn` | `secureLogger.warn` + `scenario`/`provided` fields |
| `src/services/validation/calculation-validator.ts` | 1 `console.error` (LLM catch) | `secureLogger.error` + `persona` |
| `src/services/account-items/account-items-service.ts` | 1 `console.error` (sync catch) | `secureLogger.error` + `operation` |
| `src/services/external-info/external-info-service.ts` | 2 `console.warn` | `secureLogger.warn` + `sourceId` |
| `src/services/investor/invitation-service.ts` | 5 `console.error` (one per op catch) | `secureLogger.error` + `operation` (+`invitationId` on revoke) |
| `src/services/secrets/api-key-service.ts` | 4 `console.error` | `secureLogger.error` + `operation`/`provider` |

JSDoc example `console.log(...)` snippets inside `ratio-analyzer.ts` were left
untouched — they are illustrative usage, not runtime logging.

## Tests added (4 files, +8 cases) — "log output is part of the contract"
Tests assert the structured logger is invoked (not just the underlying console)
by spying on the singleton instance returned by `getSecureLogger()`.

- `ratio-analyzer.test.ts` → warn on missing BS / non-positive totalAssets;
  info lifecycle (`Analysis started` + `Analysis completed` with
  `component`/`totalRatios`/`durationMs`).
- `runway-calculator.test.ts` → warn per scenario adjustment given without
  reason; asserts `component:'RunwayCalculator'` + `scenario` ∈ {optimistic, pessimistic}.
  (The pre-existing `console.warn` x2 assertion is retained — it still holds
  because `secureLogger.warn` delegates to `console.warn` at the default level.)
- `external-info-service.test.ts` → warn for an unimplemented source (`'mof'`,
  a valid `InfoSourceId` present in `DEFAULT_SOURCE_CONFIGS` but with no
  `createSource` case) — type-safe, no casting.
- `invitation-service.test.ts` → error log when `createInvitation` fails
  (`prisma.investorInvitation.create` mocked to reject), asserts
  `component:'InvitationService'` + `operation` + raw `error`.

For the converted services whose log lines are purely operational catch errors
(account-items, api-key-service, calculation-validator), existing suites still
pass (no new logging tests added there — log is not a hard contract).

## Scope exclusions (intentional)
- All Class-A paths untouched (audit/conversion/valuation/tax/kpi/debt/
  deferred-accrual/journal-proposal/freee services + their lib/api trees,
  `auth*`, `crypto`, `security`, prisma). Read-only reference only.
- `src/services/ai/journal-proposal-service.ts` skipped — journal-proposal
  workflow is Class-A-adjacent even though the file lives under `ai/`.
- IR report services (`ir-*-service.ts`) had **no** real `console.*` — only
  JSDoc examples — so nothing to convert there.

## Out of scope / future work
Many non-Class-A modules still use `console.*` (≈250 occurrences repo-wide:
jobs/, hooks/, app pages, lib/integrations/ai/*, lib/secrets/providers/*, etc.).
This PR converts a coherent batch of `src/services/**` modules. Subsequent
OBS-NN passes can extend the pattern; the testing recipe below makes that cheap.

## Verify
`node scripts/autopm_verify.mjs --changed-only` → **exitCode 0**
(typecheck 0 relevant errors; eslint `--max-warnings=0` clean on 11 files;
vitest 7 files / 141 tests passed).

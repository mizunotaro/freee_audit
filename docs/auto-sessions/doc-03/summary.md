# DOC-03 — JSDoc for remaining exported APIs: currency / closing / validation / storage

**Scope:** Add concise JSDoc to exported functions / classes / public methods lacking it
across the four service directories. Docs only — no logic, type, or runtime changes.

**Result:** `node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(typecheck 0 errors, eslint 0 warnings, vitest 4 files / 85 tests passed).

## Diff

4 files, **+158 / −0** (pure additive comments).

| File | Documented exports |
|------|--------------------|
| `src/services/closing/closing-entries.ts` | `generateClosingEntries`, `calculateTaxEffectAccounting`, `getTaxEffectHistory`, `generateTaxEffectJournalEntry`, `checkPrepaidExpenses` |
| `src/services/validation/calculation-validator.ts` | `CalculationValidator` (class), `validateCashFlow` (method), `calculationValidator` (singleton) |
| `src/services/validation/journal-quality-validator.ts` | `findDuplicateJournals`, `findDateGaps`, `findUnbalancedEntries`, `computeMissingCounterpartyStats`, `analyzeJournalQuality` |
| `src/services/storage/file-service.ts` | `FileService` (class) + `putFile`, `getFile`, `deleteFile`, `exists`, `getMetadata` (methods) |

## Convention (matches DOC-01)

One-line purpose → `@param` each → `@returns` → error semantics:
- Prisma-backed functions: `@throws Rejected with a Prisma error if ...`.
- `Result<T, AppError>` functions: success/failure branches stated explicitly
  (e.g. "or failure with VALIDATION_ERROR on schema failure").
- Class JSDoc describes the responsibility; per-method JSDoc describes the call.

## Scope decision: `currency/` left unchanged

`src/services/currency/**` was already fully JSDoc'd by **DOC-01** — every exported
function, class, method, factory, and const singleton in `converter.ts`,
`currency-converter.ts`, `exchange-rate.ts`, `exchange-rate-aggregator.ts`, and
`providers/boj-rate-provider.ts` already carries JSDoc. `index.ts` is a barrel
(re-exports only) and `types.ts` is a pure type-declaration module that DOC-01
deliberately left undocumented. To match the existing idiom and keep the diff
minimal, currency was not touched. Verified: `git diff` shows no currency changes.

## Scope decision: type/interface declarations left undocumented

Per the goal line ("JSDoc on exported **functions** lacking it") and the DOC-01
idiom (pure type/interface/type-alias declarations were not documented), exported
interfaces and type aliases in the touched files (e.g. `ClosingEntry`,
`TaxEffectCalc`, `ValidationIssue`, `JournalQualityReport`) were intentionally left
without JSDoc. This keeps the change consistent with the rest of the codebase.

## Notes / non-issues

- `calculation-validator.ts` has a pre-existing dead private method
  `parseValidationResponse` (never called). It is private and does not trip the
  `--max-warnings=0` gate (unused private class members are not flagged). Left
  untouched — out of scope for a docs-only task.
- All four touched files were lint-clean **before** editing (verified pre-flight),
  so no inherited warnings were carried into the gate.

## Verify

```
node scripts/autopm_verify.mjs --changed-only
→ typecheck ok (0 errors)
→ eslint ok (4 files, 0 warnings)
→ vitest ok (4 files, 85 tests passed)
→ exitCode 0
```

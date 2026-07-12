# gap-untested-module-05af996a7b — Unit tests for `src/types/ocr.ts`

**Risk class:** C · **Target:** `src/types/ocr.ts` · **Test file:** `tests/unit/types/ocr.ts`

## What was added

A new Vitest spec mirroring the source path under `tests/unit/types/`. The target
module is mostly type-only, but exports three runtime values (`DEFAULT_OCR_CONFIG`,
`OCRStructuredDataSchema`, `OCRResultSchema`) plus a set of interfaces/unions. The spec
follows the repo's 3-layer type-test idiom (runtime `expect` + typed-assignment +
`expectTypeOf`).

## Coverage rationale

`src/types/ocr.ts` declares **no functions/methods** — the testable surface is the
two Zod schemas, the env-resolved default config, and the type definitions. Each
public export is exercised below.

### `DEFAULT_OCR_CONFIG` (runtime constant)
- engine defaults to `'ndlocr'`.
- `ndlocr.{enabled,dockerEndpoint,timeout}` default values.
- `yomitoku.{enabled,apiUrl,liteMode,timeout}` default values (disabled, fallbacks).
- `maxFileSize` equals `10 * 1024 * 1024` (10485760) — boundary asserted both ways.
- `allowedTypes` equals the exact 4-entry mime list.
- Matches `OCRConfig` type (`expectTypeOf`).

### Env resolution (fail-safe fallback behavior — `process.env` read at module load)
Each case isolates the module registry (`vi.resetModules()` + dynamic `await import`)
so the env read is exercised deterministically:
- `NDLOCR_DOCKER_ENDPOINT` override is honored.
- Falls back to `http://localhost:8002` when unset.
- `YOMITOKU_ENABLED === 'true'` (strict equality) enables yomitoku.
- `'false'` / truthy-but-not-`'true'` does **not** enable it (fail-safe: off).
- `YOMITOKU_API_URL` override honored.
- `YOMITOKU_LITE_MODE === 'true'` enables lite mode.

### `OCRStructuredDataSchema` (Zod object)
- Happy path: fully-populated structured document (JP text, items, money fields).
- Minimal valid object (only required `rawText` + `confidence`).
- Edge: empty `rawText` string (`''`) — still a valid string.
- Edge: `confidence` of `0` and negative — schema performs **no** `[0,1]` range
  clamping (documented current behavior, not a desired constraint).
- Non-strict object: unknown keys are stripped (`not.toHaveProperty`).
- Error paths (safeParse → `success:false`): missing `rawText`, missing
  `confidence`, wrong-typed `rawText`, wrong-typed `confidence`, item missing
  required `name`.
- Item with only `name` parses; `error.issues` populated on failure.

### `OCRResultSchema` (Zod discriminated union on `success`)
- Success branch parses for **both** engines (`ndlocr`, `yomitoku`).
- Parsed success result narrows to `data`/`confidence`/`engine`.
- Failure branch parses for **all seven** `OCRErrorCode` values.
- Parsed failure result narrows to `error.code`/`message`; `cause` undefined by default.
- Optional `Error` `cause` accepted on the failure branch.
- Non-`Error` `cause` rejected (`z.instanceof(Error)`).
- Discriminator edge: missing `success`, invalid discriminator value (`'maybe'`).
- Success-branch errors: missing `data`, invalid `engine` (`'tesseract'`).
- Failure-branch errors: missing `error.code`, invalid code (`'NOT_A_REAL_CODE'`).

### Types (compile-time + runtime assignment)
- `OCREngineType` is exactly `'ndlocr' | 'yomitoku'`.
- `OCRErrorCode` is exactly the seven-code union.
- `OCRResult` narrows on the `success` flag (both branches).
- `OCRResult<T>` substitutes the success-data type (`OCRResult<string>`).
- `OCRError` accepts an optional `cause`.
- Interfaces (`OCRItem`, `OCRStructuredData`, `OCROptions`, `OCRConfig`) accept valid
  shapes, including minimal (`OCRItem` name-only, empty `OCROptions`).

## Assertions added (42 tests, all passing)

42 `it` blocks across 5 `describe` groups:
`DEFAULT_OCR_CONFIG` (6) · `DEFAULT_OCR_CONFIG env resolution` (6) ·
`OCRStructuredDataSchema` (12) · `OCRResultSchema` (11) · `types` (7).

## Verification

- `corepack pnpm exec vitest run tests/unit/types/ocr.test.ts` → **42 passed**.
- `corepack pnpm exec eslint tests/unit/types/ocr.test.ts --max-warnings=0` → clean.
- `corepack pnpm exec tsc --noEmit` → no errors in `ocr.test.ts` / `ocr.ts`.

## Notes

- No new test-framework dependencies introduced (Vitest + Zod already in use).
- Deterministic: env tests use module-registry isolation + `afterEach` cleanup; no
  network, clock, or unseeded randomness.
- `src/types/**` is excluded from the coverage map in `vitest.config.ts`, so this spec
  exists for regression/type-contract safety rather than coverage percentage.

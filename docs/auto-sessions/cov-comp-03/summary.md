# COV-COMP-03 — Unit-test coverage: components/budget + components/import

## Scope
Added focused unit tests for previously-untested modules under:
- `src/components/budget` — `BudgetForm.tsx`, `CSVUpload.tsx`
- `src/components/import` — `ImportCard.tsx`, `ImportPreview.tsx`, `ImportResult.tsx`,
  `JournalImport.tsx`, `types.ts` (via the `index.ts` barrel)

All 7 modules in scope now have a mirror test under `tests/components/`.

## Tests added (7 files, 58 tests)

| File | Tests | Primary logic exercised |
|------|------:|--------------------------|
| `tests/components/import/ImportResult.test.tsx` | 13 | progress-rate guards (`totalRows>0` div-by-zero), success/skip/fail bar widths, status→label/description mapping, `durationMs` ms-vs-秒 formatting, ErrorTable cap (20) + `...他 N件`, warnings cap (5) |
| `tests/components/import/ImportPreview.test.tsx` | 12 | `displayRows.slice(maxPreviewRows)`, error/warning counts, language label, mappedHeaders `→`, row-error matching (`row===rowIdx+2`), ErrorList cap (5), warnings cap (3), truncation notice |
| `tests/components/import/ImportCard.test.tsx` | 7 | `validateFile` (extension accept/reject, case-insensitivity, 10 MB boundary, `onError`), size-in-KB display, preview success (`SET_PREVIEW`), `!ok` error path |
| `tests/components/import/JournalImport.test.tsx` | 7 | CSV-only + 10 MB validation, size display, upload result rendering, file-clear on `imported>0`, errors cap (10), `!ok` `data.error` |
| `tests/components/budget/CSVUpload.test.tsx` | 8 | CSV toast rejection, FileReader preview parsing (`slice(0,6)`, comma split, trim+strip quotes), 6-line cap, import success (count/toast/onSuccess), `data.error` fallback chain |
| `tests/components/budget/BudgetForm.test.tsx` | 6 | create vs edit mode (title/label/disabled/pre-fill), zod validation messages, POST create payload, PUT edit payload, fetch-failure toast |
| `tests/components/import/types.test.ts` | 5 | contract pin: `DEFAULT_UI_IMPORT_OPTIONS`, per-type ja/en labels+descriptions, `ACCEPTED_FILE_TYPES`, `MAX_FILE_SIZE_MB===10` |

## Key decisions / boundary handling
- **`fetch` mocked at the boundary** (`global.fetch = vi.fn()`), `sonner` toast mocked via `vi.hoisted`
  capture — IO/UX is not the unit under test. No DB touched.
- **BudgetForm Radix `Select` mock**: the component renders a department `<SelectItem value="">`
  ("なし"), which `@radix-ui/react-select` refuses in jsdom (throws on empty-string item value).
  The Select is a UI primitive — not the logic under test — so the 5 select primitives are replaced
  with pass-throughs (per-file mock, as endorsed for Radix/chart modules). The form handling
  (zodResolver validation, POST/PUT payloads, toast, create/edit modes) is exercised faithfully;
  fiscalYear/month/departmentId values flow from `useForm` defaults/reset, not Select interaction.
- **Dialog portal scoping**: `BudgetForm`/`CSVUpload` portal content to `document.body`, so queries
  use `screen` + `document.body.querySelector` rather than the render `container`.
- **Async safety**: all component handlers use `try/catch` (no unhandled rejections); no fake timers,
  so the vitest worker-crash pattern does not apply.

## Verification
- `corepack pnpm install --frozen-lockfile` + `corepack pnpm db:generate` (worktree bootstrapping).
- Ran ONLY the added test files (`corepack pnpm exec vitest run tests/components/budget tests/components/import`) — never the full suite (known OOM).
- **`node scripts/autopm_verify.mjs --changed-only` → exit 0** (typecheck 0 errors, eslint 0, vitest 58/58).

Stderr "Missing Description" notices are Radix Dialog a11y warnings (cosmetic); the
`Budget form submission error:` log is the component's own catch-block output on the
fetch-failure test (expected).

## Constraints honored
No Class-A paths modified (additive test files only). No `any`/`@ts-ignore`/`@ts-expect-error`/
`.skip`/lint-disable. No new dependencies. New helpers return structured data; existing
factories/stubs reused where applicable (custom inline factories for `ImportResultData` /
`ImportPreviewData`).

# Summary — gap-untested-module-d379873752

Add unit tests for `src/app/[locale]/(authenticated)/journal-proposal/components/FallbackInput.tsx` (Risk class C).

## Deliverable

- New test file: `tests/unit/app/[locale]/(authenticated)/journal-proposal/components/FallbackInput.test.tsx`
- 20 tests, all passing.

The path mirrors the source under the repo's established `tests/unit/app/...` convention
(the sibling page test already lives at `tests/unit/app/[locale]/(authenticated)/journal-proposal/page.test.tsx`).

## Module under test

`FallbackInput` is a pure, client-side form. Its public surface:

- Props: `onSubmit: (data: ManualInputData) => void`, `isProcessing: boolean`.
- Exported type `ManualInputData`.
- Internal logic driven by the component:
  - `handleSubmit` — `e.preventDefault()` then `onSubmit(formData)`.
  - `calculateTaxAmount` — on `totalAmount` blur, sets `taxAmount = Math.round(totalAmount * taxRate)`.
  - Field change handlers (date / vendor / totalAmount / taxRate / taxAmount / description).
  - `value={formData.totalAmount || ''}` and `value={formData.taxAmount || ''}` idiom (zero renders empty).
  - `required` on date / vendor / totalAmount; `isProcessing` disables the submit button and swaps its label.

## Test infrastructure decisions

- **`next-intl`**: mocked as `useTranslations: () => (key) => key` (same pattern as the sibling `journal-proposal/page.test.tsx`). Asserting on the raw keys keeps the tests deterministic and independent of message-file contents.
- **`@/components/ui/select` (Radix)**: Radix `<Select>` is unreliable in jsdom. Because the tax-rate Select *is* part of the logic under test here (its `onValueChange` drives the rate used by `calculateTaxAmount`), the primitives are replaced with a real native `<select>` rebuilt from the component's own `<SelectItem value>`s. This keeps the `value → onValueChange` wiring live and drivable via `fireEvent.change`, rather than hiding it behind a blind pass-through.
- **Date determinism**: `vi.useFakeTimers()` + `vi.setSystemTime('2024-06-15T10:30:00Z')` in `beforeAll`/`afterAll`, so the `new Date().toISOString().split('T')[0]` default is an exact, reproducible `'2024-06-15'`. The component has no timers/async effects, so fake timers are safe.
- **Number-input values**: asserted via raw `.value` (string). This faithfully tests the `|| ''` empty-zero idiom (jest-dom's `toHaveValue` collapses `''` to `0` for `type="number"`, hiding that behavior).

## Assertions added (by group)

### Initial render
1. Renders the `title` and `description` copy.
2. Every labelled field is present (date, vendor, totalAmount, taxAmount, description, tax-rate select).
3. Date defaults to today's ISO date (`'2024-06-15'`).
4. Numeric fields start at zero, rendered empty via `|| ''` (`totalAmount.value === ''`, `taxAmount.value === ''`).
5. date / vendor / totalAmount carry the `required` attribute (`toBeRequired`).
6. Tax rate defaults to `'0.1'`; submit button enabled with the `submit` label.

### isProcessing contract
7. `isProcessing=true` → button disabled, labelled `submitting`.
8. Toggling back to `false` → button enabled, labelled `submit`.

### Field updates
9. Edited date / vendor / totalAmount / description propagate into the submitted payload (`toMatchObject`).
10. `Number()` coercion: `totalAmount` accepts `'2500'`, clears to `''` on empty; `taxAmount` accepts `'777'`.

### Tax-rate selection
11. Select exposes exactly `['0.1', '0.08', '0']`.
12. `onValueChange` converts the string value to a number (payload `taxRate === 0.08`).

### calculateTaxAmount (on blur of totalAmount)
13. 10%: `1100 × 0.10 → '110'`.
14. 8% (rate changed first): `1000 × 0.08 → '80'`.
15. 0%: `1000 × 0 → 0`, rendered empty (`taxAmount.value === ''`).
16. Rounding: `105 × 0.10 → Math.round = 11` (half-up `Math.round` semantics), locked via both `expected === 11` and the field value.

### Submission
17. Full `ManualInputData` payload emitted on submit, including `items: []` and computed `taxAmount` (`toEqual`).
18. `handleSubmit` calls `preventDefault` (dispatched submit event with a `preventDefault` spy).
19. **Fail-safe**: native `required` validation blocks submission while required fields are empty (`onSubmit` not called).
20. Manually-entered tax amount is preserved in the payload (`taxAmount === 95`).

## Coverage rationale / requirement mapping

- **Happy-path**: render + field edits + submit payload (1, 2, 6, 9, 17, 20).
- **Edge / boundary**: zero-rendered-empty idiom (4, 15), empty-clears coercion (10), default date (3), rounding direction (16), the three tax-rate options (11).
- **Error / fail-safe**: incomplete form does not submit — the component's safety net is native `required` validation (5, 19); submitting never throws and always produces a well-formed `ManualInputData` when validation passes (17).
- **Timeouts / dependency failures**: N/A. The component is a synchronous form whose only collaborators are the `onSubmit` / `isProcessing` props and the mocked `next-intl`; there is no async work, network call, clock, or randomness to fail or time out. No fabricated tests were added for non-existent behavior.

## Quality gate (run in this worktree)

- `corepack pnpm install --frozen-lockfile` — ok (worktree started without `node_modules`).
- `corepack pnpm db:generate` — ok (required before typecheck to avoid phantom TS7006 errors).
- `corepack pnpm exec tsc --noEmit` — **0 errors**.
- `corepack pnpm exec eslint <test file> --max-warnings=0` — **0 warnings**.
- `corepack pnpm exec vitest run <test file>` — **20/20 passed**.

No production source was changed; no new dependencies added; no secrets, TODOs, or `NotImplementedError`s introduced.

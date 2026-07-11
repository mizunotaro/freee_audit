# Gap closure: unit tests for `ProposalEditor.tsx`

**Task ID:** gap-untested-module-b0760dc5f9
**Risk class:** C
**Target:** `src/app/[locale]/(authenticated)/journal-proposal/components/ProposalEditor.tsx`
**Test file:** `tests/unit/app/[locale]/(authenticated)/journal-proposal/components/ProposalEditor.test.tsx`
**Date:** 2026-07-11

## Outcome

Added a Vitest + React Testing Library suite (26 tests, all passing) for the
`ProposalEditor` component. The module previously had no test entry; the only
exported public surface is `ProposalEditor` (the internal `EntryEditor` helper
is exercised indirectly through it).

Placed under `tests/unit/app/[locale]/(authenticated)/journal-proposal/components/`
to mirror the source path and match the established `tests/unit/...` convention
used by the sibling `journal-proposal/page.test.tsx`. This path also matches the
source stem, so `scripts/autopm_verify.mjs` auto-resolves the test on
source-only changes to `ProposalEditor.tsx`.

## Mocks

- `sonner` → captures `toast.warning` (the only toast call the component makes).
- `next-intl` `useTranslations` → resolves `namespace.key` against a fixture
  message table with `{var}` interpolation (mirrors next-intl), falling back to
  the full key path for missing keys (also matches next-intl).
- `@/components/journal-proposal` `TaxTypeSelector` → replaced with a native
  `<select>` that wires `value`/`onChange` faithfully. `TaxTypeSelector` is a
  separately-tested collaborator built on Radix Select, which is brittle in
  jsdom; this keeps the tax-type editing path exercisable without instantiating
  Radix. Real shadcn `Card`/`Button`/`Input`/`Label`/`Textarea` are used as-is.

Determinism notes: balance-check assertions use raw numbers (not formatted
strings), so locale is irrelevant there. Total-text assertions use amounts
< 1000, whose `toLocaleString()` output is locale-independent. No real
network/clock/random is used.

## Assertions added (26)

### Rendering (6)
1. Renders the `編集` title and `保存` / `キャンセル` action buttons.
2. Renders `借方` / `貸方` section headers.
3. Renders every entry, split by `lineType` (debit on the left, credit on the right).
4. Renders running totals `借方合計` / `貸方合計` with the `¥` prefix and `toLocaleString()`.
5. Pre-fills each field (`accountName`, `amount`, `taxType`, `taxAmount`, `description`) from the proposal.
6. Applies the `className` prop to the root `Card`.

### Save — balanced, happy path (3)
7. `onSave` is called exactly once with the full proposal (id, entry count, both line types) when debit === credit.
8. `toast.warning` is **not** called on a balanced save.
9. Entry values are preserved verbatim when saving without edits.

### Save — balance mismatch / fail-safe (4)
10. Editing a debit amount to create a mismatch blocks `onSave` and calls `toast.warning` once.
11. The warning message contains the formatted debit/credit totals (`¥100` / `¥800`) — verifying the component computes and passes the correct totals.
12. A credit-side mismatch also blocks save and toasts.
13. **Recovery**: after a blocked save, re-balancing lets the next save through with the corrected amount.

### Entry editing — `updateEntry` state updates (6)
14. Editing `accountName` updates the saved payload for the target entry.
15. Editing `amount` recomputes the live `借方合計` total (and leaves `貸方合計` unchanged).
16. Changing `taxType` via `TaxTypeSelector` updates the saved payload.
17. Editing `taxAmount` updates the saved payload.
18. Editing `description` updates the saved payload.
19. `updateEntry` patches only the targeted entry — the other entry's `accountName`/`amount`/`description` are untouched (partial merge).

### Cancel (1)
20. `キャンセル` calls `onCancel` once and does **not** call `onSave`.

### Edge cases & fail-safe (6)
21. Empty `entries` array → totals `¥0` / `¥0`, treated as balanced (`0 === 0`), saves with empty entries, no warning. (Documents current behavior: the component permits an empty balanced proposal.)
22. Multiple debit + credit entries → totals aggregate correctly across all lines; balanced saves.
23. Large balanced amounts (`1,234,567` each) save successfully — the balance check compares raw numbers, not the formatted strings.
24. Clearing an amount input coerces to `0` (`Number("") === 0`); debit total drops to `¥0`.
25. Decimal amounts parse as floats (`Number("100.5") === 100.5`); total shows `¥100.5`.
26. Zero/zero boundary (`0 === 0`) saves without warning.

## Coverage rationale

The component's logic is concentrated in two closures: `updateEntry` (immutable
partial-patch of a single entry by id) and `handleSave` (sum debit vs. credit,
short-circuit with `toast.warning` on mismatch, else forward to `onSave`). The
suite covers both branches of `handleSave` (balanced → save; mismatch →
fail-safe block + toast), every field path through `updateEntry`, the live
total recompute, partial-merge isolation, and the cancel path. Edge cases probe
the `Number(e.target.value)` coercion (empty → 0, decimal → float) and the raw
numeric balance comparison at boundaries (empty, zero, large). Fail-safe is
asserted directly: an unbalanced proposal never reaches `onSave`.

## Defects / observations (not fixed — out of scope for a test-only task)

- **Missing i18n key**: the component calls
  `t('proposal.balanceMismatch', { debit, credit })`, but `balanceMismatch` is
  **absent** from `messages/ja.json` (and `en.json`). In production next-intl
  falls back to the key path, so users see `proposal.balanceMismatch` instead of
  a localized message. The test fixture defines this key only to make the
  component's debit/credit value-passing observable; the missing real
  translation should be added separately.
- **`Number()` NaN path is unreachable**: `amount`/`taxAmount` inputs are
  `type="number"`, whose value-sanitization algorithm rejects non-numeric input
  (jsdom and browsers set it to `""`), so `Number(value)` yields a number or `0`
  — never `NaN`. The `NaN !== totalCredit` short-circuit is therefore defensive
  dead code in practice; it is still covered indirectly by the generic mismatch
  tests.

## Verification

```
autopm_verify.mjs --changed-only  →  exitCode 0
  typecheck: total errors=0, relevant=0
  eslint:    ok (0 warnings)
  vitest:    26 passed (26)
```

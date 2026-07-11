# FIN-IMPL-03 — Management-accounting analysis module (CVP / contribution / break-even / segment)

**Status:** IMPLEMENTATION COMPLETE — awaiting human review.
**Labels required on PR:** `human-review-required`, `do-not-auto-merge`.
**Gate:** `node scripts/autopm_verify.mjs --changed-only` → **exit 0** (typecheck 0 errors, eslint 0, vitest 36/36).

> ⚠️ This is **financial output**. Every formula and judgemental assumption below is enumerated for the
> owner to verify. Do not auto-merge.

---

## 1. What changed

| File | Kind | Purpose |
|------|------|---------|
| `src/services/analytics/managerial-accounting.ts` | NEW | Pure, side-effect-free management-accounting computations. |
| `tests/unit/services/analytics/managerial-accounting.test.ts` | NEW | 36 tests: golden (hand-computed), property identities, edge cases. |

No Class-A path was modified. The module does **not** read the DB, journals, or any ledger — it is a pure
transform over structured inputs supplied by the caller (same pattern as `src/services/analytics/financial-kpi.ts`).
Journal/ledger/Class-A data remains a **read-only input** that callers assemble into the typed inputs.

---

## 2. Public API

All exports return `Result<T, AppError>` and validate inputs with `z.safeParse`.

| Export | Returns | Standard definition |
|--------|---------|---------------------|
| `classifyCostBehavior(lines, options?)` | `ClassifiedCostItem[]` | Conservative cost-behavior split (judgemental — see §4). |
| `buildCVPAggregateFromProfitLoss(pl)` | `{revenue, variableCosts, fixedCosts}` | COGS→variable, SGA→fixed from a P&L. |
| `calculateContributionMargin(input)` | `ContributionMarginResult` | 限界利益 = 売上高 − 変動費. |
| `calculateBreakEvenPoint(input)` | `BreakEvenResult` | 損益分岐点売上高 = 固定費 ÷ 限界利益率. |
| `analyzeCVP(input)` | `CVPAnalysis` | Per-unit CVP: BE units/sales, target-profit, MoS, DOL. |
| `analyzeSegmentProfitability(input)` | `SegmentProfitabilityResult` | Segment margin + company rollup. |

---

## 3. Formula list (for human verification)

Ratios are returned as **fractions in [−∞, 1]** (e.g. `0.4`), not percent. Multiply by 100 to display.
Numbers are returned **unrounded** (rounding is a presentation concern).

| # | Formula | Citation |
|---|---------|----------|
| F1 | Contribution Margin = Sales Revenue − Variable Costs | Horngren, Datar & Rajan, *Cost Accounting: A Managerial Emphasis* (16e) Ch. 3; Garrison, Noreen & Brewer, *Managerial Accounting* (17e) Ch. 5 |
| F2 | Contribution-Margin Ratio = Contribution Margin ÷ Sales | same |
| F3 | Contribution Margin per Unit = Selling Price − Variable Cost per Unit | Garrison Ch. 5 |
| F4 | Break-even Sales = Fixed Costs ÷ Contribution-Margin Ratio | Garrison Ch. 5 |
| F5 | Break-even Volume = Fixed Costs ÷ Contribution Margin per Unit | Garrison Ch. 5 |
| F6 | Target-profit Volume = (Fixed Costs + Target Profit) ÷ Contribution Margin per Unit | Garrison Ch. 5 |
| F7 | Margin of Safety (amount) = Actual/Budgeted Sales − Break-even Sales | Garrison Ch. 5 |
| F8 | Margin of Safety (ratio) = (Sales − Break-even Sales) ÷ Sales | Garrison Ch. 5 |
| F9 | Degree of Operating Leverage = Contribution Margin ÷ Net Operating Income | Garrison Ch. 5 |
| F10 | Segment Contribution Margin = Segment Revenue − Segment Variable Costs | Garrison Ch. 6; Horngren Ch. 3 |
| F11 | Segment Margin = Segment Contribution Margin − Traceable Fixed Costs | Garrison Ch. 6 |
| F12 | Company Net Operating Income = Σ Segment Margins − Common Fixed Costs | Garrison Ch. 6 |

**Golden anchors (hand-computed):**

- Aggregate `{revenue 20,000,000, variableCosts 12,000,000, fixedCosts 4,000,000}` →
  CM `8,000,000`, CMR `0.4`, break-even sales `10,000,000`.
- Per-unit `{price 1,000, varCost 600, fixed 4,000,000, volume 20,000, target 2,000,000}` →
  CM/unit `400`, CMR `0.4`, BE volume `10,000`, BE sales `10,000,000`,
  target-profit volume `15,000`, operating income `4,000,000`, MoS amount `10,000,000`,
  MoS ratio `0.5`, DOL `2.0`.
- Segments A `{rev 10,000,000, vc 4,000,000, tFC 1,500,000}` + B `{rev 8,000,000, vc 4,800,000, tFC 1,000,000}`,
  common `1,200,000` → A segMargin `4,500,000`, B segMargin `2,200,000`,
  totals segMargin `6,700,000`, company NOI `5,500,000`.

---

## 4. Judgemental assumptions — each marked `// PENDING HUMAN DETERMINATION` in code

These are the points the owner must confirm before relying on the output. The module defaults to the
most conservative option in each case.

1. **Cost-behavior split (変動費/固定費) is a per-business judgement.** `classifyCostBehavior` /
   `buildCVPAggregateFromProfitLoss` apply the standard introductory simplification (Garrison's
   "contribution approach"): **cost of sales (account-code prefix `5`) = variable; SGA (prefix `6`,`7`) = fixed**.
   This aligns with the prefix map already used in `src/services/budget/detailed-actual-vs-budget.ts`.
   Override per account via `classifyCostBehavior(lines, { overrides: { '<code>': 'fixed'|'variable' } })`.
   Unrecognized codes default to **fixed** (understates CM — the safer error).

2. **CVP models operating profit only.** `buildCVPAggregateFromProfitLoss` excludes 営業外収益/費用
   (non-operating), 特別損益 (extraordinary), and income tax. Confirm this scope is intended.

3. **Common fixed costs are not allocated to segments.** `analyzeSegmentProfitability` deducts common
   fixed costs only at the company level (F12). Any future allocation basis is judgemental and out of scope.

4. **Break-even is reported undefined when CMR ≤ 0.** When variable costs meet/exceed revenue there is no
   finite break-even (each sale reduces profit); the result returns `defined:false, breakEvenSales:null`
   rather than a meaningless number.

5. **DOL is null at break-even.** When operating income is exactly 0, DOL is undefined; returned as `null`.

---

## 5. Edge cases covered by tests

- Zero revenue → CMR null, break-even undefined.
- CMR exactly 0 (revenue == variableCosts) and CMR < 0 (VC > revenue) → break-even undefined.
- CM/unit == 0 and CM/unit < 0 → break-even + target-profit volume undefined/null.
- `fixedCosts = 0` → break-even sales = 0.
- Operating at break-even volume → DOL null; volume below break-even → negative margin of safety.
- Missing-period segment (revenue 0) → ratios null, amounts still computed.
- Empty segments array, non-finite inputs, negative volume → `VALIDATION_ERROR`.

---

## 6. Verification evidence

```
node scripts/autopm_verify.mjs --changed-only  →  exitCode 0
  typecheck: ok (0 errors)   eslint: ok (0)   vitest: 36/36 passed
whole-repo `tsc --noEmit`: 0 errors
```

No new dependencies added (`zod`, `@/types/result` already in repo). No Class-A path touched.

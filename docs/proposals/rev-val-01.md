# REV-VAL-01 — Valuation Numerical-Correctness Review (DCF / WACC / Monte Carlo / BS / CF-KPI)

> **AUDIT-ONLY proposal.** This document is analysis written *for a human reviewer*. It contains no
> decisions, no approvals, and no sign-offs. Source code under `src/services/valuation/**` and
> `python-service/**` was treated as **read-only**; no production file was modified. Every finding,
> severity rating, and proposed change below is explicitly marked **`PENDING HUMAN DETERMINATION`**.
>
> Scope covered: `src/services/valuation/{dcf,monte-carlo/index,black-scholes,wacc,wacc-advisor,
> comparable,asset-based,scenario,qa/index,types,index}.ts` and `python-service/app/services/
> {cashflow_calculator,kpi_calculator}.py` + `python-service/app/utils/precision.py`, cross-checked
> against the existing test suites (`tests/unit/services/valuation/**`, `python-service/tests/**`).

---

## 0. How to read this document

- Each finding lists **Location** (`file:line`), **Defect**, **Failure scenario**, **Standard
  reference**, **Proposed change**, and a **Verdict** line.
- **`PENDING HUMAN DETERMINATION`** is attached to every conclusion. Nothing here is decided.
- "Live" / "Dead" in §2 refers to whether a function has a production caller reachable from the
  Next.js valuation page or an API route (see §2). This distinction gates *production* severity, not
  whether a defect is real.
- All numeric anchors in §1 were recomputed independently with Node.js (bisection on the
  Abramowitz–Stegun normal CDF used in `black-scholes.ts`); they are reproducible.

---

## 1. Golden / reference anchors (use these as the first regression fixtures)

These are the deterministic, standard-formula values the reviewed functions *should* produce. They
are intended as the seed of a golden-test suite (§6). All verdicts `PENDING HUMAN DETERMINATION`.

| # | Function | Inputs | Expected | Reviewed-code output | Status |
|---|----------|--------|----------|----------------------|--------|
| G1 | `calculateDCF` | FCF₀=1000, g=5%, gₜ=2%, r=10%, n=5 | EV≈14,462.12 (PVsum=4,358.12, TV=16,272.59, TPV=10,103.99, rounds to **14,462**) | 14,462 | matches |
| G2 | `calculateWACC` (detailed) | Rf=1.5%, MRP=6%, β=1, Rd=3%, Tc=30%, D/V=30% | Re=7.500%, WACC=**5.8800%** | 5.8800% | matches |
| G3 | `calculateBlackScholes` (call) | S=K=100, T=1, r=5%, σ=20%, q=0 | d1=0.3500, d2=0.1500, C=**10.4506** | 10.450575 | matches |
| G4 | `inverseNormalCdf` | p=0.6 | Φ⁻¹(0.6)=**0.2533** | **0.9891** | **BROKEN** (§7.1) |
| G5 | `inverseNormalCdf` antisymmetry | Φ⁻¹(p)+Φ⁻¹(1−p)=0 ∀p | 0 | ≈1.99 | **BROKEN** (§7.1) |
| G6 | MC `percentile(50)` vs `ss.median` | sorted [1..100] | 50.5 | **51** (floor method) | biased (§3.5) |

Correct reference Φ⁻¹ table (for the inverse-normal property test): `0.10→-1.2816, 0.25→-0.6745,
0.40→-0.2533, 0.50→0, 0.60→0.2533, 0.75→0.6745, 0.90→1.2816, 0.95→1.6449`.

---

## 2. Liveness map (what actually runs in production)

The valuation page imports the TS engine directly; only the QA cross-check goes through an API route.
`PENDING HUMAN DETERMINATION` on the liveness claims (derived from a grep of callers, which may miss
dynamic/indirect dispatch).

| Symbol | Production caller | Live? |
|--------|-------------------|-------|
| `calculateDCF` | `valuation/page.tsx` | **Live** |
| `calculateWACC` | `valuation/page.tsx` | **Live** |
| `runMonteCarloSimulation` | `valuation/page.tsx` | **Live** (uses Box–Muller, **not** `inverseNormalCdf`) |
| `getWACCAdvice` | `valuation/page.tsx` | **Live** |
| `calculateAssetBased` | `valuation/page.tsx` | **Live** |
| `calculateBlackScholes` | `valuation/page.tsx` | **Live** |
| `calculateScenario` | `valuation/page.tsx` | **Live** |
| `ValuationQAService` | `api/valuation/qa/route.ts` | **Live** |
| `latinHypercubeSampling` + `inverseNormalCdf` | none found (exported only) | **Dead** (latent landmine) |
| `sensitivityAnalysis` (MC) | none found (exported only; `scenario.ts` has its own `calculateSensitivity`) | **Dead** |
| `impliedVolatility` | only its own test | **Dead** (unused; bisection itself is sound) |
| Python `CashFlowCalculator` / `KPICalculator` | FastAPI routers (`cashflow.py`, `kpi.py`) | **Live** when the microservice is wired |

**Implication:** the *production*-severity findings are the live-path ones (§3, §4, §5.1, §6). The
dead-but-broken code (§7) is a correctness landmine: it ships correct-looking output that is
numerically wrong, and would silently corrupt results the moment it is wired up. `PENDING HUMAN
DETERMINATION` on which class to fix first.

---

## 3. Monte Carlo — `src/services/valuation/monte-carlo/index.ts` (LIVE path)

### 3.1 Weak, correlated PRNG (`SeededRandom`, lines 27–38, 279–280)
**Defect.** `next()` returns `frac(sin(seed++)·10000)`. The `sin`-based generator is a well-known weak
PRNG: short period, strong serial correlation, and poor equidistribution in higher dimensions — exactly
the properties that destroy Monte Carlo variance estimates. Additionally, line 279–280 constructs **two**
`SeededRandom` instances (`new SeededRandom(seed).next.bind(new SeededRandom(seed))`); the first is
discarded. Functionally still seeded, but misleading and wasteful.
**Failure scenario.** Two variables that should be independent emerge correlated; reported `stdDev` /
percentile bands are biased; results are non-reproducible in quality even when seeded.
**Standard.** Use a vetted generator (xorshift128+ / PCG / Mulberry32) or `simple-statistics`'s
built-in shuffling on `Math.random` for the non-seeded path.
**Proposed change.** Replace `SeededRandom` with Mulberry32 (≈6 lines, no new dependency); keep the
`seed` API. Fix the double-instantiation on line 280. `PENDING HUMAN DETERMINATION`.

### 3.2 Single non-finite sample aborts the entire run (lines 288–306)
**Defect.** The sampling loop calls `evaluateFormula`, which throws on any non-finite result
(`evaluateFormula`, lines 247–249). One bad iteration (e.g. a lognormal drawing a huge tail, or a
divide-by-zero in a user formula) propagates to the outer `catch` and returns `success:false` for the
whole simulation, discarding all prior iterations.
**Failure scenario.** A 100k-iteration run with one overflow returns `simulation_error` and no
statistics, even though 99,999 samples were valid.
**Standard.** Monte Carlo engines either clamp/reject individual samples and continue, or report the
rejection count. Aborting on a single sample is not standard.
**Proposed change.** Count and skip non-finite samples (or NaN/±Infinity inputs), continue the loop,
and surface a `rejectedSamples` count in the result; fail only if *all* samples were rejected.
`PENDING HUMAN DETERMINATION`.

### 3.3 `correlationMatrix` declared but never applied (`types.ts:237`, engine ignores it)
**Defect.** `MonteCarloInputs.correlationMatrix?: number[][]` exists in the type but `runMonteCarloSimulation`
never reads it. Variables are sampled independently via `sampleDistribution`.
**Failure scenario.** A caller supplies a correlation matrix expecting induced correlation (e.g. revenue
and costs moving together); the engine silently ignores it and produces decorrelated output. The API
gives no warning that the input had no effect.
**Standard.** Either implement Cholesky-based correlated sampling, or remove the field and document its
absence. Shipping an accepted-but-ignored input is the worst option.
**Proposed change.** Remove the field (preferred for an audit-only recommendation) **or** implement
correlated sampling with a clear error when the matrix is not positive-definite. `PENDING HUMAN
DETERMINATION`.

### 3.4 Percentile method is biased and inconsistent with the reported median (lines 317–320)
**Defect.** `percentile(p)` uses `index = floor(p/100 · n)`, the "lower" variant. For `n=100` it returns
`sorted[50]` for p50, but `ss.median` averages `sorted[49]` and `sorted[50]`. Thus the reported
`statistics.median` ≠ `statistics.percentiles.p50` (G6: 50.5 vs 51) and p25/p75 are systematically high.
**Failure scenario.** A consumer reading `p50` and `median` from the same result object gets two
different "middle" values; VaR-style p5/p95 bands are shifted.
**Standard.** Use a single, documented percentile convention consistently (linear interpolation between
closest ranks is the `simple-statistics` default and matches `ss.median` semantics).
**Proposed change.** Replace the floor method with `ss.quantile(results, p/100)` (already a dependency)
so median and percentiles agree. `PENDING HUMAN DETERMINATION`.

### 3.5 Other MC robustness gaps
- **`numBins` from `ceil(sqrt(iterations))` capped at 100 (lines 337–353):** fine, but `binWidth =
  (max-min)/numBins` divides by zero / produces NaN if all samples are equal (max==min). Add a guard.
- **No reproducibility test:** there is no `monte-carlo.test.ts` (see §6), so none of 3.1–3.5 is
  exercised. `PENDING HUMAN DETERMINATION`.

---

## 4. DCF — `src/services/valuation/dcf.ts` (LIVE)

### 4.1 Negative-growth threshold is wrong: rejects valid −1%…−99% growth (line 47 vs 50 vs 247)
**Defect.** Inputs are in **percent** (line 86: `g = growthRate/100`). `calculateDCF` rejects
`growthRate <= -1` (line 47) — i.e. it rejects **−1%** and anything more negative — but the error
message says "must be greater than **-100%**" (line 50) and `validateDCFInputs` uses `<= -100`
(line 247). The calc function and the validator disagree by two orders of magnitude. This is a classic
percent-vs-decimal unit mix-up: the intended decimal guard `g <= -1` was written as `growthRate <= -1`
against percent input.
**Failure scenario.** A declining business modeled with −5% growth is rejected at calculation time
even though `validateDCFInputs` accepts it; the modeler cannot value a shrinking company. Mathematically
any `g > -1` (i.e. `growthRate > -100%`) is valid for the projection `(1+g)^n`.
**Existing test gap (confirmed).** `dcf.test.ts` only exercises `growthRate: -0.5` (passes, since
−0.5 > −1) and `growthRate: -100` (rejected by both). The entire gap `[-100, -1)` — e.g. −5, −50, −99 —
is untested, so CI is green while the bug ships.
**Proposed change.** Make line 47 read `if (growthRate <= -100)` to match the message and the validator
(and keep `freeCashFlow > 0` as the guard that FCF stays positive). Add a golden/property test at
`growthRate = -5` asserting success and a sensible EV. `PENDING HUMAN DETERMINATION`.

### 4.2 Terminal-value / projection math is correct (G1)
The Gordon-growth terminal value `TV = FCF₍n+1₎/(r−gₜ)` discounted at `(1+r)^n`, summed with the
explicit-period PVs, reproduces the standard EV (G1 = 14,462). `terminalGrowthRate >= discountRate`
(line 54) and `discountRate <= 0` (line 73) guards are correct. **No defect; record as a regression
anchor.** `PENDING HUMAN DETERMINATION` (i.e. confirm this is the desired convention — end-of-period
discounting, not mid-year).

### 4.3 Display-only rounding (lines 181–194)
`enterpriseValue`, `terminalValue`, `terminalPV` and `presentValues` are `Math.round`-ed in the result.
This is display precision, not a formula error, but it means the stored `metadata.presentValues` no
longer reconcile exactly to `enterpriseValue` when summed by a consumer. `PENDING HUMAN DETERMINATION`
on whether to round only at the presentation layer.

---

## 5. WACC + WACC Advisor (LIVE)

### 5.1 `wacc-advisor.ts` passes D/E off as D/V into the detailed WACC (line 274)
**Defect.** `recommendedValues.debtRatio = optimalCapitalStructure.suggestedDERatio * 100`. But
`suggestedDERatio` is a **debt-to-equity** ratio (e.g. 0.2), while `debtRatio` in the detailed WACC
(`wacc.ts`) is **debt-to-value** (D/V). A caller that feeds `recommendedValues` straight into
`calculateWACC({mode:'detailed'})` uses D/E as D/V, double-counts/mis-weights the capital structure, and
also trips the `debtRatio+equityRatio=100` guard (line 100–103) incorrectly.
**Failure scenario.** Industry D/E=0.2 is published as `debtRatio: 20` and consumed as D/V=20% (it is
really ≈16.7%), silently skewing WACC.
**Proposed change.** Convert D/E→D/V via `D_V = D/E / (1 + D/E)` before exposing `debtRatio`, **or**
rename the field to `debtEquityRatio` and document units. `PENDING HUMAN DETERMINATION`.

### 5.2 `normalizeIndustry` substring-matches `"it"` (lines 92–125)
**Defect.** The matcher is `normalized.includes(key)` over a `mappings` table that contains the key
`"it" → "software"`. `String.includes("it")` is true for a large set of unrelated strings:
"digital", "united", "limited", "audit", "utility", "capital", "entity", "writing", "hospitality", etc.
Because object iteration is insertion-ordered and `"it"` appears early, these all collapse to
`"software"`.
**Failure scenario.** An industry string like "digital marketing" or "hospitality" is classified as
Software, pulling software betas/D-E/credit-spreads into an unrelated valuation.
**Proposed change.** Match on exact token equality (split on non-alphanumeric, compare tokens), or use
anchored regexes; drop bare 2-letter ambiguous keys. `PENDING HUMAN DETERMINATION`.

### 5.3 `lastUpdated = now()` misrepresents 2024-vintage data (line 282, data at 78–90)
**Defect.** The response sets `lastUpdated: new Date().toISOString()` (the wall-clock "now"), but the
underlying Rf/MRP sources are explicitly `"Damodaran (2024)"` / `"BOJ 10-year JGB yield"` snapshots
hardcoded at `riskFreeRate.current=0.8`, `marketRiskPremium.current=6.0`. The timestamp therefore claims
the market data is fresh when it is a fixed 2024 snapshot.
**Failure scenario.** A reviewer trusting `lastUpdated` assumes current rates; in a rising-rate
environment the WACC is materially off.
**Proposed change.** Stamp `lastUpdated` with the actual data vintage (a constant, e.g. the Damodaran
publication date), not `Date.now()`. `PENDING HUMAN DETERMINATION`.

### 5.4 WACC detailed math is correct; notation mismatch only (G2; `wacc.ts:124` vs `129`)
`costOfEquity = Rf + β·MRP` is the correct CAPM (MRP is the premium), reproducing G2 = 5.8800%. The
**display** formula on line 129 reads `Re = Rf + β × (Rm − Rf)` while the code computes
`Rf + β × Rm` with `Rm` = premium. The *number* is right; the *label* would only be correct if `Rm`
were the market return. `PENDING HUMAN DETERMINATION` on relabeling `Rm`→`MRP` in the rendered step.
Also note the hard fallback `riskFreeRate ?? 1.5` (line 76) disagrees with the advisor's
`riskFreeRate.current = 0.8` — two different Rf defaults in the same subsystem. `PENDING HUMAN
DETERMINATION`.

---

## 6. QA gate — `src/services/valuation/qa/index.ts` (LIVE via `/api/valuation/qa`)

### 6.1 The `passed` boolean is inverted: errors do NOT fail, warnings DO (line 120) — SEVERE
**Defect.**
```ts
passed: issues.filter((i) => i.severity !== 'error').length === 0
```
This counts **non-error** issues (warning/info) and fails when any exist, while being **blind to
errors**. Concrete truth table:

| errors | warnings/infos | `passed` (current) | `passed` (intended) |
|--------|----------------|--------------------|---------------------|
| 5      | 0              | **true** ✗         | false               |
| 0      | 1              | **false** ✗        | true                |

The intent is unambiguous because the sibling methods agree with the *intended* semantics:
`generateRecommendations` (288–293) emits "Critical: Fix errors…" when errors exist, and
`calculateScore` (301–305) deducts 50/error. Only the headline `passed` is computed from the inverted
filter.
**Failure scenario.** A valuation with multiple `severity:'error'` formula/consistency issues (e.g.
missing formula, no steps) returns `passed:true, score:…`, silently green-lighting a broken result;
conversely a clean result with one benign warning fails.
**Proposed change.** `passed: issues.filter((i) => i.severity === 'error').length === 0`. Add a test
asserting the truth table above (and that a result with only warnings still passes). `PENDING HUMAN
DETERMINATION`.

### 6.2 Boundary checks never affect pass/fail; `bestPracticeCheck` is hardcoded pass (lines 130–138)
**Defect.** `validateBoundaries` (172–187) only pushes into a local `warnings` array used solely for the
`boundaryCheck` detail; it never becomes a `QAIssue`, so negative enterprise/terminal value never
influences `passed` or `score`. Separately, `bestPracticeCheck: { passed: true, issues: [] }` (138) is a
constant — the eponymous check does not exist.
**Failure scenario.** A negative enterprise value (a red flag) is recorded as a warning string but
cannot fail QA; "best practice" is always reported clean.
**Proposed change.** Either promote boundary findings to `QAIssue`s (so they feed score/passed) or
document that boundary is advisory-only; implement or remove `bestPracticeCheck`. `PENDING HUMAN
DETERMINATION`.

### 6.3 LLM cross-validation verdict is parsed by substring grep (lines 238–247)
**Defect.** `passed` is derived from `content.includes('passed') && !content.includes('failed')`, and
confidence is downgraded if `content.includes('critical')`. This is prompt-fragile: a model writing
"the calculation has not failed, but one input is critical…" yields contradictory flags, and any model
that returns structured JSON is parsed as plain text.
**Failure scenario.** LLM says "passed: false" inside a sentence that also contains "passed" →
`llmValidated=true`. Deterministic mis-grading of the cross-check.
**Proposed change.** Request strict JSON and `JSON.parse` it (the prompt already asks for JSON,
line 284); fall back to `false` on parse failure. `PENDING HUMAN DETERMINATION`.

> No `qa` test file exists; 6.1–6.3 are entirely untested. `PENDING HUMAN DETERMINATION`.

---

## 7. Dead-but-broken code (exported, no production caller — landmines)

### 7.1 `inverseNormalCdf` is catastrophically wrong (`monte-carlo/index.ts:69–107`) — G4/G5
**Defect.** The central branch reuses the variable `r` mid-computation and restructures the rational
approximation:
```ts
q = p - 0.5
r = q * q
r = q * ((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]   // r reassigned to numerator
return (r / ((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])) * r + 1 // denom at wrong argument
```
The canonical Acklam central formula is `x = num(r=q²) / den(r=q²)` with no leading `q·` and no outer
`·r + 1`. Measured output (G4/G5): for **every** p in (0.02425, 0.97575) the function returns ≈0.98–1.0
instead of the true Φ⁻¹ (e.g. p=0.6 → 0.9891 vs 0.2533), and antisymmetry is violated
(Φ⁻¹(p)+Φ⁻¹(1−p) ≈ 1.99, must be 0). The tail branches and the `p===0.5 → 0` special case mask the
breakage only at p=0.5.
**Failure scenario.** Used only by `latinHypercubeSampling` (normal strata, line 454). If LHS is ever
wired into the UI, every normal-stratum sample is collapsed to ~+1σ, producing a deterministic, wrong
distribution while looking valid.
**Proposed change.** Replace with a correct Acklam rational + one Halton refinement step (or invert the
proven-correct AS normal CDF by bisection). Add the antisymmetry property test (G5) and the table test
(G4). `PENDING HUMAN DETERMINATION`.

### 7.2 Latin Hypercube Sampling induces perfect inter-variable correlation (lines 428–439)
**Defect.** For each sample `i` the code builds `perm = [i, i, …, i]` (one value repeated across all
variables) then Fisher–Yates shuffles it — which is a no-op on identical elements. Consequently
`permutations[i][v] == i` for every variable `v`, so every variable occupies stratum `i` on the same
iteration. Correct LHS gives **each variable its own independent permutation** of {0…n−1}; sharing one
(identity) permutation forces perfect rank correlation and defeats the entire purpose of LHS.
**Failure scenario.** LHS output is perfectly correlated across inputs; variance reduction is zero (or
worse, biased) versus plain Monte Carlo.
**Proposed change.** Generate one independent shuffled permutation **per variable** (an
`nVars × n` matrix of `shuffle([0..n-1])`). Add a test asserting low rank-correlation between two
independent-variable strata. `PENDING HUMAN DETERMINATION`.

### 7.3 `sensitivityAnalysis` divides by `steps − 1` with no guard (line 507)
**Defect.** `factor = 1 − range + (2·range·i)/(steps − 1)` → NaN/±Infinity when `steps === 1`. Unlike
`scenario.ts#calculateSensitivity` (which validates `steps >= 2`, lines 203/210), this function does not.
**Failure scenario.** A caller passing `steps: 1` gets `NaN` means fed into `runMonteCarloSimulation`,
which then aborts (§3.2) with a confusing message.
**Proposed change.** Validate `steps >= 2` (or handle `steps === 1` as the base case). `PENDING HUMAN
DETERMINATION`.

### 7.4 `impliedVolatility` is unused but sound (`black-scholes.ts:229–269`)
Bisection on [0.0001, 5.0] with a convergence tolerance is standard; no numerical defect found. Only
its own test calls it. Listed for completeness; no change required. `PENDING HUMAN DETERMINATION`.

---

## 8. Comparable-company valuation — `src/services/valuation/comparable.ts` (LIVE)

### 8.1 Enterprise vs equity multiples are averaged into one "enterprise value" (lines 110–121, 134–137)
**Defect.** `enterpriseValue = round(averageValue)` where `averageValue` is the mean of **all** selected
multiple-implied values. But P/E and P/B imply **equity value**, while EV/EBITDA and EV/Revenue imply
**enterprise value**; averaging them conflates two different quantities. Likewise
`averageMultiple`/`medianMultiple` (134–137, 186–191) average the *multiple numbers themselves* across
heterogeneous types (e.g. (P/E + EV/EBITDA)/2) — a statistic with no financial meaning.
**Failure scenario.** Selecting P/E=15× and EV/EBITDA=8× on the same target yields an "average multiple"
of 11.5× and an EV that mixes equity and enterprise bases — a wrong number presented as authoritative.
**Standard.** Report EV-implied and equity-implied valuations separately; bridge equity↔EV with net
debt. Never average across multiple families.
**Proposed change.** Split outputs into `equityValue` (from P/E, P/B, P/S) and `enterpriseValue` (from
EV/EBITDA, EV/Revenue); drop or compartmentalize the cross-family `averageMultiple`. `PENDING HUMAN
DETERMINATION`.

### 8.2 EV/Revenue silently falls back to P/S (lines 159–163, 177–178)
**Defect.** `getTargetMetricForType('EV_REVENUE')` and `('PS')` both return `targetRevenue`, and
`getComparableMultiple('EV_REVENUE')` returns `company.evRevenue ?? company.psr` — i.e. an **enterprise**
multiple falls back to an **equity** multiple (price-to-sales) with no signal. P/S = market-cap/revenue;
EV/Revenue = enterprise-value/revenue. They differ by net debt and are not interchangeable.
**Proposed change.** Require `evRevenue` for EV/Revenue (fail/skip otherwise); do not fall back to `psr`.
`PENDING HUMAN DETERMINATION`.

---

## 9. Python service — numerical correctness (LIVE when microservice is wired)

### 9.1 Investing cash-flow sign is inverted (`cashflow_calculator.py:281–285`)
**Defect.** `change = previous_fixed − current_fixed`; on a purchase (`current_fixed` grows) `change < 0`,
`purchase = min(0, change)` is negative, `sale = 0`, and `net_cash = −purchase + sale` is **positive**.
An asset purchase (a cash **outflow**) is reported as a positive investing cash flow, and the stored
`purchase_of_fixed_assets` carries a negative sign while `net_cash_from_investing` carries the opposite
sign — internally inconsistent with standard CF presentation where purchases are outflows.
**Failure scenario.** A company that bought ¥2M of fixed assets reports +¥2M investing CF; total
net change in cash is overstated by ¥4M vs reality (purchase should subtract, not add).
**Proposed change.** Define purchases/sales as outflows/inflows consistently, e.g.
`net_cash = purchase + sale` with `purchase ≤ 0, sale ≥ 0` (or `net_cash = sale − |purchase|`), and keep
`purchase_of_fixed_assets` as a negative outflow. Add a golden test: prev_fixed=18M, curr=20M →
`net_cash_from_investing == -2_000_000`. `PENDING HUMAN DETERMINATION`.

### 9.2 JGAAP interest is double-counted (config 35–40; operating 112–114; financing 317–318)
**Defect.** Two interacting problems:
1. The config table sets `interest_as_operating = False` for **JGAAP**, but under JGAAP interest paid is
   classified as **operating** (it is *not* reclassified to financing). The flag is semantically inverted
   relative to the standard.
2. The two consumers of the flag use **different** guards: `_calculate_operating` removes interest only
   when `not interest_as_operating **and** standard == IFRS` (line 112), but `_calculate_financing`
   subtracts `interest_paid` whenever `not interest_as_operating` (line 317). For JGAAP
   (`interest_as_operating=False`, `standard != IFRS`): operating keeps interest (correct, via net_income),
   **and** financing subtracts it again → interest expense is deducted **twice**.

**Failure scenario.** A JGAAP company with interest expense E reports total net cash change understated
by E; the cash reconciliation in `validate_calculation` (375–384) will then mismatch
ending−beginning cash by E.
**Existing test encodes the bug.** `test_cashflow.py:178–180` asserts
`jgaap_calc.interest_as_operating is False`, locking the inverted flag in as "correct". A fix to JGAAP
must also update this test. `test_jgaap_calculation` (70–85) uses a fixture with no interest expense and
checks only `net_income`/`depreciation`, so the double-count is invisible to CI.
**Proposed change.** Make the operating and financing guards symmetric and JGAAP-correct: keep interest
in operating for JGAAP (no financing deduction); for IFRS move it operating→financing consistently; for
USGAAP keep operating. Update the test to assert the *cash-flow effect*, not just the flag. `PENDING HUMAN
DETERMINATION`.

### 9.3 `_calculate_other_non_cash` scans a receivable keyword inside liabilities (lines 257–260)
**Defect.** The "accrued" scan over `bs.liabilities.current` uses keywords `["未払", "未収"]`. `未収`
means **accrued revenue / receivable** (an asset), not a liability. If any `未収…` item is present in the
liabilities list it is summed as an accrued liability adjustment with the wrong sign semantics.
**Proposed change.** Drop `未収` from the liability-side keyword set (it belongs with receivables, line
164). `PENDING HUMAN DETERMINATION`.

### 9.4 KPI units are mixed within one result block (`kpi_calculator.py:83–86`)
**Defect.** `current_ratio`, `quick_ratio`, `equity_ratio` are multiplied by 100 (percentages), but
`debt_to_equity = liabilities/equity` is left as a raw ratio. A single `safety` dict therefore mixes
percent values and a ratio, so `current_ratio == 150` and `debt_to_equity == 0.5` coexist without units.
**Existing test.** `test_safety_kpis` (149–157) asserts only that the keys exist, not their values or
units, so the inconsistency is untested.
**Proposed change.** Pick one convention (ratios or percentages) for the whole block and document it; add
a value/unit assertion. `PENDING HUMAN DETERMINATION`.

### 9.5 Growth rate uses `abs(previous)` base; banker's rounding diverges from `precision.py` (lines 183–186, 13–14)
**Defect (a).** `_calculate_growth_rate = (current − previous)/abs(previous)·100`. For a negative base
(loss-making prior period) this reports a misleading signed growth — e.g. prev=−100→curr=+50 yields +150%,
and prev=−100→curr=−50 yields +50% (a narrowing loss reported as "growth"). Growth from a negative base is
conventionally undefined/flagged.
**Defect (b).** `round_to_2 = round(v·100)/100` uses Python's banker's rounding (round-half-to-even),
whereas `precision.py:17` standardizes on `ROUND_HALF_UP`. The KPI module does not import `precision.py`
at all (it uses `float` + builtin `round`), so the two services round inconsistently and KPI 0.5-cases
(e.g. 2.675) can differ from the CF service's output.
**Existing test gap.** `test_growth_kpis_with_previous` (159–167) uses a positive base (25% growth
asserted), so the `abs()` path is untested; no test asserts a rounding-mode outcome.
**Proposed change.** Flag/return `None` (or `N/A`) for negative-base growth, or document the `abs()`
choice; route rounding through `precision.round_decimal`/`ROUND_HALF_UP` for consistency. `PENDING HUMAN
DETERMINATION`.

---

## 10. Prioritization matrix (all `PENDING HUMAN DETERMINATION`)

| Priority | Finding | Why | Live? |
|----------|---------|-----|-------|
| P0 | §6.1 QA `passed` inverted | Silent green-light of error-laden valuations | Yes |
| P0 | §9.1 Python investing-CF sign | Wrong sign on every capex; breaks cash reconciliation | Yes* |
| P1 | §4.1 DCF −1%..−99% growth rejected | Cannot value declining businesses; validator disagrees | Yes |
| P1 | §9.2 JGAAP interest double-count | Understates net cash by interest expense; test locks bug | Yes* |
| P1 | §3.1–3.4 MC PRNG / abort / correlation / percentile | Biased bands, non-robust runs | Yes |
| P2 | §5.1 advisor D/E→D/V | Skews detailed WACC when advice is consumed | Yes |
| P2 | §8.1–8.2 comparable EV/equity conflation | Meaningless averages | Yes |
| P2 | §5.2 advisor `"it"` substring | Misclassifies many industries | Yes |
| P3 | §9.3–9.5 Python other/accrued/units/rounding | Correctness & consistency | Yes* |
| P3 | §7.1–7.3 dead code (inverseNormalCdf, LHS, sensitivity) | Landmines if wired up | No |
| P4 | §5.3 `lastUpdated` vintage, §5.4 notation, §4.3 rounding | Display/hygiene | Yes |

\* Python "live" contingent on the FastAPI microservice being deployed and called; `PENDING HUMAN
DETERMINATION` on deployment status.

---

## 11. Proposed test additions (property + golden) — `PENDING HUMAN DETERMINATION`

A. **Golden anchors (deterministic).** Pin G1 (DCF 14,462), G2 (WACC 5.8800%), G3 (BS 10.4506) to
within 1e-2 / 1e-4. These are the regression backbone.

B. **DCF property tests.**
- `growthRate ∈ {-5, -50, -99}` returns `success:true` and `EV > 0` (catches §4.1).
- `validateDCFInputs` and `calculateDCF` agree on acceptance for every growth rate in a sampled grid
  (catches the validator/calc split).
- `terminalGrowthRate >= discountRate` ⇒ failure; `EV == sum(periodPV) + terminalPV` to within rounding.

C. **Monte Carlo property tests (new `monte-carlo.test.ts`).**
- Seeded reproducibility: same seed ⇒ identical `distribution` (after sorting).
- Seeded independence: two independent normal variables from a large run have |Pearson r| < 0.05.
- Known-mean: normal(mean=100, std=1), formula `x`, 50k iters ⇒ `mean ∈ [99,101]`, `median ≈ mean`.
- `median == percentiles.p50` (catches §3.4).
- Robustness: a formula that occasionally overflows does **not** abort the whole run (catches §3.2).

D. **inverseNormalCdf property tests (for §7.1).**
- Antisymmetry: `inv(p) + inv(1−p) ≈ 0` for p ∈ {0.05…0.95}.
- Table: `inv({.1,.25,.5,.75,.9}) ≈ {-1.2816,-0.6745,0,0.6745,1.2816}` within 1e-3.

E. **LHS property test (for §7.2).** Two independent-variable strata have low Spearman correlation;
each variable's strata are a permutation of {0…n−1}.

F. **QA truth-table test (for §6.1).** Construct issues with only-errors ⇒ `passed===false`; only-warnings
⇒ `passed===true`; assert score deltas (−50/−10).

G. **Python golden/property tests.**
- `CashFlowCalculator(JGAAP)` with prev_fixed=18M→20M and an interest expense fixture ⇒ asserts
  `net_cash_from_investing == -2_000_000` (§9.1) and that interest is counted exactly once (§9.2).
- Cash reconciliation: `ending − beginning == net_change` for a fixture with interest (catches 9.1/9.2).
- `KPICalculator.safety` units are homogeneous (§9.4); growth from a negative base is flagged (§9.5).

All proposed tests are additive (new files / new `it()` blocks) and do not require modifying Class-A
production paths. `PENDING HUMAN DETERMINATION` on scope/ownership.

---

## 12. Verification method (how these numbers were produced)

Golden anchors and the `inverseNormalCdf` proof were computed with a standalone Node.js script:
- DCF/WACC/BS via the exact formulas in the reviewed files (no library calls).
- Correct Φ⁻¹ reference obtained by 80-step bisection on the Abramowitz–Stegun 7.1.26 normal CDF (the
  same `normalCDF` used in `black-scholes.ts`), which is correct to ~7.5e-8.
- The reviewed `inverseNormalCdf` was transcribed symbol-for-symbol from `monte-carlo/index.ts:69–107`.
Liveness was determined by `grep` for symbol references across `src/**` and `tests/**`. File/line
citations refer to the source as read during this review.

---

*End of REV-VAL-01 proposal. This is analysis only; all conclusions are `PENDING HUMAN DETERMINATION`.
No source file, schema, migration, or Class-A path was modified. No reviewer, approver, or sign-off is
named herein.*

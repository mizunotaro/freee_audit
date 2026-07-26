# SPDX-License-Identifier: MIT
"""Phase-3: financial-analysis features (owner-requested).
予実(journal-level variance) / 資金繰り+Runway(base/pess/optimistic) /
経営管理指標 + 財務会計・管理会計分析.

Doctrine: financial correctness is money-critical. So:
  - the METHODOLOGY/formulas go into docs/proposals/ for the owner to review
    (audit-only);
  - the ENGINEERING (scenario engine, aggregation, API, UI, tests) is built in
    NON-Class-A services (budget/cashflow/analytics), but every implementation
    PR must be labelled `human-review-required` + `do-not-auto-merge` so the
    owner reviews the numbers before merge (auto_merger skips deny-labelled PRs);
  - the kpi service (Class-A) gets a proposal only.
Idempotent; atomic. Run from repo root."""
from __future__ import annotations
import json, os, tempfile
from pathlib import Path
import importlib.util

_spec = importlib.util.spec_from_file_location("_p1", str(Path(__file__).parent / "seed_phase1.py"))
_p1 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_p1)
T, audit, CLASS_A_BAN = _p1.T, _p1.audit, _p1.CLASS_A_BAN
ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "records" / "pm" / "task_queue.json"
PROMPTS = ROOT / "records" / "pm" / "prompts"

# Implementation rules for FINANCIAL-OUTPUT features: worker may build in the
# named non-Class-A service, but the result is money-critical -> owner review.
FIN_IMPL = (
    "## Constraints (financial output — non-negotiable)\n"
    + CLASS_A_BAN +
    "- Journal/ledger and any Class-A data are READ-ONLY inputs here; compute in "
    "the named non-Class-A service only.\n"
    "- Base every formula on a cited, standard definition (name it in code + PR "
    "body). Where the correct treatment is judgemental, mark it "
    "`// PENDING HUMAN DETERMINATION` and default to the most conservative option.\n"
    "- Add GOLDEN/property tests: hand-computed expected numbers for representative "
    "inputs, plus edge cases (zero/negative/missing periods). Real assertions only; "
    "no fake green.\n"
    "- New helpers return `Result<T,E>`; inputs validated with Zod `safeParse`.\n"
    "- **This is financial output: the PR MUST be labelled `human-review-required` "
    "and `do-not-auto-merge`, and the PR body MUST list every formula/assumption "
    "for the owner to verify.** Do NOT let it auto-merge.\n"
    "- Additive/strengthening; reuse existing modules named in scope; no new deps.\n\n"
    "## Definition of done\n- `node scripts/autopm_verify.mjs --changed-only` exits 0.\n"
    "- Golden tests pass; PR labelled human-review-required + do-not-auto-merge with "
    "the formula list in the body.\n"
)

SEEDS = [
  # ===== A. Design proposals (owner reviews the math) — audit-only =====
  audit("fin-design-01", 300,
        "DESIGN: journal-level budget-variance attribution methodology (予実要因分析)",
        "Read existing budget code (src/services/budget/{actual-vs-budget,detailed-actual-vs-budget,"
        "budget-service}.ts) and how journals/actuals are sourced (read-only). Design a "
        "methodology to attribute budget-vs-actual variance DOWN TO THE JOURNAL ENTRY: "
        "per account/department/period, decompose total variance into drivers (e.g. "
        "price vs volume vs mix vs timing), rank the journal entries that most explain "
        "each variance, and define the data model + API/response shape + edge cases "
        "(missing budget, reclassifications, accruals). Cite standard variance-analysis "
        "definitions. Conclusions PENDING HUMAN DETERMINATION.",
        "fin-design-01-variance-attribution.md"),
  audit("fin-design-02", 301,
        "DESIGN: cashflow + Runway 3-scenario model (通常/悲観/強気)",
        "Read src/services/cashflow/{calculator,cash-position,runway-calculator}.ts (read-only). "
        "Design a scenario model that produces base / pessimistic / optimistic projections for "
        "cash position, monthly burn, and Runway (months to zero cash). Define each scenario's "
        "parameter set (revenue growth, collection timing/DSO, churn, cost inflation, one-offs), "
        "the formulas, sensitivity handling, and the response shape. Cite standard "
        "burn/Runway definitions (net burn, gross burn, Runway = cash / net monthly burn). "
        "Conclusions PENDING HUMAN DETERMINATION.",
        "fin-design-02-cashflow-scenarios.md"),
  audit("fin-design-03", 302,
        "DESIGN: management + financial accounting analysis catalog (経営管理指標/財務会計/管理会計)",
        "Read src/services/analytics/{financial-kpi,kpi}.ts and existing analysis routes "
        "(read-only). Catalog the metrics to add/strengthen across: FINANCIAL ACCOUNTING "
        "(BS/PL/CF ratios: profitability ROE/ROA/ROIC, liquidity current/quick, leverage, "
        "efficiency turnover, growth) and MANAGEMENT ACCOUNTING (contribution margin, "
        "CVP/break-even, cost behaviour fixed/variable split, segment profitability, "
        "budget/standard-cost variance). For each: definition, formula, inputs, and any "
        "judgemental assumption (PENDING HUMAN DETERMINATION). Note which already exist "
        "vs new.",
        "fin-design-03-accounting-metrics.md"),
  audit("fin-design-04", 303,
        "DESIGN: strengthening the Class-A kpi service (custom KPI engine)",
        "Read src/services/kpi/custom-kpi-service.ts (Class-A, READ-ONLY). Propose how to "
        "strengthen custom-KPI definition/validation/computation to support the metrics in "
        "fin-design-03 safely (formula validation, unit consistency, divide-by-zero, period "
        "alignment). Implementation stays human-owned (Class-A); this is the proposal.",
        "fin-design-04-kpi-engine.md"),

  # ===== B. Implementation (non-Class-A services; owner-reviewed PRs) =====
  T("fin-impl-01", "予実 journal-level variance-attribution module (strengthen budget service)", "B", 310,
    ["src/services/budget", "tests/unit/services/budget"],
    "## Goal\nImplement journal-level budget-variance attribution in `src/services/budget` "
    "(strengthen `detailed-actual-vs-budget.ts`; add a `variance-attribution.ts`). Per "
    "account/department/period: total variance, driver decomposition (price/volume/mix/"
    "timing), and the ranked journal entries explaining each variance. Follow "
    "docs/proposals/fin-design-01 if present; otherwise implement standard variance "
    "analysis and note assumptions. Journals are read-only inputs.\n\n" + FIN_IMPL),
  T("fin-impl-02", "3-scenario cashflow + Runway engine (通常/悲観/強気) (strengthen cashflow service)", "B", 311,
    ["src/services/cashflow", "tests/unit/services/cashflow"],
    "## Goal\nAdd a scenario engine to `src/services/cashflow` (strengthen "
    "`runway-calculator.ts` + `calculator.ts`; add `scenario-engine.ts`) producing "
    "base/pessimistic/optimistic projections for cash position, net/gross burn, and Runway. "
    "Parameterize each scenario (revenue growth, DSO, churn, cost inflation, one-offs). "
    "Follow docs/proposals/fin-design-02 if present. Golden tests for each scenario.\n\n" + FIN_IMPL),
  T("fin-impl-03", "Management-accounting analysis module (CVP/contribution/break-even/segment)", "B", 312,
    ["src/services/analytics", "tests/unit/services/analytics"],
    "## Goal\nAdd a management-accounting module to `src/services/analytics` (e.g. "
    "`managerial-accounting.ts`): contribution margin, CVP/break-even, fixed/variable cost "
    "behaviour split, segment profitability. Follow docs/proposals/fin-design-03 if present. "
    "Golden tests with hand-computed expectations.\n\n" + FIN_IMPL),
  T("fin-impl-04", "Financial-accounting ratio analysis strengthening (analytics)", "B", 313,
    ["src/services/analytics", "tests/unit/services/analytics"],
    "## Goal\nStrengthen `src/services/analytics/financial-kpi.ts` with a complete, tested "
    "financial-ratio set (profitability ROE/ROA/ROIC, liquidity current/quick, leverage, "
    "efficiency turnovers, growth) per docs/proposals/fin-design-03. Golden tests; "
    "divide-by-zero + missing-period handling.\n\n" + FIN_IMPL),
  T("fin-api-01", "API endpoints for variance / scenarios / managerial analysis (non-Class-A)", "B", 314,
    ["src/app/api/analysis", "tests/integration"],
    "## Goal\nExpose the new budget-variance, cashflow-scenario, and managerial-accounting "
    "capabilities via new route handlers under `src/app/api/analysis/**` (NOT under Class-A "
    "api paths). Zod-validate inputs (400 on bad), auth guard, Result<T,E>. Integration "
    "tests. Financial output -> label the PR human-review-required + do-not-auto-merge.\n\n" + FIN_IMPL),
  T("fin-ui-01", "UI: variance waterfall, scenario-Runway chart, managerial dashboards", "C", 315,
    ["src/components/charts", "src/components/reports", "tests/components"],
    "## Goal\nAdd presentational components: a variance waterfall/bridge chart (drivers), a "
    "Runway chart showing base/pessimistic/optimistic bands, and managerial-accounting "
    "dashboard cards (contribution margin, break-even). Reuse existing chart components "
    "(BudgetVsActualChart, CashFlowChart, KPIGauge). UI layer only — call the new APIs; do "
    "NOT embed financial formulas in components (they live in services). Loading/error/empty "
    "states + tests.\n\n" + _p1.COMMON),
]

def main() -> int:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    existing = {t["id"] for t in data.get("tasks", [])}
    PROMPTS.mkdir(parents=True, exist_ok=True); added = 0
    for s in SEEDS:
        t, prompt = s["task"], s["prompt"]
        if t["id"] in existing:
            print("skip (exists):", t["id"]); continue
        (PROMPTS / f"{t['id']}.md").write_text(prompt, encoding="utf-8", newline="\n")
        data["tasks"].append(t); added += 1
        print(f"seeded {t['id']:16s} rc={t['risk_class']} prio={t['priority']}")
    fd, tmp = tempfile.mkstemp(dir=str(QUEUE.parent), suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, QUEUE)
    print(f"\nseeded {added}; queue total {len(data['tasks'])}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

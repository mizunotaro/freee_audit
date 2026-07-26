# SPDX-License-Identifier: MIT
"""Phase-6: polish toward a "complete" non-Class-A system. All prior waves done
(done>170, worker-eligible backlog=0). This registers the remaining genuinely-
valuable non-Class-A engineering: full E2E business-flow coverage, CI perf/
quality gates, test-quality follow-through, contract tests, and CI speed.
Class-A stays human-gated. Idempotent; atomic."""
from __future__ import annotations
import json, os, tempfile
from pathlib import Path
import importlib.util

_spec = importlib.util.spec_from_file_location("_p1", str(Path(__file__).parent / "seed_phase1.py"))
_p1 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_p1)
T, COMMON = _p1.T, _p1.COMMON
ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "records" / "pm" / "task_queue.json"
PROMPTS = ROOT / "records" / "pm" / "prompts"

SEEDS = [
  # ---- Full E2E business-flow coverage (mock mode) ----
  T("e2e-flow-04", "E2E: financial-statement reports (BS/PL/CF) render + export", "C", 500,
    ["tests/e2e"],
    "## Goal\nE2E (mock mode) for the core reports flow: open BS, PL and CF views, "
    "assert each renders its key figures, switch periods, and export one format. "
    "Deterministic selectors, no sleeps. UI-level only.\n\n" + COMMON),
  T("e2e-flow-05", "E2E: journal list/detail + data-quality flags view", "C", 501,
    ["tests/e2e"],
    "## Goal\nE2E (mock mode) for the journal list→detail flow and the data-quality "
    "flags surface (from dq-01): list renders, filters apply, a flagged entry shows "
    "its reason. Read-only UI (verdict logic is Class-A/mocked).\n\n" + COMMON),
  T("e2e-flow-06", "E2E: cashflow + Runway scenario view (通常/悲観/強気)", "C", 502,
    ["tests/e2e"],
    "## Goal\nE2E (mock mode) for the cashflow/Runway scenario UI (fin-impl-02/fin-ui): "
    "the three scenario bands render, toggling a scenario updates the chart, and Runway "
    "months display. UI-level only.\n\n" + COMMON),
  T("e2e-flow-07", "E2E: navigation, auth-guard redirects, 404/error boundaries", "C", 503,
    ["tests/e2e"],
    "## Goal\nE2E (mock mode): unauthenticated access to a protected route redirects to "
    "login; a bad URL shows the 404/error boundary; primary nav links resolve. No "
    "Class-A auth changes — exercise existing behavior only.\n\n" + COMMON),

  # ---- CI quality/perf gates (wire the harnesses that already exist) ----
  T("perf-gate-01", "Wire the perf benchmark (perf-bench-01) into CI as a non-blocking report", "B", 510,
    [".github/workflows", "tests/benchmark"],
    "## Goal\nAdd a NON-required CI job that runs the existing benchmark harness "
    "(tests/benchmark, from perf-bench-01) on a small synthetic set and uploads the "
    "timing JSON as an artifact, so perf regressions are visible per-PR. Keep it "
    "non-required (does not gate merge). No Class-A changes.\n\n" + COMMON),
  T("ci-cache-01", "Speed up CI: cache Prisma client + build artifacts across jobs", "C", 511,
    [".github/workflows"],
    "## Goal\nReduce CI wall-time: cache the generated Prisma client and any "
    "reusable build output across the parallel jobs (actions/cache), avoiding "
    "regenerating per shard. Verify all required jobs still pass. CI config only; no "
    "new dependencies; do not weaken any gate.\n\n" + COMMON),

  # ---- Test-quality follow-through (act on the testq-01 report) ----
  T("testq-02", "Strengthen the weakest tests flagged by docs/proposals/testq-01.md", "C", 520,
    ["docs/proposals/testq-01.md", "tests/unit"],
    "## Goal\nRead docs/proposals/testq-01.md (the assertion-strength audit). For the "
    "weakest NON-Class-A test files it ranks (assertion-free, toBeDefined-only, "
    "snapshot-only), add real behavioural assertions. Do NOT touch Class-A test "
    "targets. Re-run the quality script if present to confirm improvement.\n\n" + COMMON),

  # ---- Contract tests ----
  T("contract-01", "Response-schema contract tests for non-Class-A analysis API routes", "C", 530,
    ["src/app/api/analysis", "tests/integration"],
    "## Goal\nAdd contract tests asserting the RESPONSE shape (Zod schema or explicit "
    "shape assertions) of the non-Class-A analysis routes, so an accidental shape "
    "change is caught. Reuse existing schemas where defined. No Class-A routes.\n\n" + COMMON),

  # ---- Remaining a11y + edge depth ----
  T("a11y-02", "A11y + states: reports/charts/currency/chat remaining component groups", "C", 540,
    ["src/components", "tests/components"],
    "## Goal\nComplete the a11y/states pass (aria, keyboard nav, loading/error/empty) "
    "for the remaining UI component groups not covered by a11y-01. UI layer only.\n\n" + COMMON),
  T("edge-03", "Edge/error-branch depth: benchmark/external-info/inventory/peer-companies", "C", 541,
    ["src/services", "tests/unit/services"],
    "## Goal\nAdd under-covered error/edge-branch tests for these non-Class-A services "
    "(empty/zero/negative/missing-period/boundary). Real assertions; no Class-A.\n\n" + COMMON),

  # ---- README / developer onboarding ----
  T("doc-readme-01", "Refresh README/CONTRIBUTING: setup, scripts, test/CI, Class-A boundary", "C", 550,
    ["README.md", "CONTRIBUTING.md"],
    "## Goal\nEnsure README + CONTRIBUTING accurately describe: local setup, the key "
    "scripts, how to run unit/integration/e2e tests, the CI shape (sharded unit + "
    "gates), and the Class-A boundary (human-owned paths, do-not-edit). Docs only; if "
    "a file is protected/owned, propose the change in the PR body instead.\n\n" + COMMON),

  # ---- Complete Result<T,E> across any remaining non-Class-A surface ----
  T("err-06", "Finish Result<T,E> in any remaining non-Class-A services + call sites", "C", 560,
    ["src/services", "src/lib"],
    "## Goal\nSweep the remaining NON-Class-A services/lib for expected-failure "
    "`throw`s not yet converted to Result<T,E>; convert them + same-module call sites; "
    "add error-branch tests. If a module is fully converted already, note it and move "
    "on. Never change Class-A signatures.\n\n" + COMMON),
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
